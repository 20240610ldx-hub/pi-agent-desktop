import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installActivityFixture } from "./activity-disclosure.mjs";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const project = "D:/generated/task-fixture";
const stamp = "2026-10-19T12:00:00.000Z";
const session = (id, status, parent = "task-main") => ({
  id, name: `Task fixture ${id}`, firstMessage: "Generated task session", cwd: project,
  projectRoot: project, projectKey: project, path: `${project}/${id}.jsonl`, created: stamp,
  modified: stamp, messageCount: 2,
  ...(status ? { relation: { kind: "subagent", parentSessionId: parent, profile: "researcher", description: id === "running-a" ? "Running task with an intentionally long description ".repeat(12) : `Task ${id}`, status } } : {}),
});

export async function installTaskFixture(context, report) {
  await installActivityFixture(context, report);
  const state = {
    sessions: [session("task-main"), ...["running-a", "running-b", "queued", "starting", "completed", "failed", "aborted", "interrupted", "extra"].map((id) => session(id, id.startsWith("running") ? "running" : id === "extra" ? "completed" : id)), session("other-main"), session("foreign-task", "running", "other-main")],
    running: ["running-a", "running-b", "foreign-task"], revision: 1, rejectControl: false,
  };
  await context.addInitScript(() => {
    localStorage.setItem("pi-workspace-pane-layout-v1", JSON.stringify({ version: 1, columns: [{ id: "tasks-column", paneIds: ["tasks"], width: 460, split: .5 }], expandedPaneId: null }));
    localStorage.setItem("pi-workspace-pane-visibility-v1", "true");
    const Original = window.EventSource;
    const sources = [];
    window.EventSource = class extends Original {
      constructor(url) { super(url); sources.push(this); }
    };
    window.__taskEvents = (value) => {
      for (const source of sources.filter(source => source.readyState === 1 && source.url === "/api/agent/running/events")) source.emit(value);
    };
  });
  await context.route("**/api/**", async (route) => {
    const request = route.request(), url = new URL(request.url());
    const record = { method: request.method(), path: url.pathname + url.search };
    if (request.method() === "POST" && /^\/api\/subagents\/[^/]+$/.test(url.pathname)) {
      report.interceptedWrites.push({ ...record, body: request.postData() });
      return state.rejectControl ? route.fulfill({ status: 409, json: { error: "Generated task control failure" } }) : route.fulfill({ json: { success: true } });
    }
    if (request.method() !== "GET") return route.fallback();
    if (url.pathname === "/api/sessions") return route.fulfill({ json: { sessions: state.sessions, runningSessionIds: state.running, sessionListVersion: state.revision } });
    const info = state.sessions.find(item => url.pathname === `/api/sessions/${item.id}`);
    if (info) return route.fulfill({ json: { sessionId: info.id, filePath: info.path, leafId: `${info.id}-answer`, tree: [], treeFormat: "summary", snapshotRevision: `task-${state.revision}`, totalActiveMs: 0,
      context: { messages: [{ role: "user", content: `Inspect ${info.id}`, timestamp: Date.parse(stamp) }, { role: "assistant", content: [{ type: "text", text: `Generated answer for ${info.id}` }], timestamp: Date.parse(stamp) + 1000, stopReason: "stop" }], entryIds: [`${info.id}-user`, `${info.id}-answer`], oldestEntryId: `${info.id}-user`, hasMore: false, model: null, thinkingLevel: "off" },
      stats: { totalMessages: 2, userMessages: 1, assistantMessages: 1, toolCalls: 0, toolResults: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }, cost: 0, costBreakdown: [] } } });
    if (url.pathname === "/api/agent/running") return route.fulfill({ json: { runningSessionIds: state.running, sessionListVersion: state.revision } });
    return route.fallback();
  });
  return state;
}

export async function runTaskActivity() {
  const out = new URL(`../test-results/pilaude/task-activity/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = name => fileURLToPath(new URL(name, out));
  const report = { status: "running", base, checks: [], captures: [], measurements: [], apiRequests: [], thinkingRequests: [], interceptedWrites: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
  let browser, page, phone;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block" });
    const state = await installTaskFixture(context, report);
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on("pageerror", error => report.pageErrors.push(error.message));
    page.on("console", message => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    const capture = async name => { await page.screenshot({ path: artifact(`${name}.png`), scale: "css", style: "nextjs-portal{visibility:hidden!important}" }); report.captures.push(artifact(`${name}.png`)); };
    await page.goto(`${base}/?session=task-main`, { waitUntil: "domcontentloaded", timeout: 90000 });
    const panel = page.locator(".workspace-tasks-content .agent-session-panel");
    await panel.getByRole("button", { name: "Steer sub-agent", exact: true }).first().waitFor();
    const selectedBefore = new URL(page.url()).searchParams.get("session");
    await panel.getByRole("button", { name: "Steer sub-agent", exact: true }).first().press("Enter");
    await panel.getByRole("textbox", { name: "Steer sub-agent", exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("session"), selectedBefore, "Enter on a child action does not select the task row");
    report.checks.push("Native child action Enter opens steering without selecting its parent task");
    await capture("keyboard-steer-open");
    const steer = panel.getByRole("textbox", { name: "Steer sub-agent", exact: true });
    await steer.fill("Generated steering message");
    const controlWrites = () => report.interceptedWrites.filter(item => item.path.startsWith("/api/subagents/"));
    await steer.dispatchEvent("keydown", { key: "Enter", code: "Enter", keyCode: 229, isComposing: false });
    assert.equal(controlWrites().length, 0, "IME commit does not send steering");
    await steer.dispatchEvent("keydown", { key: "Escape", code: "Escape", isComposing: true });
    assert.equal(await steer.isVisible(), true, "IME Escape does not close steering");
    await steer.press("Enter");
    await steer.waitFor({ state: "hidden" });
    assert.deepEqual(JSON.parse(controlWrites().at(-1).body), { action: "steer", message: "Generated steering message" });
    assert.equal(new URL(page.url()).searchParams.get("session"), selectedBefore);
    report.checks.push("IME Enter and Escape are guarded; ordinary Enter sends one intercepted steering request");
    const runningA = panel.locator('[data-session-id="running-a"]');
    await runningA.getByRole("button", { name: "Steer sub-agent", exact: true }).press("Space");
    await steer.waitFor();
    await steer.press("Escape");
    await steer.waitFor({ state: "hidden" });
    assert.equal(new URL(page.url()).searchParams.get("session"), selectedBefore, "Space action does not select a task");
    const rowSelect = runningA.locator(".agent-session-select");
    await rowSelect.dispatchEvent("keydown", { key: "Enter", code: "Enter", keyCode: 229, isComposing: false });
    assert.equal(new URL(page.url()).searchParams.get("session"), selectedBefore, "IME Enter does not select a session");
    await rowSelect.press("Enter");
    await page.waitForURL(url => url.searchParams.get("session") === "running-a");
    await runningA.locator('.agent-session-select[aria-current="true"]').waitFor();
    assert.equal(await panel.locator('[data-session-id="foreign-task"]').count(), 0, "Another family is isolated");
    await panel.locator('[data-session-id="task-main"] .agent-session-select').press("Space");
    await page.waitForURL(url => url.searchParams.get("session") === "task-main");
    report.checks.push("Native Enter/Space select sessions; child actions do not navigate; foreign family stays isolated");
    const search = panel.getByRole("searchbox");
    await search.fill("not-a-real-task");
    await panel.getByText("No matching agents", { exact: true }).waitFor();
    assert.equal(await panel.locator(".agent-session-row").count(), 1, "Main session remains available with no matches");
    await search.fill("researcher");
    assert.equal(await panel.locator(".agent-session-row").count(), 10, "Profile filtering includes every matching subagent");
    await search.fill("");
    for (const status of ["queued", "starting", "completed", "failed", "aborted", "interrupted"]) {
      assert.equal(await panel.locator(`[data-session-id="${status}"]`).getAttribute("data-status"), status);
    }
    assert.equal(await panel.locator('[data-status="running"]').count(), 2);
    assert.equal(await panel.locator(".animate-spin").count(), 0);
    const staticFrames = await panel.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations === Infinity).length);
    assert.equal(staticFrames, 0, "Parallel tasks add no continuous animations beside chat activity");
    report.checks.push("Filter/no matches/long labels and all persisted states; two parallel tasks remain static");
    await capture("task-light-states");
    const publish = async () => {
      state.revision++;
      await page.evaluate(value => window.__taskEvents(value), { type: "running", runningSessionIds: state.running, sessionListVersion: state.revision });
    };
    state.sessions.find(item => item.id === "running-a").relation.status = "completed";
    state.running = state.running.filter(id => id !== "running-a");
    await publish();
    await page.waitForFunction(() => document.querySelector('.workspace-tasks-content [data-session-id="running-a"]')?.getAttribute("data-status") === "completed");
    assert.equal(await panel.locator('[data-session-id="running-b"]').getAttribute("data-status"), "running");
    assert.equal(await runningA.getByRole("button", { name: "Stop sub-agent", exact: true }).count(), 0);
    report.checks.push("SSE completion updates one task while its parallel sibling stays running");
    state.rejectControl = true;
    await panel.locator('[data-session-id="running-b"]').getByRole("button", { name: "Stop sub-agent", exact: true }).press("Space");
    await panel.getByRole("alert").getByText("Generated task control failure", { exact: true }).waitFor();
    assert.deepEqual(JSON.parse(controlWrites().at(-1).body), { action: "abort" });
    assert.equal(new URL(page.url()).searchParams.get("session"), "task-main");
    assert.equal(await panel.locator('[data-session-id="running-b"]').getAttribute("data-status"), "running", "Failed control does not fabricate stopped state");
    report.checks.push("Stop is intercepted once, failure remains visible, task status is not fabricated");
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "dark" });
    const styles = await panel.evaluate(element => ({ font: getComputedStyle(element).fontFamily, overflow: element.scrollWidth > element.clientWidth, statusColors: [...element.querySelectorAll('.agent-session-status-icon')].map(icon => ({ status: icon.closest('[data-status]').dataset.status, color: getComputedStyle(icon).color })) }));
    assert.equal(styles.overflow, false); report.measurements.push({ name: "dark-task-states", ...styles });
    assert.equal(await panel.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations === Infinity).length), 0);
    await capture("task-dark-states");
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await panel.evaluate(element => element.getAnimations({ subtree: true }).length), 0);
    state.sessions = state.sessions.filter(item => item.id === "task-main" || item.id === "other-main" || item.id === "foreign-task");
    state.running = ["foreign-task"];
    await publish();
    await panel.getByText("No sub-agents in this session", { exact: true }).waitFor();
    assert.equal(await panel.locator(".agent-session-row").count(), 1);
    report.checks.push("Empty family remains usable; normal/reduced motion and dark state colors measured");
    const mobile = await browser.newContext({ viewport: { width: 430, height: 812 }, isMobile: true, hasTouch: true, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block" });
    await installTaskFixture(mobile, report);
    phone = await mobile.newPage();
    await phone.goto(`${base}/?session=task-main`, { waitUntil: "domcontentloaded", timeout: 90000 });
    const phonePanel = phone.locator(".workspace-tasks-content .agent-session-panel");
    await phone.getByText("Generated answer for task-main", { exact: true }).waitFor({ state: "attached" });
    await phone.locator('.right-panel-toggle-button').waitFor();
    await phone.locator('.right-panel-toggle-button').click();
    await phonePanel.getByRole("button", { name: "Stop sub-agent", exact: true }).first().waitFor();
    const sizes = await phonePanel.locator(".agent-session-action").evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return { width: box.width, height: box.height, hit: hit === element || element.contains(hit) };
    }));
    assert.ok(sizes.length > 0 && sizes.every(size => size.width >= 44 && size.height >= 44 && size.hit));
    report.measurements.push({ name: "touch-action-targets", sizes });
    await phonePanel.getByRole("button", { name: "Steer sub-agent", exact: true }).first().tap();
    const phoneSteer = phonePanel.getByRole("textbox", { name: "Steer sub-agent", exact: true });
    await phoneSteer.waitFor();
    await phoneSteer.press("Escape");
    await phoneSteer.waitFor({ state: "hidden" });
    const phoneScroll = phonePanel.locator('[role="list"]');
    await phoneScroll.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await phonePanel.locator('[data-session-id="extra"] .agent-session-select').tap();
    await phone.waitForURL(url => url.searchParams.get("session") === "extra");
    await phonePanel.locator('[data-session-id="extra"] .agent-session-select[aria-current="true"]').waitFor();
    report.checks.push("Touch action centers hit their buttons; tapping Steer opens input and the last long-list task remains selectable");
    await phone.screenshot({ path: artifact("task-touch.png"), scale: "css", style: "nextjs-portal{visibility:hidden!important}" }); report.captures.push(artifact("task-touch.png"));
    await mobile.close();
    report.checks.push("Touch Stop/Steer actions measure at least 44 by 44 CSS pixels");
    assert.equal(report.pageErrors.length, 0);
    report.status = "passed";
  } catch (error) {
    report.status = "failed"; report.error = error.stack ?? String(error);
    if (page) { await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {}); report.captures.push(artifact("failure.png")); }
    if (phone && !phone.isClosed()) { await phone.screenshot({ path: artifact("touch-failure.png"), scale: "css" }).catch(() => {}); report.captures.push(artifact("touch-failure.png")); }
    throw error;
  } finally {
    await writeFile(artifact("report.json"), JSON.stringify(report, null, 2));
    await browser?.close();
    console.log(JSON.stringify({ status: report.status, checks: report.checks, report: artifact("report.json"), error: report.error }, null, 2));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runTaskActivity();
