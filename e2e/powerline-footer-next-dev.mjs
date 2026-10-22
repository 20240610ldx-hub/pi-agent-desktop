// Real application layer: no API/SSE interception and no jiti-loaded server code.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = resolve(process.env.POWERLINE_E2E_OUT || join(root, "test-results/powerline-next-dev", String(Date.now())));
const missing = process.argv.includes("--missing-package");
mkdirSync(out, { recursive: true });
assert.ok(!existsSync(join(root, ".next/dev/lock")), "This worktree already has a dev server");
const agentsBefore = readFileSync(join(root, "AGENTS.md"));
const home = join(out, "home"), agentDir = join(home, ".pi", "agent"), project = join(out, "project");
mkdirSync(project, { recursive: true });
mkdirSync(join(agentDir, "sessions", "e2e"), { recursive: true });
writeFileSync(join(agentDir, "models.json"), JSON.stringify({ providers: { "footer-local": {
  baseUrl: "http://127.0.0.1:1", api: "openai-completions", apiKey: "POWERLINE_FIXTURE_KEY", models: [{ id: "footer", name: "Footer Real Next", reasoning: true, input: ["text"], contextWindow: 128000, maxTokens: 1024, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }],
} } }));
writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ quietStartup: true, powerline: { welcome: false } }));
const timestamp = new Date().toISOString();
for (const id of ["footer-next-a", "footer-next-b"]) {
  const entries = [
    { type: "session", version: 3, id, timestamp, cwd: project },
    { type: "model_change", id: "m", parentId: null, provider: "footer-local", modelId: "footer", timestamp },
    { type: "message", id: "u", parentId: "m", timestamp, message: { role: "user", content: "Local transcript for footer layout", timestamp: Date.now() } },
    { type: "message", id: "a", parentId: "u", timestamp, message: { role: "assistant", content: [{ type: "text", text: "Footer transcript paragraph.\n\n".repeat(60) }], provider: "footer-local", model: "footer", api: "openai-completions", stopReason: "stop", timestamp: Date.now(), usage: { input: 100, output: 100, cacheRead: 0, cacheWrite: 0, totalTokens: 200, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } } },
  ];
  writeFileSync(join(agentDir, "sessions", "e2e", `${id}.jsonl`), entries.map(e => JSON.stringify(e)).join("\n") + "\n");
}
const probe = createServer();
probe.listen(0, "127.0.0.1"); await once(probe, "listening");
const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, NODE_ENV: "development", HOME: home, USERPROFILE: home, PI_AGENT_HOME: home, PI_CODING_AGENT_DIR: agentDir, PI_WEB_PASSWORD: "", NEXT_TELEMETRY_DISABLED: "1" };
env.POWERLINE_FIXTURE_KEY = "fixture-not-a-secret"; // Never sent: this script makes no model requests.
delete env.__NEXT_PRIVATE_ORIGIN; delete env.__NEXT_PRIVATE_STANDALONE_CONFIG;
if (missing) {
  // Simulate a genuinely unavailable external package in Node's resolver. Never
  // rename/remove installed packages or touch the user's configuration files.
  const preload = join(out, "missing-package.cjs");
  writeFileSync(preload, `const Module = require('node:module');\nconst original = Module._resolveFilename;\nModule._resolveFilename = function(spec, ...args) {\n if (spec === 'pi-powerline-footer/package.json') throw Object.assign(new Error('fixture package unavailable'), { code: 'MODULE_NOT_FOUND' });\n return original.call(this, spec, ...args);\n};\n`);
  env.NODE_OPTIONS = `${env.NODE_OPTIONS || ""} --require "${preload.replaceAll("\\", "/")}"`;
}
const log = createWriteStream(join(out, "server.log"));
const server = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-H", "127.0.0.1", "-p", String(port)], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
writeFileSync(join(out, "server-pid.txt"), String(server.pid));
server.stdout.pipe(log, { end: false }); server.stderr.pipe(log, { end: false });
const exited = once(server, "exit");
let browser, page;
const report = { layer: "real next dev --webpack + ordinary persisted sessions + real API/SSE + DOM", missing, pid: server.pid, base, checks: [], measurements: [] };
const api = async (path, body) => {
  const res = await fetch(base + path, { ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(120000) });
  assert.ok(res.ok, `${path}: ${res.status} ${res.ok ? "" : await res.text()}`); return res.json();
};
try {
  for (let attempt = 0; ; attempt++) {
    try { await api("/api/sessions"); break; } catch (error) { if (attempt > 60 || server.exitCode !== null) throw error; await delay(500); }
  }
  // get_tools warms an ordinary SDK session through the application's route.
  await api("/api/agent/footer-next-a", { type: "get_tools" });
  const initial = await api("/api/sessions/footer-next-a/state");
  report.widgets = initial.state?.extensionWidgets;
  if (missing) {
    assert.deepEqual(report.widgets, [], "missing external package skips widgets");
    const state = await api("/api/agent/footer-next-a");
    assert.ok(state.state.model, "ordinary session remains usable");
    await api("/api/agent/footer-next-b", { type: "get_tools" });
    await delay(300);
    const warnings = readFileSync(join(out, "server.log"), "utf8").match(/\[pilaude-powerline\].*MODULE_NOT_FOUND/g) || [];
    assert.equal(warnings.length, 1, "real Node resolution throws; missing-package warning occurs once");
    report.checks.push("Real Next runtime missing-package branch: two sessions, no widget, one warning, usable session");
  } else {
    assert.ok(report.widgets?.some(w => w.key === "powerline-top" && w.lines.length), `real Next state must contain powerline-top: ${JSON.stringify(report.widgets)}`);
    // Compile the history route before the UI's bounded (10 s) session-load
    // request. Cold webpack compilation can exceed that application deadline.
    await api("/api/sessions/footer-next-a?deferThinking=1&deferMedia=1&tree=summary&wholeTurns=1");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.addInitScript(() => {
      window.__footerWire = []; window.__footerSources = [];
      const Original = window.EventSource;
      window.EventSource = class extends Original {
        constructor(url, options) { super(url, options); window.__footerSources.push(this); this.addEventListener("message", event => { try { window.__footerWire.push(JSON.parse(event.data)); } catch (error) { console.error(error); } }); }
      };
    });
    page = await context.newPage(); page.setDefaultTimeout(120000);
    report.pageErrors = [];
    report.requests = [];
    page.on("request", request => report.requests.push({ url: request.url(), method: request.method() }));
    page.on("requestfailed", request => report.requests.push({ url: request.url(), failed: request.failure()?.errorText }));
    page.on("pageerror", error => report.pageErrors.push(error.message));
    await page.goto(`${base}/?session=footer-next-a`, { waitUntil: "domcontentloaded", timeout: 120000 });
    const primary = page.locator(".extension-widget-primary");
    // Next may recompile this entry while the first browser bootstrap compiles
    // sibling routes. Exercise the application's own Retry if its load deadline
    // wins that cold-start race; never replace the response or change the limit.
    const retryButton = page.getByRole("button", { name: "Retry", exact: true });
    let mounted = false, retried = false;
    for (let attempt = 0; attempt < 5 && !mounted; attempt++) {
      const outcome = await Promise.race([
        primary.waitFor({ timeout: 60000 }).then(() => "ready"),
        retryButton.waitFor({ timeout: 60000 }).then(() => "retry"),
      ]).catch(() => "timeout");
      if (outcome === "retry") { retried = true; await retryButton.click(); }
      await primary.waitFor({ timeout: 30000 }).then(() => { mounted = true; }, () => {});
      if (!mounted) await page.reload({ waitUntil: "domcontentloaded" });
      else if (retried) {
        // Start layout measurements on a normal mount, after cold compilation.
        // The host's error-to-Retry path can leave its composer spacer unmeasured.
        await page.reload({ waitUntil: "domcontentloaded" });
        retried = false; mounted = false; attempt--;
      }
    }
    await primary.waitFor();
    assert.match(await primary.innerText(), /Footer Real Next/);
    await page.locator(".message-assistant").first().waitFor();
    for (const theme of ["light", "dark"]) for (const size of [{ width: 1280, height: 800 }, { width: 800, height: 600 }, { width: 390, height: 340 }]) {
      await page.setViewportSize(size);
      await page.evaluate(theme => { localStorage.setItem("pi-theme", theme); document.documentElement.setAttribute("data-theme", theme); document.documentElement.classList.toggle("dark", theme === "dark"); }, theme);
      await page.locator(".chat-scroll-container").evaluate(element => element.scrollTo({ top: element.scrollHeight, behavior: "instant" }));
      await page.waitForTimeout(400); // Let viewport/scroll restoration settle before measuring.
      const measurement = await primary.evaluate(element => {
        const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; };
        const style = getComputedStyle(element), messages = [...document.querySelectorAll(".message-user, .message-assistant")];
        const alpha = /rgba\([^)]*,\s*([\d.]+)\)/.exec(style.backgroundColor);
        return { primary: box(element), last: box(messages.at(-1)), background: style.backgroundColor, alpha: alpha ? Number(alpha[1]) : 1, overflow: element.scrollWidth > element.clientWidth, overflowX: style.overflowX, viewport: innerWidth };
      });
      report.measurements.push({ theme, ...size, ...measurement });
      await page.screenshot({ path: join(out, `${theme}-${size.width}x${size.height}.png`) });
      assert.equal(measurement.alpha, 1, "primary background stays opaque");
      const { primary: p, last: m } = measurement;
      assert.ok(m.bottom <= p.y + 1 || m.y >= p.bottom - 1 || m.right <= p.x || m.x >= p.right, "last message and primary do not overlap");
      assert.ok(p.x >= 0 && p.right <= measurement.viewport, "primary stays inside the viewport");
      assert.ok(!measurement.overflow || measurement.overflowX === "auto", "long package rows scroll within their bounded surface");
    }
    const draft = "Footer real Next draft";
    await page.locator(".chat-input-textarea").fill(draft);
    // Reload produces a fresh package widget through the real server SSE stream.
    await api("/api/agent/footer-next-a", { type: "reload" });
    await page.waitForFunction(() => window.__footerWire.some(e => e.method === "setWidget" && e.widgetKey === "powerline-top" && e.widgetLines?.length));
    report.sse = await page.evaluate(() => window.__footerWire.filter(e => e.method === "setWidget" && e.widgetKey === "powerline-top"));
    assert.equal(await page.locator(".chat-input-textarea").inputValue(), draft);
    const connections = await page.evaluate(() => window.__footerWire.filter(e => e.type === "connected").length);
    // Chromium keeps an already-open SSE stream when the context goes offline, so
    // signal a transport error on the session stream: the application's own
    // AgentEventConnection then discards it and reconnects against the real server.
    await page.evaluate(() => {
      for (const source of window.__footerSources.filter(source => source.readyState === 1 && /\/api\/agent\/footer-next-a\/events/.test(source.url))) source.onerror?.(new Event("error"));
    });
    await page.waitForFunction(count => window.__footerWire.filter(e => e.type === "connected").length > count, connections);
    assert.match(await primary.innerText(), /Footer Real Next/);
    assert.equal(await page.locator(".chat-input-textarea").inputValue(), draft);
    await page.reload({ waitUntil: "domcontentloaded" });
    await primary.waitFor();
    assert.equal(await page.locator(".chat-input-textarea").inputValue(), draft);
    for (const id of ["footer-next-b", "footer-next-a"]) {
      await page.goto(`${base}/?session=${id}`, { waitUntil: "domcontentloaded" });
      await primary.waitFor(); assert.match(await primary.innerText(), /Footer Real Next/);
    }
    report.checks.push("State/SSE setWidget(powerline-top), DOM, 6 theme/size states, opaque/no overlap, extension reload, reconnect/page refresh, session round trip/draft");
    if (process.argv.includes("--consumer")) {
      process.env.E2E_BASE_URL = base;
      const { runPowerlineFooterConsumer } = await import("./powerline-footer-consumer.mjs");
      await runPowerlineFooterConsumer();
      report.checks.push("Separate consumer fixture layer also passed");
    }
  }
  report.status = "passed";
  console.log(JSON.stringify({ status: report.status, checks: report.checks, out }));
} catch (error) {
  report.status = "failed"; report.error = error.stack;
  if (page) { await page.screenshot({ path: join(out, "failure.png") }); writeFileSync(join(out, "failure.html"), await page.content()); }
  throw error;
} finally {
  await browser?.close();
  // Kill only the process tree launched above, including Next's worker.
  server.kill("SIGTERM");
  await exited; log.end();
  writeFileSync(join(root, "AGENTS.md"), agentsBefore);
  writeFileSync(join(out, "results.json"), JSON.stringify(report, null, 2));
}
