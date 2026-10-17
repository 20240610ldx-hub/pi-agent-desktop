import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { approveSignIn, startFakeOAuthServer } from "../lib/__fixtures__/mcp-oauth-server.mjs";

const origin = "http://127.0.0.1:30141";
const metadata = await (await fetch(`${origin}/api/data`)).json();
const data = resolve(metadata.agentDir);
assert.equal(data, resolve("test-results/pilaude/runtime-data"), "Use the isolated fixture server");
const project = join(data, "project");
await mkdir(project, { recursive: true });
const files = ["mcp.json", "mcp-credentials.json"];
const previous = new Map(await Promise.all(files.map(async name => {
  try { return [name, await readFile(join(data, name))]; }
  catch (error) { if (error.code === "ENOENT") return [name, null]; throw error; }
})));
const fake = await startFakeOAuthServer();
const browser = await chromium.launch({ headless: true });
try {
  await writeFile(join(data, "mcp.json"), JSON.stringify({ mcpServers: { "pilaude-oauth-ui": { url: fake.url } } }));
  const context = await browser.newContext({ viewport: { width: 1280, height: 840 } });
  await context.addInitScript(() => localStorage.setItem("pi-locale", "en"));
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = []; const apiBodies = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", async response => {
    if (response.url().startsWith(`${origin}/api/mcp`) && response.headers()["content-type"]?.includes("application/json")) {
      apiBodies.push(await response.text().catch(() => ""));
    }
  });
  await page.goto(`${origin}/?cwd=${encodeURIComponent(project)}`, { waitUntil: "load", timeout: 45000 });
  await page.getByRole("button", { name: "Settings", exact: true }).first().click();
  await page.locator(".settings-entry-menu button", { hasText: "MCP" }).click();
  await page.getByRole("button", { name: /pilaude-oauth-ui/ }).click();
  const signIn = page.getByRole("button", { name: "Sign in", exact: true });
  const contrast = await signIn.evaluate(button => {
    const luminance = color => {
      const channels = color.match(/[\d.]+/g).slice(0,3).map(Number).map(value => value / 255);
      return channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
        .reduce((sum,value,index) => sum + value * [0.2126,0.7152,0.0722][index],0);
    };
    const style = getComputedStyle(button);
    const foreground = luminance(style.color); const background = luminance(style.backgroundColor);
    return (Math.max(foreground,background)+0.05)/(Math.min(foreground,background)+0.05);
  });
  // Report appearance separately: this test verifies credential lifecycle, not UI parity.
  await signIn.click();
  const link = page.locator(`a[href^="${fake.origin}/authorize?"]`);
  await link.waitFor();
  const redirect = await approveSignIn(await link.getAttribute("href"));
  await page.locator(".oauth-paste-input").fill(redirect);
  await page.locator(".oauth-paste-submit").click();
  await page.getByText("Signed in.", { exact: true }).waitFor();
  const raw = await readFile(join(data, "mcp-credentials.json"), "utf8");
  for (const token of [...fake.issued.access, ...fake.issued.refresh]) {
    assert.equal(raw.includes(token), false);
    assert.equal(apiBodies.some(body => body.includes(token)), false);
    assert.equal((await page.locator("body").innerText()).includes(token), false);
  }
  assert.equal(JSON.parse(raw).format, "pilaude-mcp-dpapi-v1");
  await mkdir("test-results/pilaude/mcp-auth-ui", { recursive: true });
  await page.screenshot({ path: "test-results/pilaude/mcp-auth-ui/signed-in.png" });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByText("Not signed in.", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ uiSignIn: true, encrypted: true, noTokenInApiOrUi: true, uiSignOut: true, primaryTextContrast: Number(contrast.toFixed(2)), status: "passed" }));
} finally {
  await browser.close();
  await fake.close();
  for (const [name, bytes] of previous) {
    if (bytes === null) await rm(join(data, name), { force: true });
    else await writeFile(join(data, name), bytes);
  }
}
