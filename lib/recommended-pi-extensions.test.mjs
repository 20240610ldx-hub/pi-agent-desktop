import assert from "node:assert/strict";
import test from "node:test";

test("the requested eight extensions have explicit desktop integration states", async () => {
  const { RECOMMENDED_PI_EXTENSIONS } = await import("./recommended-pi-extensions.ts");
  assert.deepEqual(RECOMMENDED_PI_EXTENSIONS.map(item => item.id), [
    "@juicesharp/rpiv-todo", "pi-web-access", "pi-powerline-footer", "@gotgenes/pi-permission-system",
    "pi-subagents", "@plannotator/pi-extension", "pi-background-tasks", "@narumitw/pi-usage",
  ]);
  assert.equal(new Set(RECOMMENDED_PI_EXTENSIONS.map(item => item.id)).size, 8);
  for (const item of RECOMMENDED_PI_EXTENSIONS) {
    assert.ok(item.version && item.license && item.reasonKey && item.descriptionKey);
    assert.ok(item.sourceUrls.every(url => new URL(url).protocol === "https:"));
    if (item.status === "extension") assert.equal(item.installSource, `npm:${item.id}@${item.version}`);
    else assert.equal(item.installSource, undefined, "unsupported or existing capabilities cannot load a second extension");
  }
});

test("TUI-only and incompatible packages cannot be selected for installation from the catalogue", async () => {
  const { getRecommendedPiExtension } = await import("./recommended-pi-extensions.ts");
  for (const id of ["pi-powerline-footer", "pi-background-tasks"]) {
    const item = getRecommendedPiExtension(id);
    assert.equal(item.status, "unsupported");
    assert.equal(item.installSource, undefined);
  }
  for (const id of ["pi-subagents", "@narumitw/pi-usage"]) assert.equal(getRecommendedPiExtension(id).status, "built-in");
  assert.equal(getRecommendedPiExtension("constructor"), undefined);
});
