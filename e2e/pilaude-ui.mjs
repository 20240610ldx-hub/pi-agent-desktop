import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Runs against an isolated development server. Model prompts are intercepted. */
export async function checkPilaudeUi(browser, { url, project, artifacts }) {
  await mkdir(artifacts, { recursive: true });
  const results = [];
  for (const [width, scale, theme, locale] of [
    [1280, 1, "light", "en"], [960, 1.25, "dark", "zh-CN"],
    [1100, 1.5, "light", "zh-CN"], [1280, 2, "dark", "en"],
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 840 }, deviceScaleFactor: scale,
      colorScheme: theme, reducedMotion: "reduce" });
    let page;
    try {
      await context.addInitScript(({ theme, locale }) => {
        localStorage.setItem("pi-theme", theme);
        localStorage.setItem("pi-locale", locale);
      }, { theme, locale });
      page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(30000);
      console.log(`UI case ${width}/${scale}/${theme}/${locale}`);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let prompts = 0;
      const emptySessions = async (route) => route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ sessions: [], sessionListVersion: 0 }) });
      const sessionListPattern = /\/api\/sessions(?:\?.*)?$/;
      await context.route(sessionListPattern, emptySessions);
      await context.route("**/api/agent/**", async (route) => {
        const request = route.request();
        const body = request.method() === "POST" ? request.postDataJSON() : null;
        if (body?.type !== "prompt") return route.continue();
        prompts++;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({
          error: "Pilaude E2E: model temporarily unavailable", code: "prompt_rejected", accepted: false,
        }) });
      });
      await page.goto(url);
      const openProject = locale === "en" ? "Open a project" : "打开项目";
      await page.getByRole("button", { name: openProject, exact: true }).waitFor();
      const cta = page.getByRole("button", { name: openProject, exact: true });
      assert.equal(await cta.evaluate((el) => getComputedStyle(el).height), "40px");
      assert.notEqual(await cta.evaluate((el) => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
      await page.screenshot({ path: join(artifacts, `welcome-${width}-${scale}-${theme}-${locale}.png`) });
      await cta.click();
      const pathInput = page.getByPlaceholder("/path/to/project or ~/project");
      await pathInput.fill(project);
      await pathInput.press("Enter");
      await page.getByRole("button", { name: locale === "en" ? "Select this folder" : "选择此文件夹", exact: true }).click();
      await context.unroute(sessionListPattern, emptySessions);
      const input = page.locator("textarea.chat-input-textarea");
      await input.waitFor();
      await input.fill("中文输入法测试");
      await input.dispatchEvent("keydown", { key: "Enter", code: "Enter", keyCode: 229, isComposing: true });
      assert.equal(prompts, 0, "IME confirmation must not send");
      assert.equal(await input.inputValue(), "中文输入法测试");
      await input.press("Shift+Enter");
      assert.equal(prompts, 0, "Shift+Enter inserts a newline");
      assert.ok((await input.inputValue()).includes("\n"));
      await input.fill("Pilaude draft survives rejected send");
      await input.press("Enter");
      await page.getByText("Pilaude E2E: model temporarily unavailable", { exact: false }).first().waitFor();
      try {
        await page.waitForFunction(() => document.querySelector("textarea.chat-input-textarea")?.value === "Pilaude draft survives rejected send", null, { timeout: 15000 });
      } catch (error) {
        await page.screenshot({ path: join(artifacts, `failure-${width}-${scale}.png`) });
        console.error((await page.locator("body").innerText()).slice(-3000));
        throw error;
      }
      assert.equal(prompts, 1, "only one prompt must be submitted");
      assert.equal(await page.locator(".chat-composer").evaluate((el) => getComputedStyle(el).borderRadius), "20px");
      const showPanel = page.getByRole("button", { name: locale === "en" ? "Show file panel" : "显示文件面板", exact: true }).first();
      await showPanel.click();
      assert.equal(await page.locator(".right-panel-container").evaluate((el) => getComputedStyle(el).position), width < 1100 ? "fixed" : "relative");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "no horizontal overflow");
      await page.screenshot({ path: join(artifacts, `chat-${width}-${scale}-${theme}-${locale}.png`) });
      if (width < 1100) {
        // The drawer must stay above its backdrop, and the exposed backdrop dismisses it.
        await page.locator(".right-panel-container").getByRole("button", { name: locale === "en" ? "Hide file panel" : "隐藏文件面板", exact: true }).click();
        assert.equal(await showPanel.getAttribute("aria-expanded"), "false");
        await showPanel.click();
        await page.locator(".right-panel-overlay-backdrop").click({ position: { x: 16, y: 400 } });
        assert.equal(await showPanel.getAttribute("aria-expanded"), "false");
      }
      assert.deepEqual(errors, [], "runtime must not raise an uncaught page error");
      results.push({ width, scale, theme, locale, prompts, status: "passed" });
    } catch (error) {
      if (page) {
        await page.screenshot({ path: join(artifacts, `failure-${width}-${scale}.png`) });
        console.error((await page.locator("body").innerText()).slice(-2500));
        console.error(await page.locator("input,textarea").evaluateAll((elements) => elements.map((element) => ({
          value: element.value, disabled: element.disabled, placeholder: element.placeholder,
        }))));
      }
      throw error;
    } finally { await context.close(); }
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const option = (name) => process.argv[process.argv.indexOf(name) + 1];
  const url = process.argv.includes("--url") ? option("--url") : "http://127.0.0.1:30141";
  const project = process.argv.includes("--project") ? option("--project") : null;
  assert.ok(project, "Pass --project with an isolated test folder");
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(url).hostname), "Use a local test server");
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const artifacts = join(process.cwd(), "test-results/pilaude/ui-matrix");
    const results = await checkPilaudeUi(browser, { url, project, artifacts });
    await writeFile(join(artifacts, "results.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
}
