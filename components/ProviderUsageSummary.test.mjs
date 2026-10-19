import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { build } from "esbuild";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

let browser, bundle;
const origin = "https://provider-usage.fixture";
const report = (providerId, label) => ({ providerId, status: "ready", report: { capturedAt: 1_800_000_000_000, buckets: [], metrics: [{ id: "balance", label, value: "12.34", unit: "currency", currency: "USD" }] } });

before(async () => {
  const project = fileURLToPath(new URL("../", import.meta.url));
  bundle = (await build({
    stdin: { contents: `import React from "react";
      import {createRoot} from "react-dom/client";
      import {I18nProvider} from "./hooks/useI18n";
      import {ProviderUsageSummary} from "./components/ProviderUsageSummary";
      function Harness(){
        const [provider,setProvider]=React.useState("deepseek");
        const [enabled,setEnabled]=React.useState(true);
        const [shown,setShown]=React.useState(true);
        return <><button onClick={()=>setProvider("deepseek")}>Provider A</button><button onClick={()=>setProvider("openrouter")}>Provider B</button>
          <button onClick={()=>setProvider("unsupported")}>Unsupported</button><button onClick={()=>setEnabled(value=>!value)}>Toggle enabled</button>
          <button onClick={()=>setShown(value=>!value)}>Toggle mounted</button>
          <output id="scope">{provider}:{String(enabled)}</output><div id="usage">{shown&&<ProviderUsageSummary providerId={provider} enabled={enabled}/>}</div></>;
      }
      createRoot(document.getElementById("root")).render(<React.StrictMode><I18nProvider><Harness/></I18nProvider></React.StrictMode>);`, resolveDir: project, loader: "tsx" },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", logLevel: "silent", tsconfig: fileURLToPath(new URL("../tsconfig.json", import.meta.url)),
  })).outputFiles[0].text;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); });

async function fixture({ cache } = {}) {
  const context = await browser.newContext();
  const external = [];
  await context.route("**/*", route => {
    if (route.request().url() === `${origin}/`) return route.fulfill({ contentType: "text/html", body: `<div id="root"></div><script>${bundle.replaceAll("</script", "<\\/script")}</script>` });
    if (route.request().url() === `${origin}/favicon.ico`) return route.fulfill({ status: 204 });
    external.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.addInitScript(({ cache }) => {
    if (cache) localStorage.setItem("pi-web:provider-usage:deepseek", JSON.stringify(cache));
    window.usageRequests = [];
    window.fetch = (url, options) => new Promise((resolve, reject) => {
      window.usageRequests.push({ url, options, resolve: result => resolve({ ok: true, json: async () => result }), reject });
    });
  }, { cache });
  await page.goto(origin);
  await page.getByRole("button", { name: "Refresh usage", exact: true }).waitFor();
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  return {
    page,
    async close() { await context.close(); assert.deepEqual(external, [], "No fixture request reaches a server or provider"); },
  };
}
async function resolve(page, index, result) {
  await page.evaluate(({ index, result }) => { window.usageRequests[index].resolve(result); }, { index, result });
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}
async function query(page, expectedCount) {
  await page.getByRole("button", { name: "Refresh usage", exact: true }).click();
  await page.waitForFunction(count => window.usageRequests.length === count, expectedCount);
}
const usageText = page => page.locator("#usage").innerText();

test("a late report from A is never visible under provider B", async () => {
  const app = await fixture();
  const { page } = app;
  try {
    await query(page, 1);
    await page.getByRole("button", { name: "Provider B", exact: true }).click();
    await resolve(page, 0, report("deepseek", "Stale A report under B"));
    assert.doesNotMatch(await usageText(page), /Stale A report under B/);
  } finally { await app.close(); }
});

test("provider B can refresh immediately and an ignored-abort response from A cannot replace B", async () => {
  const app = await fixture();
  const { page } = app;
  try {
    await query(page, 1);
    await page.getByRole("button", { name: "Provider B", exact: true }).click();
    assert.equal(await page.locator("#usage button").isEnabled(), true, "A's pending request must not disable B");
    assert.equal(await page.evaluate(() => window.usageRequests[0].options.signal?.aborted), true);
    await query(page, 2);
    await resolve(page, 1, report("openrouter", "Current B balance"));
    await resolve(page, 0, report("deepseek", "Stale A balance"));
    assert.match(await usageText(page), /Current B balance/);
    assert.doesNotMatch(await usageText(page), /Stale A balance/);
  } finally { await app.close(); }
});

test("returning to provider A does not revive its previous request", async () => {
  const app = await fixture();
  const { page } = app;
  try {
    await query(page, 1);
    await page.getByRole("button", { name: "Provider B", exact: true }).click();
    await page.getByRole("button", { name: "Provider A", exact: true }).click();
    await resolve(page, 0, report("deepseek", "Previous A visit"));
    assert.doesNotMatch(await usageText(page), /Previous A visit/);
    assert.match(await usageText(page), /Not queried/);
  } finally { await app.close(); }
});

test("known disabled scope clears visible account data and rejects a late response", async () => {
  const app = await fixture();
  const { page } = app;
  try {
    await query(page, 1);
    await resolve(page, 0, report("deepseek", "Old account balance"));
    assert.match(await usageText(page), /Old account balance/);
    await query(page, 2);
    await page.getByRole("button", { name: "Toggle enabled", exact: true }).click();
    assert.doesNotMatch(await usageText(page), /Old account balance/);
    assert.equal(await page.getByRole("button", { name: "Refresh usage", exact: true }).isDisabled(), true);
    await resolve(page, 1, report("deepseek", "Late disabled balance"));
    assert.doesNotMatch(await usageText(page), /Late disabled balance/);
    await page.getByRole("button", { name: "Toggle enabled", exact: true }).click();
    assert.match(await usageText(page), /Not queried/);
    assert.equal(await page.evaluate(() => window.usageRequests.length), 2, "Enabling does not query automatically");
  } finally { await app.close(); }
});

test("provider-only persistent snapshots are never presented as the current account", async () => {
  const app = await fixture({ cache: report("deepseek", "Unidentified cached account") });
  try {
    assert.match(await usageText(app.page), /Not queried/);
    assert.doesNotMatch(await usageText(app.page), /Unidentified cached account/);
    assert.equal(await app.page.evaluate(() => window.usageRequests.length), 0);
  } finally { await app.close(); }
});

test("unmount aborts the request and late completion does not restore data after remount", async () => {
  const app = await fixture();
  const { page } = app;
  try {
    await query(page, 1);
    await page.getByRole("button", { name: "Toggle mounted", exact: true }).click();
    assert.equal(await page.evaluate(() => window.usageRequests[0].options.signal?.aborted), true);
    await resolve(page, 0, report("deepseek", "Unmounted balance"));
    await page.getByRole("button", { name: "Toggle mounted", exact: true }).click();
    assert.match(await usageText(page), /Not queried/);
    assert.doesNotMatch(await usageText(page), /Unmounted balance/);
  } finally { await app.close(); }
});

test("a failed refresh clears the preceding report and remains retryable", async () => {
  const app = await fixture();
  const { page } = app;
  try {
    await query(page, 1);
    await resolve(page, 0, report("deepseek", "Prior balance"));
    await query(page, 2);
    await resolve(page, 1, { providerId: "deepseek", status: "auth-unavailable", message: "Generated authentication unavailable" });
    assert.doesNotMatch(await usageText(page), /Prior balance/);
    assert.match(await usageText(page), /Generated authentication unavailable/);
    assert.equal(await page.getByRole("button", { name: "Refresh usage", exact: true }).isEnabled(), true);
  } finally { await app.close(); }
});

test("response provider identity is checked, errors permit retry, unsupported providers stay inert", async () => {
  const app = await fixture();
  const { page } = app;
  try {
    await query(page, 1);
    await resolve(page, 0, report("openrouter", "Wrong provider balance"));
    assert.doesNotMatch(await usageText(page), /Wrong provider balance/);
    assert.match(await usageText(page), /Usage query failed/);
    await query(page, 2);
    await resolve(page, 1, { providerId: "deepseek", status: "query-failed", message: "Generated retryable failure" });
    assert.match(await usageText(page), /Generated retryable failure/);
    await query(page, 3);
    await resolve(page, 2, report("deepseek", "Recovered balance"));
    assert.match(await usageText(page), /Recovered balance/);
    await page.getByRole("button", { name: "Unsupported", exact: true }).click();
    assert.equal(await page.locator("#usage").innerText(), "");
    assert.equal(await page.evaluate(() => window.usageRequests.length), 3);
  } finally { await app.close(); }
});
