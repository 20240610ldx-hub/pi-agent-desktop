import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });

test("review syntax colors YAML without changing Chinese, empty lines, tabs or CRLF", async () => {
  const { tokenizeReviewSource } = await jiti.import("./review-syntax.ts");
  const source = 'name: "中文"\r\n\r\nrun: echo "$HOME"\t# 注释\r\n';
  const tokens = tokenizeReviewSource(source, ".github/workflows/test.yml");
  assert.equal(tokens.map((token) => token.text).join(""), source);
  assert.ok(tokens.some((token) => token.tone === "property" && token.text.includes("name")));
  assert.ok(tokens.some((token) => token.tone === "string" && token.text.includes("中文")));
});

test("YAML plain scalars share string color while explicit keys, numbers, nulls and comments keep their own tones", async () => {
  const { tokenizeReviewSource } = await jiti.import("./review-syntax.ts");
  const source = 'id: version\r\nshell: bash\r\nname: Upload installer\r\nquoted: "中文"\r\ncount: 3\r\nflag: true\r\nempty: null\r\nlist: [alpha, beta]\r\nmap: {name: value}\r\n# comment\r\nrun: |\r\n  echo "$HOME"\r\n';
  for (const path of ["workflow.yml", "workflow.yaml"]) {
    const tokens = tokenizeReviewSource(source, path);
    assert.equal(tokens.map((part) => part.text).join(""), source);
    for (const literal of ["version", "bash", "Upload installer", "中文", "alpha", "beta", "value", 'echo "$HOME"']) {
      assert.ok(tokens.some((part) => part.tone === "string" && part.text.includes(literal)), `${path}: ${literal}`);
    }
    assert.ok(tokens.some((part) => part.tone === "property" && part.text === "id"));
    assert.ok(tokens.some((part) => part.tone === "number" && part.text === "3"));
    assert.ok(tokens.some((part) => part.tone === "keyword" && part.text === "true"));
    assert.ok(tokens.some((part) => part.tone === "keyword" && part.text === "null"));
    assert.ok(tokens.some((part) => part.tone === "comment" && part.text === "# comment"));
    assert.ok(tokens.some((part) => part.tone === "punctuation" && part.text.includes(":")));
  }
});

test("word marks intersect syntax spans safely, including source that looks like HTML", async () => {
  const { tokenizeReviewSource, markReviewSyntax, renderReviewSyntax } = await jiti.import("./review-syntax.ts");
  const { reviewWordParts } = await jiti.import("./git-review-display.ts");
  const { createElement } = await jiti.import("react");
  const { renderToStaticMarkup } = await jiti.import("react-dom/server");
  const source = 'name: "<img src=x onerror=alert(1)>中文"';
  const before = 'name: "old"';
  const result = markReviewSyntax(tokenizeReviewSource(source, "test.yaml"), reviewWordParts(before, source).new);
  assert.equal(result.map((part) => part.text).join(""), source);
  assert.ok(result.some((part) => part.changed && part.tone === "string" && part.text.includes("中文")));
  const html = renderToStaticMarkup(createElement("code", null, renderReviewSyntax(result)));
  assert.ok(html.includes("<mark>"));
  assert.ok(html.includes("changes-syntax-string"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("<script"));
});

test("multiline shell syntax keeps heredoc state and empty lines without inventing source text", async () => {
  const { tokenizeReviewLines } = await jiti.import("./review-syntax.ts");
  const lines = ["cat <<EOF", "中文 <tag>", "", "EOF", 'echo "$HOME"'];
  const highlighted = tokenizeReviewLines(lines, "scripts/check.sh");
  assert.deepEqual(highlighted.map((line) => line.map((part) => part.text).join("")), lines);
  assert.ok(highlighted[1].some((part) => part.tone === "string"));
  assert.ok(highlighted[4].some((part) => part.tone === "variable" && part.text === "$HOME"));
});

test("unknown languages, long lines and oversized hunks fall back to exact plain source", async () => {
  const { tokenizeReviewSource, tokenizeReviewLines, markReviewSyntax } = await jiti.import("./review-syntax.ts");
  const source = '<script>alert("中文")</script>\r\n';
  assert.deepEqual(tokenizeReviewSource(source, "note.unknown-language"), [{ text: source, tone: "plain" }]);
  const long = 'name: "' + "中".repeat(5000) + '"';
  assert.deepEqual(tokenizeReviewSource(long, "large.yml"), [{ text: long, tone: "plain" }]);
  const lines = Array.from({ length: 1001 }, () => "name: value");
  assert.ok(tokenizeReviewLines(lines, "large.yml").every((line) => line.every((part) => part.tone === "plain")));
  const tokens = tokenizeReviewSource("name: value", "small.yml");
  assert.deepEqual(markReviewSyntax(tokens, [{ text: "different", changed: true }]), tokens);
});

test("file extension aliases use the already registered canonical grammar", async () => {
  const { tokenizeReviewSource } = await jiti.import("./review-syntax.ts");
  for (const [alias, canonical, source] of [
    ["ps1", "powershell", 'Write-Host "中文" $env:HOME'],
    ["jsonc", "json", '{"name": "中文"}'], ["jsonl", "json", '{"name": "中文"}'],
    ["h", "c", "int count = 2;"], ["gql", "graphql", "query Items { items { id } }"],
    ["sh", "bash", 'echo "$HOME"'], ["html", "markup", '<p title="中文">safe</p>'], ["js", "javascript", 'const name = "中文";'],
  ]) {
    const tokens = tokenizeReviewSource(source, `file.${alias}`);
    assert.deepEqual(tokens, tokenizeReviewSource(source, `file.${canonical}`), alias);
    assert.ok(tokens.some((part) => part.tone !== "plain"), alias);
  }
});

test("old and new hunk sides color independently and never inherit state across omitted source", async () => {
  const { tokenizeReviewCells } = await jiti.import("./review-syntax.ts");
  const { parseUnifiedPatch } = await jiti.import("./patch.ts");
  const rows = parseUnifiedPatch('--- a/check.sh\n+++ b/check.sh\n@@ -1,3 +1,3 @@\n-cat <<EOF\n+echo start\n body\n EOF\n@@ -30 +30 @@\n-echo old\n+echo new\n')[0].rows;
  const cells = tokenizeReviewCells(rows, "check.sh");
  const body = rows.find((row) => row.type === "line" && row.left.text === "body");
  assert.ok(cells.get(body.left).some((part) => part.tone === "string"));
  assert.ok(cells.get(body.right).every((part) => part.tone !== "string"));
  const last = rows.at(-1);
  assert.ok(cells.get(last.left).some((part) => part.tone === "function" && part.text === "echo"));
  for (const row of rows) {
    if (row.type !== "line") continue;
    assert.equal(cells.get(row.left).map((part) => part.text).join(""), row.left.text);
    assert.equal(cells.get(row.right).map((part) => part.text).join(""), row.right.text);
  }
});
