import assert from "node:assert/strict";

// The sidebar profile opens General directly, including from the mobile drawer.
async function openGeneralSettings(page) {
  const showSidebar = page.getByRole("button", { name: "Show sidebar", exact: true });
  if (await showSidebar.isVisible()) await showSidebar.click();
  await page.locator(".pilaude-local-profile").click();
  await page.locator(".settings-general").waitFor();
}

export async function checkChatAppearanceReset(page) {
  const width = page.getByRole("slider", { name: "Chat content width", exact: true });
  const fontSize = page.getByRole("group", { name: "Conversation font size", exact: true });
  const small = fontSize.getByRole("radio", { name: "Small", exact: true });
  const medium = fontSize.getByRole("radio", { name: "Medium", exact: true });
  const large = fontSize.getByRole("radio", { name: "Large", exact: true });
  const resetWidth = page.getByRole("button", { name: "Reset chat content width", exact: true });
  const resetFontSize = page.getByRole("button", { name: "Reset chat font size", exact: true });
  await width.press("End");
  await large.check();
  await resetWidth.click();
  assert.equal(await width.inputValue(), "820");
  assert.equal(await large.isChecked(), true, "Resetting width must preserve Large font size");
  await width.press("End");
  await resetFontSize.click();
  assert.equal(await medium.isChecked(), true);
  assert.equal(await width.inputValue(), "2000", "Resetting font size must preserve width");
  await small.check();
  await resetFontSize.click();
  assert.equal(await medium.isChecked(), true, "Resetting Small must restore Medium");
  assert.equal(await width.inputValue(), "2000", "Resetting Small must preserve width");
  await resetWidth.click();
  assert.deepEqual(await page.evaluate(() => ({
    width: localStorage.getItem("pi-chat-content-width"),
    fontSize: localStorage.getItem("pi-chat-content-font-size"),
    appliedWidth: document.documentElement.style.getPropertyValue("--chat-content-max-width"),
    appliedFontSize: document.documentElement.style.getPropertyValue("--chat-content-font-size"),
  })), { width: "820", fontSize: "14", appliedWidth: "820px", appliedFontSize: "14px" });
  await page.reload({ waitUntil: "networkidle" });
  await openGeneralSettings(page);
  assert.equal(await width.inputValue(), "820");
  assert.equal(await medium.isChecked(), true);
  assert.equal(await resetWidth.isDisabled(), true);
  assert.equal(await resetFontSize.isDisabled(), true);
}

export async function checkChatAppearance(page) {
  await page.setViewportSize({ width: 2560, height: 1100 });
  const textarea = page.locator(".chat-input-textarea");
  const openSettings = () => openGeneralSettings(page);
  const closeSettings = async () => {
    await page.keyboard.press("Escape");
    await page.locator(".settings-general").waitFor({ state: "detached" });
    if (page.viewportSize().width <= 640) {
      const contextDock = page.locator('.pilaude-context-dock[data-presentation="modal"]');
      if (await contextDock.isVisible()) {
        await page.keyboard.press("Escape");
        await contextDock.waitFor({ state: "detached" });
      }
      const hideSidebar = page.getByRole("button", { name: "Hide sidebar", exact: true });
      const bounds = await hideSidebar.boundingBox();
      if (bounds && bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize().width) await hideSidebar.click();
    }
  };
  const width = page.getByRole("slider", { name: "Chat content width", exact: true });
  const fontSize = page.getByRole("group", { name: "Conversation font size", exact: true });
  const small = fontSize.getByRole("radio", { name: "Small", exact: true });
  const medium = fontSize.getByRole("radio", { name: "Medium", exact: true });
  const large = fontSize.getByRole("radio", { name: "Large", exact: true });
  const userMessage = page.locator(".markdown-user-message");
  const code = page.locator(".markdown-code-block pre");
  const font = (locator) => locator.evaluate((el) => getComputedStyle(el).fontSize);
  const fittedHeight = async () => {
    // Width changes are observed and fitted on a later frame; let layout settle
    // before checking shrinkage as well as growth.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => {
      const input = document.querySelector(".chat-input-textarea");
      return input && (input.scrollHeight <= input.clientHeight + 1 || input.clientHeight >= 199);
    });
    return textarea.evaluate((el) => el.clientHeight);
  };
  const checkFixedTypography = async () => {
    assert.equal(await font(textarea), "14px", "Desktop composer font must stay fixed");
    for (const [selector, size] of [
      [".session-item-title", "14px"],
      [".pilaude-local-profile small", "12px"],
      [".pilaude-context-card > summary", "14px"],
      [".pilaude-context-usage > small", "12px"],
    ]) {
      assert.equal(await font(page.locator(selector).first()), size, `${selector} must keep its chrome font size`);
    }
  };

  // A missing preference uses Medium; stored 16 still means Large on reload.
  await page.evaluate(() => localStorage.removeItem("pi-chat-content-font-size"));
  await page.reload({ waitUntil: "networkidle" });
  await code.waitFor();
  const showSidebar = page.getByRole("button", { name: "Show sidebar", exact: true });
  if (await showSidebar.isVisible()) await showSidebar.click();
  const contextToggle = page.locator(".pilaude-context-toggle");
  if (await contextToggle.getAttribute("aria-pressed") !== "true") await contextToggle.click();
  await openSettings();
  assert.equal(await width.inputValue(), "820");
  assert.equal(await width.getAttribute("min"), "820");
  assert.equal(await width.getAttribute("max"), "2000");
  assert.deepEqual(await fontSize.getByRole("radio").evaluateAll((inputs) => inputs.map((input) => ({
    type: input.type, value: input.value,
  }))), [
    { type: "radio", value: "13" },
    { type: "radio", value: "14" },
    { type: "radio", value: "16" },
  ]);
  assert.equal(await medium.isChecked(), true, "A missing font preference must default to Medium");
  assert.equal(await page.evaluate(() => localStorage.getItem("pi-chat-content-font-size")), null);
  await width.press("End");
  await closeSettings();
  assert.equal(await font(userMessage), "14px");
  await checkFixedTypography();
  const mediumCodeSize = Number.parseFloat(await font(code));
  const draft = "Existing drafts resize when the available width changes, while the composer font stays fixed. ".repeat(6);
  await textarea.fill(draft);
  const wideHeight = await fittedHeight();
  await openSettings();
  await width.press("Home");
  await closeSettings();
  const narrowHeight = await fittedHeight();
  assert.equal(await textarea.inputValue(), draft);
  assert.ok(narrowHeight > wideHeight, "Narrowing must grow the draft without another keystroke");

  let smallCodeSize;
  for (const [option, size] of [[small, 13], [medium, 14], [large, 16]]) {
    await openSettings();
    await option.check();
    assert.equal(await option.isChecked(), true);
    assert.equal(await fontSize.locator("input:checked").count(), 1);
    await closeSettings();
    assert.equal(await textarea.inputValue(), draft, "Changing reading font size must preserve the draft");
    assert.equal(await fittedHeight(), narrowHeight, "Changing reading font size must preserve draft height");
    await checkFixedTypography();
    assert.equal(await font(userMessage), `${size}px`, "User messages must follow the reading font preset");
    const codeSize = Number.parseFloat(await font(code));
    if (size === 13) {
      smallCodeSize = codeSize;
      assert.ok(codeSize < mediumCodeSize, "Small must reduce the code font size");
    } else if (size === 14) {
      assert.equal(codeSize, mediumCodeSize);
      assert.ok(codeSize > smallCodeSize, "Medium must increase the code font size from Small");
    } else {
      assert.ok(codeSize > mediumCodeSize, "Large must increase the code font size");
    }
  }
  const largeCodeSize = await font(code);
  await openSettings();
  await width.press("End");
  await closeSettings();
  assert.equal(await textarea.inputValue(), draft);
  assert.ok(await fittedHeight() < narrowHeight, "Widening must shrink the existing draft");
  assert.deepEqual(await page.evaluate(() => ({
    width: localStorage.getItem("pi-chat-content-width"),
    fontSize: localStorage.getItem("pi-chat-content-font-size"),
  })), { width: "2000", fontSize: "16" });
  await page.reload({ waitUntil: "networkidle" });
  await code.waitFor();
  assert.equal(await font(userMessage), "16px");
  assert.equal(await font(code), largeCodeSize);
  await checkFixedTypography();

  await openSettings();
  assert.equal(await width.inputValue(), "2000");
  assert.equal(await large.isChecked(), true, "Stored 16 must remain Large after reload");
  await checkChatAppearanceReset(page);
  // Language is no longer the panel's last section (15b373d moved it above
  // Chat), so "reachable" is checked two ways: the lowest control is hit-
  // testable once the panel is scrolled to its end, and the last language
  // option is hit-testable once the panel itself is scrolled to it.
  for (const viewport of [{ width: 1280, height: 600 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.locator(".settings-general").evaluate((panel) => {
      panel.scrollTop = panel.scrollHeight;
      // Ignore sr-only proxies; the font presets are visible native radios.
      const controls = [...panel.querySelectorAll("button, input, select, textarea")]
        .filter((el) => !el.classList.contains("sr-only") && el.getClientRects().length > 0);
      const lowest = controls.reduce((a, b) => (b.getBoundingClientRect().bottom > a.getBoundingClientRect().bottom ? b : a));
      const rect = lowest.getBoundingClientRect();
      return lowest.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }), true, "The bottom of a short settings panel must remain reachable");
    assert.equal(await page.locator(".settings-language-options button:last-child").evaluate((el) => {
      const panel = el.closest(".settings-general");
      panel.scrollTop += el.getBoundingClientRect().top - panel.getBoundingClientRect().top - panel.clientHeight / 2;
      const rect = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }), true, "Every language option must remain reachable in a short settings panel");
  }
  await small.check();
  await closeSettings();
  assert.equal(await font(textarea), "16px", "Mobile inputs retain the focus-zoom minimum");
  assert.equal(await font(userMessage), "13px");
  const mobileDraft = "A mobile draft wraps and resizes within the available space.";
  await textarea.fill(mobileDraft);
  const mobileHeight = await fittedHeight();
  await openSettings();
  await large.check();
  await closeSettings();
  assert.equal(await font(textarea), "16px", "Mobile composer font must stay fixed across presets");
  assert.equal(await font(userMessage), "16px");
  assert.equal(await textarea.inputValue(), mobileDraft);
  assert.equal(await fittedHeight(), mobileHeight, "Changing reading font size must preserve mobile draft height");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log("PASS: chat appearance persistence, typography, draft resizing, and short settings panels");
}
