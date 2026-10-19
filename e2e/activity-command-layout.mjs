import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installActivityFixture } from "./activity-disclosure.mjs";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const stamp = Date.UTC(2026, 9, 19, 14);
// Data only. No command string in this fixture is submitted to a process/API executor.
export const COMMAND_FIXTURE = Object.freeze({
  bash: 'git -C "D:/generated/activity-fixture" diff --numstat fixture-base -- src/example.mjs',
  powershell: 'git -C "D:/generated/activity-fixture" diff --numstat fixture-base -- src/example.ps1',
  long: 'generated-command --value "<tag>&quoted" --path "D:/generated/' + "nested-folder/".repeat(24) + 'example.txt"\r\n  generated-tail\r\n',
  longOutput: "generated\tvalue\r\n" + "unbroken-output-segment".repeat(40) + "\r\n",
  budget: 'generated-command --value "' + "<tag>& very long value ".repeat(230) + '"\r\n',
  output: "147\t27\tsrc/example.mjs\n",
  powershellOutput: "12\t3\tsrc/example.ps1\r\n",
  partial: '{"command":"git -C \\"D:/generated/activity-fixture\\" diff --numstat',
  codemode: 'const result = await tools.read({ path: "src/example.mjs" });\nreturn result;',
});
const tool = (id, toolName, input, extra = {}) => ({ type: "toolCall", toolCallId: id, toolName, input, ...extra });
const assistant = (content, offset) => ({ role: "assistant", content, timestamp: stamp + offset, provider: "generated", model: "generated", stopReason: "stop" });
const result = (id, toolName, text, extra = {}) => ({ role: "toolResult", toolCallId: id, toolName, content: [{ type: "text", text }], timestamp: stamp + 2000, isError: false, ...extra });

/** Actual AppShell/MessageView; all HTTP, EventSource and clipboard effects use fixture boundaries. */
export async function installCommandLayoutFixture(context, report) {
  const state = await installActivityFixture(context, report);
  const calls = [
    tool("command-bash", "bash", { command: COMMAND_FIXTURE.bash }),
    tool("command-powershell", "powershell", { command: COMMAND_FIXTURE.powershell }),
    tool("command-long", "bash", { command: COMMAND_FIXTURE.long }),
    tool("command-budget", "bash", { command: COMMAND_FIXTURE.budget }),
    tool("command-mcp", "mcp__fixture__inspect", { command: "generated inspection", options: { raw: true } }),
    tool("command-codemode", "codemode", { code: COMMAND_FIXTURE.codemode }),
    tool("command-partial", "bash", {}, { rawInput: COMMAND_FIXTURE.partial }),
    tool("command-invalid", "powershell", { command: 17, options: ["generated"] }),
    tool("command-timeout", "bash", { command: "generated-with-timeout", timeout: 3 }),
    tool("command-extra", "powershell", { command: "generated-with-extension-option", cwd: "D:/generated/other" }),
    tool("command-error", "bash", { command: "generated-command --fail" }),
  ];
  state.messages = [
    { role: "user", content: "Inspect the generated command layout fixture.", timestamp: stamp },
    assistant(calls, 1000),
    result("command-bash", "bash", COMMAND_FIXTURE.output),
    result("command-powershell", "powershell", COMMAND_FIXTURE.powershellOutput),
    result("command-long", "bash", COMMAND_FIXTURE.longOutput),
    result("command-budget", "bash", "Generated budget-fallback output.\n"),
    result("command-mcp", "mcp__fixture__inspect", '{"generated":true,"count":2}'),
    result("command-codemode", "codemode", "Script completed\nWall time 0.1 seconds\nOutput:\n", { content: [{ type: "text", text: "Script completed\nWall time 0.1 seconds\nOutput:\n" }, { type: "text", text: "Generated code result." }], details: { calls: [{ id: "nested-generated-read", name: "read", args: '{"path":"src/example.mjs"}', status: "ok", durationMs: 4 }] } }),
    result("command-invalid", "powershell", "Generated invalid-shape fallback result."),
    result("command-timeout", "bash", "Generated timeout fallback result."),
    result("command-extra", "powershell", "Generated extension fallback result."),
    result("command-error", "bash", "Generated command failure.\n", { isError: true }),
    assistant([{ type: "text", text: "Generated command layout answer remains separate." }], 3000),
  ];
  state.entryIds = state.messages.map((_, index) => `generated-command-entry-${index}`);
  state.revision++;
  await context.addInitScript(() => {
    window.__commandClipboard = [];
    window.__commandCopyFails = false;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text) => { if (window.__commandCopyFails) throw new Error("Generated clipboard denial"); window.__commandClipboard.push(text); } } });
    document.execCommand = () => false;
    sessionStorage.removeItem("pi-web:tab-open-session");
  });
  return state;
}

async function linkedBody(trigger) {
  const id = await trigger.getAttribute("aria-controls");
  assert.ok(id, "Disclosure identifies its content region");
  return trigger.page().locator(`[id=${JSON.stringify(id)}]`);
}
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.effect?.getComputedTiming().iterations === Infinity || animation.playState !== "running"));
}
async function openTool(page, id) {
  const row = page.locator(`[data-tool-call-id=${JSON.stringify(id)}]`);
  const trigger = row.locator(".tool-call-trigger");
  await trigger.scrollIntoViewIfNeeded();
  if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
  await settle(page);
  return { row, trigger, body: await linkedBody(trigger) };
}
async function exactCopy(page, body, index, expected) {
  const controls = body.locator(".code-copy-control");
  assert.ok(await controls.count() > index, "Expanded input/output keeps a reachable copy action");
  const before = await page.evaluate(() => window.__commandClipboard.length);
  await controls.nth(index).getByRole("button").click();
  await page.waitForFunction((length) => window.__commandClipboard.length === length + 1, before);
  assert.equal(await page.evaluate(() => window.__commandClipboard.at(-1)), expected, "Clipboard receives the exact original payload, without prompt prefixes or truncation");
}

export async function runActivityCommandLayout() {
  const out = new URL(`../test-results/pilaude/activity-command-layout/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true }); const artifact = (name) => fileURLToPath(new URL(name, out));
  const captureOnly = process.env.E2E_COMMAND_CAPTURE_ONLY === "1";
  const report = { status: "running", base, captureOnly, checks: [], captures: [], measurements: [], apiRequests: [], thinkingRequests: [], interceptedWrites: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1300, height: 1000 }, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block" });
    await installCommandLayoutFixture(context, report);
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    await page.goto(`${base}/?session=activity`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByText("Generated command layout answer remains separate.", { exact: true }).waitFor();
    const group = page.locator(".process-details-trigger").first();
    if (await group.getAttribute("aria-expanded") !== "true") await group.click();
    const groupBody = await linkedBody(group);
    const initialBash = await openTool(page, "command-bash");
    // Always preserve the pre-fix rendered geometry before the first compact-shell assertion.
    const panelClose = page.locator('.right-panel-container.right-panel-open .workspace-pane-close').first();
    if (await panelClose.isVisible()) await panelClose.click();
    const contextToggle = page.locator('.pilaude-context-toggle[aria-pressed="true"]'); if (await contextToggle.count()) await contextToggle.click();
    const sidebarClose = page.getByRole("button", { name: "Hide sidebar", exact: true }); if (await sidebarClose.isVisible()) await sidebarClose.click();
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.classList.toggle("dark", value === "dark"), theme);
      for (const width of [1300, 430]) {
        await page.setViewportSize({ width, height: 1000 }); await initialBash.trigger.scrollIntoViewIfNeeded(); await settle(page);
        const capture = artifact(`command-${theme}-${width}.png`);
        await page.screenshot({ path: capture, scale: "css", style: "nextjs-portal{visibility:hidden!important}" }); report.captures.push(capture);
        const syntax = await initialBash.body.locator(".tool-call-command-text").evaluate((pre) => {
          const string = pre.querySelector(".token.string"), s = getComputedStyle(pre), token = string ? getComputedStyle(string) : null;
          return { theme: document.documentElement.classList.contains("dark") ? "dark" : "light", stringText: string?.textContent, stringColor: token?.color, baseColor: s.color, font: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, fontStyle: s.fontStyle, whiteSpace: s.whiteSpace, tokenFont: token?.fontFamily, tokenSize: token?.fontSize, tokenWeight: token?.fontWeight, tokenStyle: token?.fontStyle, nestedPreCount: pre.querySelectorAll("pre").length, text: pre.textContent, literalElementCount: pre.querySelectorAll("tag").length };
        });
        report.measurements.push({ name: "command-syntax", width, ...syntax });
        assert.equal(syntax.stringText, '"D:/generated/activity-fixture"');
        assert.notEqual(syntax.stringColor, syntax.baseColor, "Only the quoted string receives syntax color");
        assert.equal(syntax.stringColor, theme === "dark" ? "rgb(48, 209, 88)" : "rgb(36, 138, 61)");
        assert.equal(syntax.tokenFont, syntax.font); assert.equal(syntax.tokenSize, syntax.fontSize); assert.equal(syntax.tokenWeight, syntax.fontWeight); assert.equal(syntax.tokenStyle, syntax.fontStyle);
        assert.equal(syntax.nestedPreCount, 0); assert.equal(syntax.text, COMMAND_FIXTURE.bash);
        report.measurements.push(await initialBash.row.evaluate((row, conditions) => {
          const rect = row.getBoundingClientRect(); const body = row.querySelector('[role="region"]'); const input = body?.querySelector("pre"); const style = getComputedStyle(row);
          const box = (node) => { if (!node) return null; const r = node.getBoundingClientRect(), s = getComputedStyle(node); return { x: r.x, y: r.y, width: r.width, height: r.height, border: s.borderWidth, radius: s.borderRadius, background: s.backgroundColor, padding: s.padding, fontSize: s.fontSize }; };
          return { ...conditions, dpr: devicePixelRatio, screenshotScale: "css", row: box(row), body: box(body), input: box(input), commandPill: box(body?.querySelector(".tool-call-command-line")), result: box(body?.querySelector(".tool-call-command-result")), inputText: input?.textContent, font: style.fontFamily, fontSize: style.fontSize, viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, visibleBounds: rect.left >= 0 && rect.right <= innerWidth + 1 };
        }, { theme, width }));
      }
    }
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.externalRequests, []);
    if (captureOnly) { report.status = "baseline-captured"; return report; }
    await page.setViewportSize({ width: 1300, height: 1000 });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    const bash = await openTool(page, "command-bash");
    assert.equal(await bash.body.locator("pre").first().textContent(), COMMAND_FIXTURE.bash, "Completed bash input renders the command itself instead of JSON metadata");
    assert.equal(await bash.body.locator("pre").last().textContent(), COMMAND_FIXTURE.output);
    await exactCopy(page, bash.body, 0, COMMAND_FIXTURE.bash);
    await exactCopy(page, bash.body, 1, COMMAND_FIXTURE.output);
    report.checks.push("Completed bash shows compact exact command and output; both copy exact raw payloads");
    const powerShell = await openTool(page, "command-powershell");
    assert.equal(await powerShell.body.locator("pre").first().textContent(), COMMAND_FIXTURE.powershell);
    await exactCopy(page, powerShell.body, 0, COMMAND_FIXTURE.powershell);
    const powerShellString = powerShell.body.locator(".tool-call-command-text .token.string").first();
    assert.equal(await powerShellString.textContent(), '"D:/generated/activity-fixture"');
    assert.equal(await powerShellString.evaluate((node) => getComputedStyle(node).color), "rgb(36, 138, 61)");
    const long = await openTool(page, "command-long");
    assert.equal((await long.body.locator(".tool-call-command-text").textContent()).replaceAll("\r\n", "\n"), COMMAND_FIXTURE.long.replaceAll("\r\n", "\n"), "Displayed text keeps every line and metacharacter; clipboard separately verifies exact CRLF bytes");
    await page.setViewportSize({ width: 430, height: 1000 }); await settle(page);
    await exactCopy(page, long.body, 0, COMMAND_FIXTURE.long);
    await exactCopy(page, long.body, 1, COMMAND_FIXTURE.longOutput);
    const longBounds = await long.body.evaluate((node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, viewport: innerWidth, pageWidth: document.documentElement.scrollWidth }; });
    assert.ok(longBounds.left >= 0 && longBounds.right <= longBounds.viewport + 1 && longBounds.pageWidth <= longBounds.viewport + 1, "Long command/result wrap without document overflow at430px");
    const budget = await openTool(page, "command-budget");
    assert.ok(COMMAND_FIXTURE.budget.length > 4096);
    assert.equal(await budget.body.locator(".token").count(), 0, "Oversized command skips tokenization rather than truncating source");
    assert.equal((await budget.body.locator(".tool-call-command-text").textContent()).replaceAll("\r\n", "\n"), COMMAND_FIXTURE.budget.replaceAll("\r\n", "\n"));
    assert.equal(await budget.body.locator(".tool-call-command-text tag").count(), 0, "Literal markup remains text in the plain fallback");
    await exactCopy(page, budget.body, 0, COMMAND_FIXTURE.budget);
    await page.setViewportSize({ width: 1300, height: 1000 });
    report.checks.push("Registered Prism shell grammars color quoted strings only, preserve font/wrap/literal text, and fall back to exact plain text above4096characters");
    const mcp = await openTool(page, "command-mcp");
    assert.deepEqual(JSON.parse(await mcp.body.locator("pre").first().textContent()), { command: "generated inspection", options: { raw: true } });
    const partial = await openTool(page, "command-partial");
    assert.equal(await partial.body.locator("pre").first().textContent(), COMMAND_FIXTURE.partial);
    await exactCopy(page, partial.body, 0, COMMAND_FIXTURE.partial);
    const invalid = await openTool(page, "command-invalid");
    assert.deepEqual(JSON.parse(await invalid.body.locator("pre").first().textContent()), { command: 17, options: ["generated"] });
    const timeout = await openTool(page, "command-timeout");
    assert.deepEqual(JSON.parse(await timeout.body.locator("pre").first().textContent()), { command: "generated-with-timeout", timeout: 3 });
    const extra = await openTool(page, "command-extra");
    assert.deepEqual(JSON.parse(await extra.body.locator("pre").first().textContent()), { command: "generated-with-extension-option", cwd: "D:/generated/other" });
    const codemode = await openTool(page, "command-codemode");
    assert.equal(await codemode.body.locator("pre").first().textContent(), COMMAND_FIXTURE.codemode);
    assert.equal(await codemode.body.getByText("Tool calls", { exact: true }).isVisible(), true);
    assert.equal(await codemode.body.getByText("Generated code result.", { exact: true }).isVisible(), true);
    await exactCopy(page, codemode.body, 0, COMMAND_FIXTURE.codemode);
    report.checks.push("PowerShell uses the same validated command layout; MCP JSON, partial input, malformed shell input and codemode retain their real formats");
    const failed = await openTool(page, "command-error");
    assert.equal(await failed.row.getAttribute("data-status"), "error");
    assert.equal(await failed.body.getByText("Generated command failure.", { exact: true }).isVisible(), true);
    await page.evaluate(() => { window.__commandCopyFails = true; });
    await failed.body.getByRole("button", { name: "Copy", exact: true }).first().click();
    await failed.body.getByRole("status").filter({ hasText: "Could not copy" }).waitFor();
    await page.evaluate(() => { window.__commandCopyFails = false; });
    await failed.trigger.focus(); await failed.trigger.press("Enter");
    assert.equal(await failed.trigger.getAttribute("aria-expanded"), "false");
    assert.equal(await failed.body.getAttribute("aria-hidden"), "true");
    assert.equal(await failed.body.evaluate((node) => node.inert), true);
    assert.equal(await failed.trigger.evaluate((node) => node === document.activeElement), true);
    await failed.trigger.press("Space"); assert.equal(await failed.trigger.getAttribute("aria-expanded"), "true");
    assert.equal(await groupBody.count(), 1);
    assert.ok(report.measurements.filter((measurement) => measurement.row).every((measurement) => measurement.visibleBounds && measurement.documentWidth <= measurement.viewportWidth + 1), "1300/430 widths keep command bodies inside the viewport");
    assert.deepEqual(report.interceptedWrites, [], "Rendering/copying never submits a command or writes API data");
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.externalRequests, []);
    report.checks.push("Failure remains visible; copy errors are announced; keyboard disclosure keeps ARIA/inert/focus; no overflow or API writes");
    report.status = "passed";
  } catch (error) { report.status = "failed"; report.error = error.stack ?? String(error); throw error; }
  finally { await writeFile(artifact("report.json"), `${JSON.stringify(report, null, 2)}\n`); await browser?.close(); console.log(JSON.stringify({ status: report.status, checks: report.checks, report: artifact("report.json") })); }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runActivityCommandLayout();
