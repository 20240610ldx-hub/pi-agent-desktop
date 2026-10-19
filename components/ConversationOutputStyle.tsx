"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/hooks/useI18n";
import type { NativeMenuEntry } from "@/lib/desktop-menu-model";
import { BUILTIN_OUTPUT_STYLE_IDS, OUTPUT_STYLE_INSTRUCTIONS_MAX_LENGTH, OUTPUT_STYLE_NAME_MAX_LENGTH, type OutputStyleDefinition, type OutputStyleState } from "@/lib/output-styles";
import { focusModalPanel, listenForStackedDialogEscape } from "@/lib/stacked-dialog";
import { isImeComposing } from "@/lib/ime";
import { ConfigButton } from "./SettingsUi";

async function readStyleState(sessionId: string, styleId?: string): Promise<OutputStyleState> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/output-style`, styleId === undefined ? { cache: "no-store" } : {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ styleId }),
  });
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error ?? `HTTP ${response.status}`);
  if (!data || typeof data.supported !== "boolean" || typeof data.selectedId !== "string" || !Array.isArray(data.styles)
    || data.styles.some((style: unknown) => !style || typeof style !== "object" || typeof (style as { id?: unknown }).id !== "string" || typeof (style as { name?: unknown }).name !== "string" || typeof (style as { builtin?: unknown }).builtin !== "boolean")) throw new Error("Invalid output-style response");
  return data as OutputStyleState;
}

function failureText(error: unknown): string { return error instanceof Error ? error.message : String(error); }

interface StyleDraft { name: string; instructions: string; savedId?: string }

/** Session-scoped output-style state; only acknowledged server state supplies check marks. */
export function useConversationOutputStyle(sessionId: string | null | undefined): { menuItems: NativeMenuEntry[]; editor: ReactNode; error: ReactNode; refresh: () => void } {
  const { t } = useI18n();
  const [state, setState] = useState<OutputStyleState | null>(null);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<StyleDraft | null>(null);
  const scope = useRef({ sessionId, generation: 0 });
  if (scope.current.sessionId !== sessionId) scope.current = { sessionId, generation: scope.current.generation + 1 };
  const generation = scope.current.generation;
  const requestLatch = useRef<number | null>(null);
  const [renderGeneration, setRenderGeneration] = useState(generation);
  if (renderGeneration !== generation) {
    setRenderGeneration(generation); setState(null); setFailure(null); setBusy(false); setDraft(null); setLoading(Boolean(sessionId));
  }
  const current = useCallback((token: number) => scope.current.generation === token, []);
  useEffect(() => {
    let active = true;
    setState(null); setFailure(null); setBusy(false); setDraft(null); setLoading(Boolean(sessionId));
    if (!sessionId) return;
    void readStyleState(sessionId).then((next) => { if (active && current(generation)) setState(next); })
      .catch((error: unknown) => { if (active && current(generation)) setFailure(failureText(error)); })
      .finally(() => { if (active && current(generation)) setLoading(false); });
    return () => { active = false; };
  }, [sessionId, generation, revision, current]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const select = useCallback(async (styleId: string) => {
    if (!sessionId || busy || requestLatch.current === generation || !state?.supported || !current(generation)) return;
    const token = generation;
    requestLatch.current = token;
    setBusy(true); setFailure(null);
    try { const next = await readStyleState(sessionId, styleId); if (current(token)) setState(next); }
    catch (error) { if (current(token)) setFailure(failureText(error)); }
    finally { if (current(token)) { requestLatch.current = null; setBusy(false); } }
  }, [sessionId, busy, state?.supported, generation, current]);
  const save = useCallback(async () => {
    if (!sessionId || !draft || busy || requestLatch.current === generation || !state?.supported || !current(generation)) return;
    const token = generation;
    requestLatch.current = token;
    setBusy(true); setFailure(null);
    try {
      let styleId = draft.savedId;
      if (!styleId) {
        const response = await fetch("/api/output-styles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: draft.name, instructions: draft.instructions }) });
        const data = await response.json() as { style?: OutputStyleDefinition; error?: string };
        if (!response.ok || !data.style?.id) throw new Error(data.error ?? `HTTP ${response.status}`);
        if (!current(token)) return;
        styleId = data.style.id;
        setDraft((value) => value ? { ...value, savedId: styleId } : value);
      }
      const next = await readStyleState(sessionId, styleId);
      if (current(token)) { setState(next); if (next.supported && next.selectedId === styleId) setDraft(null); }
    } catch (error) { if (current(token)) setFailure(failureText(error)); }
    finally { if (current(token)) { requestLatch.current = null; setBusy(false); } }
  }, [sessionId, draft, busy, state?.supported, generation, current]);
  const menuItems = useMemo<NativeMenuEntry[]>(() => {
    const reason = loading ? t("outputStyle.loading") : !sessionId ? t("outputStyle.unavailable")
      : failure && !state ? t("outputStyle.readFailed") : !state?.supported ? t(state?.reason === "exact-system-prompt" ? "outputStyle.exactSystemPrompt" : state?.reason === "subagent" ? "outputStyle.subagent" : "outputStyle.unavailable") : undefined;
    const styles = state?.styles.length ? state.styles : BUILTIN_OUTPUT_STYLE_IDS.map((id) => ({ id, name: id, builtin: true }));
    return [...styles.map((style) => ({
      label: style.builtin && (BUILTIN_OUTPUT_STYLE_IDS as readonly string[]).includes(style.id) ? t(`titleMenu.${style.id}`) : style.name,
      checked: state?.supported ? state.selectedId === style.id : undefined,
      disabled: Boolean(reason) || busy,
      disabledReason: reason ?? (busy ? t("outputStyle.applying") : undefined),
      onSelect: () => void select(style.id),
    })), { kind: "separator" }, { label: t("titleMenu.newStyle"), disabled: Boolean(reason) || busy, disabledReason: reason, onSelect: () => { setFailure(null); setDraft({ name: "", instructions: "" }); } }, ...(failure ? [{ label: t("outputStyle.retry"), onSelect: refresh }] : [])];
  }, [state, loading, sessionId, failure, busy, t, select, refresh]);
  return {
    menuItems,
    editor: draft ? <OutputStyleEditor key={`${sessionId}:${generation}`} draft={draft} busy={busy} error={failure} onChange={setDraft} onCancel={() => { setDraft(null); setFailure(null); }} onSave={() => void save()} /> : null,
    error: failure && !draft ? <div role="alert" className="conversation-output-style-error">{failure}</div> : null,
    refresh,
  };
}

function trapDialogTab(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab" || isImeComposing(event)) return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter((element) => element.getClientRects().length > 0);
  const first = items[0], last = items.at(-1);
  if (!first) { event.preventDefault(); event.currentTarget.focus(); return; }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) { event.preventDefault(); first.focus(); }
}

function OutputStyleEditor({ draft, busy, error, onChange, onCancel, onSave }: { draft: StyleDraft; busy: boolean; error: string | null; onChange: (draft: StyleDraft) => void; onCancel: () => void; onSave: () => void }) {
  const { t } = useI18n();
  const id = useId();
  const dialog = useRef<HTMLFormElement>(null);
  const modal = useRef<HTMLDivElement>(null);
  const [discarding, setDiscarding] = useState(false);
  const discardingRef = useRef(discarding);
  discardingRef.current = discarding;
  const requestClose = () => {
    if (busy) return;
    if (!draft.savedId && (draft.name.length > 0 || draft.instructions.length > 0)) setDiscarding(true);
    else onCancel();
  };
  const close = useRef(requestClose);
  const busyRef = useRef(busy);
  close.current = requestClose; busyRef.current = busy;
  useLayoutEffect(() => {
    const restore = focusModalPanel(document, modal.current);
    dialog.current?.focus({ preventScroll: true });
    const stop = listenForStackedDialogEscape(document, () => { if (discardingRef.current) return; if (!busyRef.current) close.current(); });
    return () => { stop(); restore(); };
  }, []);
  return createPortal(<div ref={modal} tabIndex={-1} className="conversation-output-style-backdrop" role="presentation" onClick={(event) => { if (!busy && event.target === event.currentTarget) requestClose(); }}>
    <form ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1} className="conversation-output-style-editor" inert={discarding} onSubmit={(event) => { event.preventDefault(); if (!busy && draft.name.trim() && draft.instructions.trim()) onSave(); }} onKeyDown={(event) => { trapDialogTab(event); if (event.key === "Enter" && isImeComposing(event)) event.preventDefault(); }}>
      <h2 id={`${id}-title`}>{t("outputStyle.createTitle")}</h2>
      <label htmlFor={`${id}-name`}>{t("outputStyle.name")}</label>
      <input id={`${id}-name`} className="config-input" value={draft.name} maxLength={OUTPUT_STYLE_NAME_MAX_LENGTH} required disabled={busy || Boolean(draft.savedId)} onChange={(event) => onChange({ ...draft, name: event.target.value })} />
      <label htmlFor={`${id}-instructions`}>{t("outputStyle.instructions")}</label>
      <textarea id={`${id}-instructions`} className="config-input" value={draft.instructions} maxLength={OUTPUT_STYLE_INSTRUCTIONS_MAX_LENGTH} required disabled={busy || Boolean(draft.savedId)} onChange={(event) => onChange({ ...draft, instructions: event.target.value })} />
      {error && <div role="alert">{draft.savedId && <p>{t("outputStyle.createdApplyFailed")}</p>}<span>{error}</span></div>}
      <div className="conversation-output-style-actions"><ConfigButton disabled={busy} onClick={requestClose}>{t("chat.cancel")}</ConfigButton><ConfigButton type="submit" variant="primary" disabled={busy || !draft.name.trim() || !draft.instructions.trim()}>{t(busy ? "outputStyle.saving" : draft.savedId ? "outputStyle.retryApply" : "outputStyle.saveApply")}</ConfigButton></div>
    </form>
    {discarding && <DiscardStyleDraft onKeep={() => setDiscarding(false)} onDiscard={onCancel} />}
  </div>, document.body);
}

function DiscardStyleDraft({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  const { t } = useI18n();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const keep = useRef(onKeep);
  keep.current = onKeep;
  useLayoutEffect(() => {
    const restore = focusModalPanel(document, panel.current);
    const stop = listenForStackedDialogEscape(document, () => keep.current());
    return () => { stop(); restore(); };
  }, []);
  return <div ref={panel} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} tabIndex={-1} className="conversation-output-style-discard" onKeyDown={trapDialogTab}>
    <h2 id={`${id}-title`}>{t("outputStyle.discardTitle")}</h2><p id={`${id}-body`}>{t("outputStyle.discardBody")}</p>
    <div className="conversation-output-style-actions"><ConfigButton onClick={onKeep}>{t("outputStyle.keepEditing")}</ConfigButton><ConfigButton variant="danger" onClick={onDiscard}>{t("outputStyle.discard")}</ConfigButton></div>
  </div>;
}
