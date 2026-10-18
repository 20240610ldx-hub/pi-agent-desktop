"use client";

import { useI18n } from "@/hooks/useI18n";
import { canUseNativeMenu, menuPointBelow, showNativeMenu, type NativeMenuEntry } from "@/lib/desktop-menu";
import { openDomMenu } from "@/lib/dom-menu-store";
import { useTerminalAppearance } from "@/lib/terminal-appearance";

export function TerminalSettingsMenu() {
  const { t } = useI18n();
  const { appearance, setAppearance } = useTerminalAppearance();

  return (
    <button
      type="button"
      className="terminal-settings-trigger file-workbench-icon-button"
      aria-label={t("terminal.settings")}
      aria-haspopup="menu"
      title={t("terminal.settings")}
      onClick={async (event) => {
        const point = menuPointBelow(event.currentTarget, "right");
        const at = { x: point.x - 188, y: point.y };
        const entries: NativeMenuEntry[] = [
          {
            kind: "submenu",
            label: t("terminal.cursorStyle"),
            detail: t(`terminal.cursorStyle.${appearance.cursorStyle}`),
            items: (["block", "bar", "underline"] as const).map((cursorStyle) => ({
              label: t(`terminal.cursorStyle.${cursorStyle}`),
              checked: appearance.cursorStyle === cursorStyle,
              onSelect: () => setAppearance({ cursorStyle }),
            })),
          },
          {
            label: t("terminal.cursorBlink"),
            checked: appearance.cursorBlink,
            onSelect: () => setAppearance({ cursorBlink: !appearance.cursorBlink }),
          },
          {
            label: t("terminal.copyOnSelect"),
            checked: appearance.copyOnSelect,
            onSelect: () => setAppearance({ copyOnSelect: !appearance.copyOnSelect }),
          },
          {
            kind: "submenu",
            label: t("terminal.scrollback"),
            detail: t("terminal.scrollbackLines", { count: appearance.scrollback.toLocaleString() }),
            items: ([1000, 5000, 10000] as const).map((scrollback) => ({
              label: t("terminal.scrollbackLines", { count: scrollback.toLocaleString() }),
              checked: appearance.scrollback === scrollback,
              onSelect: () => setAppearance({ scrollback }),
            })),
          },
        ];
        if (canUseNativeMenu() && await showNativeMenu(entries, at)) return;
        openDomMenu(entries, at, "terminal");
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="5" r="1.75" />
        <circle cx="12" cy="12" r="1.75" />
        <circle cx="12" cy="19" r="1.75" />
      </svg>
    </button>
  );
}
