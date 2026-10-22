import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SIDEBAR_PIN_METADATA_KEY = "pi-web:sidebar-session-metadata-v1";
const project = "D:/generated/sidebar-project";
const otherProject = "D:/generated/other-project";
const stamp = Date.UTC(2026, 9, 19, 12);
const session = (id, overrides = {}) => ({
  id, name: `Pin fixture ${id}`, firstMessage: `Generated sidebar ${id}`,
  cwd: project, projectRoot: project, projectKey: project,
  path: `${project}/${id}.jsonl`, created: new Date(stamp).toISOString(),
  modified: new Date(stamp - 1000).toISOString(), messageCount: 2, transient: false, ...overrides,
});
export const SIDEBAR_PIN_SESSIONS = [
  session("a", { modified: new Date(stamp).toISOString() }),
  session("b"), session("a-child", { parentSessionId: "a" }), session("b-child", { parentSessionId: "b" }),
  session("group-x"), session("group-y"), session("transient", { transient: true }),
  session("hidden"), session("unpinned"), session("orphan", { parentSessionId: "missing-parent" }),
  session("archived"), session("overflow-e"), session("overflow-f"),
  session("other", { cwd: otherProject, projectRoot: otherProject, projectKey: otherProject }),
];
export const SIDEBAR_PIN_METADATA = {
  version: 1,
  pinnedIds: ["other", "b", "b-child", "archived", "a", "a-child", "group-x", "transient", "group-y", "hidden", "orphan"],
  archivedIds: ["archived"],
  groups: [{ id: "g", name: "Fixture group" }],
  memberships: [{ sessionId: "group-x", groupId: "g" }, { sessionId: "group-y", groupId: "g" }],
};

/** Replace every API/SSE boundary before opening the real app. No session/model writes. */
export async function installSidebarPinFixture(context, base, report) {
  await context.addInitScript(({ key, metadata }) => {
    if (window.top !== window || !/^https?:$/.test(window.location.protocol)) return;
    if (!sessionStorage.getItem("sidebar-pin-initialized")) {
      sessionStorage.setItem("sidebar-pin-initialized", "1");
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(metadata));
      localStorage.setItem("pi-theme", "light");
      localStorage.setItem("pi-locale", "en");
      localStorage.setItem("pi-workspace-pane-visibility-v1", "false");
      localStorage.setItem("pi-sound-enabled", "false");
    }
    window.EventSource = class extends EventTarget {
      constructor(url) { super(); this.url = String(url); this.readyState = 1; }
      close() { this.readyState = 2; }
      static CONNECTING = 0; static OPEN = 1; static CLOSED = 2;
    };
  }, { key: SIDEBAR_PIN_METADATA_KEY, metadata: SIDEBAR_PIN_METADATA });
  await context.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) {
      report.externalRequests.push(request.url());
      return route.fulfill({ status: 200, body: "" });
    }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (!["GET", "HEAD"].includes(request.method())) {
      report.nonReadRequests.push({ method: request.method(), path: url.pathname, body: request.postData() });
      return route.fulfill({ status: 409, json: { error: "Sidebar fixture does not execute writes" } });
    }
    report.apiReads.push(url.pathname + url.search);
    if (url.pathname === "/api/sessions") return route.fulfill({ json: { sessions: SIDEBAR_PIN_SESSIONS } });
    if (url.pathname === "/api/sessions/search") return route.fulfill({ json: { results: [{ session: SIDEBAR_PIN_SESSIONS[0], before: "", match: "Pin fixture", after: "", entryId: "answer" }], truncated: false } });
    const info = SIDEBAR_PIN_SESSIONS.find((item) => url.pathname === `/api/sessions/${item.id}`);
    if (info) return route.fulfill({ json: {
      info, sessionId: info.id, filePath: info.path, leafId: "answer", tree: [], treeFormat: "summary", snapshotRevision: "sidebar-fixture-v1", totalActiveMs: 0,
      context: { messages: [{ role: "user", content: "Generated sidebar fixture", timestamp: stamp }, { role: "assistant", content: [{ type: "text", text: "Generated sidebar fixture ready." }], timestamp: stamp + 1000, stopReason: "stop", provider: "generated", model: "generated" }], entryIds: ["user", "answer"], oldestEntryId: "user", hasMore: false, model: null, thinkingLevel: "off" },
      stats: { totalMessages: 2, userMessages: 1, assistantMessages: 1, toolCalls: 0, toolResults: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }, cost: 0, costBreakdown: [] },
    } });
    if (url.pathname === "/api/custom-css") return route.fulfill({ contentType: "text/css", body: "" });
    const data = {
      "/api/home": { home: project, homeDir: project },
      "/api/cwd/status": { availability: "available" },
      "/api/open-in-explorer": { supported: false, reason: "Generated fixture", platform: "win32" },
      "/api/worktrees": { projectRoot: project, projectKey: project, isGit: false, isTopLevel: true, currentWorktreePath: project, worktrees: [] },
      "/api/scheduled-tasks": { tasks: [], scheduler: { owner: false, ownerInfo: null } },
      "/api/desktop/environment": { hostname: "Generated fixture", platform: "win32" },
      "/api/models": { models: {}, modelList: [], defaultModel: null, modelScopeWarnings: [] },
      "/api/models/enabled": { allEnabled: true, patterns: null, stalePatterns: [], enabledTotal: 0, availableTotal: 0, providers: [], scope: "global", settingsPath: "generated", editable: false },
      "/api/models/nonchat": { classifier: [], image: [], codemode: "automatic" },
      "/api/project-trust": { requiresTrust: false, trusted: true, decision: null, inherited: false },
      "/api/auth/providers": { oauthProviders: [], apiKeyProviders: [] },
      "/api/models-config": { providers: {} },
      "/api/updates": { updates: [], nextCheckAt: "2099-01-01T00:00:00Z" },
      "/api/web-auth": { enabled: false },
      "/api/tools/settings": { powerShellEnabled: false, powerShellAvailable: false },
      "/api/artifacts/settings": { enabled: false },
      "/api/git/status": { isGitRepository: false, files: [] },
    };
    return route.fulfill({ json: url.pathname.startsWith("/api/agent/") ? { running: false, runningSessionIds: [] } : data[url.pathname] ?? {} });
  });
}

export async function checkSidebarPinOrder(page, base, report, capture = async () => {}) {
  page.setDefaultTimeout(15000);
  const tree = page.locator(".sidebar-project-tree-group").filter({ has: page.locator(".sidebar-project-tree-row-main", { hasText: "sidebar-project" }) });
  const main = (id, scope = tree) => scope.getByRole("button", { name: `Pin fixture ${id}`, exact: true });
  const roots = () => tree.locator('.session-tree-item[data-session-depth="0"] > div > .session-item > .session-item-main').allTextContents();
  const metadata = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SIDEBAR_PIN_METADATA_KEY);
  const waitFor = async (check, message) => {
    const deadline = Date.now() + 15000;
    while (!await check()) {
      if (Date.now() > deadline) throw new Error(message);
      await page.waitForTimeout(30);
    }
  };
  const expectMetadata = async (expected, message) => waitFor(async () => JSON.stringify(await metadata()) === JSON.stringify(expected), message);
  const unchanged = async (button, options = {}) => {
    const before = await metadata();
    const result = await button.evaluate((element, options) => {
      const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowDown", altKey: true, ...options });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }, options);
    assert.equal(result, false, "Ineligible input remains unconsumed");
    assert.deepEqual(await metadata(), before, "Ignored shortcut leaves every metadata field intact");
  };
  await page.goto(`${base}/?session=a`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await main("b").waitFor();
  await expectMetadata(SIDEBAR_PIN_METADATA, "Initial pin metadata hydrated");
  await waitFor(async () => JSON.stringify(await roots()) === JSON.stringify(["Pin fixture b", "Pin fixture a", "Pin fixture transient", "Pin fixture group-x", "Pin fixture group-y"]), "Initial DOM reflects hydrated pin order and buckets");
  assert.deepEqual(await roots(), ["Pin fixture b", "Pin fixture a", "Pin fixture transient", "Pin fixture group-x", "Pin fixture group-y"]);
  assert.equal(await main("hidden").count(), 0, "Sixth root stays outside the preview");
  await main("b").focus();
  await main("b").evaluate((button) => { window.__sidebarPinFocusedRow = button; });
  await page.keyboard.press("Alt+ArrowDown");
  const moved = { ...SIDEBAR_PIN_METADATA, pinnedIds: ["other", "a", "b-child", "archived", "b", "a-child", "group-x", "transient", "group-y", "hidden", "orphan"] };
  await expectMetadata(moved, "Alt+Down swaps displayed eligible roots only");
  assert.deepEqual((await roots()).slice(0, 2), ["Pin fixture a", "Pin fixture b"]);
  assert.equal(await main("hidden").isVisible(), true, "A successful move expands the preview to retain its keyed roots");
  assert.equal(await main("b").evaluate((button) => button === window.__sidebarPinFocusedRow && button === document.activeElement), true, "Same keyed row keeps native focus");
  assert.equal(await main("b-child").count(), 1, "Family children remain attached");
  await tree.locator(".sidebar-project-tree-show-more").click();
  await main("b").focus();
  await page.keyboard.press("Alt+ArrowDown");
  assert.deepEqual(await metadata(), moved, "Last displayed eligible root cannot cross the hidden cap or pin/group boundary");
  await page.keyboard.press("Alt+ArrowUp");
  await expectMetadata(SIDEBAR_PIN_METADATA, "Alt+Up reverses the adjacent swap");
  await tree.locator(".sidebar-project-tree-show-more").click();
  await main("b").focus();
  await page.keyboard.press("Alt+ArrowUp");
  assert.deepEqual(await metadata(), SIDEBAR_PIN_METADATA, "First root stops at bucket boundary");
  for (const options of [{ altKey: false }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { isComposing: true }, { keyCode: 229 }]) await unchanged(main("b"), options);
  await unchanged(main("b").locator(".session-item-title"));
  await unchanged(main("b").locator("..").locator(".session-item-more"));
  for (const id of ["a-child", "transient"]) await unchanged(main(id));
  const otherTree = page.locator(".sidebar-project-tree-group").filter({ has: page.locator(".sidebar-project-tree-row-main", { hasText: "other-project" }) });
  await main("other", otherTree).focus();
  await page.keyboard.press("Alt+ArrowDown");
  assert.deepEqual(await metadata(), SIDEBAR_PIN_METADATA, "A different project's sole pin cannot cross into this project");
  const recent = page.locator(".sidebar-recent-items .session-item-main").first();
  await unchanged(recent);
  await capture("pin-order-preview");
  report.checks.push("Persisted rank order; adjacent Alt moves; same keyed native focus; descendants and unrelated metadata intact; preview-cap boundary; ordinary/modifier/IME guards; recent duplicates and transients ignored");

  await main("group-y").focus();
  await page.keyboard.press("Alt+ArrowUp");
  const grouped = { ...SIDEBAR_PIN_METADATA, pinnedIds: ["other", "b", "b-child", "archived", "a", "a-child", "group-y", "transient", "group-x", "hidden", "orphan"] };
  await expectMetadata(grouped, "Custom-group roots move only inside their displayed bucket");
  await tree.locator(".sidebar-project-tree-show-more").click();
  await main("group-y").focus();
  await page.keyboard.press("Alt+ArrowUp");
  assert.deepEqual(await metadata(), grouped, "Custom group cannot cross to ungrouped roots");
  await page.reload({ waitUntil: "domcontentloaded" });
  await main("group-y").waitFor();
  await expectMetadata(grouped, "Order survives reload");
  await waitFor(async () => JSON.stringify(await roots()) === JSON.stringify(["Pin fixture b", "Pin fixture a", "Pin fixture transient", "Pin fixture group-y", "Pin fixture group-x"]), "Reloaded DOM reflects hydrated pin order and buckets");
  assert.deepEqual(await roots(), ["Pin fixture b", "Pin fixture a", "Pin fixture transient", "Pin fixture group-y", "Pin fixture group-x"]);
  report.checks.push("Custom-group ordering and group boundary; reload persistence");

  await tree.locator(".sidebar-project-tree-show-more").click();
  await main("unpinned").waitFor();
  await unchanged(main("unpinned"));
  await unchanged(main("orphan"));
  await page.locator(".sidebar-archived-toggle").click();
  await unchanged(main("archived", page.locator(".sidebar-archived-sessions")));
  const search = page.locator(".sidebar-search-input");
  await search.fill("Pin fixture");
  await main("b").waitFor();
  await unchanged(main("b"));
  await search.press("Enter");
  await waitFor(async () => await page.locator(".sidebar-project-tree").count() === 0, "Content search replaces the tree");
  const searchResult = page.locator(".session-sidebar button").filter({ has: page.locator("mark") }).first();
  await searchResult.waitFor();
  await unchanged(searchResult);
  await search.press("Escape");
  await search.fill("");
  await main("b").waitFor();
  report.checks.push("Unpinned rows, orphan descendants, archived rows, title filter and content search remain ineligible");

  const second = await page.context().newPage();
  try {
    await second.goto(`${base}/?session=a`, { waitUntil: "domcontentloaded", timeout: 90000 });
    const secondTree = second.locator(".sidebar-project-tree-group").filter({ has: second.locator(".sidebar-project-tree-row-main", { hasText: "sidebar-project" }) });
    await secondTree.getByRole("button", { name: "Pin fixture b", exact: true }).waitFor();
    await waitFor(async () => {
      const names = await secondTree.locator('.session-tree-item[data-session-depth="0"] > div > .session-item > .session-item-main').allTextContents();
      return names[0] === "Pin fixture b" && names[1] === "Pin fixture a" && names.indexOf("Pin fixture group-y") < names.indexOf("Pin fixture group-x");
    }, "Second tab hydrates the current pin order before storage synchronization");
    const before = await metadata();
    await main("b").focus();
    await page.keyboard.press("Alt+ArrowDown");
    const crossTab = { ...before, pinnedIds: ["other", "a", "b-child", "archived", "b", "a-child", "group-y", "transient", "group-x", "hidden", "orphan"] };
    await expectMetadata(crossTab, "Reorder persists for storage listeners");
    await waitFor(async () => {
      const names = await secondTree.locator('.session-tree-item[data-session-depth="0"] > div > .session-item > .session-item-main').allTextContents();
      return names[0] === "Pin fixture a" && names[1] === "Pin fixture b";
    }, "Existing second tab observes reordered roots through storage synchronization");
    await capture("pin-order-synced");
    report.checks.push("Existing second tab updates from the real storage event without API writes");
  } finally { await second.close(); }

  // Selected overflow roots replace the fifth preview slot. A move must not
  // eject the focused fourth root when the selected root moves inside the cap.
  const overflowMetadata = {
    version: 1, pinnedIds: ["a", "b", "group-x", "group-y", "overflow-e", "overflow-f"],
    archivedIds: ["transient", "hidden", "unpinned", "orphan", "archived", "other"], groups: [], memberships: [],
  };
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.removeItem("pi-web:expanded-projects");
  }, { key: SIDEBAR_PIN_METADATA_KEY, value: overflowMetadata });
  await page.goto(`${base}/?session=overflow-f`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitFor(async () => JSON.stringify(await roots()) === JSON.stringify(["Pin fixture a", "Pin fixture b", "Pin fixture group-x", "Pin fixture group-y", "Pin fixture overflow-f"]), "Selected sixth root replaces the fifth capped preview slot");
  await main("group-y").focus();
  await main("group-y").evaluate((button) => { window.__sidebarOverflowFocusedRow = button; });
  await page.keyboard.press("Alt+ArrowDown");
  await expectMetadata({ ...overflowMetadata, pinnedIds: ["a", "b", "group-x", "overflow-f", "overflow-e", "group-y"] }, "Move swaps only displayed root slots around the hidden fifth pin");
  assert.equal(await page.evaluate(() => window.__sidebarOverflowFocusedRow?.isConnected && document.activeElement === window.__sidebarOverflowFocusedRow), true, "Moving the fourth preview root past the selected sixth root preserves the same focused button");
  assert.equal(await main("group-y").isVisible(), true, "Moved root remains visible after the selected root enters the cap");
  await capture("pin-order-selected-overflow-focus");
  report.checks.push("Selected sixth-root preview replacement keeps the moved fourth root visible and the same native button focused");
}

/**
 * Start pilaude-ui-verification via preview_start first, then run:
 *   node e2e/sidebar-pin-order.mjs
 * API/SSE fixtures above are the only seed dependency; no real sessions needed.
 */
export async function runSidebarPinOrder() {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { chromium } = await import("playwright");
  const base = "http://127.0.0.1:30142";
  const out = new URL(`../test-results/pilaude/sidebar-pin-order/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", base, checks: [], captures: [], apiReads: [], nonReadRequests: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
  let browser, page;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1300, height: 1100 }, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block" });
    await installSidebarPinFixture(context, base, report);
    page = await context.newPage();
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    const capture = async (name) => {
      await page.screenshot({ path: artifact(`${name}.png`), scale: "css", style: "nextjs-portal{visibility:hidden!important}" });
      report.captures.push(artifact(`${name}.png`));
    };
    await checkSidebarPinOrder(page, base, report, capture);
    assert.deepEqual(report.pageErrors, [], "No unhandled browser errors");
    assert.deepEqual(report.consoleErrors, [], "No browser console errors");
    assert.deepEqual(report.nonReadRequests, [], "No API writes were attempted");
    assert.deepEqual(report.externalRequests, [], "No external service requests");
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.failure = { message: error.message, stack: error.stack };
    if (page && !page.isClosed()) {
      report.rows = await page.locator(".session-item-main").allTextContents().catch(() => []);
      await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {});
    }
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    await writeFile(artifact("results.json"), JSON.stringify(report, null, 2));
    await browser?.close();
    console.log(`Sidebar pin order ${report.status}: ${artifact("results.json")}`);
  }
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await runSidebarPinOrder();
