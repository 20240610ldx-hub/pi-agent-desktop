"use client";

import { useSyncExternalStore } from "react";
import { APP_PREF_KEYS, getPrefJson, setPrefJson } from "./app-prefs";

export type TerminalAppearance = {
  cursorStyle: "block" | "bar" | "underline";
  cursorBlink: boolean;
  copyOnSelect: boolean;
  scrollback: 1000 | 5000 | 10000;
};

const DEFAULT_APPEARANCE: TerminalAppearance = {
  cursorStyle: "block",
  cursorBlink: true,
  copyOnSelect: false,
  scrollback: 10000,
};

export function normalizeTerminalAppearance(raw: unknown): TerminalAppearance {
  const value = raw !== null && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  return {
    cursorStyle: value.cursorStyle === "block" || value.cursorStyle === "bar" || value.cursorStyle === "underline"
      ? value.cursorStyle : DEFAULT_APPEARANCE.cursorStyle,
    cursorBlink: typeof value.cursorBlink === "boolean" ? value.cursorBlink : DEFAULT_APPEARANCE.cursorBlink,
    copyOnSelect: typeof value.copyOnSelect === "boolean" ? value.copyOnSelect : DEFAULT_APPEARANCE.copyOnSelect,
    scrollback: value.scrollback === 1000 || value.scrollback === 5000 || value.scrollback === 10000
      ? value.scrollback : DEFAULT_APPEARANCE.scrollback,
  };
}

let appearance: TerminalAppearance | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): TerminalAppearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  appearance ??= normalizeTerminalAppearance(getPrefJson(APP_PREF_KEYS.terminalAppearance));
  return appearance;
}

function getServerSnapshot(): TerminalAppearance {
  return DEFAULT_APPEARANCE;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function setAppearance(patch: Partial<TerminalAppearance>): void {
  if (typeof window === "undefined") return;
  const current = getSnapshot();
  const next = normalizeTerminalAppearance({ ...current, ...patch });
  if (next.cursorStyle === current.cursorStyle && next.cursorBlink === current.cursorBlink
    && next.copyOnSelect === current.copyOnSelect && next.scrollback === current.scrollback) return;
  appearance = next;
  setPrefJson(APP_PREF_KEYS.terminalAppearance, next);
  listeners.forEach((listener) => listener());
}

export function useTerminalAppearance(): {
  appearance: TerminalAppearance;
  setAppearance: (patch: Partial<TerminalAppearance>) => void;
} {
  return {
    appearance: useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
    setAppearance,
  };
}
