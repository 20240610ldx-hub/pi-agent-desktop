import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const { createOutputStyleStore } = await createJiti(import.meta.url).import("./output-style-store.ts");

test("custom styles can be created, listed and edited without overwriting other definitions", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "pi-output-styles-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "output-styles.json");
  const store = createOutputStyleStore(path);
  assert.deepEqual(store.list(), []);
  const first = store.create({ name: " Technical notes ", instructions: " Explain key assumptions. " });
  assert.match(first.id, /^custom:[a-f\d-]{36}$/);
  assert.equal(first.name, "Technical notes");
  assert.equal(first.instructions, "Explain key assumptions.");
  assert.equal(first.builtin, false);
  const second = store.create({ name: "Examples", instructions: "Show a small example." });
  const stored = JSON.parse(readFileSync(path, "utf8"));
  writeFileSync(path, JSON.stringify({ ...stored, futureSetting: true }));
  const reopened = createOutputStyleStore(path);
  reopened.update({ id: first.id, name: "Notes", instructions: "State tradeoffs clearly." });
  assert.deepEqual(reopened.list(), [{ ...first, name: "Notes", instructions: "State tradeoffs clearly." }, second]);
  assert.equal(JSON.parse(readFileSync(path, "utf8")).futureSetting, true);
});

test("custom definitions reject empty, oversized or invalid values and cannot replace built-ins", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "pi-output-style-validation-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = createOutputStyleStore(join(directory, "styles.json"));
  for (const input of [null, { name: "", instructions: "x" }, { name: "x".repeat(81), instructions: "x" }, { name: "x", instructions: "x".repeat(16001) }, { name: "bad\u0000name", instructions: "x" }, { name: "x", instructions: "bad\u0000instruction" }]) {
    assert.throws(() => store.create(input), /name|instructions|object/);
  }
  assert.throws(() => store.update({ id: "concise", name: "Changed", instructions: "Override built-in" }), /custom.*ID/);
  assert.throws(() => store.update({ id: "custom:00000000-0000-0000-0000-000000000000", name: "Missing", instructions: "Missing" }), /Unknown/);
  assert.deepEqual(store.list(), []);
});

test("malformed, oversized and non-regular stores are refused without overwriting them", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "pi-output-style-regular-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "styles.json");
  writeFileSync(path, "{broken");
  const store = createOutputStyleStore(path);
  assert.throws(() => store.list());
  assert.throws(() => store.create({ name: "Example", instructions: "Example" }));
  assert.equal(readFileSync(path, "utf8"), "{broken");
  writeFileSync(path, " ".repeat(1024 * 1024 + 1));
  assert.throws(() => store.list(), /could not be read/);
  const folder = join(directory, "folder");
  mkdirSync(folder);
  assert.throws(() => createOutputStyleStore(folder).list(), /could not be read/);
});

test("store parse failures never expose malformed instruction contents", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "pi-output-style-private-error-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const marker = "PRIVMARK42";
  const path = join(directory, "styles.json");
  writeFileSync(path, `{"instructions": ${marker}}`);
  const store = createOutputStyleStore(path);
  for (const operation of [() => store.list(), () => store.create({ name: "Valid", instructions: "Valid" })]) {
    assert.throws(operation, (error) => {
      assert.equal(error.message.includes(marker), false, "parse failures must not expose stored text");
      assert.equal(error.message.includes(directory), false, "store failures must not expose private paths");
      return true;
    });
  }
});
