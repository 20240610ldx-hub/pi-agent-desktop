import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const isWindows = process.platform === "win32";
const setEnv = (name, value) => isWindows ? `$env:${name} = '${value}'` : `export ${name}='${value}'`;
const probeEnv = (marker, name) => isWindows
  ? `Write-Output ('${marker}:{0}:{1}' -f $env:${name}, $PID)`
  : `printf '\\n${marker}:%s:%s\\n' "$${name}" "$$"`;

const root = fileURLToPath(new URL("../", import.meta.url));
const reuseServer = Boolean(process.env.E2E_BASE_URL);
const configuredAgentDir = process.env.E2E_AGENT_DIR || process.env.PI_CODING_AGENT_DIR;
if (reuseServer) {
  assert.ok(configuredAgentDir, "E2E_BASE_URL requires E2E_AGENT_DIR (or PI_CODING_AGENT_DIR) matching the running test server");
} else {
  assert.ok(!existsSync(join(root, ".next/dev/lock")), "Run in a checkout without an active dev server, or set E2E_BASE_URL and E2E_AGENT_DIR");
}
const artifacts = mkdtempSync(join(tmpdir(), "pi-web-terminal-e2e-"));
console.log(`Artifacts: ${artifacts}`);
const agentDir = configuredAgentDir ? resolve(configuredAgentDir) : join(artifacts, "agent");
// The preview's existing project is already authorized even while its roots cache
// catches up with the fixture sessions. Only this run's child directory is owned.
const workspaceRoot = reuseServer ? join(agentDir, "project", `test-terminal-${randomUUID()}`) : join(artifacts, "workspaces");
const workspace = join(workspaceRoot, "workspace-a");
const otherWorkspace = join(workspaceRoot, "workspace-b");
const fixtureDir = join(agentDir, "sessions", `terminal-e2e-${randomUUID()}`);
mkdirSync(fixtureDir, { recursive: true });
mkdirSync(workspace, { recursive: true });
mkdirSync(otherWorkspace);
writeFileSync(join(workspace, "note.txt"), "File viewer fixture\n");
const timestamp = "2026-09-05T00:00:00.000Z";
const fixtures = [
  { id: randomUUID(), cwd: workspace, name: "Terminal session one" },
  { id: randomUUID(), cwd: workspace, name: "Terminal session two" },
  { id: randomUUID(), cwd: otherWorkspace, name: "Other workspace session" },
];
for (const { id, cwd, name } of fixtures) {
  writeFileSync(join(fixtureDir, `${id}.jsonl`), [
    { type: "session", version: 3, id, timestamp, cwd },
    { type: "session_info", id: "name", parentId: null, timestamp, name },
    { type: "message", id: "message", parentId: "name", timestamp, message: { role: "user", content: `${name} message` } },
  ].map((entry) => JSON.stringify(entry)).join("\n") + "\n");
}

let base = process.env.E2E_BASE_URL?.replace(/\/+$/, "");
let log;
let server;
let serverExit;
let browser;
const ownedTerminals = new Set();
try {
  if (!reuseServer) {
    const probe = createServer();
    probe.listen(0, "127.0.0.1");
    await once(probe, "listening");
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    base = `http://127.0.0.1:${port}`;
    log = createWriteStream(join(artifacts, "server.log"));
    const serverEnv = { ...process.env, PI_CODING_AGENT_DIR: agentDir, PI_WEB_PASSWORD: "", NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "development", HISTFILE: isWindows ? "NUL" : "/dev/null", BASH_SILENCE_DEPRECATION_WARNING: "1", SHELL: isWindows ? process.env.SHELL : "/bin/bash" };
    delete serverEnv.__NEXT_PRIVATE_ORIGIN;
    delete serverEnv.__NEXT_PRIVATE_STANDALONE_CONFIG;
    server = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "-H", "127.0.0.1", "-p", String(port)], {
      cwd: root,
      env: serverEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.pipe(log, { end: false });
    server.stderr.pipe(log, { end: false });
    serverExit = once(server, "exit");
    for (let i = 0; ; i++) {
      const response = await fetch(`${base}/api/sessions`).catch(() => null);
      if (response?.ok) break;
      assert.ok(i < 120 && server.exitCode === null, "Server did not become ready");
      await delay(500);
    }
  }
  // Force a rescan when reusing a server whose session catalogue was already cached.
  const sessionsResponse = await fetch(`${base}/api/sessions?force=1`);
  assert.equal(sessionsResponse.status, 200, "Test server must expose its sessions");
  const { sessions } = await sessionsResponse.json();
  for (const fixture of fixtures) {
    assert.ok(sessions.some((session) => session.id === fixture.id && session.cwd === fixture.cwd),
      "Test server did not read terminal fixtures; E2E_AGENT_DIR must match its PI_CODING_AGENT_DIR");
  }
  browser = await chromium.launch();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: "en-US" });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const errors = [];
    const modelRequests = [];
    await page.route("**/api/agent/**", async (route) => {
      const request = route.request();
      if (request.method() !== "POST" || /\/lease$/.test(new URL(request.url()).pathname)) return route.continue();
      const body = request.postDataJSON();
      const safe = ["get_tools", "get_state", "get_system_prompt", "get_session_stats", "get_available_models", "set_thinking_level", "set_model", "set_steering_mode", "set_follow_up_mode", "set_auto_compaction", "set_auto_retry"];
      if (safe.includes(body?.type)) return route.continue();
      modelRequests.push({ url: request.url(), body });
      await route.abort("blockedbyclient");
    });
    const diagnostics = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/") && (response.status() >= 400 || url.pathname.startsWith("/api/files/"))) {
        const record = { url: response.url(), status: response.status() };
        diagnostics.push(record);
        void response.text().then((body) => { record.body = body; }).catch(() => {});
      }
    });
    page.on("console", (message) => {
      if (message.type() === "error") diagnostics.push({ console: message.text() });
    });
    page.on("requestfailed", (request) => diagnostics.push({ url: request.url(), failure: request.failure()?.errorText }));
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) diagnostics.push({ navigation: frame.url() });
    });
    const created = new Set();
    const createRequests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/terminal" && request.method() === "POST") {
        const { id } = request.postDataJSON();
        created.add(id);
        ownedTerminals.add(id);
        createRequests.push(id);
      }
    });
    const panel = page.locator("#workspace-pane-terminal .workspace-terminal-tab:not([hidden]) section.terminal-panel");
    const terminalTab = (id) => page.locator(`#file-panel [role="tab"][data-tab-id="${id}"]`);
    const savedTabs = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("pi-web:terminal-tabs")).tabs);
    const terminalAction = async (id, name) => {
      await terminalTab(id).click({ button: "right" });
      await page.getByRole("menuitem", { name, exact: true }).click();
    };
    const ready = async () => {
      await panel.locator(':scope[data-status="ready"]').waitFor();
      assert.equal(await panel.locator(".terminal-panel-header").count(), 0, "ready terminals must not show the path/status header");
    };
    // Normalize hard-wrapped row breaks, but require each marker in both the
    // rendered DOM and accessibility buffer so stale visual output cannot pass.
    const output = () => panel.evaluate((element) => ({
      dom: (element.querySelector(".xterm-rows")?.innerText ?? "").replace(/[\r\n]/g, ""),
      accessibility: (element.querySelector(".xterm-accessibility-tree")?.textContent ?? "").replace(/[\r\n]/g, ""),
    }));
    const text = async () => (await output()).dom;
    const run = async (command) => {
      await panel.locator(".xterm-helper-textarea").focus();
      await page.keyboard.type(command);
      await page.keyboard.press("Enter");
    };
    const waitOutput = async (pattern) => {
      await page.waitForFunction((source) => {
        const panel = [...document.querySelectorAll("section.terminal-panel")].find((element) => element.getBoundingClientRect().width > 0);
        const dom = (panel?.querySelector(".xterm-rows")?.innerText ?? "").replace(/[\r\n]/g, "");
        const accessibility = (panel?.querySelector(".xterm-accessibility-tree")?.textContent ?? "").replace(/[\r\n]/g, "");
        return new RegExp(source).test(dom) && new RegExp(source).test(accessibility);
      }, pattern);
      const rendered = await output();
      assert.equal(rendered.dom.match(new RegExp(pattern))?.[0], rendered.accessibility.match(new RegExp(pattern))?.[0], "DOM and accessibility must report the same output marker");
    };
    const showSidebar = async () => {
      const button = page.getByRole("button", { name: "Show sidebar", exact: true });
      if (await button.count()) await button.click();
    };
    const showPanel = async () => {
      // On mobile the sidebar is a modal overlay whose backdrop covers the toggle.
      const backdrop = page.locator(".sidebar-overlay-backdrop:visible");
      if (await backdrop.count() && await backdrop.evaluate((element) => getComputedStyle(element).pointerEvents !== "none")) {
        await backdrop.click({ position: { x: 380, y: 400 } });
      }
      // Desktop: topbar toggle. Mobile: the fixed floating toggle outside the topbar.
      const toggle = page.locator('button[aria-label="Show workspace"]:visible').first();
      if (await toggle.count()) await toggle.click();
      await page.locator("#file-panel").waitFor({ state: "visible" });
    };
    // Terminal owns its tab strip independently of the Files pane. Visibility
    // controls reveal an existing pane without creating or terminating a shell.
    const openWorkspaceTerminal = async () => {
      await showPanel();
      const terminalPane = page.locator("#workspace-pane-terminal");
      if (!await terminalPane.isVisible()) {
        const controls = viewport.width <= 640 ? '#file-panel .workspace-pane-mobile-controls' : '.app-topbar';
        await page.locator(`${controls} .workspace-pane-toggle[aria-controls="workspace-pane-terminal"]:visible`).click();
      }
      const previousIds = new Set((await savedTabs()).map((tab) => tab.id));
      await terminalPane.getByRole("button", { name: "New terminal", exact: true }).first().click();
      await page.waitForFunction((ids) => {
        const saved = JSON.parse(sessionStorage.getItem("pi-web:terminal-tabs"));
        const tab = saved?.tabs.find((item) => !ids.includes(item.id));
        const selected = tab && document.querySelector(`#workspace-pane-terminal [data-tab-id="${tab.id}"]`);
        return tab && saved.activeId === tab.id && selected?.getAttribute("aria-selected") === "true";
      }, [...previousIds]);
      const newId = (await savedTabs()).find((tab) => !previousIds.has(tab.id)).id;
      // The pane has multiple resident xterms. Mark its selected host by ID so
      // ready/input cannot accidentally target the previously active terminal.
      await terminalPane.locator(".workspace-terminal-tab:not([hidden])").evaluate((element, id) => { element.dataset.e2eTerminalId = id; }, newId);
    };
    // Mobile has an in-pane exit; desktop uses the existing global close key.
    // Both hide the complete workbench and preserve resident terminal tabs/PIDs.
    const hidePanel = async () => {
      if (viewport.width <= 640) await page.locator('#file-panel .workspace-pane-hide-workbench[aria-label="Hide workspace"]:visible').click();
      else {
        await page.locator('.app-topbar').click({ position: { x: 5, y: 5 } });
        await page.keyboard.press("Backslash");
      }
    };
    try {
      await page.goto(`${base}/?session=${fixtures[0].id}`);
      await page.getByText("Terminal session one message", { exact: true }).waitFor();
      await showSidebar();
      await showPanel();
      // Files keeps its own active viewer alongside the independent terminal.
      const showFileList = page.locator('#file-panel .file-tree-toggle[aria-label="Show file list"]');
      if (await showFileList.isVisible()) await showFileList.click();
      await page.locator("#file-panel").getByText("note.txt", { exact: true }).click();
      await page.getByText("File viewer fixture", { exact: true }).waitFor();
      const fileTab = page.getByRole("tab", { name: "note.txt", exact: true });
      await openWorkspaceTerminal();
      await ready();
      await run(`${setEnv("PR695_TOKEN", "alive")}; ${probeEnv("TOKEN", "PR695_TOKEN")}`);
      await waitOutput("TOKEN:alive:[0-9]+");
      const pid = (await text()).match(/TOKEN:alive:(\d+)/)[1];
      const [id] = created;
      assert.equal(created.size, 1);
      // Dev StrictMode may repeat the initial effect with the same id; creation
      // is idempotent. Later navigation/reconnects must not send any more POSTs.
      const initialCreationRequests = createRequests.length;
      assert.ok(initialCreationRequests >= 1);
      assert.ok(createRequests.every((terminalId) => terminalId === id));
      assert.equal(await terminalTab(id).locator(".file-tab-label").innerText(), "Terminal");
      assert.equal(await terminalTab(id).getAttribute("title"), workspace);
      await fileTab.click();
      await page.getByText("File viewer fixture", { exact: true }).waitFor();
      assert.equal(await page.locator(".terminal-panel").count(), 1);
      assert.equal(await page.locator(".terminal-panel").isVisible(), true, "selecting a file preserves the simultaneously visible Terminal pane");
      await terminalTab(id).click();
      await ready();
      await fileTab.locator(".file-tab-close").click();
      await fileTab.waitFor({ state: "detached" });
      assert.equal(await terminalTab(id).locator(".file-tab-close").isVisible(), false, "single terminal close button is visually hidden");
      await hidePanel();
      await showSidebar();
      await page.getByText("Terminal session two", { exact: true }).click();
      await showPanel();
      await ready();
      await run(probeEnv("SESSION", "PR695_TOKEN"));
      await waitOutput(`SESSION:alive:${pid}`);
      assert.equal(createRequests.length, initialCreationRequests, "switching files/sessions must keep the original terminal");

      await page.reload();
      await ready();
      await run(probeEnv("REFRESH", "PR695_TOKEN"));
      await waitOutput(`REFRESH:alive:${pid}`);
      assert.equal(created.size, 1, "refresh must reconnect, not create");
      assert.equal(createRequests.length, initialCreationRequests, "refresh must not POST another creation, even with the same id");

      await context.setOffline(true);
      await page.locator('section.terminal-panel[data-status="connecting"]:visible').waitFor();
      await context.setOffline(false);
      await ready();
      await run(probeEnv("RECONNECT", "PR695_TOKEN"));
      await waitOutput(`RECONNECT:alive:${pid}`);
      assert.equal(createRequests.length, initialCreationRequests, "reconnect must not create a terminal");
      for (const [source, value] of Object.entries(await output())) {
        assert.equal((value.match(new RegExp(`REFRESH:alive:${pid}`, "g")) ?? []).length, 1, `${source}: reconnect must not replay delivered output`);
      }

      await page.screenshot({ path: join(artifacts, `${viewport.width}.png`), fullPage: true });
      const dimensions = await page.locator(".terminal-panel:visible").evaluate((element) => {
        const panel = element.getBoundingClientRect();
        const screen = element.querySelector(".xterm-screen").getBoundingClientRect();
        return { panelWidth: panel.width, screenWidth: screen.width, screenHeight: screen.height, fits: screen.right <= panel.right + 1 && screen.bottom <= panel.bottom + 1 };
      });
      assert.ok(dimensions.screenWidth > 100 && dimensions.screenHeight > 100 && dimensions.fits, JSON.stringify(dimensions));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

      // Identical labels/cwds must still address independent terminals by id.
      await openWorkspaceTerminal();
      await ready();
      const sameCwdTabs = await savedTabs();
      assert.equal(sameCwdTabs.length, 2);
      assert.deepEqual(sameCwdTabs.map((tab) => tab.cwd), [workspace, workspace]);
      const secondId = sameCwdTabs.find((tab) => tab.id !== id).id;
      for (const tab of sameCwdTabs) {
        assert.equal(await terminalTab(tab.id).locator(".file-tab-label").innerText(), "Terminal");
        assert.equal(await terminalTab(tab.id).locator(".file-tab-close").isVisible(), true, "multiple tabs must expose close buttons");
      }
      await run(`${setEnv("PR695_TOKEN", "second")}; ${probeEnv("SECOND", "PR695_TOKEN")}`);
      await waitOutput("SECOND:second:[0-9]+");
      const secondPid = (await text()).match(/SECOND:second:(\d+)/)[1];
      assert.notEqual(secondPid, pid, "same-cwd tabs must own different shell processes");
      await terminalTab(id).click();
      await ready();
      await terminalAction(secondId, "Terminate terminal");
      await terminalTab(secondId).waitFor({ state: "detached" });
      assert.equal((await fetch(`${base}/api/terminal/${secondId}`)).status, 404);
      assert.deepEqual((await savedTabs()).map((tab) => tab.id), [id]);
      await ready();
      await run(probeEnv("SAME_CWD", "PR695_TOKEN"));
      await waitOutput(`SAME_CWD:alive:${pid}`);
      assert.equal(await terminalTab(id).locator(".file-tab-close").isVisible(), false);

      await terminalAction(id, "Restart terminal");
      await page.waitForFunction((oldId) => {
        const saved = JSON.parse(sessionStorage.getItem("pi-web:terminal-tabs"));
        return saved.tabs.length === 1 && saved.tabs[0].id !== oldId;
      }, id);
      await ready();
      assert.equal((await fetch(`${base}/api/terminal/${id}`)).status, 404);
      await run("exit 7");
      await page.locator('section.terminal-panel[data-status="exited"]:visible').waitFor();
      await page.getByText("Process exited with code 7", { exact: true }).waitFor();
      const currentId = (await savedTabs())[0].id;
      await terminalAction(currentId, "Terminate terminal");
      await page.locator(".terminal-panel").waitFor({ state: "detached" });
      assert.equal((await fetch(`${base}/api/terminal/${currentId}`)).status, 404);

      let releaseCreation;
      let creationFetched;
      const creationResponse = new Promise((resolve) => { releaseCreation = resolve; });
      const pendingCreation = new Promise((resolve) => { creationFetched = resolve; });
      await page.route("**/api/terminal", async (route) => {
        const response = await route.fetch();
        creationFetched({ id: route.request().postDataJSON().id, status: response.status() });
        await creationResponse;
        await route.fulfill({ response });
      });
      await showSidebar();
      await openWorkspaceTerminal();
      const delayedCreation = await Promise.race([
        pendingCreation,
        delay(30_000, undefined, { ref: false }).then(() => assert.fail("Terminal creation did not reach the delayed response")),
      ]);
      assert.equal(delayedCreation.status, 200);
      assert.equal((await fetch(`${base}/api/terminal/${delayedCreation.id}`)).status, 200, "the delayed response must already own a real PTY");
      await page.locator('section.terminal-panel[data-status="connecting"]:visible').waitFor();
      await terminalAction(delayedCreation.id, "Terminate terminal");
      releaseCreation();
      await page.locator(".terminal-panel").waitFor({ state: "detached" });
      await page.unroute("**/api/terminal");
      for (const terminalId of created) assert.equal((await fetch(`${base}/api/terminal/${terminalId}`)).status, 404);

      await showSidebar();
      await openWorkspaceTerminal();
      await ready();
      const workspaceId = (await savedTabs())[0].id;
      await run(`${setEnv("PR695_WORKSPACE", "retained")}; ${probeEnv("WORKSPACE_SEED", "PR695_WORKSPACE")}`);
      await waitOutput("WORKSPACE_SEED:retained:[0-9]+");
      const workspacePid = (await text()).match(/WORKSPACE_SEED:retained:(\d+)/)[1];
      await hidePanel();
      await showSidebar();
      await page.locator('.sidebar-project-tree-row-main').and(page.getByRole("button", { name: workspace, exact: true })).first().click();
      // A project row both selects its cwd and toggles the folder, so the target
      // may land collapsed; expand it before looking for its session.
      const otherRow = page.locator('.sidebar-project-tree-row-main').and(page.getByRole("button", { name: otherWorkspace, exact: true }));
      await otherRow.click();
      if (await otherRow.getAttribute("aria-expanded") === "false") await otherRow.click();
      await page.getByText("Other workspace session", { exact: true }).waitFor();
      await openWorkspaceTerminal();
      await ready();
      const workspaceTabs = await savedTabs();
      assert.deepEqual(workspaceTabs.map((tab) => tab.cwd).sort(), [workspace, otherWorkspace].sort());
      assert.equal(workspaceTabs.find((tab) => tab.cwd === workspace).id, workspaceId);
      const otherId = workspaceTabs.find((tab) => tab.cwd === otherWorkspace).id;
      assert.equal((await (await fetch(`${base}/api/terminal/${otherId}`)).json()).cwd, otherWorkspace);
      await run(probeEnv("OTHER_EMPTY", "PR695_WORKSPACE"));
      await waitOutput("OTHER_EMPTY::[0-9]+");
      await run(`${setEnv("PR695_WORKSPACE", "other")}; ${probeEnv("OTHER", "PR695_WORKSPACE")}`);
      await waitOutput("OTHER:other:[0-9]+");
      const otherPid = (await text()).match(/OTHER:other:(\d+)/)[1];
      assert.notEqual(otherPid, workspacePid);
      await terminalTab(workspaceId).click();
      await ready();
      await run(probeEnv("WORKSPACE", "PR695_WORKSPACE"));
      await waitOutput(`WORKSPACE:retained:${workspacePid}`);
      await terminalTab(otherId).click();
      await ready();
      await run(probeEnv("OTHER_RETAINED", "PR695_WORKSPACE"));
      await waitOutput(`OTHER_RETAINED:other:${otherPid}`);
      await page.screenshot({ path: join(artifacts, `${viewport.width}-workspaces.png`), fullPage: true });
      for (const terminalId of [workspaceId, otherId]) {
        await terminalAction(terminalId, "Terminate terminal");
        await terminalTab(terminalId).waitFor({ state: "detached" });
      }
      await page.locator(".terminal-panel").waitFor({ state: "detached" });
      for (const terminalId of created) assert.equal((await fetch(`${base}/api/terminal/${terminalId}`)).status, 404);
      assert.deepEqual(errors, []);
      assert.deepEqual(modelRequests, [], "terminal pane interactions must not attempt model commands");
      console.log(`PASS ${viewport.width}: real shell, files, sessions, refresh, reconnect, same-cwd tabs, restart, exit, close during creation, workspace isolation`);
    } catch (error) {
      await page.screenshot({ path: join(artifacts, `failure-${viewport.width}.png`), fullPage: true });
      console.error(await page.locator("body").innerText());
      console.error("Page errors:", errors);
      const terminalOutput = await panel.count() ? await output().catch((reason) => ({ error: String(reason) })) : { error: "No visible terminal panel" };
      writeFileSync(join(artifacts, `failure-${viewport.width}-output.json`), JSON.stringify(terminalOutput, null, 2));
      console.error("Terminal DOM/accessibility output:", JSON.stringify(terminalOutput, null, 2));
      console.error("Browser diagnostics:", JSON.stringify(diagnostics, null, 2));
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  try {
    await browser?.close();
  } finally {
    try {
      const cleanup = await Promise.allSettled([...ownedTerminals].map(async (id) => {
        const response = await fetch(`${base}/api/terminal/${id}`, { method: "DELETE", signal: AbortSignal.timeout(10_000) });
        assert.equal(response.status, 200, `Failed to clean up terminal ${id}`);
      }));
      const failures = cleanup.filter((result) => result.status === "rejected");
      assert.equal(failures.length, 0, failures.map((result) => String(result.reason)).join("\n"));
    } finally {
      try {
        if (server) {
          server.kill("SIGTERM");
          await serverExit;
        }
      } finally {
        log?.end();
        await rm(fixtureDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
        await rm(workspaceRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      }
    }
  }
}
