import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { build } from "esbuild";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const source = await readFile(new URL("./ModelSelector.tsx", import.meta.url), "utf8");

test("does not autofocus the model filter on mobile", () => {
  // Autofocus would open the on-screen keyboard as soon as the picker opens.
  assert.match(source, /aria-label=\{t\("chat\.filterModels"\)\}[\s\S]*?autoFocus=\{!isMobile\}/);
  assert.doesNotMatch(source, /^\s*autoFocus\s*$/m);
});

let browser, bundle, css;
const origin = "https://model-selector.fixture";

before(async () => {
  bundle = (await build({
    stdin: { contents: `import React from "react";
      import {createRoot} from "react-dom/client";
      import {I18nProvider} from "./hooks/useI18n";
      import {ModelSelector} from "./components/ModelSelector";
      function Harness() {
        const config = window.fixtureConfig;
        const [value, setValue] = React.useState(config.value);
        const [defaultValue, setDefault] = React.useState(config.defaultValue);
        const [busy, setBusy] = React.useState(false);
        window.setBusy = setBusy;
        window.changes ??= [];
        return <I18nProvider><div id="anchor" style={{position:'fixed',left:config.left??40,top:config.top??500,width:config.anchorWidth??180}}>
          <ModelSelector options={config.options} value={value} defaultValue={defaultValue} busy={busy}
            ariaLabel="Fixture model" placement="up"
            onChange={(provider,modelId)=>{window.changes.push({provider,modelId});setValue({provider,modelId});}}
            onSetDefault={config.stars ? (provider,modelId)=>setDefault({provider,modelId}) : undefined}/>
        </div><button id="after" style={{position:'fixed',bottom:0}}>After selector</button></I18nProvider>;
      }
      createRoot(document.getElementById("root")).render(<React.StrictMode><Harness/></React.StrictMode>);`,
      resolveDir: fileURLToPath(new URL("../", import.meta.url)), loader: "tsx" },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", logLevel: "silent",
  })).outputFiles[0].text;
  css = (await Promise.all(["app/globals.css", "app/settings.css", "vendor/open-claude-ui/cds-theme.css", "app/native-theme.css"].map(name =>
    readFile(new URL(`../${name}`, import.meta.url), "utf8")))).join("\n").replace(/^@import[^;]*;/gm, "");
  browser = await chromium.launch({ headless: true });
});

after(async () => { await browser?.close(); });

const options = Array.from({ length: 4 }, (_, i) => ({
  provider: i < 2 ? "provider-a" : "provider-b", modelId: `model-${i}`, name: `Model ${i}`,
}));

async function fixture(config = {}, viewport = { width: 900, height: 720 }) {
  const page = await browser.newPage({ viewport, hasTouch: config.touch ?? false });
  page.setDefaultTimeout(3000);
  await page.route("**/*", route => route.request().url() === `${origin}/`
    ? route.fulfill({ contentType: "text/html", body: `<style>${css}</style><div id="root"></div><script>${bundle.replaceAll("</script", "<\\/script")}</script>` })
    : route.abort());
  await page.addInitScript(config => { window.fixtureConfig = config; }, { options, value: options[2], ...config });
  await page.goto(origin);
  await page.getByRole("button", { name: "Fixture model", exact: true }).waitFor();
  return page;
}

test("plain menu checks sit at the reference right inset at desktop and narrow widths", async () => {
  for (const width of [900, 390]) {
    const page = await fixture({}, { width, height: 720 });
    try {
      await page.getByRole("button", { name: "Fixture model", exact: true }).click();
      await page.locator(".model-selector-menu").evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished)));
      const inset = await page.locator(".model-selector-check").evaluate(el => {
        const panel = el.closest(".model-selector-menu").getBoundingClientRect();
        return panel.right - el.getBoundingClientRect().right;
      });
      // Reference ink ends 17 / 1.5 = 11.33px from the panel; the 14px SVG
      // has about 3px of empty space after its stroke.
      assert.ok(Math.abs(inset - 8.33) <= 1, `width=${width}, SVG right inset=${inset}`);
    } finally { await page.close(); }
  }
});

test("selected checks leave a gap before both save buttons and default stars including touch", async () => {
  for (const touch of [false, true]) {
    const page = await fixture({ stars: true, touch });
    try {
      await page.getByRole("button", { name: "Fixture model", exact: true }).click();
      await page.locator(".model-selector-menu").evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished)));
      const selected = page.locator(".app-option-row[data-selected]");
      const gap = () => selected.evaluate(el => {
        const check = el.querySelector(".model-selector-check").getBoundingClientRect();
        const star = el.querySelector(".app-default-star").getBoundingClientRect();
        return star.left - check.right;
      });
      assert.ok(await gap() >= 8, `save button overlap, touch=${touch}`);
      await selected.getByRole("button", { name: "Save as default" }).click();
      assert.equal(await selected.locator(".app-default-star.is-default").count(), 1);
      assert.ok(await gap() >= 8, `default marker overlap, touch=${touch}`);
    } finally { await page.close(); }
  }
});

test("menu checks use the dark reference blue and preserve light system blue while labels inherit C01 text", async () => {
  for (const dark of [false, true]) {
    const page = await fixture();
    try {
      // Supply the C01 parent token: this worktree predates its integration.
      const text = dark ? "rgb(240, 239, 236)" : "rgb(11, 11, 11)";
      const systemBlue = await page.evaluate(({ dark, text }) => {
        document.documentElement.classList.toggle("dark", dark);
        document.getElementById("anchor").style.setProperty("--text", text);
        const probe = document.createElement("span");
        probe.style.color = "var(--menu-selection-color)";
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }, { dark, text });
      await page.getByRole("button", { name: "Fixture model", exact: true }).click();
      await page.locator(".model-selector-menu").evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished)));
      assert.equal(await page.locator(".model-selector-check").evaluate(el => getComputedStyle(el).color),
        dark ? "rgb(41, 117, 209)" : systemBlue);
      const labels = await page.getByRole("option").evaluateAll(rows => rows.map(el => getComputedStyle(el.querySelector("span")).color));
      assert.deepEqual(labels, options.map(() => text));
      // Changing the shared parent token must reach every model label.
      await page.locator("#anchor").evaluate(el => el.style.setProperty("--text", "rgb(100, 110, 120)"));
      await page.locator(".model-selector-menu").evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished)));
      assert.deepEqual(await page.getByRole("option").evaluateAll(rows => rows.map(el => getComputedStyle(el.querySelector("span")).color)),
        options.map(() => "rgb(100, 110, 120)"));
    } finally { await page.close(); }
  }
});

test("keyboard navigation crosses provider groups and Escape restores the trigger", async () => {
  const page = await fixture();
  try {
    const trigger = page.getByRole("button", { name: "Fixture model", exact: true });
    await trigger.focus();
    await trigger.press("ArrowDown");
    await page.getByRole("listbox").waitFor();
    assert.equal(await page.locator(":focus").textContent(), "Model 2");
    await page.keyboard.press("ArrowUp");
    assert.equal(await page.locator(":focus").textContent(), "Model 1");
    await page.keyboard.press("Home");
    assert.equal(await page.locator(":focus").textContent(), "Model 0");
    await page.keyboard.press("End");
    assert.equal(await page.locator(":focus").textContent(), "Model 3");
    await page.evaluate(() => {
      window.outerEscapes = 0;
      document.addEventListener("keydown", event => { if (event.key === "Escape") window.outerEscapes++; });
    });
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => window.outerEscapes), 0);
    assert.equal(await page.getByRole("listbox").count(), 0);
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    await trigger.press("Enter");
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").textContent(), "Model 3");
    await page.keyboard.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.changes), [{ provider: "provider-b", modelId: "model-3" }]);
  } finally { await page.close(); }
});

test("provider search preserves text editing and ignores composing Enter and Escape", async () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ provider: i < 6 ? "alpha-provider" : "beta-provider", modelId: `id-${i}`, name: `Choice ${i}` }));
  const page = await fixture({ options: many, value: many[8] });
  try {
    await page.getByRole("button", { name: "Fixture model", exact: true }).click();
    const input = page.getByRole("textbox");
    await input.fill("beta-provider");
    assert.equal(await page.getByRole("option").count(), 6);
    await input.press("Home");
    assert.equal(await input.evaluate(el => el.selectionStart), 0);
    await input.press("End");
    assert.equal(await input.evaluate(el => el.selectionStart), 13);
    for (const key of ["Enter", "Escape"]) {
      await input.evaluate((el, key) => el.dispatchEvent(new KeyboardEvent("keydown", { key, keyCode: 229, isComposing: true, bubbles: true, cancelable: true })), key);
    }
    assert.equal(await page.getByRole("listbox").count(), 1);
    assert.deepEqual(await page.evaluate(() => window.changes), []);
    await input.press("ArrowDown");
    assert.equal(await page.locator(":focus").textContent(), "Choice 6");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(":focus").getAttribute("aria-label"), "Fixture model");
  } finally { await page.close(); }
});

test("an unavailable current model remains visible without offering a fake choice", async () => {
  const page = await fixture({ value: { provider: "missing-provider", modelId: "missing-model" } });
  try {
    await page.getByRole("button", { name: "Fixture model", exact: true }).click();
    const current = page.getByRole("option", { name: /missing-model/ });
    assert.equal(await current.getAttribute("aria-disabled"), "true");
    assert.equal(await current.getAttribute("aria-selected"), "true");
    assert.match(await current.textContent(), /missing-provider/);
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.changes), [{ provider: "provider-b", modelId: "model-3" }]);
  } finally { await page.close(); }
});

test("reopening scrolls the current model into view and the menu avoids viewport edges", async () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ provider: "local", modelId: `id-${i}`, name: `Long model name ${String(i).padStart(2, "0")} ${"extra ".repeat(30)}` }));
  const page = await fixture({ options: many, value: many[70], left: 750, top: 40 });
  try {
    const trigger = page.getByRole("button", { name: "Fixture model", exact: true });
    await trigger.click();
    const list = page.locator(".model-selector-menu");
    const box = await list.boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 901 && box.y + box.height <= 721, JSON.stringify(box));
    assert.equal(await page.locator('.app-menu-list').evaluate(el => {
      const row = el.querySelector('[aria-selected="true"]');
      const a = el.getBoundingClientRect(), b = row.getBoundingClientRect();
      return b.top >= a.top && b.bottom <= a.bottom;
    }), true);
    await page.keyboard.press("Escape");
    await trigger.click();
    assert.ok(await page.locator('.app-menu-list').evaluate(el => el.scrollTop) > 0);
    await page.setViewportSize({ width: 390, height: 720 });
    await page.waitForFunction(() => {
      const box = document.querySelector('.model-selector-menu').getBoundingClientRect();
      return box.x >= 0 && box.right <= 391;
    });
    const resized = await list.boundingBox();
    assert.ok(resized.x >= 0 && resized.x + resized.width <= 391 && resized.y >= 0, JSON.stringify(resized));
  } finally { await page.close(); }
});

test("saving a default keeps focus inside; busy closes the menu and preserves the current value", async () => {
  const page = await fixture({ stars: true });
  try {
    const trigger = page.getByRole("button", { name: "Fixture model", exact: true });
    await trigger.click();
    await page.locator('.app-option-row').first().getByRole("button", { name: "Save as default" }).click();
    assert.equal(await page.locator(":focus").getAttribute("role"), "option");
    assert.equal(await page.locator('.app-default-star.is-default').count(), 1);
    assert.deepEqual(await page.evaluate(() => window.changes), []);
    await page.evaluate(() => window.setBusy(true));
    await page.getByRole("listbox").waitFor({ state: "hidden" });
    assert.equal(await trigger.isDisabled(), true);
    assert.match(await trigger.textContent(), /Model 2/);
    await page.evaluate(() => window.setBusy(false));
    await trigger.click();
    assert.equal(await page.getByRole("option", { selected: true }).textContent(), "Model 2");
  } finally { await page.close(); }
});

test("empty search recovers and long or unnamed models keep their actual identifiers", async () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ provider: "local", modelId: `id-${i}`, name: i ? `Choice ${i} ${"long ".repeat(30)}` : "" }));
  const page = await fixture({ options: many, value: many[0] });
  try {
    const trigger = page.getByRole("button", { name: "Fixture model", exact: true });
    assert.match(await trigger.textContent(), /id-0/);
    await trigger.click();
    const input = page.getByRole("textbox");
    await input.fill("does-not-exist");
    assert.equal(await page.getByRole("option").count(), 0);
    assert.match(await page.getByRole("status").textContent(), /No matching models/);
    await input.fill("local/id-1");
    assert.equal(await page.getByRole("option").count(), 1);
    const label = page.getByRole("option").locator("span");
    assert.equal(await label.getAttribute("title"), many[1].name);
    assert.equal(await label.evaluate(el => el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow === "ellipsis"), true);
    await input.press("ArrowDown");
    await page.keyboard.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.changes), [{ provider: "local", modelId: "id-1" }]);
  } finally { await page.close(); }
});

test("an empty catalogue exposes no invented option and selecting the current model sends nothing", async () => {
  const page = await fixture({ options: [], value: null });
  try {
    await page.getByRole("button", { name: "Fixture model", exact: true }).click();
    assert.equal(await page.getByRole("option").count(), 0);
    assert.match(await page.getByRole("status").textContent(), /No available models/);
    await page.keyboard.press("End");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(":focus").getAttribute("aria-label"), "Fixture model");
  } finally { await page.close(); }
  const current = await fixture();
  try {
    await current.getByRole("button", { name: "Fixture model", exact: true }).click();
    await current.getByRole("option", { selected: true }).click();
    assert.deepEqual(await current.evaluate(() => window.changes), []);
    assert.equal(await current.getByRole("listbox").count(), 0);
  } finally { await current.close(); }
});
