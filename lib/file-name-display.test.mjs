import assert from "node:assert/strict";
import test from "node:test";

const { splitFileName } = await import("./file-name-display.ts");

test("file labels separate the final extension while preserving the complete name", () => {
  for (const [name, stem, extension] of [
    ["index.tsx", "index", ".tsx"],
    ["archive.tar.gz", "archive.tar", ".gz"],
    [".env", ".env", ""],
    [".env.local", ".env", ".local"],
    ["README", "README", ""],
    ["trailing.", "trailing.", ""],
    ["", "", ""],
  ]) {
    assert.deepEqual(splitFileName(name), { stem, extension });
    const result = splitFileName(name);
    assert.equal(result.stem + result.extension, name);
  }
});

test("CSS owns truncation so combining characters, emoji and long suffixes stay lossless", () => {
  for (const name of ["项目👩🏽‍💻é配置文件.ts", "中".repeat(300) + ".tsx", "file." + "extension".repeat(100), "👨‍👩‍👧‍👦", "<img onerror=x>.html"]) {
    const result = splitFileName(name);
    assert.equal(result.stem + result.extension, name);
    assert.ok(!result.stem.includes("…"));
  }
});

test("a dot in a directory never becomes a file extension", () => {
  assert.deepEqual(splitFileName("folder.name/README"), { stem: "folder.name/README", extension: "" });
  assert.deepEqual(splitFileName("folder.name\\.env"), { stem: "folder.name\\.env", extension: "" });
  assert.deepEqual(splitFileName("folder.name/file.ts"), { stem: "folder.name/file", extension: ".ts" });
});
