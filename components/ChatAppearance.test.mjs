import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createJiti } from "jiti";

const chatWindow = await readFile(new URL("./ChatWindow.tsx", import.meta.url), "utf8");
const chatInput = await readFile(new URL("./ChatInput.tsx", import.meta.url), "utf8");
const settingsPanel = await readFile(new URL("./SettingsPanel.tsx", import.meta.url), "utf8");
const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const chatAppearanceHook = await readFile(new URL("../hooks/useChatAppearance.ts", import.meta.url), "utf8");
const jiti = createJiti(import.meta.url);
const { clampChatContentWidth, clampChatContentFontSize, CHAT_CONTENT_FONT_SIZE_PRESETS } = await jiti.import("../hooks/useChatAppearance.ts");

const widthVariable = /var\(--chat-content-max-width, 820px\)/g;

test("chat content keeps the existing 820px default behind one shared variable", () => {
  assert.equal((chatWindow.match(widthVariable) ?? []).length, 2);
  assert.equal((chatInput.match(widthVariable) ?? []).length, 1);
  assert.match(globals, /--chat-content-max-width: 820px;/);
  assert.doesNotMatch(chatWindow, /max-w-\[820px\]|maxWidth: 820/);
  assert.doesNotMatch(chatInput, /maxWidth: 820/);
});

test("General chat settings own the chat width preference", () => {
  assert.match(chatInput, /useChatAppearance\(\)/);
  assert.match(settingsPanel, /useChatAppearance\(\)/);
  assert.match(settingsPanel, /type="range"/);
  assert.match(settingsPanel, /min=\{CHAT_CONTENT_WIDTH_MIN\}/);
  assert.match(settingsPanel, /max=\{CHAT_CONTENT_WIDTH_MAX\}/);
  assert.match(settingsPanel, /step=\{10\}/);
  assert.match(chatAppearanceHook, /pi-chat-content-width/);
  assert.match(chatAppearanceHook, /localStorage\.setItem/);
});

test("chat width validation preserves the default and supported range", () => {
  assert.equal(clampChatContentWidth(undefined), 820);
  assert.equal(clampChatContentWidth("invalid"), 820);
  assert.equal(clampChatContentWidth(700), 820);
  assert.equal(clampChatContentWidth(1104), 1104);
  assert.equal(clampChatContentWidth(2400), 2000);
});

test("conversation size normalizes legacy preferences to small, medium or large", () => {
  assert.deepEqual(CHAT_CONTENT_FONT_SIZE_PRESETS.map(({ value }) => value), [13, 14, 16]);
  for (const value of [undefined, null, "", "invalid", Infinity, NaN]) {
    assert.equal(clampChatContentFontSize(value), 14);
  }
  for (const [value, expected] of [[8, 13], [13, 13], [13.5, 14], [14, 14], [15, 14], [16, 16], ["18", 16], [18.7, 16], [30, 16]]) {
    assert.equal(clampChatContentFontSize(value), expected);
  }
});

// C01 theme / icon source contracts (fixture layer: reads source, not a rendered page).
const nativeTheme = (await readFile(new URL("../app/native-theme.css", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const iconSource = await readFile(new URL("./PilaudeIcon.tsx", import.meta.url), "utf8");
const themeHook = await readFile(new URL("../hooks/useTheme.ts", import.meta.url), "utf8");

const cssBlock = (selector, scheme) => {
  const start = nativeTheme.indexOf(`\n${selector} {\n  color-scheme: ${scheme};`);
  assert.notEqual(start, -1, `${selector} block missing`);
  return nativeTheme.slice(start, nativeTheme.indexOf("\n}", start));
};

test("light and dark themes both define every text tier and the UI font stack once", () => {
  for (const block of [cssBlock(":root", "light"), cssBlock("html.dark", "dark")]) {
    for (const token of ["--text", "--text-muted", "--text-dim", "--text-meta", "--accent"]) {
      assert.match(block, new RegExp(`\n  ${token}:`), `${token} missing`);
    }
  }
  const root = cssBlock(":root", "light");
  assert.match(root, /--font-ui:[^;]*"PingFang SC"[^;]*"Segoe UI Variable"/);
  assert.match(root, /--font-ui:[^;]*"Microsoft YaHei"[^;]*"Noto Sans SC"[^;]*sans-serif;/);
});

test("theme preference follows the system only while it is auto", () => {
  assert.match(themeHook, /if \(current\.preference !== "auto"\) return;/);
  assert.match(themeHook, /matchMedia\("\(prefers-color-scheme: dark\)"\)/);
  assert.match(themeHook, /classList\.toggle\("dark", isDarkTheme\(theme\)\)/);
});

test("PilaudeIcon is a 24-grid currentColor stroke icon that defaults to 18px and is hidden from AT", () => {
  assert.match(iconSource, /size = 18/);
  assert.match(iconSource, /viewBox="0 0 24 24"/);
  assert.match(iconSource, /stroke="currentColor"/);
  assert.match(iconSource, /aria-hidden="true"/);
});

test("every PilaudeIcon name used by a component exists in the icon table", async () => {
  const { readdir } = await import("node:fs/promises");
  const table = new Set([...iconSource.matchAll(/^  (\w+): "/gm)].map((m) => m[1]));
  assert.ok(table.size >= 19);
  for (const file of await readdir(new URL(".", import.meta.url))) {
    if (!file.endsWith(".tsx")) continue;
    const source = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
    for (const [, name] of source.matchAll(/<PilaudeIcon name="(\w+)"/g)) {
      assert.ok(table.has(name), `${file} uses unknown icon ${name}`);
    }
  }
});
