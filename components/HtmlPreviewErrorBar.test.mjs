import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { HtmlPreviewErrorBar, formatPreviewErrors } = await jiti.import("./HtmlPreviewErrorBar.tsx");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");

const render = (props) => renderToStaticMarkup(React.createElement(I18nProvider, null, React.createElement(HtmlPreviewErrorBar, props)));

test("fences errors so backticks inside cannot close the block", () => {
  assert.equal(formatPreviewErrors(["a", "b"]), "```\na\nb\n```");
  assert.equal(formatPreviewErrors(["x ``` y"]), "````\nx ``` y\n````");
});

test("renders nothing without errors and offers a fix only when possible", () => {
  assert.equal(render({ errors: [], onDismiss() {} }), "");
  const withFix = render({ errors: ["boom", "bang"], onFix() {}, onDismiss() {} });
  assert.match(withFix, /role="alert"/);
  assert.match(withFix, /boom/);
  assert.match(withFix, /\+1 more/);
  assert.match(withFix, /Ask to fix/);
  assert.doesNotMatch(render({ errors: ["boom"], onDismiss() {} }), /Ask to fix/);
});

test("offers an explicit retry for failures and a save-specific error title", () => {
  const html = render({ errors: ["disk <full>"], title: "Download file · Failed", onRetry() {}, onDismiss() {} });
  assert.match(html, /Download file · Failed/);
  assert.match(html, /disk &lt;full&gt;/);
  assert.match(html, />Retry<\/button>/);
  assert.doesNotMatch(html, /Ask to fix|The page hit an error/);
  assert.doesNotMatch(render({ errors: ["boom"], onDismiss() {} }), />Retry<\/button>/);
});

// Exercise the actual consumer's download closure. Only the OS dialog/save
// boundary is doubled; Blob creation, content and URL cleanup remain real.
for (const file of ["ArtifactPanel.tsx", "HtmlPreviewBlock.tsx"]) {
  const text = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const find = (node, predicate) => predicate(node) ? node : ts.forEachChild(node, (child) => find(child, predicate));
  const downloadNode = find(source, (node) => ts.isVariableDeclaration(node) && node.name.getText(source) === "download");
  const mimeNode = find(source, (node) => ts.isVariableStatement(node) && /^(?:const MIME_TYPES|const KIND_MIME)/.test(node.getText(source)));
  const compile = (value) => ts.transpileModule(value, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const { artifactFileName } = await jiti.import("../lib/artifacts.ts");
  const { htmlPreviewFileName } = await jiti.import("../lib/html-preview.ts");
  for (const result of ["fail", "cancel", "success"]) {
    test(`${file} save ${result} keeps content and releases its Blob URL`, async () => {
      const saved = [], errors = [], revoked = [];
      const content = "<!doctype html><p>original document</p>";
      const version = { content, type: "html", lang: "html", complete: true };
      const download = runInNewContext(`${compile(mimeNode.getText(source))}\n${compile(`const download = ${downloadNode.initializer.getText(source)}`)}\ndownload`, {
        version, code: content, kind: "html", identifier: "demo", Blob, Error,
        URL: {
          createObjectURL: (blob) => URL.createObjectURL(blob),
          revokeObjectURL: (url) => { revoked.push(url); URL.revokeObjectURL(url); },
        },
        artifactFileName, htmlPreviewFileName,
        setSaveError: (error) => errors.push(error),
        setTimeout: (callback) => queueMicrotask(callback),
        downloadUrlAsFile: async (url, name) => {
          const response = await fetch(url);
          saved.push({ url, name, content: await response.text(), mime: response.headers.get("content-type") });
          if (result === "fail") throw new Error("disk full");
          return result !== "cancel";
        },
      });
      download();
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(saved.length, 1);
      assert.equal(saved[0].content, content);
      assert.equal(saved[0].name, file === "ArtifactPanel.tsx" ? "demo.html" : "page.html");
      assert.equal(saved[0].mime, "text/html;charset=utf-8");
      assert.deepEqual(revoked, [saved[0].url]);
      if (result === "fail") {
        assert.equal(errors.at(-1).message, "disk full");
        assert.equal(file === "ArtifactPanel.tsx" ? errors.at(-1).version : errors.at(-1).code, file === "ArtifactPanel.tsx" ? version : content);
      } else {
        assert.deepEqual(errors, [null]);
      }
    });
  }
}
