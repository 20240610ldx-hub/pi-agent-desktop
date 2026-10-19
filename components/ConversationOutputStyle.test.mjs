import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { build } from "esbuild";
import { chromium } from "playwright";

let browser, bundle;
const origin = "https://output-style.fixture";
const builtinStyles = ["default", "proactive", "concise", "explanatory", "learning"].map((id) => ({ id, name: id, builtin: true }));
const state = (selectedId = "default") => ({ supported: true, selectedId, styles: builtinStyles });

before(async () => {
  bundle = (await build({
    stdin: { contents: `import React from "react";
      import {createRoot} from "react-dom/client";
      import {I18nProvider} from "./hooks/useI18n";
      import {useConversationOutputStyle} from "./components/ConversationOutputStyle";
      import {DomContextMenuHost} from "./components/DomContextMenuHost";
      import {openDomMenu} from "./lib/dom-menu-store";
      function Harness(){const [sid,setSid]=React.useState("a");const style=useConversationOutputStyle(sid);return <>
        <button onClick={()=>setSid("a")}>Session A</button><button onClick={()=>setSid("b")}>Session B</button>
        <button id="opener" onClick={e=>{e.currentTarget.focus();openDomMenu(style.menuItems,{x:20,y:80},"conversation",{label:"Output style",opener:e.currentTarget});}}>Output style</button>
        {style.error}{style.editor}<DomContextMenuHost/>
      </>};createRoot(document.getElementById("root")).render(<I18nProvider><Harness/></I18nProvider>);`, resolveDir: new URL("../", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"), loader: "tsx" },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", logLevel: "silent", tsconfig: new URL("../tsconfig.json", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"),
  })).outputFiles[0].text;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); });

async function fixture(handler) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const requests = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: `<div id="root"></div><script>${bundle.replaceAll("</script", "<\\/script")}</script>` });
    requests.push({ path: url.pathname, method: route.request().method(), body: route.request().postDataJSON() });
    await handler(route, url, requests);
  });
  await page.goto(origin);
  return { page, requests, close: () => context.close() };
}
async function openMenu(page) { await page.getByRole("button", { name: "Output style", exact: true }).click(); }
async function waitUntil(check) { const deadline = Date.now() + 5000; while (!await check()) { if (Date.now() > deadline) throw new Error("Fixture boundary was not reached"); await new Promise((resolve) => setTimeout(resolve, 10)); } }

test("repeated submit events create a custom definition only once while saving", async () => {
  let finishCreate;
  const fixtureApp = await fixture((route, url) => {
    if (url.pathname === "/api/output-styles") { finishCreate = () => route.fulfill({ json: { style: { id: "custom:single", name: "Once", instructions: "Once.", builtin: false } } }); return; }
    return route.fulfill({ json: state() });
  });
  const { page, requests } = fixtureApp;
  try {
    await page.waitForTimeout(30); await openMenu(page); await page.getByRole("menuitem", { name: "New style...", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New output style", exact: true });
    await dialog.getByLabel("Name", { exact: true }).fill("Once"); await dialog.getByLabel("Instructions", { exact: true }).fill("Once.");
    await dialog.evaluate((form) => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    await waitUntil(() => Boolean(finishCreate));
    assert.equal(requests.filter((request) => request.path === "/api/output-styles").length, 1);
    await finishCreate();
  } finally { await fixtureApp.close(); }
});

test("a malformed style response renders a retryable error instead of crashing the menu", async () => {
  let broken = true;
  const fixtureApp = await fixture((route) => route.fulfill({ json: broken ? {} : state("learning") }));
  const { page, requests } = fixtureApp;
  try {
    await page.getByRole("alert").waitFor();
    await openMenu(page);
    assert.equal(await page.getByRole("menuitemcheckbox").count(), 0);
    broken = false;
    await page.getByRole("menuitem", { name: "Retry", exact: true }).click();
    await waitUntil(() => requests.length === 2); await page.waitForTimeout(30); await openMenu(page);
    assert.equal(await page.getByRole("menuitemcheckbox", { name: "Learning", exact: true }).getAttribute("aria-checked"), "true");
  } finally { await fixtureApp.close(); }
});

test("unsupported and unknown style state never invent a default selection", async () => {
  let read;
  const fixtureApp = await fixture((route) => { read = () => route.fulfill({ json: { supported: false, reason: "exact-system-prompt", selectedId: "default", styles: [] } }); });
  const { page } = fixtureApp;
  try {
    await waitUntil(() => Boolean(read)); await openMenu(page);
    assert.equal(await page.getByRole("menuitemcheckbox").count(), 0, "Unknown loading state has no check item");
    await page.keyboard.press("Escape"); await read(); await page.waitForTimeout(30); await openMenu(page);
    assert.equal(await page.getByRole("menuitemcheckbox").count(), 0, "Unsupported exact prompt has no made-up checked Default");
    const option = page.getByRole("menuitem", { name: "Default", exact: true });
    assert.equal(await option.isDisabled(), true);
    assert.match(await option.getAttribute("title"), /exact system prompt/);
  } finally { await fixtureApp.close(); }
});

test("editor keeps focus trapped, ignores IME Escape, and confirms draft discard before restoring its opener", async () => {
  const fixtureApp = await fixture((route) => route.fulfill({ json: state() }));
  const { page, requests } = fixtureApp;
  try {
    await page.waitForTimeout(30); await openMenu(page);
    await page.getByRole("menuitem", { name: "New style...", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New output style", exact: true });
    const name = dialog.getByLabel("Name", { exact: true });
    await page.keyboard.press("Shift+Tab");
    assert.equal(await dialog.getByRole("button", { name: "Cancel", exact: true }).evaluate((element) => element === document.activeElement), true, "Initial Shift+Tab remains inside the editor");
    await page.keyboard.press("Tab");
    assert.equal(await name.evaluate((element) => element === document.activeElement), true, "Initial Tab starts inside the editor");
    await name.fill("Unsaved style");
    await dialog.getByLabel("Instructions", { exact: true }).fill("Unsaved instructions.");
    await dialog.getByRole("button", { name: "Save and apply", exact: true }).focus();
    await page.keyboard.press("Tab");
    assert.equal(await name.evaluate((element) => element === document.activeElement), true, "Tab wraps inside editor");
    await name.dispatchEvent("keydown", { key: "Escape", isComposing: true, bubbles: true });
    assert.equal(await dialog.isVisible(), true);
    assert.equal(await page.getByRole("alertdialog").count(), 0);
    await page.keyboard.press("Escape");
    const discard = page.getByRole("alertdialog", { name: "Discard this style draft?", exact: true });
    await discard.waitFor();
    await discard.getByRole("button", { name: "Keep editing", exact: true }).click();
    assert.equal(await name.inputValue(), "Unsaved style");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await discard.getByRole("button", { name: "Discard draft", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await page.locator("#opener").evaluate((element) => element === document.activeElement), true, "Closing restores the menu opener");
    assert.equal(requests.filter((request) => request.method !== "GET").length, 0, "Discard never writes a definition or style selection");
  } finally { await fixtureApp.close(); }
});

test("a saved custom style is applied again without creating a duplicate when the first apply fails", async () => {
  let failApply = true;
  const custom = { id: "custom:fixture", name: "Fixture custom", instructions: "Keep the answer useful.", builtin: false };
  const fixtureApp = await fixture(async (route, url) => {
    if (url.pathname === "/api/output-styles") return route.fulfill({ json: { style: custom } });
    if (route.request().method() === "GET") return route.fulfill({ json: state() });
    if (failApply) return route.fulfill({ status: 503, json: { error: "Apply temporarily failed" } });
    return route.fulfill({ json: { ...state(custom.id), styles: [...builtinStyles, custom] } });
  });
  const { page, requests } = fixtureApp;
  try {
    await page.waitForTimeout(30); await openMenu(page);
    await page.getByRole("menuitem", { name: "New style...", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New output style", exact: true });
    await dialog.getByLabel("Name", { exact: true }).fill(custom.name);
    await dialog.getByLabel("Instructions", { exact: true }).fill(custom.instructions);
    await dialog.getByRole("button", { name: "Save and apply", exact: true }).click();
    await dialog.getByText("Apply temporarily failed", { exact: true }).waitFor();
    assert.equal(await dialog.getByLabel("Name", { exact: true }).inputValue(), custom.name);
    assert.equal(await dialog.getByLabel("Instructions", { exact: true }).inputValue(), custom.instructions);
    failApply = false;
    await dialog.getByRole("button", { name: "Apply saved style", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await openMenu(page);
    assert.equal(await page.getByRole("menuitemcheckbox", { name: custom.name, exact: true }).getAttribute("aria-checked"), "true");
    assert.equal(requests.filter((request) => request.path === "/api/output-styles" && request.method === "POST").length, 1);
    assert.equal(requests.filter((request) => request.method === "PUT").length, 2);
  } finally { await fixtureApp.close(); }
});

test("an old selection acknowledgement cannot overwrite session A after switching A to B to A", async () => {
  let staleApply;
  const fixtureApp = await fixture(async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: state() });
    staleApply = () => route.fulfill({ json: state("concise") });
  });
  const { page } = fixtureApp;
  try {
    await page.waitForTimeout(30); await openMenu(page);
    await page.getByRole("menuitemcheckbox", { name: "Concise", exact: true }).click();
    await waitUntil(() => Boolean(staleApply));
    await page.getByRole("button", { name: "Session B", exact: true }).click();
    await page.getByRole("button", { name: "Session A", exact: true }).click();
    await page.waitForTimeout(30); await staleApply(); await page.waitForTimeout(30);
    await openMenu(page);
    assert.equal(await page.getByRole("menuitemcheckbox", { name: "Default", exact: true }).getAttribute("aria-checked"), "true");
    assert.equal(await page.getByRole("menuitemcheckbox", { name: "Concise", exact: true }).getAttribute("aria-checked"), "false");
  } finally { await fixtureApp.close(); }
});

test("menu checks a style only after the session API acknowledges the change", async () => {
  let apply;
  const fixtureApp = await fixture(async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: state() });
    apply = () => route.fulfill({ json: state("concise") });
  });
  const { page, requests } = fixtureApp;
  try {
    await waitUntil(() => requests.length === 1);
    await page.waitForTimeout(20);
    await openMenu(page);
    await page.getByRole("menuitemcheckbox", { name: "Concise", exact: true }).click();
    await waitUntil(() => Boolean(apply));
    await openMenu(page);
    assert.equal(await page.getByRole("menuitemcheckbox", { name: "Default", exact: true }).getAttribute("aria-checked"), "true");
    assert.equal(await page.getByRole("menuitemcheckbox", { name: "Concise", exact: true }).getAttribute("aria-checked"), "false");
    await page.keyboard.press("Escape");
    await apply();
    await page.waitForTimeout(20);
    await openMenu(page);
    assert.equal(await page.getByRole("menuitemcheckbox", { name: "Concise", exact: true }).getAttribute("aria-checked"), "true");
    assert.deepEqual(requests.map(({ method, path, body }) => ({ method, path, body })), [
      { method: "GET", path: "/api/sessions/a/output-style", body: null },
      { method: "PUT", path: "/api/sessions/a/output-style", body: { styleId: "concise" } },
    ]);
  } finally { await fixtureApp.close(); }
});
