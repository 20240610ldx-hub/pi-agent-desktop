import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sizeLimitToBytes(value) {
  if (typeof value === "number") return value;
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i.exec(value.trim());
  assert.ok(match, `unparseable SizeLimit: ${value}`);
  const units = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
  return Number(match[1]) * units[match[2].toLowerCase()];
}

test("scopes Next.js output file tracing to the pi-web package", async () => {
  const config = await createJiti(import.meta.url).import("../next.config.ts", { default: true });

  assert.equal(config.outputFileTracingRoot, projectRoot);
});

test("raises the proxy body buffer above the upload route's 100 MB request cap", async () => {
  const config = await createJiti(import.meta.url).import("../next.config.ts", { default: true });

  assert.ok(sizeLimitToBytes(config.experimental.proxyClientMaxBodySize) > 100 * 1024 * 1024);
});

test("native build outputs and test artifacts do not invalidate the frontend watcher", async () => {
  const config = await createJiti(import.meta.url).import("../next.config.ts", { default: true });
  const defaults = Object.freeze({ ignored: /node_modules|custom-default/i, aggregateTimeout: 5 });
  const result = config.webpack({ module: { rules: [] }, watchOptions: defaults }, { dev: true });
  for (const file of ["D:/pilaude/src-tauri/target/release/deps/file.o", "D:\\pilaude\\src-tauri\\target\\debug\\app.exe", "D:/pilaude/test-results/check.log", "D:/pilaude/.next-desktop/server/app.js"]) {
    assert.ok(result.watchOptions.ignored.test(file), file);
  }
  for (const file of ["D:/pilaude/src-tauri/src/lib.rs", "D:/pilaude/components/AppShell.tsx", "D:/pilaude/test-results-source/input.ts"]) {
    assert.equal(result.watchOptions.ignored.test(file), false, file);
  }
  assert.ok(result.watchOptions.ignored.test("CUSTOM-DEFAULT"));
  assert.equal(result.watchOptions.aggregateTimeout, 5);
  const production = config.webpack({ module: { rules: [] }, watchOptions: defaults }, { dev: false });
  assert.equal(production.watchOptions, defaults);
});
