import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installTitleMenuFixture } from "./title-conversation-menu.mjs";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";

/** Real AppShell and native adapter, mocked IPC/HTTP. This does not launch a live native WebView. */
async function installNativeFixture(context, report, { secondary = false, installed = true, launchFailure = false } = {}) {
  await installTitleMenuFixture(context, report);
  await context.addInitScript(({ secondary, installed, launchFailure }) => {
    const callbacks = new Map(); let callbackId = 0;
    window.__destinationCalls = []; window.__nativeNotifications = [];
    const immutable = (name, value) => Object.defineProperty(window, name, { value, writable: false, configurable: false });
    if (secondary) immutable("__PILAUDE_CONVERSATION_WINDOW__", true);
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: secondary ? "conversation-fixture" : "main" }, currentWebview: { label: secondary ? "conversation-fixture" : "main" } },
      transformCallback: (callback) => { const id = ++callbackId; callbacks.set(id, callback); return id; }, unregisterCallback: (id) => callbacks.delete(id),
      invoke: async (command, args) => {
        window.__destinationCalls.push({ command, args });
        if (command === "conversation_destinations") return { newWindow: true, vsCode: { supported: installed, reason: installed ? null : "not-installed" } };
        if (command === "open_conversation_window" || command === "open_project_in_vscode") { if (launchFailure) throw new Error("Generated native destination failure"); return null; }
        if (command === "plugin:window|is_maximized" || command === "plugin:window|is_focused") return false;
        if (command === "plugin:notification|notify") { window.__nativeNotifications.push(args); return null; }
        if (command === "plugin:event|listen") return ++callbackId;
        if (command === "get_desktop_api_token") return "generated-fixture-token-never-real-00000000";
        if (command === "set_close_quits" || command === "plugin:event|unlisten" || command === "set_ui_theme" || command === "plugin:clipboard-manager|write_text") return null;
        throw new Error(`Unexpected mocked IPC command: ${command}`);
      },
    };
    const OriginalSource = window.EventSource;
    const sources = [];
    window.EventSource = class extends OriginalSource { constructor(url) { super(url); sources.push(this); } };
    window.__emitDestinationEvent = (url, value) => {
      for (const source of sources.filter((source) => source.url === url && source.readyState === 1)) {
        const event = new MessageEvent("message", { data: JSON.stringify(value) }); source.onmessage?.(event); source.dispatchEvent(event);
      }
    };
    if (secondary) {
      localStorage.setItem("pi-workspace-v1", JSON.stringify({ sessionId: "main-saved", cwd: "D:/generated/main", fileTabs: [] }));
      localStorage.setItem("pi-web:last-open-by-workspace", JSON.stringify({ "D:/generated/title-menu-fixture": "main-saved" }));
    }
    const notificationClass = class { static permission = "granted"; static async requestPermission() { return "granted"; } constructor(...args) { window.__nativeNotifications.push(args); } };
    Object.defineProperty(window, "Notification", { value: notificationClass, configurable: true });
  }, { secondary, installed, launchFailure });
}

export async function runNativeConversationDestinations() {
  const out = new URL(`../test-results/pilaude/native-conversation-destinations/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true }); const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", base, checks: [], apiRequests: [], interceptedWrites: [], externalRequests: [], pageErrors: [], consoleErrors: [], ipc: [] };
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const options of [{ secondary: false, installed: true }, { secondary: true, installed: true }, { secondary: false, installed: false }, { secondary: false, installed: true, launchFailure: true }]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block" });
      await installNativeFixture(context, report, options);
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      page.on("pageerror", (error) => report.pageErrors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
      await page.goto(`${base}/?session=title-root`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.locator(".app-topbar-title-trigger").waitFor();
      await page.waitForFunction(() => window.__destinationCalls.some((call) => call.command === "conversation_destinations"));
      await page.locator(".app-topbar-title-trigger").click();
      await page.getByRole("menuitem", { name: "Open in", exact: true }).hover();
      const submenu = page.getByRole("menu", { name: "Open in", exact: true }); await submenu.waitFor();
      const newWindow = submenu.getByRole("menuitem", { name: "New window", exact: true });
      assert.notEqual(await newWindow.getAttribute("aria-disabled"), "true");
      await newWindow.click();
      await page.waitForFunction(() => window.__destinationCalls.some((call) => call.command === "open_conversation_window"));
      await page.waitForFunction(() => !document.querySelector('.app-topbar-title-trigger[aria-busy="true"]'));
      assert.deepEqual(await page.evaluate(() => window.__destinationCalls.filter((call) => call.command === "open_conversation_window").map((call) => call.args)), [{ sessionId: "title-root" }]);
      if (options.launchFailure) {
        await page.getByRole("alert").filter({ hasText: "Generated native destination failure" }).waitFor();
        assert.equal(await page.locator(".app-topbar-title-name").textContent(), "融合实验");
      } else {
        await page.locator(".app-topbar-title-trigger").click(); await page.getByRole("menuitem", { name: "Open in", exact: true }).hover();
        const editor = submenu.getByRole("menuitem", { name: "VS Code (project)", exact: true });
        if (options.installed) {
          assert.match(await editor.getAttribute("title"), /project folder.*conversation is not transferred/);
          await editor.click(); await page.waitForFunction(() => window.__destinationCalls.some((call) => call.command === "open_project_in_vscode"));
          assert.deepEqual(await page.evaluate(() => window.__destinationCalls.filter((call) => call.command === "open_project_in_vscode").map((call) => call.args)), [{ cwd: "D:/generated/title-menu-fixture" }]);
        } else {
          assert.equal(await editor.getAttribute("aria-disabled"), "true"); assert.match(await editor.getAttribute("title"), /not found/);
          await editor.dispatchEvent("click");
          assert.equal(await page.evaluate(() => window.__destinationCalls.filter((call) => call.command === "open_project_in_vscode").length), 0);
        }
      }
      if (options.secondary) {
        assert.equal(await page.locator(".window-controls").count(), 0, "Decorated conversation windows use OS controls");
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("pi-workspace-v1")).sessionId), "main-saved", "Secondary view cannot overwrite the main cold-start workspace");
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("pi-web:last-open-by-workspace"))["D:/generated/title-menu-fixture"]), "main-saved", "Secondary selection cannot replace main workspace selection");
        assert.equal(await page.evaluate(() => window.__destinationCalls.filter((call) => call.command === "set_close_quits").length), 0);
        await page.evaluate(() => window.__emitDestinationEvent("/api/scheduled-tasks/events", { type: "run_finished", taskId: "fixture", runId: "generated-run", taskName: "Generated scheduled notification", sessionId: "title-root", status: "succeeded" }));
        assert.equal(await page.evaluate(() => window.__nativeNotifications.length), 0, "Secondary scheduled events cannot deliver duplicate notifications");
        assert.equal(await page.evaluate(() => window.__destinationCalls.some((call) => call.command.startsWith("plugin:notification|"))), false);
        assert.deepEqual(await page.evaluate(() => { const d = Object.getOwnPropertyDescriptor(window, "__PILAUDE_CONVERSATION_WINDOW__"); return { value: d.value, writable: d.writable, configurable: d.configurable }; }), { value: true, writable: false, configurable: false });
      }
      report.ipc.push({ options, calls: await page.evaluate(() => window.__destinationCalls) });
      await page.screenshot({ path: artifact(`native-${options.secondary ? "secondary" : options.launchFailure ? "failure" : options.installed ? "available" : "unavailable"}.png`), scale: "css", style: "nextjs-portal{visibility:hidden!important}" });
      await context.close();
    }
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.externalRequests, []);
    assert.equal(report.consoleErrors.some((error) => /Maximum update depth/.test(error)), false);
    report.checks.push("Native New window sends only selected session ID", "Installed VS Code action sends selected project cwd only; unavailable editor never launches", "Native launch failure is visible and preserves selection", "Secondary view preserves main workspace memory and lifecycle; uses OS controls; immutable marker", "All external/HTTP/IPC effects mocked; no live WebView or executable was launched");
    report.status = "passed";
  } catch (error) { report.status = "failed"; report.error = error.stack ?? String(error); throw error; }
  finally { await writeFile(artifact("report.json"), `${JSON.stringify(report, null, 2)}\n`); await browser?.close(); console.log(JSON.stringify({ status: report.status, checks: report.checks, report: artifact("report.json") })); }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runNativeConversationDestinations();
