"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/useIsMobile";
import { isImeComposing } from "@/lib/ime";
import { SelectorRow } from "./SelectorRow";

export interface ModelSelectorOption {
  provider: string;
  modelId: string;
  name: string;
}

interface ModelSelectorProps {
  options: ModelSelectorOption[];
  value?: { provider: string; modelId: string } | null;
  onChange: (provider: string, modelId: string) => void;
  onClear?: () => void;
  emptyLabel?: string;
  selectedLabel?: string;
  disabled?: boolean;
  busy?: boolean;
  isAutoSelection?: boolean;
  ariaLabel?: string;
  variant?: "toolbar" | "field";
  placement?: "up" | "auto";
  /** The model new sessions start with; its row gets a filled star. */
  defaultValue?: { provider: string; modelId: string } | null;
  /** Shows a star on every row that saves it as the default. */
  onSetDefault?: (provider: string, modelId: string) => void;
}

const MODEL_FILTER_THRESHOLD = 8;
const MODEL_OPTION_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function compareModelOptions(a: ModelSelectorOption, b: ModelSelectorOption): number {
  return MODEL_OPTION_COLLATOR.compare(a.name || a.modelId, b.name || b.modelId)
    || MODEL_OPTION_COLLATOR.compare(a.provider, b.provider)
    || MODEL_OPTION_COLLATOR.compare(a.modelId, b.modelId);
}

export function filterModelOptions(options: ModelSelectorOption[], query: string): ModelSelectorOption[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return options;

  return options.filter((option) => (
    `${option.name} ${option.provider}/${option.modelId}`
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  ));
}

export function ModelSelector({
  options,
  value,
  onChange,
  onClear,
  emptyLabel,
  selectedLabel,
  disabled = false,
  busy = false,
  isAutoSelection = false,
  ariaLabel,
  variant = "toolbar",
  placement = "up",
  defaultValue,
  onSetDefault,
}: ModelSelectorProps) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const keyboardOpenRef = useRef(false);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{ top: number; right: number; bottom: number; left: number; width: number } | null>(null);
  const [filter, setFilter] = useState("");
  const locked = disabled || busy;
  const sortedOptions = useMemo(() => [...options].sort(compareModelOptions), [options]);
  const filteredOptions = filterModelOptions(sortedOptions, filter);
  const showFilter = sortedOptions.length > MODEL_FILTER_THRESHOLD;
  const currentOption = sortedOptions.find((option) => option.modelId === value?.modelId && option.provider === value?.provider);
  const modelsByProvider: { provider: string; options: ModelSelectorOption[] }[] = [];

  for (const option of filteredOptions) {
    const group = modelsByProvider.find((item) => item.provider === option.provider);
    if (group) group.options.push(option);
    else modelsByProvider.push({ provider: option.provider, options: [option] });
  }

  const currentName = selectedLabel ?? (value
    ? currentOption?.name || value.modelId
    : emptyLabel ?? (sortedOptions.length > 0 ? "Select model" : "No models"));
  const buttonTitle = busy ? "Switching model" : locked ? currentName : sortedOptions.length > 0 || onClear ? "Change model" : "No available models";

  const close = () => {
    setOpen(false);
    setFilter("");
    triggerRef.current?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (!open) return;
    const updateAnchor = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setAnchorRect({ top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width });
    };
    window.addEventListener("resize", updateAnchor);
    window.addEventListener("scroll", updateAnchor, true);
    window.visualViewport?.addEventListener("resize", updateAnchor);
    return () => {
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("scroll", updateAnchor, true);
      window.visualViewport?.removeEventListener("resize", updateAnchor);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const current = panelRef.current?.querySelector<HTMLButtonElement>('button[role="option"][aria-selected="true"]')
      ?? panelRef.current?.querySelector<HTMLButtonElement>('button[role="option"]');
    current?.scrollIntoView({ block: "nearest" });
    if (!showFilter || keyboardOpenRef.current) current?.focus({ preventScroll: true });
  }, [open, showFilter]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        rootRef.current && !rootRef.current.contains(event.target as Node)
        && panelRef.current && !panelRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setFilter("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!locked) return;
    setOpen(false);
    setFilter("");
  }, [locked]);

  // The composer toolbar draws every control icon at 14px; the form field keeps its smaller glyph.
  const chipIconSize = variant === "field" ? 11 : 14;

  const buttonStyle: CSSProperties = variant === "field"
    ? {
        display: "flex",
        alignItems: "center",
        gap: 7,
        width: "100%",
        minWidth: 0,
        height: 34,
        padding: "0 9px",
        overflow: "hidden",
        border: "var(--hairline) solid var(--border)",
        borderRadius: 5,
        background: locked ? "var(--bg-panel)" : "var(--bg)",
        color: locked ? "var(--text-dim)" : "var(--text)",
        cursor: locked ? "default" : "pointer",
        fontSize: 12,
        textAlign: "left",
      }
    : {
        display: "flex",
        alignItems: "center",
        justifyContent: isMobile ? "flex-start" : undefined,
        gap: 6,
        width: isMobile ? "100%" : undefined,
        maxWidth: isMobile ? "100%" : 220,
        height: 32,
        padding: isMobile ? "8px 10px" : "8px 12px",
        overflow: "hidden",
        border: "none",
        borderRadius: 9,
        background: open ? "var(--bg-hover)" : "none",
        color: "var(--text-muted)",
        cursor: locked ? "not-allowed" : "pointer",
        fontSize: 12,
        opacity: locked ? 0.5 : 1,
        transition: "background 0.12s, color 0.12s",
      };

  const choose = (option: ModelSelectorOption) => {
    const active = option.modelId === value?.modelId && option.provider === value?.provider;
    close();
    if (!active || isAutoSelection) onChange(option.provider, option.modelId);
  };

  const saveDefault = (option: ModelSelectorOption) => {
    onSetDefault?.(option.provider, option.modelId);
  };

  return (
    <div
      ref={rootRef}
      className={`model-selector is-${variant}${locked ? " is-disabled" : ""}`}
      style={{ position: "relative", width: variant === "field" || isMobile ? "100%" : undefined, minWidth: 0, flex: variant === "toolbar" && isMobile ? "1 1 auto" : undefined }}
      onKeyDown={(event) => {
        if (isImeComposing(event)) {
          if (["Enter", "Escape", "ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
          }
          return;
        }
        if (open && ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
          const editing = event.target instanceof HTMLInputElement;
          if (editing && (event.key === "Home" || event.key === "End")) return;
          const rows = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('button[role="option"]:not(:disabled)') ?? []);
          // Focus may sit on a row's save-default star; locate its row's option button.
          const currentRow = (document.activeElement as Element | null)?.closest(".app-option-row")?.querySelector<HTMLButtonElement>('button[role="option"]');
          const index = currentRow ? rows.indexOf(currentRow) : -1;
          const next = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1
            : index < 0 ? event.key === "ArrowDown" ? 0 : rows.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
          event.preventDefault();
          event.stopPropagation();
          rows[next]?.focus({ preventScroll: true });
          rows[next]?.scrollIntoView({ block: "nearest" });
          return;
        }
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setFilter("");
        }
      }}
    >
      <button
        type="button"
        ref={triggerRef}
        aria-label={ariaLabel ?? buttonTitle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-busy={busy || undefined}
        disabled={locked}
        title={buttonTitle}
        style={buttonStyle}
        onKeyDown={(event) => {
          if (open || locked || isImeComposing(event) || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          keyboardOpenRef.current = true;
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchorRect({ top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width });
          setOpen(true);
        }}
        onClick={(event) => {
          keyboardOpenRef.current = event.detail === 0;
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchorRect({ top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width });
          setOpen((current) => {
            if (current) setFilter("");
            return !current;
          });
        }}
        onMouseEnter={(event) => {
          if (locked) return;
          event.currentTarget.style.background = "var(--bg-hover)";
          event.currentTarget.style.color = "var(--text)";
        }}
        onMouseLeave={(event) => {
          if (locked) {
            event.currentTarget.style.background = variant === "field" ? "var(--bg-panel)" : "none";
            event.currentTarget.style.color = variant === "field" ? "var(--text-dim)" : "var(--text-muted)";
            return;
          }
          event.currentTarget.style.background = open ? "var(--bg-hover)" : variant === "field" ? "var(--bg)" : "none";
          event.currentTarget.style.color = variant === "field" ? "var(--text)" : "var(--text-muted)";
        }}
      >
        {busy ? (
          <svg width={chipIconSize} height={chipIconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }} aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          </svg>
        ) : (
          <svg width={chipIconSize} height={chipIconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={variant === "field" ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <rect x="9" y="9" width="6" height="6" />
            <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
            <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
            <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
            <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
          </svg>
        )}
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</span>
        {variant === "field" && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: "var(--text-dim)" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {open && anchorRect && (() => {
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
        const anchorTop = Math.max(8, Math.min(anchorRect.top, viewportHeight - 8));
        const anchorBottom = Math.max(8, Math.min(anchorRect.bottom, viewportHeight - 8));
        const spaceAbove = Math.max(0, anchorTop - 14);
        const spaceBelow = Math.max(0, viewportHeight - anchorBottom - 14);
        const openAbove = placement === "up" && spaceAbove >= 120 || spaceAbove > spaceBelow;
        const maxHeight = Math.min(openAbove ? spaceAbove : spaceBelow, viewportHeight * 0.6);
        const verticalPosition = openAbove
          ? { bottom: viewportHeight - anchorTop + 6 }
          : { top: anchorBottom + 6 };
        // The native reference's 289px menu at 150% is 192.67 CSS px.
        const menuWidth = Math.min(Math.max(anchorRect.width, 193), viewportWidth - 16);
        const horizontalPosition: CSSProperties = isMobile
          ? { left: 8, right: 8, maxWidth: "calc(100vw - 16px)" }
          : { left: Math.max(8, Math.min(anchorRect.left, viewportWidth - menuWidth - 8)), width: menuWidth };

        return (
          <div
            ref={panelRef}
            className="native-popover app-menu model-selector-menu"
            // Clicks on headings, gaps and hint text must not move focus to <body>:
            // the root onBlur would read relatedTarget === null and close the menu.
            onMouseDown={(event) => {
              if (!(event.target as Element).closest("input, button")) event.preventDefault();
            }}
            style={{
              position: "fixed",
              ...verticalPosition,
              ...horizontalPosition,
              zIndex: 500,
              display: "flex",
              flexDirection: "column",
              maxHeight,
              overflow: "hidden",
            }}
          >
            {showFilter && (
              <div className="model-selector-filter">
                <input
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder={t("chat.filterModels")}
                  aria-label={t("chat.filterModels")}
                  // On phones, focusing the filter opens the on-screen keyboard,
                  // which shrinks the viewport and pushes the list off-screen
                  // before the user has decided to filter. Tap to filter instead.
                  autoFocus={!isMobile}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}
            <div id={listId} className="app-menu-list" role="listbox" aria-label={ariaLabel ?? buttonTitle}>
              {value && !currentOption && !filter.trim() && (
                <div role="option" aria-selected="true" aria-disabled="true" className="model-selector-unavailable">
                  <OptionLabel label={selectedLabel ?? value.modelId} />
                  <small>{value.provider}</small>
                </div>
              )}
              {onClear && !filter.trim() && (
                <SelectorRow active={!value} gutter={Boolean(onSetDefault)} onSelect={() => {
                  close();
                  onClear();
                }}>
                  <OptionLabel label={emptyLabel ?? "Default"} />
                </SelectorRow>
              )}
              {modelsByProvider.length === 0 ? (
                <div className="model-selector-empty" role="status">
                  {filter.trim() ? t("chat.noMatchingModels") : "No available models"}
                </div>
              ) : modelsByProvider.map((group, index) => (
                <div key={group.provider} role="group" aria-label={group.provider}>
                  {modelsByProvider.length > 1 && (
                    <div className={`model-selector-provider${index > 0 || onClear ? " has-separator" : ""}`}>
                      {group.provider}
                    </div>
                  )}
                  {group.options.map((option) => {
                    return (
                      <SelectorRow
                        key={`${option.provider}:${option.modelId}`}
                        active={option.modelId === value?.modelId && option.provider === value?.provider}
                        onSelect={() => choose(option)}
                        star={onSetDefault ? {
                          isDefault: option.modelId === defaultValue?.modelId && option.provider === defaultValue?.provider,
                          saveLabel: t("chat.saveDefaultModel"),
                          defaultLabel: t("chat.defaultModel"),
                          onSave: () => saveDefault(option),
                        } : undefined}
                      >
                        <OptionLabel label={option.name || option.modelId} />
                        {option.modelId === value?.modelId && option.provider === value?.provider && (
                          <svg className="model-selector-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="m5 12 4 4L19 6" />
                          </svg>
                        )}
                      </SelectorRow>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function OptionLabel({ label }: { label: string }) {
  return <span title={label} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>;
}
