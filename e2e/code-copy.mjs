import assert from "node:assert/strict";

// Literal source is the oracle: preserve blank lines, tabs, trailing spaces,
// Unicode and HTML characters independently of highlighted DOM/line numbers.
export const CODE_COPY_SOURCE = '\n\tconst café = "你好 🌍";  \n  const literalHTML = "<span data-x=\'&\'>中文</span>";\n\tconsole.log(café, literalHTML); \t\n\n';

/** Install only the browser clipboard boundary, before navigating to the app. */
export async function installCodeCopyClipboard(context, { sessionId } = {}) {
  await context.addInitScript(({ sessionId }) => {
    if (sessionId && new URLSearchParams(location.search).get("session") !== sessionId) return;
    const state = { writes: [], pending: [], fallbackWrites: [], unhandled: [] };
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const execDescriptor = Object.getOwnPropertyDescriptor(document, "execCommand");
    const onUnhandled = (event) => state.unhandled.push(String(event.reason));
    window.addEventListener("unhandledrejection", onUnhandled);
    state.restore = () => {
      if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
      else delete navigator.clipboard;
      if (execDescriptor) Object.defineProperty(document, "execCommand", execDescriptor);
      else delete document.execCommand;
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
    const nativeExecCommand = document.execCommand.bind(document);
    document.execCommand = (command, ...args) => {
      if (command !== "copy") return nativeExecCommand(command, ...args);
      state.fallbackWrites.push(document.activeElement?.value ?? "");
      return false;
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text) {
          state.writes.push(text);
          return new Promise((resolve, reject) => state.pending.push({ resolve, reject }));
        },
      },
    });
    window.__codeCopyClipboard = state;
  }, { sessionId });
}

export async function restoreCodeCopyClipboard(page) {
  await page.evaluate(() => window.__codeCopyClipboard?.restore());
}

/**
 * Real AppShell > ChatWindow > MarkdownBody > CodeBlock consumer fixture.
 * The caller supplies one ordinary fence containing CODE_COPY_SOURCE and calls
 * installCodeCopyClipboard(context) before navigation. No React/private state.
 */
export async function checkCodeCopy(page) {
  const block = page.locator(".markdown-code-block").filter({
    has: page.locator(".markdown-code-lang", { hasText: /^javascript$/ }),
  }).first();
  await block.waitFor({ state: "visible", timeout: 60000 });
  const copy = block.getByRole("button", { name: /^(Copy|Copied)$/ });
  const stateIs = async (name, message) => assert.equal(
    await block.getByRole("button", { name, exact: true }).count(), 1, message);
  await stateIs("Copy");

  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  try {
    await copy.click();
    assert.deepEqual(await page.evaluate(() => window.__codeCopyClipboard.writes), [CODE_COPY_SOURCE],
      "Clipboard receives exact source, including whitespace/tabs/Unicode/literal HTML, without line numbers");
    await stateIs("Copy", "Unresolved clipboard must not claim success");
    await page.clock.runFor(3000);
    await stateIs("Copy", "Pending clipboard stays Copy beyond feedback duration");

    await page.evaluate(() => window.__codeCopyClipboard.pending.shift().resolve());
    await page.getByRole("button", { name: "Copied", exact: true }).waitFor();
    await stateIs("Copied", "Success becomes visible only after clipboard resolves");
    await page.clock.runFor(1499);
    await stateIs("Copied", "Copied persists at 1499ms since success");
    await page.clock.runFor(1);
    await stateIs("Copied", "Copied must persist at 1500ms since success");
    await page.clock.runFor(999);
    await stateIs("Copied", "Copied persists through 2499ms since success");
    await page.clock.runFor(1);
    await stateIs("Copy", "Copied resets at 2500ms since success");
    console.log("PASS: exact source, pending clipboard, Copied persists at 1500ms and resets at 2500ms since success");

    await copy.click();
    await page.evaluate(() => window.__codeCopyClipboard.pending.shift().resolve());
    await page.getByRole("button", { name: "Copied", exact: true }).waitFor();
    await page.clock.runFor(1000);
    await copy.click();
    await page.evaluate(() => window.__codeCopyClipboard.pending.shift().resolve());
    assert.deepEqual(await page.evaluate(() => window.__codeCopyClipboard.writes),
      [CODE_COPY_SOURCE, CODE_COPY_SOURCE, CODE_COPY_SOURCE], "Repeated copy still writes exact source");
    await page.clock.runFor(1499);
    await stateIs("Copied", "Repeated success stays Copied before original timeout");
    await page.clock.runFor(1);
    await stateIs("Copied",
      "Repeated success must restart feedback: original timeout cannot clear Copied at 1500ms since latest success");
    await page.clock.runFor(999);
    await stateIs("Copied", "Repeated success persists through its own 2499ms");
    await page.clock.runFor(1);
    await stateIs("Copy", "Repeated success resets at 2500ms since latest success");
    console.log("PASS: repeated successful copy restarts the full 2500ms feedback duration");

    await copy.focus();
    const sameButton = await copy.elementHandle();
    await copy.click();
    await page.evaluate(() => window.__codeCopyClipboard.pending.shift().reject(new Error("Clipboard denied by generated fixture")));
    await page.clock.runFor(1);
    await stateIs("Copy", "Failed clipboard and fallback must never claim Copied");
    assert.deepEqual(await page.evaluate(() => window.__codeCopyClipboard.fallbackWrites), [CODE_COPY_SOURCE],
      "Browser fallback attempts exact source and reports false");
    await block.getByRole("status").getByText("Could not copy. Try again.", { exact: true }).waitFor({ state: "visible" });
    assert.deepEqual(await page.evaluate(() => window.__codeCopyClipboard.unhandled), [], "Clipboard failure must be handled");
    assert.equal(await sameButton.evaluate((button) => button.isConnected), true,
      "Failure preserves the same native button for retry");
    await copy.click();
    await page.evaluate(() => window.__codeCopyClipboard.pending.shift().resolve());
    await page.getByRole("button", { name: "Copied", exact: true }).waitFor();
    assert.equal(await sameButton.evaluate((button) => button.isConnected), true, "Retry reuses the same button");
    assert.equal(await block.getByText("Could not copy. Try again.", { exact: true }).count(), 0, "Successful retry clears error");
    await page.clock.runFor(2500);
    await stateIs("Copy", "Successful retry resets feedback after 2500ms");
    console.log("PASS: rejected clipboard and failed fallback show handled error; same button retries successfully");

    // Both requests use the same public button. Settle newest first, then reject
    // the older promise: its fallback/error must not overwrite newer success.
    await copy.click();
    await copy.click();
    await page.evaluate(() => window.__codeCopyClipboard.pending.pop().resolve());
    await block.getByRole("button", { name: "Copied", exact: true }).waitFor();
    await page.clock.runFor(1000);
    await page.evaluate(() => window.__codeCopyClipboard.pending.shift().reject(new Error("Stale generated clipboard failure")));
    await page.clock.runFor(1);
    await stateIs("Copied", "Older failed copy cannot overwrite newest success");
    assert.equal(await block.getByRole("status").count(), 0, "Stale failure cannot surface a retry error");
    await page.clock.runFor(1499);
    await stateIs("Copy", "Newest success owns feedback timeout despite old promise settling late");
    await copy.click();
    await copy.click();
    await page.evaluate(() => window.__codeCopyClipboard.pending.pop().resolve());
    await block.getByRole("button", { name: "Copied", exact: true }).waitFor();
    await page.clock.runFor(1000);
    await page.evaluate(() => window.__codeCopyClipboard.pending.shift().resolve());
    await page.clock.runFor(1500);
    await stateIs("Copy", "Older successful copy cannot restart newest feedback timeout");
    assert.deepEqual(await page.evaluate(() => window.__codeCopyClipboard.unhandled), [], "Out-of-order clipboard settles are handled");
    console.log("PASS: newest attempt owns feedback when older promises resolve or reject late (post-fix coverage)");
  } finally {
    await page.clock.resume();
  }
}
