"use client";

import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useGlobalKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useNativeAppMenu } from "@/hooks/useNativeAppMenu";
import { selectProjectDirectoryNative } from "./ProjectPicker";
import { SessionSidebar, type SidebarArchiveActions } from "./SessionSidebar";
import { PilaudeWelcome } from "./PilaudeWelcome";
import { PilaudeWorkspaceContext } from "./PilaudeWorkspaceContext";
import { PilaudeIcon } from "./PilaudeIcon";
import { DirectoryPicker } from "./DirectoryPicker";
import { ChatWindow } from "./ChatWindow";
import { TranscriptViewProvider } from "./TranscriptViewContext";
import { useTranscriptView } from "@/hooks/useTranscriptView";
import { setTranscriptView, TRANSCRIPT_VIEW_MODES } from "@/lib/transcript-view-preference";
import { useConversationOutputStyle } from "./ConversationOutputStyle";
import { AppNoticeShelf } from "./AppNoticeShelf";
import { useScheduledRunNotifications } from "@/hooks/useScheduledRunNotifications";
import type { ChatScrollPosition } from "@/lib/chat-scroll-position";
import { clearDraft, getDraft, setDraft } from "@/lib/draft-store";
import { TabBar, type Tab } from "./TabBar";
import { TerminalSettingsMenu } from "./TerminalSettingsMenu";
import { WorkspacePaneDock } from "./WorkspacePaneDock";
import { WorkspaceControlButton, WorkspacePaneControls, type WorkspacePaneId } from "./WorkspacePaneControls";
import { normalizeWorkspacePaneLayout } from "@/lib/workspace-pane-layout";

// Heavy, rarely-used surfaces are code-split out of the main bundle. The
// config modals may never be opened at all; FileViewer drags in markdown +
// syntax highlighting a second time and only matters once a file tab opens.
const FileViewer = dynamic(() => import("./FileViewer").then((m) => m.FileViewer), { ssr: false });
const ChangesPane = dynamic(() => import("./ChangesPane").then((m) => m.ChangesPane), { ssr: false });
const FileExplorer = dynamic(() => import("./FileExplorer").then((m) => m.FileExplorer), { ssr: false });
// Only mounted once opened; xterm alone is a large share of the page bundle.
const TerminalPanel = dynamic(() => import("./TerminalPanel").then((m) => m.TerminalPanel), { ssr: false });
const ScheduledView = dynamic(() => import("./scheduled/ScheduledView").then((m) => m.ScheduledView), { ssr: false });
import { openFileTab, saveFileViewerState } from "./file-tab-state";
import { SettingsPanel } from "./SettingsPanel";
import { keepDocumentTitle } from "@/lib/document-title";
import { ProjectTrustDialog, type ProjectTrustFailure } from "./ProjectTrustDialog";
import { BranchNavigator, hasSessionBranches } from "./BranchNavigator";
import { UpdateReminder } from "./UpdateReminder";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMenuNavigation } from "@/hooks/useMenuNavigation";
import { APP_PREF_KEYS, getPrefBool, getPrefJson, setPref, setPrefJson } from "@/lib/app-prefs";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { useDesktopConnection } from "@/lib/desktop-connection";
import { isTauriDesktop, isConversationWindow, getConversationDestinations, openConversationWindow, openProjectInVSCode, openChangesWindow, revealItemInDirNative, setCloseQuitsNative, type ConversationDestinations } from "@/lib/desktop-native";
import { subscribeChangesFeedback } from "@/lib/changes-feedback";
import { canUseNativeMenu, menuPointBelow, showNativeMenu, type NativeMenuEntry } from "@/lib/desktop-menu";
import { closeDomMenu, getDomMenu, openDomMenu, subscribeDomMenu } from "@/lib/dom-menu-store";
import { focusModalPanel, listenForStackedDialogEscape } from "@/lib/stacked-dialog";
import { useNativeContextMenu } from "@/hooks/useNativeContextMenu";
import { DomContextMenuHost } from "./DomContextMenuHost";
import { getFileName } from "@/lib/file-paths";
import { buildAtMentionText, buildFileAtMentionsText, buildFileLineMentionText } from "@/lib/file-fuzzy";
import { PRODUCT_NAME } from "@/lib/branding";
import { isImeComposing } from "@/lib/ime";
import {
  resolveInitialNavigation,
  type PersistedWorkspace,
} from "@/lib/workspace-state";
import { useDesktopWorkspaceTabs } from "@/hooks/useDesktopWorkspaceTabs";
import { useWorkspaceAvailability } from "@/hooks/useWorkspaceAvailability";
import { WindowControls, useDesktopChrome, useReportDesktopReady, useWindowDrag } from "./desktop";
import { SystemPromptPanel } from "./SystemPromptPanel";
import { ToolDefinitionsPanel } from "./ToolDefinitionsPanel";
import { AgentSessionPanel } from "./AgentSessionPanel";
import { newTerminalTab, restoreTerminalTabs, resolveActiveTerminalTabId, TERMINAL_TABS_KEY, type TerminalTab } from "./terminal-tab-state";
import { artifactPanelTab, artifactTabId, artifactTabsForSession, upsertArtifactTab, type ArtifactTab } from "./artifact-tabs";
import { ArtifactPanel } from "./ArtifactPanel";
import { setArtifactOpener, useArtifactTitles } from "@/lib/artifact-store";
import { useAudio } from "@/hooks/useAudio";
import { copyText } from "@/lib/clipboard";
import { sendAgentCommand } from "@/lib/agent-client";
import {
  claimExtensionAttentionNotification,
  shouldShowBrowserNotification,
  showBrowserNotification,
} from "@/lib/browser-notifications";
import { setupPushSubscription } from "@/lib/push-client";
import { withTabOpen } from "@/lib/initial-navigation";
import { clearTabOpenSession, getTabOpen, setTabOpenNewSession, setTabOpenSession } from "@/lib/tab-session";
import { mergeCatalogRow } from "./session-catalog-helpers";
import { rekeyDraft } from "@/lib/draft-store";
import {
  clearLastOpen,
  getLastOpenSession,
  setLastOpenSession,
  workspaceKeyOf,
} from "@/lib/workspace-memory";
import {
  getDefaultRightPanelWidth,
  getRightPanelMaxWidth,
  getSidebarMaxWidth,
  MOBILE_MAX_WIDTH,
  RIGHT_PANEL_FALLBACK_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SPLIT_PANEL_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "@/lib/panel-layout";
import type { BlockingExtensionUiRequest, CacheWarmingInfo, LeafChangeOptions, SessionInfo, SessionTreeNode, SessionWorkspaceKind } from "@/lib/types";
import { shouldShowUsageBreakdown, UNATTRIBUTED_USAGE_KEY } from "@/lib/usage-breakdown";
import { cacheWarmingRows } from "@/lib/cache-warming-display";
import type { McpErrorResponse, ProjectTrustStatus } from "@/lib/api-types";
import type { ChatInputHandle } from "./ChatInput";
import type { FileExplorerHandle } from "./FileExplorer";
import type { SessionStatsInfo } from "@/lib/pi-types";
import type { FileViewerState } from "@/lib/file-viewer-state";
import type { ToolEntry } from "@/lib/tool-presets";
import { getSessionFamily } from "@/lib/session-family";
import { getLastSettingsSection, type SettingsSection } from "@/lib/settings-navigation";

type SessionCopyField = "file" | "id" | "projectDir" | "gitBranch" | "gitWorktree";
type AutoNameStatus =
  | { kind: "idle" }
  | { kind: "naming" }
  | { kind: "success" }
  | { kind: "error"; message: string };
const FILE_TREE_DEFAULT_WIDTH = 300;
const AGENT_PANEL_WIDTH = 420;
const FILE_TREE_MIN_WIDTH = 220;
const FILE_TREE_MAX_WIDTH = 520;
const FILE_TREE_PREVIEW_MIN_WIDTH = 240;
// Below this panel width the tree steps aside while a file or terminal is
// shown: the viewer's toolbar (path, mode switch, actions) needs ~320px, and a
// 220px tree beside it left the preview clipped.
const FILE_TREE_AUTO_COLLAPSE_WIDTH = FILE_TREE_MIN_WIDTH + 320;

function parkedNewSessionDraftKey(cwd: string): string {
  return `parked-new:${cwd}`;
}

function parkNewSessionDraft(key: string, cwd: string): void {
  const draft = getDraft(key);
  const parked = parkedNewSessionDraftKey(cwd);
  if (draft) setDraft(parked, draft);
  else clearDraft(parked);
}

export function AppShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [desktopMode] = useState(() => isTauriDesktop());
  const [conversationWindow] = useState(() => isConversationWindow());
  const [persistedWorkspace] = useState(() => (
    desktopMode && !conversationWindow ? getPrefJson<PersistedWorkspace>(APP_PREF_KEYS.workspace) : null
  ));
  const [initialNavigation, setInitialNavigation] = useState(() => resolveInitialNavigation(searchParams, persistedWorkspace));
  // Subscribed for its side effects only: this hook installs the shared theme
  // store's listener for the app's lifetime, so an "auto" preference keeps
  // following OS scheme changes and the resolved palette keeps being mirrored
  // into the desktop config while the settings dialog is closed. The sidebar's
  // sun/moon toggle was removed — theme selection lives in Settings → General.
  useTheme();
  const { locale, t: translate } = useI18n();
  const isMobile = useIsMobile();
  useViewportHeight();

  // Once the user has granted notification permission, register a Web Push
  // subscription so the server can notify backgrounded PWAs (notably iOS,
  // which suspends page JS and never receives the SSE completion event).
  useEffect(() => {
    if (conversationWindow || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    void setupPushSubscription(locale);
  }, [locale, conversationWindow]);
  // Audio ownership lives here (not in ChatWindow) so the completion tone can
  // also fire for tasks finishing in a non-active workspace whose ChatWindow
  // is not mounted. ChatWindow receives the audio callbacks as props.
  const { soundEnabled, onSoundToggle, playDoneSound, unlockAudio, soundEnabledRef } = useAudio();
  const [quoteSelectionEnabled, setQuoteSelectionEnabled] = useState(true);
  useEffect(() => {
    // Opt-out pref: absent storage means enabled (default on).
    setQuoteSelectionEnabled(getPrefBool(APP_PREF_KEYS.quoteSelectionEnabled, true));
  }, []);
  const handleQuoteSelectionChange = useCallback((enabled: boolean) => {
    setQuoteSelectionEnabled(enabled);
    setPref(APP_PREF_KEYS.quoteSelectionEnabled, String(enabled));
  }, []);
  const notifiedAttentionRequestIdsRef = useRef(new Set<string>());
  const handleBackgroundTaskDone = useCallback(() => {
    if (!conversationWindow && soundEnabledRef.current) playDoneSound();
  }, [playDoneSound, soundEnabledRef, conversationWindow]);
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);
  const transcriptView = useTranscriptView(selectedSession?.id ?? null);
  const outputStyle = useConversationOutputStyle(selectedSession?.transient ? null : selectedSession?.id);
  const [titleMenuOpen, setTitleMenuOpen] = useState(false);
  const titleMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [titleRename, setTitleRename] = useState<{ session: SessionInfo; value: string } | null>(null);
  const titleRenameInputRef = useRef<HTMLInputElement>(null);
  const titleRenameCommitRef = useRef(false);
  const [titleDeleteSession, setTitleDeleteSession] = useState<SessionInfo | null>(null);
  const titleDeleteDialogRef = useRef<HTMLDivElement>(null);
  const [titleActionBusy, setTitleActionBusy] = useState(false);
  const titleActionBusyRef = useRef(false);
  const titleActionContextRef = useRef({ sessionId: null as string | null, scheduled: false, welcome: false, generation: 0 });
  const [titleActionError, setTitleActionError] = useState<string | null>(null);
  const [titleFileManager, setTitleFileManager] = useState<{ supported: boolean; platform?: string } | null>(null);
  const [titleDestinations, setTitleDestinations] = useState<ConversationDestinations | null>(null);
  const [titleDestinationsFailed, setTitleDestinationsFailed] = useState(false);
  const [titleArchiveActions, setTitleArchiveActions] = useState<SidebarArchiveActions | null>(null);
  const handleArchiveActionsChange = useCallback((actions: SidebarArchiveActions) => setTitleArchiveActions(actions), []);
  const [chatWorkspaceCwd, setChatWorkspaceCwd] = useState<string | null>(null);
  const [newSessionWorkspaceKind, setNewSessionWorkspaceKind] = useState<SessionWorkspaceKind>("project");
  // Resolve the hidden chat cwd independently of the sidebar's session poll so
  // a chat URL or restored blank composer is classified on the first render.
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/chat-workspace", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ cwd?: string }> : null)
      .then((data) => {
        if (data?.cwd) setChatWorkspaceCwd(data.cwd);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, []);
  // The Scheduled page covers the chat area without unmounting it, so the open session keeps its state.
  const [scheduledOpen, setScheduledOpen] = useState(() => searchParams?.get("view") === "scheduled");
  // Read by restoreWorkspaceContext and handleSelectSession; those identities
  // must not change when the page opens.
  const scheduledOpenRef = useRef(scheduledOpen);
  scheduledOpenRef.current = scheduledOpen;
  // Home is a navigation surface over the current workspace, like Scheduled.
  // Keeping the chat mounted preserves its unsent draft and live session state.
  const [welcomeOpen, setWelcomeOpen] = useState(() => searchParams?.get("view") === "new");
  const welcomeOpenRef = useRef(welcomeOpen);
  welcomeOpenRef.current = welcomeOpen;
  const titleActionContext = titleActionContextRef.current;
  if (titleActionContext.sessionId !== (selectedSession?.id ?? null) || titleActionContext.scheduled !== scheduledOpen || titleActionContext.welcome !== welcomeOpen) {
    titleActionContextRef.current = { sessionId: selectedSession?.id ?? null, scheduled: scheduledOpen, welcome: welcomeOpen, generation: titleActionContext.generation + 1 };
  }
  const [explorerUploadBusy, setExplorerUploadBusy] = useState(false);
  const fileExplorerRef = useRef<FileExplorerHandle>(null);
  // The panel is a preview surface; keep the file index hidden until asked for.
  const [fileTreeOpen, setFileTreeOpen] = useState(false);
  // Measured width of the panel body; drives the narrow-panel auto-collapse.
  const [panelBodyWidth, setPanelBodyWidth] = useState(0);
  const panelBodyObserverRef = useRef<ResizeObserver | null>(null);
  const panelBodyRef = useCallback((node: HTMLDivElement | null) => {
    panelBodyObserverRef.current?.disconnect();
    panelBodyObserverRef.current = null;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setPanelBodyWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    panelBodyObserverRef.current = observer;
  }, []);
  // The user reopened the tree while the panel is narrow; cleared whenever the
  // panel crosses the threshold, so widening and narrowing again re-collapses.
  const [fileTreeNarrowOverride, setFileTreeNarrowOverride] = useState(false);
  const [fileExplorerQuery, setFileExplorerQuery] = useState("");
  const [changesCount, setChangesCount] = useState(0);
  const [changesCollapsed, setChangesCollapsed] = useState(true);
  const [sessionCatalog, setSessionCatalog] = useState<SessionInfo[]>([]);
  const [sessionNavigation, setSessionNavigation] = useState<{ items: { key: string; session: SessionInfo | null; cwd: string; projectKey: string | null; draftId: string; scheduled: boolean; welcome: boolean }[]; index: number }>({ items: [], index: -1 });
  const [availableProjectRoots, setAvailableProjectRoots] = useState<string[]>([]);
  const [welcomePickerOpen, setWelcomePickerOpen] = useState(false);
  const [welcomePickerBusy, setWelcomePickerBusy] = useState(false);
  const [welcomePickerError, setWelcomePickerError] = useState<string | null>(null);
  const handleSessionsChange = useCallback((sessions: SessionInfo[]) => {
    setSessionCatalog(sessions);
    // The sidebar hydrates metadata after the selected session has already
    // mounted. Merge that update into the active session without changing the
    // ChatWindow key or restarting its history load.
    setSelectedSession((current) => {
      if (!current) return current;
      const refreshed = sessions.find((session) => session.id === current.id);
      return refreshed ? mergeCatalogRow(current, refreshed) : current;
    });
  }, []);
  const sessionsWithSelection = useMemo(() => {
    if (!selectedSession) return sessionCatalog;
    return [
      ...sessionCatalog.filter((session) => session.id !== selectedSession.id),
      selectedSession,
    ];
  }, [selectedSession, sessionCatalog]);
  const activeSessionFamily = useMemo(
    () => getSessionFamily(sessionsWithSelection, selectedSession?.id),
    [selectedSession?.id, sessionsWithSelection],
  );
  const hasSubagentSessions = Boolean(activeSessionFamily?.subagents.length);
  const [runningSessionIds, setRunningSessionIds] = useState<Set<string>>(() => new Set());
  const handleRunningSessionIdsChange = useCallback((ids: Set<string>) => {
    setRunningSessionIds((previous) => {
      if (previous.size === ids.size && [...ids].every((id) => previous.has(id))) return previous;
      return ids;
    });
  }, []);
  // The temporary id distinguishes consecutive fresh composers in one cwd.
  const [newSessionCwd, setNewSessionCwd] = useState<string | null>(null);
  const restoredHomeDraftIdRef = useRef(searchParams?.get("view") === "new" ? searchParams.get("draft") : null);
  const [newSessionDraftId, setNewSessionDraftId] = useState(restoredHomeDraftIdRef.current ?? "initial");
  const activeNewSessionDraftKeyRef = useRef<string | null>(null);
  const [initialCwdStatus, setInitialCwdStatus] = useState<"idle" | "validating" | "ready" | "error">(
    () => initialNavigation.requestedCwd ? "validating" : "idle",
  );
  const [initialCwdError, setInitialCwdError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sessionKey, setSessionKey] = useState(0);
  const sessionScrollPositionsRef = useRef(new Map<string, ChatScrollPosition>());
  const handleSessionScrollPositionChange = useCallback((sessionId: string, position: ChatScrollPosition) => {
    sessionScrollPositionsRef.current.set(sessionId, position);
  }, []);
  const [searchTarget, setSearchTarget] = useState<{ sessionId: string; entryId: string; blockIndex?: number } | null>(null);
  const handleSearchTargetHandled = useCallback((target: { sessionId: string; entryId: string }) => {
    setSearchTarget((current) => current === target ? null : current);
  }, []);
  const [explorerRefreshKey, setExplorerRefreshKey] = useState(0);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  useNativeContextMenu();
  const [modelsRefreshKey, setModelsRefreshKey] = useState(0);
  const [topMoreOpen, setTopMoreOpen] = useState(false);
  const topMoreRef = useRef<HTMLDivElement>(null);
  const topMoreMenuRef = useRef<HTMLDivElement>(null);
  const [topMorePos, setTopMorePos] = useState<{ top: number; right: number } | null>(null);
  useMenuNavigation(topMoreOpen && Boolean(topMorePos), topMoreMenuRef, () => setTopMoreOpen(false));
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const shortcutHelpDialogRef = useRef<HTMLDivElement | null>(null);
  const [projectTrust, setProjectTrust] = useState<ProjectTrustStatus | null>(null);
  const [projectTrustDialogOpen, setProjectTrustDialogOpen] = useState(false);
  const [projectTrustBusy, setProjectTrustBusy] = useState(false);
  const [projectTrustError, setProjectTrustError] = useState<ProjectTrustFailure | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => !initialNavigation.sidebarCollapsed);
  const desktopSidebarOpenRef = useRef(!initialNavigation.sidebarCollapsed);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [contextDockOpen, setContextDockOpen] = useState(false);
  const handleContextDockClose = useCallback(() => setContextDockOpen(false), []);
  const [artifactShelfOpen, setArtifactShelfOpen] = useState(false);
  useEffect(() => { setContextDockOpen(window.innerWidth >= 1200); }, []);
  const [rightPanelExpanded, setRightPanelExpanded] = useState(false);
  const rightPanelFullWidth = rightPanelOpen && rightPanelExpanded && !isMobile;
  useEffect(() => {
    if (!rightPanelOpen || isMobile) setRightPanelExpanded(false);
  }, [rightPanelOpen, isMobile]);
  const [mobileSidebarReady, setMobileSidebarReady] = useState(false);
  const viewportCompactInitializedRef = useRef(false);
  // The desktop window has no native title bar. macOS keeps its traffic lights
  // and only needs the top bar inset for them; other platforms get the buttons
  // from <WindowControls />, which renders nothing in a browser build.
  const desktopChrome = useDesktopChrome();
  // The macOS traffic lights float over the window's top-left corner (Overlay
  // title bar), so whichever 48px row sits there makes room for them. The
  // sidebar header owns that corner while the sidebar is open; the top bar does
  // when it is hidden (or on the drawer layout); a file panel that covers the
  // window (full width, or the mobile layout) covers the top bar too, so its tab
  // strip takes over — and becomes the window's drag handle, since the top bar
  // it hides was the only other one.
  const macLightsOverTopbar = desktopChrome.isMacOS && (!sidebarOpen || isMobile);
  const macLightsOverPanel = desktopChrome.isMacOS && rightPanelOpen && (rightPanelFullWidth || isMobile);
  const windowDrag = useWindowDrag();
  const sidebarWidthRef = useRef(SIDEBAR_DEFAULT_WIDTH);
  const rightPanelWidthRef = useRef(RIGHT_PANEL_FALLBACK_WIDTH);
  const fileTreeWidthRef = useRef(FILE_TREE_DEFAULT_WIDTH);
  const getResponsiveRightPanelWidth = useCallback(
    () => typeof window === "undefined"
      ? RIGHT_PANEL_FALLBACK_WIDTH
      : getDefaultRightPanelWidth(window.innerWidth),
    [],
  );
  const getResponsiveSidebarMaxWidth = useCallback(
    () => typeof window === "undefined"
      ? SIDEBAR_MAX_WIDTH
      : getSidebarMaxWidth({
        viewportWidth: window.innerWidth,
        rightPanelOpen,
        rightPanelWidth: rightPanelWidthRef.current,
      }),
    [rightPanelOpen],
  );
  const getResponsiveRightPanelMaxWidth = useCallback(
    () => typeof window === "undefined"
      ? RIGHT_PANEL_MAX_WIDTH
      : getRightPanelMaxWidth({
        viewportWidth: window.innerWidth,
        sidebarOpen,
        sidebarWidth: sidebarWidthRef.current,
      }),
    [sidebarOpen],
  );
  const sidebarResizer = useResizablePanel({
    ariaLabel: translate("layout.resizeSidebar"),
    cssVariable: "--sidebar-width",
    defaultWidth: SIDEBAR_DEFAULT_WIDTH,
    getMaxWidth: getResponsiveSidebarMaxWidth,
    growthDirection: "right",
    maxWidth: SIDEBAR_MAX_WIDTH,
    minWidth: SIDEBAR_MIN_WIDTH,
    storageKey: "pi-sidebar-width",
    widthRef: sidebarWidthRef,
  });
  const rightPanelResizer = useResizablePanel({
    ariaLabel: translate("layout.resizeFilePanel"),
    cssVariable: "--right-panel-width",
    defaultWidth: RIGHT_PANEL_FALLBACK_WIDTH,
    getDefaultWidth: getResponsiveRightPanelWidth,
    getMaxWidth: getResponsiveRightPanelMaxWidth,
    growthDirection: "left",
    maxWidth: RIGHT_PANEL_MAX_WIDTH,
    minWidth: RIGHT_PANEL_MIN_WIDTH,
    storageKey: "pi-right-panel-width",
    widthRef: rightPanelWidthRef,
  });
  const getFileTreeMaxWidth = useCallback(
    () => {
      const availablePanelWidth = typeof window === "undefined"
        ? rightPanelWidthRef.current
        : window.innerWidth < MOBILE_MAX_WIDTH
          ? window.innerWidth
          : window.innerWidth < SPLIT_PANEL_MIN_WIDTH
            ? Math.min(560, window.innerWidth - 48)
            : rightPanelWidthRef.current;
      return Math.max(
        FILE_TREE_MIN_WIDTH,
        Math.min(
          FILE_TREE_MAX_WIDTH,
          availablePanelWidth - FILE_TREE_PREVIEW_MIN_WIDTH,
        ),
      );
    },
    [],
  );
  const fileTreeResizer = useResizablePanel({
    ariaLabel: translate("layout.resizeFileTree"),
    cssVariable: "--file-tree-width",
    defaultWidth: FILE_TREE_DEFAULT_WIDTH,
    getMaxWidth: getFileTreeMaxWidth,
    // The tree sits at the panel's left edge (CSS order), so it grows rightward.
    growthDirection: "right",
    maxWidth: FILE_TREE_MAX_WIDTH,
    minWidth: FILE_TREE_MIN_WIDTH,
    storageKey: "pi-file-tree-width",
    widthRef: fileTreeWidthRef,
  });
  const reclampSidebarWidth = sidebarResizer.reclampWidth;
  const reclampRightPanelWidth = rightPanelResizer.reclampWidth;
  const reclampFileTreeWidth = fileTreeResizer.reclampWidth;
  const rightPanelWidth = rightPanelResizer.width;
  // On mobile the sidebar is an overlay drawer; hide it by default so the chat
  // is visible on load. Runs once the breakpoint resolves after hydration.
  useEffect(() => {
    setSidebarOpen(isMobile ? false : desktopSidebarOpenRef.current);
  }, [isMobile]);
  // Close an already-open panel when the viewport becomes too narrow for the
  // split layout. The initial check only records the starting layout: compact
  // reloads restore terminal state but intentionally start with the overlay
  // hidden, while later crossings close it rather than trapping the chat.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const compactQuery = window.matchMedia(`(max-width: ${SPLIT_PANEL_MIN_WIDTH - 1}px)`);
    const desktopQuery = window.matchMedia(`(min-width: ${SPLIT_PANEL_MIN_WIDTH}px)`);
    const checkWidth = () => {
      // A load starts with the panel closed. On desktop, this marks the
      // compact listeners initialized and leaves later resize events active.
      if (compactQuery.matches && viewportCompactInitializedRef.current) setRightPanelOpen(false);
      viewportCompactInitializedRef.current = compactQuery.matches;
    };
    checkWidth();
    compactQuery.addEventListener("change", checkWidth);
    desktopQuery.addEventListener("change", checkWidth);
    return () => {
      compactQuery.removeEventListener("change", checkWidth);
      desktopQuery.removeEventListener("change", checkWidth);
    };
  }, []);
  useEffect(() => {
    setMobileSidebarReady(true);
  }, []);
  useEffect(() => {
    if (!rightPanelOpen) return;
    reclampSidebarWidth();
    reclampRightPanelWidth();
    reclampFileTreeWidth();
  }, [reclampFileTreeWidth, reclampRightPanelWidth, reclampSidebarWidth, rightPanelOpen, rightPanelWidth]);
  const chatInputRef = useRef<ChatInputHandle | null>(null);
  const [pendingQuotePrompt, setPendingQuotePrompt] = useState<{ sessionId: string; text: string } | null>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  // Branch navigator state — populated by ChatWindow via onBranchDataChange
  const [branchTree, setBranchTree] = useState<SessionTreeNode[]>([]);
  const [branchActiveLeafId, setBranchActiveLeafId] = useState<string | null>(null);
  const [branchSwitchLocked, setBranchSwitchLocked] = useState(false);
  const branchLeafChangeFnRef = useRef<((leafId: string | null, options?: LeafChangeOptions) => void) | null>(null);
  const sessionHasBranches = hasSessionBranches(branchTree);

  const handleBranchDataChange = useCallback((tree: SessionTreeNode[], activeLeafId: string | null, onLeafChange: (leafId: string | null, options?: LeafChangeOptions) => void, locked: boolean) => {
    setBranchTree(tree);
    setBranchActiveLeafId(activeLeafId);
    setBranchSwitchLocked(locked);
    branchLeafChangeFnRef.current = onLeafChange;
  }, []);

  const handleBranchLeafChange = useCallback((leafId: string | null, options?: LeafChangeOptions) => {
    branchLeafChangeFnRef.current?.(leafId, options);
  }, []);

  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [systemTools, setSystemTools] = useState<ToolEntry[] | null>(null);
  const [systemInfoLoading, setSystemInfoLoading] = useState(false);
  const systemInfoLoaderRef = useRef<((kind: "system" | "tools") => Promise<void>) | null>(null);
  const systemInfoLoadIdRef = useRef(0);

  const handleSystemPromptChange = useCallback((prompt: string | null) => {
    setSystemPrompt(prompt);
    setSystemInfoLoading(false);
  }, []);

  const handleSystemToolsChange = useCallback((tools: ToolEntry[] | null) => {
    setSystemTools(tools);
  }, []);

  const handleSystemInfoLoaderChange = useCallback((
    loader: ((kind: "system" | "tools") => Promise<void>) | null,
  ) => {
    systemInfoLoadIdRef.current += 1;
    systemInfoLoaderRef.current = loader;
    setSystemInfoLoading(false);
  }, []);

  // Session stats (tokens + cost) — populated by ChatWindow, used by the stats panel and ring hover summary
  const [sessionStats, setSessionStats] = useState<SessionStatsInfo | null>(null);
  const [autoNameStatus, setAutoNameStatus] = useState<AutoNameStatus>({ kind: "idle" });
  const autoNameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSessionIdRef = useRef<string | null>(selectedSession?.id ?? null);
  activeSessionIdRef.current = selectedSession?.id ?? null;
  const handleSessionStatsChange = useCallback((stats: SessionStatsInfo | null) => {
    setSessionStats(stats);
  }, []);

  useEffect(() => {
    if (desktopMode && !conversationWindow) {
      void setCloseQuitsNative(getPrefBool(APP_PREF_KEYS.closeQuits, false));
    }
  }, [desktopMode, conversationWindow]);

  // Context usage — populated by ChatWindow, used by the stats panel and ring
  const [contextUsage, setContextUsage] = useState<{ percent: number | null; contextWindow: number; tokens: number | null } | null>(null);
  const handleContextUsageChange = useCallback((usage: { percent: number | null; contextWindow: number; tokens: number | null } | null) => {
    setContextUsage(usage);
  }, []);

  // Single active panel — only one dropdown open at a time
  const [activeTopPanel, setActiveTopPanel] = useState<"agents" | "branches" | "system" | "tools" | "session" | null>(null);
  const [topPanelPos, setTopPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!sessionHasBranches) {
      setActiveTopPanel((panel) => panel === "branches" ? null : panel);
    }
  }, [sessionHasBranches]);

  useEffect(() => {
    if (!hasSubagentSessions) {
      setActiveTopPanel((panel) => panel === "agents" ? null : panel);
    }
  }, [hasSubagentSessions]);

  useEffect(() => {
    if (rightPanelFullWidth) setActiveTopPanel(null);
  }, [rightPanelFullWidth]);

  const toggleTopPanel = useCallback((
    panel: "agents" | "branches" | "system" | "tools" | "session",
  ) => {
    if (isMobile) setSidebarOpen(false);
    setTopMoreOpen(false);
    setActiveTopPanel((cur) => cur === panel ? null : panel);
  }, [isMobile]);

  const handleSystemInfoToggle = useCallback((
    panel: "system" | "tools",
  ) => {
    const opening = activeTopPanel !== panel;
    toggleTopPanel(panel);
    if (!opening || systemInfoLoading) return;

    const load = systemInfoLoaderRef.current;
    if (!load) return;
    const loadId = ++systemInfoLoadIdRef.current;
    setSystemInfoLoading(true);
    void load(panel).catch((error) => {
      console.error("Failed to load system information:", error);
    }).finally(() => {
      if (systemInfoLoadIdRef.current === loadId) {
        setSystemInfoLoading(false);
      }
    });
  }, [activeTopPanel, systemInfoLoading, toggleTopPanel]);

  // Cache warming moves on its own between runs (scheduled → refreshing → stopped), so the
  // panel asks the live wrapper again each time it opens. GET never starts a dormant session.
  const [panelCacheWarming, setPanelCacheWarming] = useState<CacheWarmingInfo | null>(null);
  const sessionPanelSessionId = activeTopPanel === "session" ? selectedSession?.id ?? null : null;
  useEffect(() => {
    setPanelCacheWarming(null);
    if (!sessionPanelSessionId) return;
    let cancelled = false;
    fetch(`/api/agent/${encodeURIComponent(sessionPanelSessionId)}`)
      .then((res) => res.json() as Promise<{ running?: boolean; state?: { cacheWarming?: CacheWarmingInfo } }>)
      .then((data) => {
        if (!cancelled && data.state?.cacheWarming) setPanelCacheWarming(data.state.cacheWarming);
      })
      .catch(() => { /* the snapshot from the last state sync stays */ });
    return () => { cancelled = true; };
  }, [sessionPanelSessionId]);

  const openSessionStatsPanel = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
    setActiveTopPanel("session");
  }, [isMobile]);

  // The composer opens Settings too: a bare /mcp opens Settings › MCP (useAgentSession).
  const openSettingsSection = useCallback((section: SettingsSection) => {
    setSettingsSection(section);
  }, []);

  const handleSidebarToggle = useCallback(() => {
    if (isMobile) setActiveTopPanel(null);
    setSidebarOpen((open) => {
      const next = !open;
      if (!isMobile) desktopSidebarOpenRef.current = next;
      return next;
    });
  }, [isMobile]);

  // The panel is a preview layer; the composer remains the home base. The
  // overlay and backslash shortcut both use this same exit.
  // Also leaves full width, like the toggle: reopening into full width would
  // cover the topbar toggle again. Mobile skips the focus so closing the
  // panel does not pop the software keyboard.
  const handleRightPanelClose = useCallback(() => {
    if (isMobile) setActiveTopPanel(null);
    setTopMoreOpen(false);
    setRightPanelOpen(false);
    setRightPanelExpanded(false);
    if (!isMobile) chatInputRef.current?.focus();
  }, [isMobile]);

  const handleRightPanelExpandToggle = useCallback(() => {
    setActiveTopPanel(null);
    setRightPanelExpanded((expanded) => !expanded);
  }, []);

  // Position the portaled More menu under its trigger and follow window resizes.
  useEffect(() => {
    if (!topMoreOpen) return;
    const update = () => {
      const rect = topMoreRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTopMorePos({ top: rect.bottom + 7, right: window.innerWidth - rect.right - 2 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [topMoreOpen]);

  useEffect(() => {
    if (!topMoreOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      // The menu is portaled to <body> (the open file panel's z-index 100 sits
      // above the topbar's z-index 90 stacking context and used to cover the
      // menu), so clicks inside it need this second containment check.
      const inside = topMoreRef.current?.contains(event.target as Node)
        || topMoreMenuRef.current?.contains(event.target as Node);
      if (!inside) setTopMoreOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isImeComposing(event)) setTopMoreOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [topMoreOpen]);

  useEffect(() => {
    setTopMoreOpen(false);
  }, [selectedSession?.id]);

  useEffect(() => {
    if (!activeTopPanel) return;

    const handlePointerDown = (event: MouseEvent) => {
      // Panel DOM lives under topBarRef (fixed-position child); treat the whole
      // top bar — including toggle buttons — as inside so toggles stay reliable.
      if (!topBarRef.current?.contains(event.target as Node)) setActiveTopPanel(null);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isImeComposing(event)) setActiveTopPanel(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activeTopPanel]);

  useEffect(() => {
    if (!activeTopPanel || !topBarRef.current) return;
    const update = () => {
      const topBarRect = topBarRef.current!.getBoundingClientRect();
      // The top bar spans exactly the center column: the sidebar and the
      // file panel are full-height siblings of the main column, so its rect is
      // already clear of both and the dropdowns can use it as-is.
      const left = topBarRect.left;
      const available = topBarRect.width;
      if (activeTopPanel === "agents") {
        setTopPanelPos({
          top: topBarRect.bottom,
          left,
          width: Math.min(AGENT_PANEL_WIDTH, available),
        });
        return;
      }
      setTopPanelPos({ top: topBarRect.bottom, left, width: available });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(topBarRef.current);
    return () => ro.disconnect();
  }, [activeTopPanel]);

  // Files mount only their active viewer; every terminal keeps its own stable host.
  const [fileTabs, setFileTabs] = useState<Tab[]>([]);
  const [activeFileTabId, setActiveFileTabId] = useState<string | null>(null);
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [requestedActiveTerminalTabId, setActiveTerminalTabId] = useState<string | null>(null);
  const activeTerminalTabId = resolveActiveTerminalTabId(terminalTabs, requestedActiveTerminalTabId);
  const [terminalsRestored, setTerminalsRestored] = useState(false);
  const [openPanes, setOpenPanes] = useState<Record<WorkspacePaneId, boolean>>({ files: true, terminal: false, changes: false, tasks: false });
  const changesFeedbackTargetRef = useRef<string | null>(null);
  const [changesWindowError, setChangesWindowError] = useState<string | null>(null);
  const [paneRevealRequest, setPaneRevealRequest] = useState<{ id: WorkspacePaneId } | null>(null);
  const [workspacePanesRestored, setWorkspacePanesRestored] = useState(false);
  useEffect(() => {
    const layout = normalizeWorkspacePaneLayout(getPrefJson(APP_PREF_KEYS.workspacePaneLayout));
    const ids = layout.columns.flatMap((column) => column.paneIds);
    if (ids.length) setOpenPanes({ files: ids.includes("files"), terminal: ids.includes("terminal"), changes: ids.includes("changes"), tasks: ids.includes("tasks") });
    const visibility = getPrefJson(APP_PREF_KEYS.workspacePaneVisibility);
    if (visibility === true && ids.length) setRightPanelOpen(true);
    setWorkspacePanesRestored(true);
  }, []);
  useEffect(() => {
    if (workspacePanesRestored && !conversationWindow) setPrefJson(APP_PREF_KEYS.workspacePaneVisibility, rightPanelOpen);
  }, [rightPanelOpen, workspacePanesRestored, conversationWindow]);
  const [artifactTabs, setArtifactTabs] = useState<ArtifactTab[]>([]);
  // Artifacts continue to share the Files workbench; they are not a fourth pane.
  useArtifactTitles(artifactTabs);
  const filesPaneTabs: Tab[] = [...fileTabs, ...artifactTabs.map(artifactPanelTab)];
  const terminalPaneTabs: Tab[] = terminalTabs.map((tab) => ({
    id: tab.id,
    label: translate("terminal.title"),
    filePath: tab.cwd,
    kind: "terminal" as const,
    closing: Boolean(tab.closing),
  }));
  const activeTerminalTab = terminalTabs.find((tab) => tab.id === activeTerminalTabId) ?? null;
  const panelTabCount = filesPaneTabs.length + terminalPaneTabs.length;
  const activeArtifactTab = artifactTabs.find((tab) => tab.id === activeFileTabId) ?? null;
  const revealWorkspacePane = useCallback((id: WorkspacePaneId) => {
    setPaneRevealRequest({ id });
    setOpenPanes((panes) => ({ ...panes, [id]: true }));
    setRightPanelOpen(true);
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);
  const hideWorkspacePane = useCallback((id: WorkspacePaneId) => {
    if (!Object.entries(openPanes).some(([paneId, open]) => paneId !== id && open)) handleRightPanelClose();
    setOpenPanes((panes) => ({ ...panes, [id]: false }));
  }, [handleRightPanelClose, openPanes]);
  const toggleWorkspacePane = (id: WorkspacePaneId) => {
    if (rightPanelOpen && openPanes[id]) hideWorkspacePane(id);
    else {
      if (id === "files" && !filesPaneTabs.length) setFileTreeOpen(true);
      revealWorkspacePane(id);
    }
  };
  const handleRightPanelToggle = useCallback(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setActiveTopPanel(null);
    }
    setTopMoreOpen(false);
    setRightPanelOpen((open) => {
      // A manual open with no tab lands on the project file tree, not a mostly
      // empty "No file open" state.
      if (!open && !Object.values(openPanes).some(Boolean)) setOpenPanes((panes) => ({ ...panes, files: true }));
      if (!open && panelTabCount === 0) setFileTreeOpen(true);
      if (open) setRightPanelExpanded(false);
      return !open;
    });
  }, [isMobile, openPanes, panelTabCount]);

  useEffect(() => {
    try {
      const saved = restoreTerminalTabs(window.sessionStorage.getItem(TERMINAL_TABS_KEY));
      setTerminalTabs(saved.tabs);
      setActiveTerminalTabId(saved.activeId ?? saved.tabs[0]?.id ?? null);
      if (saved.open && saved.tabs.length) {
        setOpenPanes((panes) => ({ ...panes, terminal: true }));
        setRightPanelOpen(true);
      }
    } catch { /* storage is optional */ }
    setTerminalsRestored(true);
  }, []);

  useEffect(() => {
    if (!terminalsRestored) return;
    try {
      window.sessionStorage.setItem(TERMINAL_TABS_KEY, JSON.stringify({
        tabs: terminalTabs.map(({ id, cwd }) => ({ id, cwd })),
        activeId: activeTerminalTabId,
        open: rightPanelOpen && openPanes.terminal,
      }));
    } catch { /* storage is optional */ }
  }, [terminalTabs, activeTerminalTabId, openPanes.terminal, rightPanelOpen, terminalsRestored]);

  const handleFileViewerStateChange = useCallback((
    tabId: string,
    viewerRevision: number,
    viewerState: FileViewerState,
  ) => {
    setFileTabs((prev) => saveFileViewerState(prev, tabId, viewerRevision, viewerState));
  }, []);

  // Same @mention format as the chat input's @ autocomplete, so the agent's
  // read tool resolves it the same way (it strips the @ prefix).
  const handleAtMention = useCallback((relativePath: string, isDir: boolean) => {
    chatInputRef.current?.insertText(buildAtMentionText(relativePath, isDir));
    if (isMobile) { setRightPanelOpen(false); setSidebarOpen(false); }
  }, [isMobile]);

  const handleAtMentions = useCallback((relativePaths: string[]) => {
    const mentions = buildFileAtMentionsText(relativePaths);
    if (mentions) chatInputRef.current?.insertText(mentions);
    if (isMobile) { setRightPanelOpen(false); setSidebarOpen(false); }
  }, [isMobile]);

  useEffect(() => {
    if (desktopMode && !conversationWindow) {
      void setCloseQuitsNative(getPrefBool(APP_PREF_KEYS.closeQuits, false));
    }
  }, [desktopMode, conversationWindow]);

  const { state: connectionState, retry: retryConnection } = useDesktopConnection(desktopMode);

  const handleFileLineMention = useCallback((relativePath: string, startLine: number, endLine: number) => {
    chatInputRef.current?.insertText(buildFileLineMentionText(relativePath, startLine, endLine));
    if (isMobile) { setRightPanelOpen(false); setSidebarOpen(false); }
  }, [isMobile]);

  const initialSessionId = initialNavigation.sessionId;
  const [activeCwd, setActiveCwd] = useState<string | null>(null);
  const activeProjectKeyRef = useRef<string | null>(null);
  const activeWorkspaceKind: SessionWorkspaceKind = (() => {
    if (selectedSession) {
      return selectedSession.workspaceKind
        ?? (chatWorkspaceCwd && selectedSession.cwd === chatWorkspaceCwd ? "chat" : "project");
    }
    const cwd = newSessionCwd ?? activeCwd;
    if (cwd && chatWorkspaceCwd && cwd === chatWorkspaceCwd) return "chat";
    return newSessionWorkspaceKind;
  })();
  const isChatWorkspaceActive = activeWorkspaceKind === "chat";
  // Project-scoped chrome (trust, pickers, file tree, window title) must never
  // receive the hidden chat workspace path.
  const visibleProjectCwd = isChatWorkspaceActive ? null : activeCwd;
  const terminalCwd = isChatWorkspaceActive ? null : activeTerminalTab?.cwd ?? activeCwd;
  const projectPickerStartCwd = isChatWorkspaceActive
    ? null
    : selectedSession?.cwd ?? newSessionCwd ?? activeCwd;
  // Until the server tells us the hidden chat cwd, an invalid URL cwd cannot
  // be classified. Keep it out of the error card rather than risk showing the
  // internal Chat workspace path during the first paint.
  const showInitialRequestedCwd = Boolean(
    chatWorkspaceCwd
      && initialNavigation.requestedCwd
      && initialNavigation.requestedCwd !== chatWorkspaceCwd,
  );
  useEffect(() => {
    if (!isChatWorkspaceActive) return;
    setRightPanelOpen(false);
    setRightPanelExpanded(false);
    setFileTreeOpen(false);
    setFileTabs([]);
    setActiveFileTabId(null);
  }, [isChatWorkspaceActive]);
  // True once the initial ?session= URL param has been resolved (or confirmed absent)
  const [initialSessionRestored, setInitialSessionRestored] = useState<boolean>(() => !initialSessionId);
  // sessionStorage is empty during SSR. Applying the tab's remembered session
  // in the useState initializer made the first client tree differ from the
  // server HTML (sidebar "select project" vs ""). Restore after mount instead.
  useLayoutEffect(() => {
    const next = withTabOpen(initialNavigation, getTabOpen());
    if (next === initialNavigation) return;
    setInitialNavigation(next);
    if (next.sessionId) setInitialSessionRestored(false);
  }, [initialNavigation]);
  // Suppresses sessionKey bump in handleCwdChange during the initial URL restore
  const suppressCwdBumpRef = useRef(false);
  // Guards the async workspace restore so a slow response from an earlier
  // switch cannot resurrect a session into a project the user already left.
  const workspaceRestoreTokenRef = useRef(0);

  const invalidateWorkspaceRestore = useCallback(() => {
    workspaceRestoreTokenRef.current += 1;
  }, []);

  // Persist every active-session transition, including new and forked sessions
  // that bypass the sidebar selection handler. Transient sessions do not yet
  // carry projectKey, so use the active project identity until hydration.
  // The workspace memory is shared by every tab; the tab memory keeps this
  // tab's own session so a reload does not follow another tab's last pick.
  // New session is a selection too: remember the composer cwd so reload stays
  // on that UI instead of resurrecting the previous chat.
  useEffect(() => {
    if (selectedSession) {
      const projectKey = selectedSession.projectKey
        ?? activeProjectKeyRef.current
        ?? workspaceKeyOf(selectedSession);
      if (!conversationWindow) setLastOpenSession(projectKey, selectedSession.id);
      setTabOpenSession(selectedSession.id);
      return;
    }
    if (newSessionCwd) setTabOpenNewSession(newSessionCwd);
  }, [newSessionCwd, selectedSession, conversationWindow]);

  useEffect(() => {
    const requestedCwd = initialNavigation.requestedCwd;
    if (!requestedCwd) return;

    const controller = new AbortController();
    setInitialCwdStatus("validating");
    setInitialCwdError(null);

    void fetch("/api/cwd/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cwd: requestedCwd }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as {
          cwd?: string;
          error?: string;
          workspaceKind?: SessionWorkspaceKind;
        };
        if (!response.ok || !data.cwd) {
          throw new Error(data.error ?? `HTTP ${response.status}`);
        }

        // The sidebar will notify us when it adopts this cwd. Avoid remounting
        // the just-created empty chat during that initial synchronization.
        suppressCwdBumpRef.current = true;
        const draftId = restoredHomeDraftIdRef.current ?? `initial:${requestedCwd}`;
        setNewSessionDraftId(draftId);
        activeNewSessionDraftKeyRef.current = `new:${draftId}:${data.cwd}`;
        setNewSessionCwd(data.cwd);
        if (data.workspaceKind === "chat") {
          setChatWorkspaceCwd(data.cwd);
          setNewSessionWorkspaceKind("chat");
        }
        setInitialCwdStatus("ready");
        if (!new URLSearchParams(window.location.search).get("cwd")) {
          router.replace(`?cwd=${encodeURIComponent(data.cwd)}`, { scroll: false });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setInitialCwdError(error instanceof Error ? error.message : String(error));
        setInitialCwdStatus("error");
      });

    return () => controller.abort();
  }, [initialNavigation, router]);

  // Restore the workspace's last open session after switching to it. Called
  // from handleCwdChange once the outgoing context has been reset. The session
  // is looked up against the live list so a deleted or drifted session falls
  // back to the default welcome page instead of erroring.
  const restoreWorkspaceContext = useCallback((projectKey: string, cwd: string) => {
    const token = ++workspaceRestoreTokenRef.current;
    const lastOpenSessionId = getLastOpenSession(projectKey);
    if (!lastOpenSessionId) return;
    const adopt = (d: { sessions: SessionInfo[] } | null) => {
      if (token !== workspaceRestoreTokenRef.current) return; // stale switch
      const s = d?.sessions.find((x) => x.id === lastOpenSessionId);
      if (!s) {
        // The list loaded but the remembered session is gone — forget it.
        // When the list itself failed (d === null) keep the memory so a
        // later switch retries the restore.
        if (d && !conversationWindow) clearLastOpen(projectKey);
        return;
      }
      if (workspaceKeyOf(s) !== projectKey) {
        // Defensive: the remembered session drifted out of this workspace.
        if (!conversationWindow) clearLastOpen(projectKey);
        return;
      }
      // Keep the temporary composer's draft in its cwd, even when the
      // remembered session belongs to another worktree of this project.
      const activeDraftKey = activeNewSessionDraftKeyRef.current;
      if (activeDraftKey) {
        parkNewSessionDraft(activeDraftKey, cwd);
      }
      activeNewSessionDraftKeyRef.current = null;
      // Selecting the session must remount the chat with the session
      // present: useAgentSession loads content in a mount-only effect, so
      // the null-session welcome mount from the switch would never load
      // the restored session's messages.
      setSelectedSession(s);
      setSessionKey((k) => k + 1);
      // A direct Scheduled URL can restore its hidden workspace while sessions
      // load. That fills the chat but must not switch the visible page.
      if (!scheduledOpenRef.current && !welcomeOpenRef.current) {
        if (new URLSearchParams(window.location.search).get("session") !== s.id) {
          router.replace(`?session=${encodeURIComponent(s.id)}`, { scroll: false });
        }
      }
    };
    // Fast path: the sidebar already delivered the catalogue — restore
    // without waiting on a fresh /api/sessions round trip.
    if (sessionCatalog.length > 0) {
      adopt({ sessions: sessionCatalog });
      return;
    }
    void fetch("/api/sessions")
      .then((r) => (r.ok ? (r.json() as Promise<{ sessions: SessionInfo[] }>) : null))
      .then(adopt)
      .catch(() => {
        // Network hiccup: keep the remembered session for a later retry.
      });
  }, [router, sessionCatalog, conversationWindow]);

  const handleCwdChange = useCallback((
    cwd: string | null,
    projectRoot?: string | null,
    projectKey?: string | null,
    workspaceKind?: SessionWorkspaceKind,
  ) => {
    invalidateWorkspaceRestore();
    const currentFreshCwd = newSessionCwd ?? activeCwd;
    setActiveCwd(cwd);
    if (workspaceKind) setNewSessionWorkspaceKind(workspaceKind);
    // Skip if cwd is null (initial mount).
    if (!cwd) return;
    const newProject = workspaceKind === "chat" ? cwd : projectKey ?? projectRoot ?? cwd;
    const currentProject = activeProjectKeyRef.current
      ?? (selectedSession ? workspaceKeyOf(selectedSession) : null);
    activeProjectKeyRef.current = newProject;
    setSessionNavigation(current => {
      const entry = current.items[current.index];
      if (!entry || entry.session || entry.cwd !== cwd || entry.projectKey === newProject) return current;
      return { ...current, items: current.items.map((item, index) => index === current.index ? { ...item, projectKey: newProject } : item) };
    });

    // Keep the project identity in sync during the initial URL restore without
    // remounting the just-created or restored chat.
    if (suppressCwdBumpRef.current) {
      suppressCwdBumpRef.current = false;
      return;
    }
    // The server may hydrate a normalized key after a custom cwd is already
    // active. Updating identity for the exact same cwd is not a user switch.
    if (currentFreshCwd === cwd && currentProject !== newProject) return;
    // Existing sessions stay open when the worktree selector moves within the
    // same project. A fresh composer must remount when its effective cwd moves,
    // otherwise its already-created runtime would keep sending to the old cwd.
    if (
      currentProject === newProject
      && (selectedSession !== null || currentFreshCwd === cwd)
    ) {
      return;
    }
    // Clicking a session of another project also moves the effective cwd —
    // as a side effect of opening it, not as a project-picker switch. The
    // click has already committed, so `selectedSession` here IS the clicked
    // session: keep it open and only drop file tabs left over from the
    // previous project, instead of blanking the chat into a new session.
    if (selectedSession && (selectedSession.projectRoot ?? selectedSession.cwd) === newProject) {
      setFileTabs([]);
      setActiveFileTabId(null);
      setRightPanelOpen(false);
      return;
    }
    // Close any session that belongs to a different project — it no longer
    // matches the selected project directory.
    const previousDraftKey = activeNewSessionDraftKeyRef.current;
    if (previousDraftKey && currentFreshCwd) {
      parkNewSessionDraft(previousDraftKey, currentFreshCwd);
    }
    const draftId = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const draftKey = `new:${draftId}:${cwd}`;
    rekeyDraft(parkedNewSessionDraftKey(cwd), draftKey);
    setNewSessionDraftId(draftId);
    activeNewSessionDraftKeyRef.current = draftKey;
    setSelectedSession(null);
    setNewSessionCwd((prev) => {
      if (prev && prev !== cwd) return null;
      return prev;
    });
    setBranchTree([]);
    setBranchActiveLeafId(null);
    setBranchSwitchLocked(false);
    setSystemPrompt(null);
    setSystemTools(null);
    setSystemInfoLoading(false);
    setActiveTopPanel(null);
    if (currentProject !== newProject) {
      // File tabs are keyed by absolute path, so tabs opened in the previous
      // project must not linger. Same-project worktree switches keep them.
      setFileTabs([]);
      if (!activeFileTabId || activeFileTabId.startsWith("file:")) {
        setActiveFileTabId(null);
        if (!openPanes.terminal && !openPanes.tasks && !openPanes.changes) setRightPanelOpen(false);
      }
      // Restore the workspace we switched to: its last open session, or keep
      // the default welcome page when none is remembered.
      restoreWorkspaceContext(newProject, cwd);
    }
    // This callback also runs when the sidebar picks its default project on a
    // direct Scheduled URL. There is no explicit navigation away from that
    // page yet, so retain the URL that made it visible.
    if (!scheduledOpenRef.current && !welcomeOpenRef.current) {
      router.replace(typeof window !== "undefined" ? window.location.pathname : "/", { scroll: false });
    }
  }, [activeCwd, activeFileTabId, invalidateWorkspaceRestore, newSessionCwd, openPanes.terminal, openPanes.tasks, openPanes.changes, router, selectedSession, restoreWorkspaceContext]);

  const handleSelectSession = useCallback((session: SessionInfo, isRestore = false, entryId?: string, blockIndex?: number) => {
    // Explicit session navigation leaves home/Scheduled; background restore does not.
    if (!isRestore) { setScheduledOpen(false); setWelcomeOpen(false); }
    setNewSessionWorkspaceKind(
      session.workspaceKind
      ?? (chatWorkspaceCwd && session.cwd === chatWorkspaceCwd ? "chat" : "project"),
    );
    setSearchTarget(entryId ? { sessionId: session.id, entryId, blockIndex } : null);
    invalidateWorkspaceRestore();
    const activeDraftKey = activeNewSessionDraftKeyRef.current;
    const activeDraftCwd = newSessionCwd ?? (selectedSession === null ? activeCwd : null);
    if (activeDraftKey && activeDraftCwd) {
      parkNewSessionDraft(activeDraftKey, activeDraftCwd);
    }
    activeNewSessionDraftKeyRef.current = null;
    // Adopt an explicitly selected session before the sidebar reports its cwd.
    const projectKey = workspaceKeyOf(session);
    if (activeProjectKeyRef.current !== projectKey) {
      setFileTabs([]);
      if (!activeFileTabId || activeFileTabId.startsWith("file:")) {
        setActiveFileTabId(null);
        if (!openPanes.terminal && !openPanes.tasks && !openPanes.changes) setRightPanelOpen(false);
      }
      setActiveTopPanel(null);
    }
    activeProjectKeyRef.current = projectKey;
    // Re-clicking the already-open session must not remount the chat and
    // re-run the full load/positioning cycle. Only skip when the effective
    // cwd context already matches — otherwise a pending cwd move still needs
    // the full re-select flow.
    if (!isRestore && selectedSession) {
      const sameProject =
        workspaceKeyOf(selectedSession) === workspaceKeyOf(session);
      if (selectedSession.id === session.id && sameProject) {
        if (welcomeOpenRef.current) window.history.replaceState(null, "", `?session=${encodeURIComponent(session.id)}`);
        if (isMobile) setSidebarOpen(false);
        return;
      }
    }
    setNewSessionCwd(null);
    setSelectedSession(session);
    // Do not bump sessionKey here — ChatWindow stays mounted and swaps
    // session data in place so the fixed input dock does not flash.
    setBranchTree([]);
    setBranchActiveLeafId(null);
    setBranchSwitchLocked(false);
    branchLeafChangeFnRef.current = null;
    setSystemPrompt(null);
    setSessionStats(null);
    setContextUsage(null);
    setActiveTopPanel(null);
    setTopMoreOpen(false);
    setSystemTools(null);
    setSystemInfoLoading(false);
    setInitialSessionRestored(true);
    // On mobile, collapse the overlay drawer so the chat is revealed after pick.
    if (isMobile && !isRestore) setSidebarOpen(false);
    if (isRestore) {
      // Suppress the redundant sessionKey bump that would come from the
      // onCwdChange effect firing after setSelectedCwd in the sidebar
      suppressCwdBumpRef.current = true;
    }
    // Skip router.replace when the URL already has this session — calling
    // replace in production Next.js triggers a Suspense remount loop.
    // Tab-memory restore lands on `/` and must write `?session=` so reload
    // and copy-link keep this session.
    if (isRestore && (scheduledOpenRef.current || welcomeOpenRef.current)) {
      // A cold-start restore behind home/Scheduled leaves its page URL alone.
    } else if (!isRestore || new URLSearchParams(window.location.search).get("session") !== session.id) {
      router.replace(`?session=${encodeURIComponent(session.id)}`, { scroll: false });
    }
  }, [activeCwd, activeFileTabId, chatWorkspaceCwd, invalidateWorkspaceRestore, router, isMobile, newSessionCwd, openPanes.terminal, openPanes.tasks, openPanes.changes, selectedSession]);

  const handleNewSession = useCallback((
    sessionId: string,
    cwd: string,
    workspaceKind?: SessionWorkspaceKind,
    restoreHistory = false,
  ) => {
    setWelcomeOpen(false);
    const resolvedWorkspaceKind = workspaceKind
      ?? (chatWorkspaceCwd && cwd === chatWorkspaceCwd ? "chat" : newSessionWorkspaceKind);
    setScheduledOpen(false);
    invalidateWorkspaceRestore();
    setNewSessionWorkspaceKind(resolvedWorkspaceKind);
    // "New task" is an explicit reset. A cwd-based blank-task draft would
    // otherwise be reloaded immediately when the composer remounts (legacy
    // key scheme kept for drafts written by older builds).
    clearDraft(`new:${cwd}`);
    const draftKey = `new:${sessionId}:${cwd}`;
    if (!restoreHistory) rekeyDraft(parkedNewSessionDraftKey(cwd), draftKey);
    activeNewSessionDraftKeyRef.current = draftKey;
    setNewSessionDraftId(sessionId);
    setSelectedSession(null);
    setNewSessionCwd(cwd);
    // A second click in the same cwd must still create a clean composer. The
    // cwd-derived session identity alone cannot distinguish those blank tasks.
    setSessionKey((key) => key + 1);
    setBranchTree([]);
    setBranchActiveLeafId(null);
    branchLeafChangeFnRef.current = null;

    setBranchSwitchLocked(false);
    setSystemPrompt(null);
    setSessionStats(null);
    setContextUsage(null);
    setSystemTools(null);
    setSystemInfoLoading(false);
    setActiveTopPanel(null);
    if (resolvedWorkspaceKind === "chat") {
      setFileTabs([]);
      setActiveFileTabId(null);
      setFileTreeOpen(false);
      setRightPanelOpen(false);
      setRightPanelExpanded(false);
    }
    if (isMobile) setSidebarOpen(false);
    router.replace(`?cwd=${encodeURIComponent(cwd)}`, { scroll: false });
  }, [chatWorkspaceCwd, invalidateWorkspaceRestore, router, isMobile, newSessionWorkspaceKind]);

  const handleProjectsChange = useCallback((projectRoots: string[]) => {
    setAvailableProjectRoots((previous) => (
      previous.length === projectRoots.length && previous.every((root, index) => root === projectRoots[index])
        ? previous
        : projectRoots
    ));
  }, []);

  const handleProjectChangeFromComposer = useCallback((projectRoot: string) => {
    if (selectedSession || isChatWorkspaceActive) return;
    handleNewSession(`project-${Date.now()}`, projectRoot, "project");
  }, [handleNewSession, isChatWorkspaceActive, selectedSession]);

  const handleSelectProjectFromComposer = useCallback(async () => {
    if (!desktopMode || isChatWorkspaceActive) return;
    try {
      const cwd = await selectProjectDirectoryNative(projectPickerStartCwd, "");
      if (cwd) handleNewSession(`project-${Date.now()}`, cwd, "project");
    } catch (error) {
      console.error("Failed to switch project:", error);
    }
  }, [desktopMode, handleNewSession, isChatWorkspaceActive, projectPickerStartCwd]);

  const handleNativeMenuAction = useCallback((payload: string) => {
    if (payload === "new-session") {
      const cwd = isChatWorkspaceActive ? chatWorkspaceCwd : activeCwd;
      if (cwd) {
        handleNewSession(
          `native-menu-${Date.now()}`,
          cwd,
          isChatWorkspaceActive ? "chat" : "project",
        );
      }
      return;
    }
    if (payload === "settings-general" || payload === "settings-models") {
      setActiveTopPanel(null);
      setTopMoreOpen(false);
      setSettingsSection(payload === "settings-general" ? "general" : "models");
    }
  }, [activeCwd, chatWorkspaceCwd, handleNewSession, isChatWorkspaceActive]);

  const openSettingsAtLastSection = useCallback(() => {
    setActiveTopPanel(null);
    setTopMoreOpen(false);
    // A project-only section without a project falls back to General (SettingsPanel re-checks).
    setSettingsSection(getLastSettingsSection(
      isChatWorkspaceActive ? null : selectedSession?.cwd ?? newSessionCwd ?? activeCwd,
    ));
  }, [activeCwd, isChatWorkspaceActive, newSessionCwd, selectedSession]);

  const toggleShortcutHelp = useCallback(() => {
    setShortcutHelpOpen((open) => {
      if (!open) {
        setActiveTopPanel(null);
        setTopMoreOpen(false);
      }
      return !open;
    });
  }, []);

  // The native macOS menu is the only reliable route when the webview has no
  // focused element. Route its custom items back through the same app state.
  useNativeAppMenu(handleNativeMenuAction);

  // Global keyboard shortcuts (handles Esc, Ctrl+Alt+N etc.)
  useGlobalKeyboardShortcuts({
    onNewSession: settingsSection || shortcutHelpOpen
      ? undefined
      : (cwd: string) => handleNewSession(
        `kb-${Date.now()}`,
        cwd,
        isChatWorkspaceActive ? "chat" : "project",
      ),
    activeCwd: isChatWorkspaceActive ? chatWorkspaceCwd : activeCwd,
    // Only while open: a closed panel must leave \ and focus alone.
    onCloseRightPanel: rightPanelOpen && !shortcutHelpOpen ? handleRightPanelClose : undefined,
    onExpandRightPanel: rightPanelOpen && !shortcutHelpOpen ? handleRightPanelExpandToggle : undefined,
    // Already open: leave it where it is.
    onOpenSettings: settingsSection ? undefined : openSettingsAtLastSection,
    onShortcutHelp: settingsSection ? undefined : toggleShortcutHelp,
    onToggleSidebar: settingsSection || shortcutHelpOpen ? undefined : handleSidebarToggle,
    onFocusComposer: settingsSection || shortcutHelpOpen ? undefined : () => chatInputRef.current?.focus(),
  });

  useEffect(() => {
    if (!shortcutHelpOpen) return;
    const dialog = shortcutHelpDialogRef.current;
    const opener = document.activeElement;
    dialog?.focus({ preventScroll: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        setShortcutHelpOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialog?.querySelectorAll<HTMLElement>(`
        button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])
      `);
      if (!focusable?.length) return;
      event.preventDefault();
      const next = event.shiftKey ? focusable[focusable.length - 1] : focusable[0];
      next.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      const focusable = opener as (Element & Partial<HTMLElement>) | null;
      if (focusable?.isConnected && typeof focusable.focus === "function") {
        focusable.focus({ preventScroll: true });
      }
    };
  }, [shortcutHelpOpen]);

  // Client-built transient SessionInfo (new session / fork) lacks the
  // server-computed projectKey, which the same-project check in
  // handleCwdChange relies on. Hydrate it from the session list so switching
  // worktrees right after creating a session doesn't close the chat.
  const hydrateSelectedSession = useCallback((sessionId: string) => {
    void fetch("/api/sessions", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ sessions: SessionInfo[] }>) : null))
      .then((d) => {
        const full = d?.sessions.find((s) => s.id === sessionId);
        if (!full) return;
        setSelectedSession((prev) => (
          prev?.id === sessionId
            ? { ...prev, ...full, transient: full.transient ?? false }
            : prev
        ));
      })
      .catch(() => {});
  }, []);

  const handleOpenSession = useCallback(async (sessionId: string) => {
    // Prefer the catalogue the sidebar already delivered: selecting from it
    // avoids a full detail round trip just to obtain the SessionInfo.
    const catalogued = sessionCatalog.find((s) => s.id === sessionId);
    if (catalogued && !catalogued.transient) {
      handleSelectSession(catalogued);
      return;
    }
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      const data = await response.json() as { info?: SessionInfo; error?: string };
      if (!response.ok || !data.info) throw new Error(data.error ?? `HTTP ${response.status}`);
      handleSelectSession(data.info);
    } catch (error) {
      console.error("[pi-web] failed to open session:", error instanceof Error ? error.message : error);
    }
  }, [handleSelectSession, sessionCatalog]);

  const handleOpenWelcome = useCallback(() => {
    invalidateWorkspaceRestore();
    setScheduledOpen(false);
    setWelcomeOpen(true);
    setActiveTopPanel(null);
    setTopMoreOpen(false);
    if (isMobile) setSidebarOpen(false);
    const params = new URLSearchParams({ view: "new" });
    if (selectedSession) params.set("session", selectedSession.id);
    else {
      const cwd = newSessionCwd ?? activeCwd;
      if (cwd) { params.set("cwd", cwd); params.set("draft", newSessionDraftId); }
    }
    // This is local view state: Next's native-history integration preserves
    // its router tree without waiting for a new server-component navigation.
    window.history.replaceState(null, "", `?${params}`);
  }, [activeCwd, invalidateWorkspaceRestore, isMobile, newSessionCwd, newSessionDraftId, selectedSession]);

  const handleOpenScheduled = useCallback(() => {
    setWelcomeOpen(false);
    setScheduledOpen(true);
    if (isMobile) setSidebarOpen(false);
    // Skip the replace when the URL already says so (see handleSelectSession).
    if (new URLSearchParams(window.location.search).get("view") !== "scheduled") {
      router.replace("?view=scheduled", { scroll: false });
    }
  }, [isMobile, router]);

  // Validated and allow-listed like any project pick, which /api/models needs for the new folder.
  const handleBrowseScheduledFolder = useCallback(
    () => selectProjectDirectoryNative(projectPickerStartCwd, ""),
    [projectPickerStartCwd],
  );

  // Called by ChatWindow when a new session gets its real id from pi
  const handleSessionCreated = useCallback((session: SessionInfo, sourceDraftKey: string) => {
    setRefreshKey((k) => k + 1);
    if (activeNewSessionDraftKeyRef.current !== sourceDraftKey) return;
    invalidateWorkspaceRestore();
    activeNewSessionDraftKeyRef.current = null;
    setNewSessionCwd(null);
    setSelectedSession(session);
    hydrateSelectedSession(session.id);
    router.replace(`?session=${encodeURIComponent(session.id)}`, { scroll: false });
  }, [invalidateWorkspaceRestore, router, hydrateSelectedSession]);

  const deliverSessionNotification = useCallback(({
    targetSession,
    title,
    body,
    tag,
  }: {
    targetSession: SessionInfo | null;
    title: string;
    body: string;
    tag?: string;
  }) => {
    if (conversationWindow || !("Notification" in window)) return;

    const fire = () => {
      const sessionUrl = targetSession ? `/?session=${encodeURIComponent(targetSession.id)}` : "/";
      void showBrowserNotification({
        title,
        body,
        sessionUrl,
        tag,
        onClick: () => {
          window.focus();
          if (targetSession) handleSelectSession(targetSession);
        },
      });
    };

    if (Notification.permission === "granted") {
      fire();
      void setupPushSubscription(locale);
    } else if (Notification.permission === "default") {
      void Notification.requestPermission().then((p) => {
        if (p === "granted") {
          fire();
          void setupPushSubscription(locale);
        }
      });
    }
  }, [handleSelectSession, locale, conversationWindow]);

  const handleAgentEnd = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setExplorerRefreshKey((k) => k + 1);
    if (selectedSession) hydrateSelectedSession(selectedSession.id);

    if (selectedSession?.relation?.kind === "subagent") return;
    if (!shouldShowBrowserNotification()) return;
    const targetSession = selectedSession;
    deliverSessionNotification({
      targetSession,
      title: targetSession?.name ?? translate("i18n.sessionComplete"),
      body: translate("i18n.taskFinished"),
      tag: targetSession ? `pi-session-complete:${targetSession.id}` : "pi-session-complete",
    });
  }, [deliverSessionNotification, hydrateSelectedSession, selectedSession, translate]);

  // Scheduled runs have their own notification (success or failure, which task, why).
  // The desktop app shows it natively; a browser tab uses the same path as session completion.
  useScheduledRunNotifications({
    enabled: !conversationWindow,
    onSound: handleBackgroundTaskDone,
    deliverInBrowser: (notification) => {
      if (!shouldShowBrowserNotification()) return;
      void (async () => {
        const { sessionId } = notification;
        let targetSession: SessionInfo | null = sessionId ? sessionCatalog.find((s) => s.id === sessionId) ?? null : null;
        if (!targetSession && sessionId) {
          const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { cache: "no-store" }).catch(() => null);
          const data = response?.ok ? await response.json().catch(() => null) as { info?: SessionInfo } | null : null;
          targetSession = data?.info ?? null;
        }
        deliverSessionNotification({ targetSession, title: notification.title, body: notification.body, tag: notification.tag });
      })();
    },
  });

  const handleAttentionNeeded = useCallback((request: BlockingExtensionUiRequest) => {
    if (selectedSession?.relation?.kind === "subagent") return;
    if (!shouldShowBrowserNotification()) return;
    if (!claimExtensionAttentionNotification(request, notifiedAttentionRequestIdsRef.current)) return;

    deliverSessionNotification({
      targetSession: selectedSession,
      title: translate("i18n.attentionNeeded"),
      body: request.method === "custom"
        ? translate("i18n.extensionInputNeeded")
        : request.title,
      tag: `pi-extension-ui:${request.id}`,
    });
  }, [deliverSessionNotification, selectedSession, translate]);

  const handleAutoName = useCallback(async () => {
    const sessionId = selectedSession?.id;
    if (!sessionId || autoNameStatus.kind === "naming") return;
    setAutoNameStatus({ kind: "naming" });

    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/auto-name`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as { title?: string; error?: string };
      if (!response.ok || !body.title) {
        throw new Error(body.error || `HTTP ${response.status}`);
      }

      const title = body.title.trim();
      setRefreshKey((key) => key + 1);
      if (activeSessionIdRef.current !== sessionId) return;
      setSelectedSession((current) => current?.id === sessionId ? { ...current, name: title } : current);
      setSessionStats((current) => current?.sessionId === sessionId ? { ...current, sessionName: title } : current);
      setAutoNameStatus({ kind: "success" });
      autoNameTimerRef.current = setTimeout(() => setAutoNameStatus({ kind: "idle" }), 1800);
    } catch (error) {
      if (activeSessionIdRef.current !== sessionId) return;
      const message = error instanceof Error ? error.message : String(error);
      setAutoNameStatus({ kind: "error", message });
      autoNameTimerRef.current = setTimeout(() => setAutoNameStatus({ kind: "idle" }), 5000);
    }
  }, [autoNameStatus.kind, selectedSession?.id]);

  useEffect(() => {
    if (autoNameTimerRef.current) clearTimeout(autoNameTimerRef.current);
    setAutoNameStatus({ kind: "idle" });
  }, [selectedSession?.id]);

  const handleSessionForked = useCallback((newSessionId: string) => {
    invalidateWorkspaceRestore();
    activeNewSessionDraftKeyRef.current = null;
    setRefreshKey((k) => k + 1);
    setNewSessionCwd(null);
    setSelectedSession((prev) => ({
      ...(prev ?? { path: "", cwd: "", created: "", modified: "", messageCount: 0, firstMessage: "" }),
      id: newSessionId,
      transient: false,
    }));
    hydrateSelectedSession(newSessionId);
    router.replace(`?session=${encodeURIComponent(newSessionId)}`, { scroll: false });
  }, [invalidateWorkspaceRestore, router, hydrateSelectedSession]);

  const handleAskInNewChat = useCallback(async (
    prompt: string,
    sourceSessionId: string,
    sourceEntryId: string,
  ) => {
    const result = await sendAgentCommand<{ newSessionId?: string }>(sourceSessionId, {
      type: "fork_branch",
      entryId: sourceEntryId,
    });
    if (!result?.newSessionId) throw new Error(translate("chat.quoteForkFailed"));
    setPendingQuotePrompt({ sessionId: result.newSessionId, text: prompt });
    handleSessionForked(result.newSessionId);
  }, [handleSessionForked, translate]);

  const handleInitialRestoreDone = useCallback(() => {
    setInitialSessionRestored(true);
  }, []);

  const handleSessionDeleted = useCallback((sessionId: string) => {
    invalidateWorkspaceRestore();
    setRefreshKey((k) => k + 1);
    if (selectedSession?.id === sessionId) {
      clearTabOpenSession(sessionId);
      const cwd = selectedSession.cwd;
      const wasChat = isChatWorkspaceActive || selectedSession.workspaceKind === "chat";
      const draftId = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      setNewSessionDraftId(draftId);
      activeNewSessionDraftKeyRef.current = cwd ? `new:${draftId}:${cwd}` : null;
      setSelectedSession(null);
      setNewSessionCwd(cwd ?? null);
      if (wasChat) {
        setNewSessionWorkspaceKind("chat");
        setFileTabs([]);
        setActiveFileTabId(null);
        setFileTreeOpen(false);
        setRightPanelOpen(false);
        setRightPanelExpanded(false);
      }
      setBranchTree([]);
      setBranchActiveLeafId(null);
      setBranchSwitchLocked(false);
      setSystemPrompt(null);
      setSystemTools(null);
      setSystemInfoLoading(false);
      setActiveTopPanel(null);
      router.replace(cwd ? `?cwd=${encodeURIComponent(cwd)}` : (typeof window !== "undefined" ? window.location.pathname : "/"), { scroll: false });
    }
  }, [invalidateWorkspaceRestore, isChatWorkspaceActive, selectedSession, router]);

  const runTitleAction = useCallback(async (action: () => Promise<void>) => {
    if (titleActionBusyRef.current) return;
    titleActionBusyRef.current = true;
    setTitleActionBusy(true);
    setTitleActionError(null);
    const sourceGeneration = titleActionContextRef.current.generation;
    try { await action(); }
    catch (error) {
      if (titleActionContextRef.current.generation === sourceGeneration) setTitleActionError(translate("sidebar.actionFailed", { error: error instanceof Error ? error.message : String(error) }));
    }
    finally { titleActionBusyRef.current = false; setTitleActionBusy(false); }
  }, [translate]);

  useEffect(() => {
    if (getDomMenu()?.appearance === "conversation") closeDomMenu();
    setTitleRename(null);
    setTitleDeleteSession(null);
    setTitleActionError(null);
  }, [selectedSession?.id, scheduledOpen, welcomeOpen]);

  useEffect(() => subscribeDomMenu(() => setTitleMenuOpen(getDomMenu()?.opener === titleMenuButtonRef.current && Boolean(getDomMenu()))), []);

  const titleRenameSessionId = titleRename?.session.id;
  useEffect(() => {
    if (!titleRenameSessionId) return;
    titleRenameCommitRef.current = false;
    titleRenameInputRef.current?.focus({ preventScroll: true });
    titleRenameInputRef.current?.select();
  }, [titleRenameSessionId]);

  useEffect(() => {
    if (!titleDeleteSession) return;
    const restoreFocus = focusModalPanel(document, titleDeleteDialogRef.current);
    const stopEscape = listenForStackedDialogEscape(document, () => {
      if (!titleActionBusyRef.current) setTitleDeleteSession(null);
    });
    return () => { stopEscape(); restoreFocus(); };
  }, [titleDeleteSession]);

  const commitTitleRename = useCallback(() => {
    const edit = titleRename;
    if (!edit || titleActionBusyRef.current || titleRenameCommitRef.current) return;
    titleRenameCommitRef.current = true;
    setTitleRename(null);
    titleMenuButtonRef.current?.focus({ preventScroll: true });
    const name = edit.value.trim();
    if (name === (edit.session.name ?? "")) return;
    void runTitleAction(async () => {
      const response = await fetch(`/api/sessions/${encodeURIComponent(edit.session.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
      });
      if (!response.ok) { const data = await response.json().catch(() => ({})) as { error?: string }; throw new Error(data.error ?? `HTTP ${response.status}`); }
      setSessionCatalog((current) => current.map((item) => item.id === edit.session.id ? { ...item, name } : item));
      setSelectedSession((current) => current?.id === edit.session.id ? { ...current, name } : current);
      setRefreshKey((key) => key + 1);
    });
  }, [titleRename, runTitleAction]);

  useEffect(() => {
    if (desktopMode) return;
    const controller = new AbortController();
    void fetch("/api/open-in-explorer", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? await response.json() as { supported?: boolean; platform?: string } : null)
      .then((data) => { if (!controller.signal.aborted) setTitleFileManager({ supported: data?.supported === true, platform: data?.platform }); })
      .catch(() => { if (!controller.signal.aborted) setTitleFileManager({ supported: false }); });
    return () => controller.abort();
  }, [desktopMode]);

  const refreshTitleDestinations = useCallback(() => {
    setTitleDestinationsFailed(false);
    return getConversationDestinations().then((destinations) => { setTitleDestinations(destinations); return destinations; }).catch(() => {
      setTitleDestinationsFailed(true);
      return null;
    });
  }, []);
  useEffect(() => { void refreshTitleDestinations(); }, [refreshTitleDestinations]);

  const openTitleMenu = useCallback((button: HTMLButtonElement) => {
    if (!selectedSession || selectedSession.transient || titleActionBusyRef.current) return;
    if (getDomMenu()?.opener === button) { closeDomMenu(); return; }
    const session = selectedSession;
    const archived = titleArchiveActions?.archivedIds.includes(session.id) ?? false;
    if (desktopMode && titleDestinationsFailed) void refreshTitleDestinations();
    const show = (fileManager: { supported: boolean; platform?: string } | null) => {
      const entries: NativeMenuEntry[] = [
        { kind: "submenu", label: translate("titleMenu.openIn"), items: [
          { label: translate("titleMenu.newWindow"), shortcut: "1", disabled: desktopMode && !titleDestinations?.newWindow, disabledReason: desktopMode && !titleDestinations?.newWindow ? translate(titleDestinationsFailed ? "titleMenu.destinationsUnavailable" : "titleMenu.destinationsChecking") : undefined, onSelect: () => void runTitleAction(() => openConversationWindow(session.id)) },
          { kind: "separator" },
          { label: translate("titleMenu.vsCodeProject"), description: translate("titleMenu.vsCodeDescription"), shortcut: "2", disabled: !titleDestinations?.vsCode.supported, disabledReason: !titleDestinations?.vsCode.supported ? translate(!desktopMode ? "sidebar.editorUnavailable" : titleDestinationsFailed ? "titleMenu.destinationsUnavailable" : !titleDestinations ? "titleMenu.destinationsChecking" : "titleMenu.vsCodeNotInstalled") : undefined, onSelect: () => void runTitleAction(() => openProjectInVSCode(session.cwd)) },
          { label: fileManager?.platform === "darwin" ? "Finder" : translate("titleMenu.explorer"), shortcut: "3", disabled: !desktopMode && !fileManager?.supported, disabledReason: !desktopMode && !fileManager?.supported ? translate(fileManager ? "sidebar.fileManagerUnavailable" : "titleMenu.checkingFileManager") : undefined, onSelect: () => void runTitleAction(async () => {
            if (desktopMode) return revealItemInDirNative(session.cwd);
            const response = await fetch("/api/open-in-explorer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cwd: session.cwd }) });
            if (!response.ok) { const data = await response.json().catch(() => ({})) as { error?: string }; throw new Error(data.error ?? `HTTP ${response.status}`); }
          }) },
        ] },
        { kind: "separator" },
        { label: translate("titleMenu.rename"), shortcut: "R", onSelect: () => setTitleRename({ session, value: session.name ?? "" }) },
        { label: translate("titleMenu.fork"), shortcut: "F", disabled: runningSessionIds.has(session.id), disabledReason: runningSessionIds.has(session.id) ? translate("sidebar.forkBusy") : undefined, onSelect: () => void runTitleAction(async () => {
          const sourceGeneration = titleActionContextRef.current.generation;
          const response = await fetch(`/api/sessions/${encodeURIComponent(session.id)}?tree=summary`, { cache: "no-store" });
          const data = await response.json() as { leafId?: string; error?: string };
          if (!response.ok || !data.leafId) throw new Error(data.error ?? translate("sidebar.forkUnavailable"));
          const fork = await sendAgentCommand<{ cancelled?: boolean; newSessionId?: string }>(session.id, { type: "fork_branch", entryId: data.leafId });
          if (fork?.cancelled || !fork?.newSessionId) throw new Error(translate("sidebar.forkUnavailable"));
          const childResponse = await fetch(`/api/sessions/${encodeURIComponent(fork.newSessionId)}?tree=summary`, { cache: "no-store" });
          const child = await childResponse.json() as { info?: SessionInfo; error?: string };
          if (!childResponse.ok || !child.info) throw new Error(child.error ?? translate("sidebar.forkUnavailable"));
          setRefreshKey((key) => key + 1);
          if (titleActionContextRef.current.generation === sourceGeneration) handleSelectSession(child.info);
        }) },
        { kind: "separator" },
        { kind: "submenu", label: translate("titleMenu.transcriptView"), items: TRANSCRIPT_VIEW_MODES.map((mode) => ({
          label: translate(`titleMenu.${mode}`), checked: transcriptView === mode,
          onSelect: () => { if (!setTranscriptView(session.id, mode)) setTitleActionError(translate("titleMenu.preferenceFailed")); },
        })) },
        { kind: "submenu", label: translate("titleMenu.outputStyle"), items: outputStyle.menuItems },
        { kind: "separator" },
        { label: translate(archived ? "titleMenu.restore" : "titleMenu.archive"), shortcut: "A", disabled: !titleArchiveActions, onSelect: () => titleArchiveActions?.setArchived(session.id, !archived) },
        { label: translate("titleMenu.delete"), shortcut: "D", danger: true, onSelect: () => setTitleDeleteSession(session) },
      ];
      openDomMenu(entries, menuPointBelow(button), "conversation", { label: translate("titleMenu.actions"), opener: button });
    };
    show(titleFileManager);
  }, [selectedSession, titleArchiveActions, desktopMode, titleFileManager, titleDestinations, titleDestinationsFailed, refreshTitleDestinations, runningSessionIds, transcriptView, outputStyle.menuItems, translate, runTitleAction, handleSelectSession]);

  const performTitleDelete = useCallback(() => {
    if (!titleDeleteSession) return;
    const session = titleDeleteSession;
    void runTitleAction(async () => {
      const response = await fetch(`/api/sessions/${encodeURIComponent(session.id)}`, { method: "DELETE" });
      if (!response.ok) { const data = await response.json().catch(() => ({})) as { error?: string }; throw new Error(data.error ?? `HTTP ${response.status}`); }
      setTitleDeleteSession(null);
      if (activeSessionIdRef.current === session.id) handleSessionDeleted(session.id);
      else setRefreshKey((key) => key + 1);
    });
  }, [titleDeleteSession, runTitleAction, handleSessionDeleted]);

  const handleOpenFile = useCallback((
    filePath: string,
    fileName: string,
    options?: { sourceSessionId?: string | null; modeHint?: "diff"; page?: number },
  ) => {
    if (isChatWorkspaceActive) return;
    const sourceSessionId = options?.sourceSessionId;
    const modeHint = options?.modeHint;
    const page = options?.page;
    const tabId = `file:${filePath}`;
    setFileTabs((prev) => openFileTab(prev, {
      fileName,
      filePath,
      modeHint,
      page,
      sourceSessionId,
      tabId,
    }));
    setActiveFileTabId(tabId);
    revealWorkspacePane("files");
  }, [isChatWorkspaceActive, revealWorkspacePane]);

  const [copiedSessionField, setCopiedSessionField] = useState<SessionCopyField | null>(null);
  const sessionCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCopySessionField = useCallback((field: SessionCopyField, value: string) => {
    void copyText(value).then(() => {
      if (sessionCopyTimerRef.current) clearTimeout(sessionCopyTimerRef.current);
      setCopiedSessionField(field);
      sessionCopyTimerRef.current = setTimeout(() => setCopiedSessionField(null), 1400);
    });
  }, []);

  const handleOpenLinkedFile = useCallback((filePath: string, page?: number) => {
    if (isChatWorkspaceActive) return;
    handleOpenFile(filePath, getFileName(filePath), { sourceSessionId: selectedSession?.id ?? null, page });
  }, [handleOpenFile, isChatWorkspaceActive, selectedSession?.id]);

  const handleOpenTerminal = useCallback((cwd: string) => {
    if (isChatWorkspaceActive) return;
    const tab = newTerminalTab(cwd);
    setTerminalTabs((tabs) => [...tabs, tab]);
    setActiveTerminalTabId(tab.id);
    revealWorkspacePane("terminal");
  }, [isChatWorkspaceActive, revealWorkspacePane]);

  // Message cards open artifacts through lib/artifact-store. An automatic open
  // (a streamed artifact just finished) is skipped on mobile, where the panel
  // would cover the reply that is still being read.
  useEffect(() => setArtifactOpener((request) => {
    if (isChatWorkspaceActive) return;
    if (request.auto && isMobile) return;
    setArtifactTabs((tabs) => upsertArtifactTab(tabs, request, Date.now()));
    setActiveFileTabId(artifactTabId(request.sessionId, request.identifier));
    if (request.reveal !== false) revealWorkspacePane("files");
  }), [isChatWorkspaceActive, isMobile, revealWorkspacePane]);

  const selectedSessionId = selectedSession?.id ?? null;
  // Read by the effect below without re-running it on every tab change.
  const panelTabsRef = useRef({ fileTabs });
  useEffect(() => {
    panelTabsRef.current = { fileTabs };
  });
  useEffect(() => {
    setArtifactTabs((tabs) => artifactTabsForSession(tabs, selectedSessionId));
    setActiveFileTabId((current) => (
      current?.startsWith("artifact:") && !current.startsWith(`artifact:${selectedSessionId}:`)
        ? panelTabsRef.current.fileTabs.at(-1)?.id ?? null
        : current
    ));
  }, [selectedSessionId]);

  const handleTerminalClosed = (tab: TerminalTab) => {
    const replacement = tab.closing === "restart" ? newTerminalTab(tab.cwd) : null;
    const remaining = terminalTabs.filter((item) => item.id !== tab.id);
    setTerminalTabs((tabs) => tabs.flatMap((item) => item.id !== tab.id ? [item] : replacement ? [replacement] : []));
    setActiveTerminalTabId((current) => current !== tab.id ? current : replacement?.id ?? remaining.at(-1)?.id ?? null);
  };

  const handleCloseTerminalTab = (tabId: string) => {
    setTerminalTabs((tabs) => tabs.map((tab) => tab.id === tabId && !tab.closing ? { ...tab, closing: "close" } : tab));
  };
  const handleCloseFileTab = useCallback((tabId: string) => {
    if (artifactTabs.some((tab) => tab.id === tabId)) {
      const remaining = artifactTabs.filter((tab) => tab.id !== tabId);
      setArtifactTabs(remaining);
      setActiveFileTabId((cur) => cur !== tabId ? cur : remaining.at(-1)?.id ?? fileTabs.at(-1)?.id ?? null);
      return;
    }
    setFileTabs((prev) => prev.filter((tab) => tab.id !== tabId));
    setActiveFileTabId((cur) => {
      if (cur !== tabId) return cur;
      const remaining = fileTabs.filter((tab) => tab.id !== tabId);
      return remaining.at(-1)?.id ?? artifactTabs.at(-1)?.id ?? null;
    });
  }, [fileTabs, artifactTabs]);

  const handleViewFullHistory = useCallback(() => {
    if (!selectedSession) return;
    // Absolute URL so Tauri's open_external_url (http/https only) can hand the
    // page to the system browser for inline viewing — not a save dialog.
    const exportUrl = new URL(
      `/api/sessions/${encodeURIComponent(selectedSession.id)}/export?inline=1`,
      window.location.origin,
    ).href;
    void import("@/lib/desktop-native").then(({ openExternal }) => {
      void openExternal(exportUrl).catch((error) => {
        console.error("Failed to open full history:", error);
      });
    });
  }, [selectedSession]);

  // Show chat area if a session is selected, or if we have a cwd to start a new session in
  const effectiveNewSessionCwd = newSessionCwd ?? (selectedSession === null && activeCwd ? activeCwd : null);
  const newSessionDraftKey = selectedSession === null && effectiveNewSessionCwd
    ? `new:${newSessionDraftId}:${effectiveNewSessionCwd}`
    : null;
  useLayoutEffect(() => {
    activeNewSessionDraftKeyRef.current = newSessionDraftKey;
  }, [newSessionDraftKey]);
  const showChat = selectedSession !== null || effectiveNewSessionCwd !== null;
  const navigationKey = welcomeOpen ? "welcome" : scheduledOpen ? "scheduled" : selectedSession ? `session:${selectedSession.id}` : newSessionDraftKey;
  useEffect(() => {
    if (!initialSessionRestored || !navigationKey) return;
    setSessionNavigation(current => current.items[current.index]?.key === navigationKey ? current : {
      items: [...current.items.slice(0, current.index + 1), { key: navigationKey, session: selectedSession, cwd: selectedSession?.cwd ?? effectiveNewSessionCwd ?? "", projectKey: selectedSession ? workspaceKeyOf(selectedSession) : activeProjectKeyRef.current, draftId: newSessionDraftId, scheduled: scheduledOpen, welcome: welcomeOpen }], index: current.index + 1,
    });
  }, [navigationKey, initialSessionRestored, selectedSession, effectiveNewSessionCwd, newSessionDraftId, scheduledOpen, welcomeOpen]);
  const projectTrustCwd = isChatWorkspaceActive
    ? null
    : selectedSession?.cwd ?? effectiveNewSessionCwd;
  // The hidden Chat workspace has no project changes to show.
  const changesCwd = isChatWorkspaceActive ? "" : selectedSession?.cwd ?? effectiveNewSessionCwd ?? activeCwd ?? "";
  const addChangesFeedback = useCallback((text: string): boolean => {
    if (!chatInputRef.current || !text.trim()) return false;
    chatInputRef.current.insertText(`\n${text}\n`);
    if (isMobile) { setRightPanelOpen(false); setSidebarOpen(false); }
    return true;
  }, [isMobile]);
  useLayoutEffect(() => {
    // A popout belongs to the draft it came from, including A → B → A visits.
    changesFeedbackTargetRef.current = crypto.randomUUID();
  }, [changesCwd, navigationKey]);
  useLayoutEffect(() => {
    if (!changesCwd || !showChat || scheduledOpen || welcomeOpen || !changesFeedbackTargetRef.current) return;
    return subscribeChangesFeedback({ targetId: changesFeedbackTargetRef.current, cwd: changesCwd, onFeedback: addChangesFeedback });
  }, [addChangesFeedback, changesCwd, navigationKey, scheduledOpen, showChat, welcomeOpen]);
  const openChangesPopout = useCallback(() => {
    if (!changesCwd) return;
    changesFeedbackTargetRef.current ??= crypto.randomUUID();
    setChangesWindowError(null);
    void openChangesWindow(changesCwd, changesFeedbackTargetRef.current).catch((error: unknown) => {
      setChangesWindowError(error instanceof Error ? error.message : String(error));
    });
  }, [changesCwd]);
  // While restoring initial session from URL, don't show the placeholder
  const showPlaceholder = initialSessionRestored && !showChat;
  // No chat to wait for: the placeholder is the final first screen. (A restored
  // chat reports from ChatWindow once its history has loaded.)
  useReportDesktopReady(showPlaceholder, "placeholder");

  // File restore must not close a separately restored terminal workspace.
  const restoreFilesPaneVisibility = useCallback((update: React.SetStateAction<boolean>) => {
    if (update === true) {
      setOpenPanes((panes) => ({ ...panes, files: true }));
      setRightPanelOpen(true);
    }
  }, []);
  useDesktopWorkspaceTabs({
    desktopMode: desktopMode && !conversationWindow,
    initialSessionRestored,
    persistedWorkspace,
    sessionId: selectedSession?.id ?? null,
    cwd: isChatWorkspaceActive ? null : selectedSession?.cwd ?? newSessionCwd ?? activeCwd,
    showPlaceholder,
    fileTabs,
    activeFileTabId,
    rightPanelOpen: rightPanelOpen && openPanes.files,
    setFileTabs,
    setActiveFileTabId,
    setRightPanelOpen: restoreFilesPaneVisibility,
  });

  const { workspaceAvailability, unavailableWorkspace, recheckWorkspace } = useWorkspaceAvailability(projectTrustCwd, setModelsRefreshKey);

  useEffect(() => {
    setProjectTrust(null);
    setProjectTrustDialogOpen(false);
    setProjectTrustError(null);
    if (!projectTrustCwd) return;
    // Wait for the folder check: a cwd that is gone is refused here as `cwd-denied`,
    // which is not a trust problem worth reporting.
    if (workspaceAvailability === null) return;
    if (workspaceAvailability !== "available" && workspaceAvailability !== "unknown") return;

    const controller = new AbortController();
    // The answer also lists the project's MCP servers (`mcpFile`, `mcpServers`), unused here: the
    // trust dialog fetches the listing again when it opens, since the file can change in between.
    fetch(`/api/project-trust?cwd=${encodeURIComponent(projectTrustCwd)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json() as ProjectTrustStatus & { error?: string };
        if (!response.ok || data.error) throw new Error(data.error ?? `HTTP ${response.status}`);
        setProjectTrust(data);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Failed to load project trust:", error);
      });
    return () => controller.abort();
  }, [projectTrustCwd, workspaceAvailability]);

  const handleTrustProject = useCallback(async () => {
    if (!projectTrustCwd || projectTrustBusy) return;
    setProjectTrustBusy(true);
    setProjectTrustError(null);
    try {
      const response = await fetch("/api/project-trust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd: projectTrustCwd }),
      });
      const data = await response.json() as ProjectTrustStatus & Partial<McpErrorResponse>;
      if (!response.ok || data.error) {
        // The dialog translates the reason; the English error is only its diagnostic.
        setProjectTrustError({ error: data.error ?? `HTTP ${response.status}`, ...(data.reason ? { reason: data.reason } : {}) });
        return;
      }
      setProjectTrust(data);
      setProjectTrustDialogOpen(false);
      setModelsRefreshKey((key) => key + 1);
      setSessionKey((key) => key + 1);
    } catch (error) {
      setProjectTrustError({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setProjectTrustBusy(false);
    }
  }, [projectTrustBusy, projectTrustCwd]);

  // The restricted-mode banner and Settings › MCP's trust notice open the same dialog.
  const openProjectTrustDialog = useCallback(() => {
    setProjectTrustError(null);
    setProjectTrustDialogOpen(true);
  }, []);

  // Settings › MCP added a project server: `.pi/mcp.json` alone makes a folder require trust, and a
  // fresh folder was trusted in the same step. Every mounted section reloads in place on the new
  // status (projectTrustReloadKey); nothing was rebuilt, so the chat needs no new session key.
  const handleProjectTrustChanged = useCallback((cwd: string, status: ProjectTrustStatus) => {
    if (cwd === projectTrustCwd) setProjectTrust(status);
  }, [projectTrustCwd]);

  const activeFileTab = fileTabs.find((tab) => tab.id === activeFileTabId) ?? null;
  // A narrow panel collapses the tree only while something is being viewed;
  // with nothing open the tree is the panel's whole content. The preference
  // (fileTreeOpen) is untouched, so a wider panel brings the tree back.
  const fileTreeNarrow = panelBodyWidth > 0 && panelBodyWidth < FILE_TREE_AUTO_COLLAPSE_WIDTH;
  const [fileTreeNarrowSeen, setFileTreeNarrowSeen] = useState(fileTreeNarrow);
  if (fileTreeNarrowSeen !== fileTreeNarrow) {
    setFileTreeNarrowSeen(fileTreeNarrow);
    setFileTreeNarrowOverride(false);
  }
  const panelHasViewer = Boolean(activeFileTabId && filesPaneTabs.some((tab) => tab.id === activeFileTabId));
  const fileTreeAutoCollapsed = fileTreeNarrow && panelHasViewer && !fileTreeNarrowOverride;
  const fileTreeShown = fileTreeOpen && !fileTreeAutoCollapsed;
  const handleFileTreeToggle = () => {
    if (fileTreeShown) {
      setFileTreeOpen(false);
      setFileTreeNarrowOverride(false);
    } else {
      setFileTreeOpen(true);
      if (fileTreeAutoCollapsed) setFileTreeNarrowOverride(true);
    }
  };
  const activeCwdName = visibleProjectCwd ? getFileName(visibleProjectCwd) || visibleProjectCwd : null;
  const topBarTitle = welcomeOpen ? PRODUCT_NAME : scheduledOpen
    ? translate("scheduled.title")
    : selectedSession
      ? selectedSession.name || selectedSession.firstMessage || translate("appshell.untitledTask")
      : showChat
        ? translate(isChatWorkspaceActive ? "sidebar.newChatTitle" : "appshell.newTask")
        : PRODUCT_NAME;
  const topBarSubtitle = scheduledOpen || welcomeOpen
    ? ""
    : isChatWorkspaceActive
      ? translate("workspace.chatTitle")
      : activeCwdName ?? translate("appshell.subtitle");
  const windowTitle = isChatWorkspaceActive
    ? `${topBarTitle} - ${PRODUCT_NAME}`
    : activeCwdName
      ? `${activeCwdName} - ${PRODUCT_NAME}`
      : PRODUCT_NAME;

  useEffect(() => keepDocumentTitle(document, windowTitle), [windowTitle]);

  // Settings + collapse controls at the sidebar's own top-right (Claude Desktop
  // style). When the sidebar is closed, the topbar shows a reopen button.
  const sessionHistoryControls = ([-1, 1] as const).map(direction => {
    const target = sessionNavigation.items[sessionNavigation.index + direction];
    const available = target && (!target.session || sessionCatalog.some(session => session.id === target.session?.id));
    const label = translate(direction < 0 ? "pilaude.back" : "pilaude.forward");
    return <button key={direction} type="button" className="sidebar-chrome-button" title={label} aria-label={label} disabled={!available} onClick={() => {
      if (!available) return;
      if (!target.welcome) setWelcomeOpen(false);
      setSessionNavigation(current => ({ ...current, index: current.index + direction }));
      if (target.welcome) handleOpenWelcome();
      else if (target.scheduled) handleOpenScheduled();
      else if (target.session) handleSelectSession(sessionCatalog.find(session => session.id === target.session?.id)!);
      else {
        handleCwdChange(target.cwd, null, target.projectKey);
        handleNewSession(target.draftId, target.cwd, chatWorkspaceCwd && target.cwd === chatWorkspaceCwd ? "chat" : "project", true);
      }
    }}><PilaudeIcon name={direction < 0 ? "back" : "forward"} /></button>;
  });
  const sidebarHeaderControls = (
    <>
      <button
        type="button"
        className="sidebar-chrome-button"
        onClick={openSettingsAtLastSection}
        title={translate("common.settings")}
        aria-label={translate("common.settings")}
        aria-haspopup="dialog"
      >
        <PilaudeIcon name="menu" />
      </button>
      <button
        className="sidebar-chrome-button"
        onClick={handleSidebarToggle}
        title={translate("sidebar.hide")}
        aria-label={translate("sidebar.hide")}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </button>
    </>
  );

  const sidebarContent = (
    <>
      <SessionSidebar
        selectedSessionId={selectedSession?.id ?? null}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onOpenWelcome={handleOpenWelcome}
        initialSessionId={initialSessionId}
        skipInitialProjectSelection={initialNavigation.requestedCwd !== null}
        onInitialRestoreDone={handleInitialRestoreDone}
        refreshKey={refreshKey}
        onSessionDeleted={handleSessionDeleted}
        onArchiveActionsChange={handleArchiveActionsChange}
        selectedCwd={selectedSession?.cwd ?? newSessionCwd ?? null}
        onCwdChange={handleCwdChange}
        onProjectsChange={handleProjectsChange}
        headerControls={<>{sidebarHeaderControls}{sessionHistoryControls}</>}
        onOpenTerminal={handleOpenTerminal}
        onBackgroundTaskDone={handleBackgroundTaskDone}
        onRunningSessionIdsChange={handleRunningSessionIdsChange}
        onSessionsChange={handleSessionsChange}
        onOpenScheduled={handleOpenScheduled}
        onOpenCustomize={() => openSettingsSection("skills")}
        onOpenSettings={() => openSettingsSection("general")}
        onOpenMore={openSettingsAtLastSection}
        onOpenArtifacts={() => {
          setArtifactShelfOpen(true);
          setActiveFileTabId(artifactTabs[0]?.id ?? null);
          revealWorkspacePane("files");
        }}
        scheduledOpen={scheduledOpen}
        onChatWorkspaceCwdChange={setChatWorkspaceCwd}
      />
    </>
  );

  const renderProjectTrustWarning = (mobileBanner: boolean) => {
    if (isChatWorkspaceActive || !showChat || !projectTrust?.requiresTrust || projectTrust.trusted) return null;
    return (
      <button
        type="button"
        onClick={openProjectTrustDialog}
        title={translate("trust.resourcesNotLoaded")}
        aria-label={translate("trust.resourcesNotLoaded")}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: mobileBanner ? "flex-start" : "center",
          gap: 6,
          width: mobileBanner ? "100%" : undefined,
          minHeight: mobileBanner ? 32 : undefined,
          height: mobileBanner ? undefined : "100%",
          padding: mobileBanner ? "6px 12px" : "0 12px",
          background: mobileBanner ? "color-mix(in srgb, #d97706 8%, var(--bg-panel))" : "none",
          border: "none",
          borderRight: mobileBanner ? "none" : "1px solid var(--border)",
          borderBottom: mobileBanner ? "1px solid var(--border)" : "none",
          color: "#d97706",
          cursor: "pointer",
          flexShrink: 0,
          fontSize: 11,
          lineHeight: 1.35,
          textAlign: "left",
        }}
        data-mobile-trust-banner={mobileBanner ? "true" : undefined}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
        <span>{translate("trust.resourcesNotLoaded")}</span>
      </button>
    );
  };


  // The workspace can still show a terminal or artifact while Scheduled is open,
  // and the overlay always needs its own visible way back to the page.
  const showFilePanelToggle = !isChatWorkspaceActive && (isMobile || !scheduledOpen || rightPanelOpen);

  const renderMainFileToggle = () => {
    return (
      <button
        type="button"
        className="main-file-toggle"
        onClick={handleRightPanelToggle}
        aria-controls="file-panel"
        aria-expanded={rightPanelOpen}
        title={rightPanelOpen ? translate("workspace.hidePanelHint") : translate("workspace.showPanel")}
        aria-label={rightPanelOpen ? translate("workspace.hidePanel") : translate("workspace.showPanel")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      </button>
    );
  };

  return (
    <>
    <style>{`
      @keyframes session-info-pop {
        from {
          opacity: 0;
          transform: translateY(-4px) scale(0.99);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .session-info-popover {
        position: relative;
        overflow: hidden;
        transform-origin: top right;
        animation: session-info-pop 160ms var(--ease-native) both;
        will-change: transform, opacity;
      }
      .session-info-popover::after {
        display: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .session-info-popover,
        .session-info-popover::after {
          animation: none;
        }
      }
      .mobile-session-stats {
        container-type: inline-size;
      }
      @container (max-width: 158px) {
        .mobile-session-stat-io {
          display: none !important;
        }
      }
      @container (max-width: 88px) {
        .mobile-session-stat-cost {
          display: none !important;
        }
      }
      @media (max-width: 640px) {
        .sidebar-overlay-backdrop.sidebar-mobile-pending {
          opacity: 0 !important;
          pointer-events: none !important;
        }
        .sidebar-container.sidebar-mobile-pending.sidebar-open {
          transform: translateX(calc(-100% - env(safe-area-inset-left)));
          box-shadow: none;
        }
      }
    `}</style>
    <div
      className="app-shell"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "var(--app-viewport-height, 100dvh)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
        overflow: "hidden",
        background: "var(--bg)",
      } as React.CSSProperties}
    >
      {connectionState === "offline" && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            flexShrink: 0,
            padding: "7px 12px",
            background: "color-mix(in srgb, var(--danger) 14%, var(--bg-panel))",
            borderBottom: "var(--hairline) solid color-mix(in srgb, var(--danger) 35%, var(--border))",
            color: "var(--text)",
            fontSize: 12,
            zIndex: 300,
          }}
        >
          <span>{translate("connection.offline")}</span>
          <button
            type="button"
            onClick={retryConnection}
            style={{
              height: 24,
              padding: "0 10px",
              border: "var(--hairline) solid var(--border)",
              borderRadius: 5,
              background: "var(--bg)",
              color: "var(--accent)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {translate("connection.retry")}
          </button>
        </div>
      )}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {/* Mobile overlay backdrop */}
      <div
        className={`sidebar-overlay-backdrop${mobileSidebarReady ? "" : " sidebar-mobile-pending"}`}
        onClick={() => setSidebarOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 199,
          background: "rgba(0,0,0,0.4)",
          opacity: sidebarOpen ? 1 : 0,
          pointerEvents: sidebarOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Left sidebar */}
      <div
        ref={sidebarResizer.panelRef}
        id="session-sidebar"
        className={`app-sidebar sidebar-container${sidebarOpen ? " sidebar-open" : " sidebar-closed"}${mobileSidebarReady ? "" : " sidebar-mobile-pending"}${sidebarResizer.isResizing ? " sidebar-resizing" : ""}`}
        inert={rightPanelFullWidth}
        style={{
          "--sidebar-width": `${sidebarResizer.width}px`,
          background: "var(--bg-panel)",
          borderRight: "var(--hairline) solid var(--border)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          zIndex: 200,
        } as React.CSSProperties}
      >
        {sidebarContent}
      </div>
      {sidebarOpen && (
        <div
          {...sidebarResizer.separatorProps}
          inert={rightPanelFullWidth}
          aria-controls="session-sidebar"
          className={`panel-resize-handle sidebar-resize-handle${sidebarResizer.isResizing ? " is-resizing" : ""}`}
          data-resize-handle="sidebar"
          title={`${translate("layout.resizeSidebar")}: ${translate("layout.resizeHint")}`}
        />
      )}

      {/* Main column: everything right of the sidebar. The topbar starts at the
          center column so the sidebar runs the full window height. */}
      <div className="app-main-column" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {/* Top bar with sidebar toggle */}
        <div
          ref={topBarRef}
          className={`app-topbar${macLightsOverTopbar ? " app-topbar--mac-inset" : ""}${!rightPanelOpen ? " app-topbar--panel-closed" : ""}`}
          {...desktopChrome.dragRegionProps}
          {...windowDrag}
          style={{ display: "flex", alignItems: "center", flexShrink: 0, height: "calc(36px + env(safe-area-inset-top))", paddingTop: "env(safe-area-inset-top)", background: "var(--bg-panel)" }}
        >
          {/* Sidebar reopen — while the sidebar (and its own toggle) is hidden.
              A wide-panel split keeps this reachable; the full-width panel covers
              the window, so there the sidebar stays closed until it is restored. */}
          {!sidebarOpen && !rightPanelFullWidth && (
            <button
              className="native-icon-button"
              onClick={handleSidebarToggle}
              title={translate("sidebar.show")}
              aria-label={translate("sidebar.show")}
              // Size, hover colour and background come from .native-icon-button, which
              // declares them with !important — inline overrides here would be dead.
              style={{ order: -2, flexShrink: 0 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          )}
          <div className="app-topbar-title" title={topBarTitle}>
            {selectedSession && !scheduledOpen && !welcomeOpen && <svg className="app-topbar-title-project-icon" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3.5 4.5h13v9h-13zM2.5 13.5h15v2h-15z" strokeLinejoin="round" /></svg>}
            {titleRename ? <input ref={titleRenameInputRef} className="app-topbar-title-rename" aria-label={translate("titleMenu.rename")} value={titleRename.value} onChange={(event) => setTitleRename((current) => current ? { ...current, value: event.target.value } : null)} onBlur={commitTitleRename} onKeyDown={(event) => {
              if (isImeComposing(event)) { event.stopPropagation(); return; }
              if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); commitTitleRename(); }
              if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); titleRenameCommitRef.current = true; setTitleRename(null); titleMenuButtonRef.current?.focus({ preventScroll: true }); }
            }} /> : selectedSession && !scheduledOpen && !welcomeOpen ? <button type="button" className="app-topbar-title-name" title={translate("titleMenu.rename")} disabled={selectedSession.transient || titleActionBusy} onClick={() => setTitleRename({ session: selectedSession, value: selectedSession.name ?? "" })}>{topBarTitle}</button> : <span>{topBarTitle}</span>}
            {selectedSession && !scheduledOpen && !welcomeOpen && <button ref={titleMenuButtonRef} type="button" className="app-topbar-title-trigger" aria-label={translate("titleMenu.actions")} aria-haspopup="menu" aria-expanded={titleMenuOpen} aria-busy={titleActionBusy || undefined} disabled={selectedSession.transient || titleActionBusy} onClick={(event) => openTitleMenu(event.currentTarget)} onKeyDown={(event) => {
              if (isImeComposing(event)) { event.stopPropagation(); return; }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); openTitleMenu(event.currentTarget); }
            }}><PilaudeIcon name="chevron" size={14} /></button>}
            {topBarSubtitle && <small className="app-topbar-title-project">{topBarSubtitle}</small>}
          </div>
          {showChat && !scheduledOpen && !welcomeOpen && projectTrust?.requiresTrust && !projectTrust.trusted && (
            <button
              type="button"
              onClick={() => {
                setProjectTrustError(null);
                setProjectTrustDialogOpen(true);
              }}
              title={translate("trust.resourcesNotLoaded")}
              aria-label={translate("trust.resourcesNotLoaded")}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "stretch",
                flex: 1,
                minWidth: 0,
                height: "100%",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              {!isMobile && <span>{translate("trust.resourcesNotLoaded")}</span>}
            </button>
          )}
          {showChat && !scheduledOpen && !welcomeOpen && (
            <div className="app-topbar-actions" style={{ display: "flex", alignItems: "stretch", height: "100%" }}>
              <button
                className="native-toolbar-button"
                onClick={handleViewFullHistory}
                disabled={!selectedSession}
                 title={selectedSession ? translate("history.full") : translate("history.unsaved")}
                 aria-label={translate("history.full")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  height: "100%",
                  padding: "0 12px",
                  background: "none",
                  color: selectedSession ? "var(--text-muted)" : "var(--text-dim)",
                  cursor: selectedSession ? "pointer" : "not-allowed",
                  opacity: selectedSession ? 1 : 0.45,
                  flexShrink: 0,
                  fontSize: 11,
                  whiteSpace: "nowrap",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M12 7v5l3 2" />
                </svg>
                 {!isMobile && <span>{translate("history.label")}</span>}
              </button>
              {!isChatWorkspaceActive && (
                <BranchNavigator
                  tree={branchTree}
                  activeLeafId={branchActiveLeafId}
                  onLeafChange={handleBranchLeafChange}
                  inline
                  compact={isMobile}
                  containerRef={topBarRef}
                  open={activeTopPanel === "branches"}
                  onToggle={() => toggleTopPanel("branches")}
                  hasSession
                />
              )}
              {(() => {
                // Persisted stats win so compressed sessions can still name
                // themselves; the file message count covers sessions whose
                // stats were never computed. Transient (not-yet-flushed)
                // sessions must never trigger JSONL-dependent naming.
                const hasMessages = Boolean(
                  selectedSession
                  && ((sessionStats?.userMessages ?? 0) > 0 || selectedSession.messageCount > 0),
                );
                const nameDisabled = !selectedSession || selectedSession.transient || !hasMessages || autoNameStatus.kind === "naming";
                const isSuccess = autoNameStatus.kind === "success";
                const isError = autoNameStatus.kind === "error";
                const nameLabel = autoNameStatus.kind === "naming"
                  ? translate("title.generating")
                  : isSuccess
                    ? translate("title.updated")
                    : isError
                      ? translate("title.failed")
                      : translate("title.generate");
                const nameDescription = !hasMessages
                  ? translate("appshell.afterFirstMessage")
                  : isError
                    ? autoNameStatus.message
                    : translate("title.generateSession");

                const statsSummary = (() => {
                  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
                  const t = sessionStats?.tokens;
                  const c = sessionStats?.cost ?? 0;
                  const parts: string[] = [];
                  if (t && t.input > 0) parts.push(`↑${fmt(t.input)}`);
                  if (t && t.output > 0) parts.push(`↓${fmt(t.output)}`);
                  if (c > 0) parts.push(c >= 0.01 ? `$${c.toFixed(2)}` : "<$0.01");
                  if (contextUsage?.contextWindow && contextUsage.percent !== null) {
                    parts.push(`${contextUsage.percent.toFixed(1)}% ctx`);
                  }
                  return parts.length > 0 ? parts.join(" · ") : translate("appshell.statsHint");
                })();

                // Desktop shell: the same five actions as a native popup. A
                // native item holds one line, so the DOM menu's caption is
                // appended to the label where it carries live state.
                const openNativeMore = (anchor: Element) => {
                  void showNativeMenu([
                    { label: nameLabel, disabled: nameDisabled, onSelect: () => void handleAutoName() },
                    {
                      label: `${translate("system.prompt")}${systemPrompt === null ? "" : systemPrompt ? "" : ` (${translate("appshell.toolsDisabled")})`}`,
                      checked: activeTopPanel === "system" ? true : undefined,
                      onSelect: () => handleSystemInfoToggle("system"),
                    },
                    {
                      label: translate("agentSwitcher.title"),
                      checked: activeTopPanel === "agents" ? true : undefined,
                      onSelect: () => toggleTopPanel("agents"),
                    },
                    {
                      label: translate("tools.label"),
                      checked: activeTopPanel === "tools" ? true : undefined,
                      onSelect: () => handleSystemInfoToggle("tools"),
                    },
                    { kind: "separator" },
                    {
                      label: `${translate("appshell.sessionStats")} — ${statsSummary}`,
                      disabled: !sessionStats && !contextUsage,
                      checked: activeTopPanel === "session" ? true : undefined,
                      onSelect: () => toggleTopPanel("session"),
                    },
                  ], menuPointBelow(anchor, "right")).then((shown) => { if (!shown) setTopMoreOpen(true); });
                };

                return (
                  <div className="app-topbar-more" ref={topMoreRef}>
                    <button
                      className="native-toolbar-button app-topbar-more-trigger"
                      type="button"
                      onClick={(event) => {
                        setActiveTopPanel(null);
                        if (canUseNativeMenu()) {
                          openNativeMore(event.currentTarget);
                          return;
                        }
                        setTopMoreOpen((open) => !open);
                      }}
                      title={translate("appshell.moreActions")}
                      aria-label={translate("appshell.moreActions")}
                      aria-expanded={topMoreOpen}
                      aria-haspopup="menu"
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        height: "100%", padding: "0 12px",
                        background: topMoreOpen ? "var(--bg-selected)" : "none",
                        border: "none",
                        borderTop: topMoreOpen ? "2px solid var(--accent)" : "2px solid transparent",
                        color: topMoreOpen ? "var(--text)" : "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: 11, whiteSpace: "nowrap",
                        transition: "color 0.1s, background 0.1s",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="5" cy="12" r="1.65" />
                        <circle cx="12" cy="12" r="1.65" />
                        <circle cx="19" cy="12" r="1.65" />
                      </svg>
                      {!isMobile && <span>{translate("appshell.more")}</span>}
                    </button>
                    {topMoreOpen && topMorePos && createPortal(
                      <div
                        ref={topMoreMenuRef}
                        className="native-popover app-menu app-topbar-more-menu"
                        role="menu"
                        aria-label={translate("appshell.moreActions")}
                        style={{ position: "fixed", top: topMorePos.top, right: topMorePos.right, zIndex: 700 }}
                      >
                        <button
                          className="app-topbar-more-item"
                          type="button"
                          role="menuitem"
                          disabled={nameDisabled}
                          onClick={() => {
                            setTopMoreOpen(false);
                            void handleAutoName();
                          }}
                        >
                          <span
                            className="app-topbar-more-icon"
                            style={{
                              color: isError
                                ? "var(--danger)"
                                : isSuccess
                                  ? "var(--accent)"
                                  : nameDisabled
                                    ? "var(--text-dim)"
                                    : "var(--text-muted)",
                            }}
                          >
                            {autoNameStatus.kind === "naming" ? (
                              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            ) : isSuccess ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="m15 4 5 5L7 22l-5-5Z" />
                                <path d="m14 5 5 5" />
                                <path d="M6 4V2M5 3H3M19 19v3M17.5 20.5h3" />
                              </svg>
                            )}
                          </span>
                          <span className="app-topbar-more-copy">
                            <span>{nameLabel}</span>
                            <small>{nameDescription}</small>
                          </span>
                        </button>
                        <button
                          className="app-topbar-more-item"
                          type="button"
                          role="menuitem"
                          onClick={() => handleSystemInfoToggle("system")}
                        >
                          <span
                            className="app-topbar-more-icon"
                            style={{ color: systemPrompt !== null ? "var(--accent)" : "var(--text-muted)" }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="8" y1="13" x2="16" y2="13" />
                              <line x1="8" y1="17" x2="13" y2="17" />
                            </svg>
                          </span>
                          <span className="app-topbar-more-copy">
                            <span>{translate("system.prompt")}</span>
                            <small>{systemPrompt === null ? translate("appshell.systemLoads") : systemPrompt ? translate("appshell.viewInstructions") : translate("appshell.toolsDisabled")}</small>
                          </span>
                        </button>
                        <button
                          className="app-topbar-more-item"
                          type="button"
                          role="menuitem"
                          onClick={() => toggleTopPanel("agents")}
                        >
                          <span
                            className="app-topbar-more-icon"
                            style={{ color: activeTopPanel === "agents" ? "var(--accent)" : "var(--text-muted)" }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="5" y="7" width="14" height="11" rx="2" />
                              <path d="M9 11h.01M15 11h.01M9 15h6M12 7V4M10 4h4" />
                            </svg>
                          </span>
                          <span className="app-topbar-more-copy">
                            <span>{translate("agentSwitcher.title")}</span>
                            <small>{translate("agentSwitcher.subagent")}</small>
                          </span>
                        </button>
                        <button
                          className="app-topbar-more-item"
                          type="button"
                          role="menuitem"
                          onClick={() => handleSystemInfoToggle("tools")}
                        >
                          <span
                            className="app-topbar-more-icon"
                            style={{ color: activeTopPanel === "tools" ? "var(--accent)" : "var(--text-muted)" }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" />
                            </svg>
                          </span>
                          <span className="app-topbar-more-copy">
                            <span>{translate("tools.label")}</span>
                            <small>{translate("tools.title")}</small>
                          </span>
                        </button>
                        {(() => {
                          const summary = statsSummary;
                          return (
                            <button
                              className="app-topbar-more-item"
                              type="button"
                              role="menuitem"
                              disabled={!sessionStats && !contextUsage}
                              onClick={() => toggleTopPanel("session")}
                            >
                              <span
                                className="app-topbar-more-icon"
                                style={{ color: activeTopPanel === "session" ? "var(--accent)" : "var(--text-muted)" }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <line x1="18" y1="20" x2="18" y2="10" />
                                  <line x1="12" y1="20" x2="12" y2="4" />
                                  <line x1="6" y1="20" x2="6" y2="14" />
                                </svg>
                              </span>
                              <span className="app-topbar-more-copy">
                                <span>{translate("appshell.sessionStats")}</span>
                                <small>{summary}</small>
                              </span>
                            </button>
                          );
                        })()}
                      </div>,
                      document.body,
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          {!isMobile && renderProjectTrustWarning(false)}
          {!isMobile && showFilePanelToggle && renderMainFileToggle()}
          {isMobile && !isChatWorkspaceActive && sessionHasBranches && (
            <BranchNavigator
              tree={branchTree}
              activeLeafId={branchActiveLeafId}
              onLeafChange={handleBranchLeafChange}
              locked={branchSwitchLocked}
              inline
              compact
              containerRef={topBarRef}
              open={activeTopPanel === "branches"}
              onToggle={() => toggleTopPanel("branches")}
              hasSession={showChat && !welcomeOpen}
              hideInlineButton
            />
          )}
          {/* Top panel dropdown — shared, only one active at a time */}
          {activeTopPanel && topPanelPos && (
            <div style={{
              position: "fixed",
              top: topPanelPos.top,
              left: topPanelPos.left,
              width: topPanelPos.width,
              maxHeight: `calc(100dvh - ${topPanelPos.top}px)`,
              overflowY: "auto",
              zIndex: 500,
            }}>
              {activeTopPanel === "agents" && activeSessionFamily && selectedSession && (
                <AgentSessionPanel
                  rootSession={activeSessionFamily.root}
                  subagents={activeSessionFamily.subagents}
                  selectedSessionId={selectedSession.id}
                  runningSessionIds={runningSessionIds}
                  onSelectSession={handleSelectSession}
                />
              )}
              {activeTopPanel === "system" && (
                <SystemPromptPanel
                  loading={systemInfoLoading}
                  prompt={systemPrompt}
                  translate={translate}
                />
              )}
              {activeTopPanel === "tools" && (
                <ToolDefinitionsPanel
                  loading={systemInfoLoading}
                  tools={systemTools}
                  translate={translate}
                />
              )}
              {activeTopPanel === "session" && (
                <div className="session-info-popover" style={{
                  background: "var(--bg-panel)",
                  borderBottom: "var(--hairline) solid var(--border)",
                  boxShadow: "0 10px 28px rgba(0,0,0,0.10)",
                  padding: "12px 16px",
                }}>
                  {sessionStats ? (() => {
                    const formatDuration = (ms: number) => {
                      if (ms <= 0) return "0s";
                      const totalSec = Math.floor(ms / 1000);
                      const h = Math.floor(totalSec / 3600);
                      const m = Math.floor((totalSec % 3600) / 60);
                      const s = totalSec % 60;
                      if (h > 0) return `${h}h ${m}m`;
                      if (m > 0) return `${m}m ${s}s`;
                      return `${s}s`;
                    };
                    const totalActiveMs = sessionStats.totalActiveMs ?? 0;
                    const ws = isChatWorkspaceActive ? null : selectedSession;
                    const sessionRows = [
                       ...(sessionStats.sessionName ? [{ label: translate("session.name"), value: sessionStats.sessionName, copyField: null }] : []),
                       { label: translate("session.file"), value: sessionStats.sessionFile ?? translate("session.inMemory"), copyField: "file" as const },
                       { label: translate("session.id"), value: sessionStats.sessionId, copyField: "id" as const },
                       ...(totalActiveMs > 0 ? [{ label: translate("session.totalActive"), value: formatDuration(totalActiveMs), copyField: null }] : []),
                    ];
                    const projectRows = [
                      ...(ws ? [{ label: translate("session.projectDir"), value: ws.projectRoot ?? ws.cwd, copyField: "projectDir" as const }] : []),
                      ...(ws?.branch ? [{ label: translate("session.gitBranch"), value: ws.branch, copyField: "gitBranch" as const }] : []),
                      ...(ws?.isWorktree ? [{ label: translate("session.gitWorktree"), value: ws.cwd, copyField: "gitWorktree" as const }] : []),
                    ];
                    const messageRows = [
                       [translate("session.user"), sessionStats.userMessages.toLocaleString(locale)],
                       [translate("session.assistant"), sessionStats.assistantMessages.toLocaleString(locale)],
                       [translate("session.toolCalls"), sessionStats.toolCalls.toLocaleString(locale)],
                       [translate("session.toolResults"), sessionStats.toolResults.toLocaleString(locale)],
                       [translate("session.total"), sessionStats.totalMessages.toLocaleString(locale)],
                    ];
                    const tokenRows = [
                       [translate("session.input"), sessionStats.tokens.input.toLocaleString(locale)],
                       [translate("session.output"), sessionStats.tokens.output.toLocaleString(locale)],
                       ...(sessionStats.tokens.cacheRead > 0 ? [[translate("session.cacheRead"), sessionStats.tokens.cacheRead.toLocaleString(locale)]] : []),
                       ...(sessionStats.tokens.cacheWrite > 0 ? [[translate("session.cacheWrite"), sessionStats.tokens.cacheWrite.toLocaleString(locale)]] : []),
                       [translate("session.total"), sessionStats.tokens.total.toLocaleString(locale)],
                    ];
                    const ctx = contextUsage ?? sessionStats.contextUsage;
                    const formatCompact = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
                    const extraTokenRows = [
                       ...(sessionStats.cost > 0 ? [[translate("session.cost"), `$${sessionStats.cost.toFixed(4)}`]] : []),
                       ...(ctx?.contextWindow ? [[translate("session.context"), `${ctx.percent !== null ? `${ctx.percent.toFixed(1)}%` : "?"} / ${formatCompact(ctx.contextWindow)}`]] : []),
                       // Cache hit rate = cache reads / (input + cache writes + cache reads) — the denominator covers all input-class tokens.
                       ...(sessionStats.tokens.cacheRead + sessionStats.tokens.cacheWrite > 0 && sessionStats.tokens.cacheRead + sessionStats.tokens.cacheWrite + sessionStats.tokens.input > 0
                         ? [[translate("session.cacheHitRate"), `${(sessionStats.tokens.cacheRead / (sessionStats.tokens.cacheRead + sessionStats.tokens.cacheWrite + sessionStats.tokens.input) * 100).toFixed(1)}%`]]
                         : []),
                    ];
                    const section = (
                      title: string,
                      sectionRows: string[][],
                      valueAlign: "left" | "right" = "left",
                      compact = false,
                    ) => (
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{title}</div>
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: compact ? "max-content max-content" : "auto minmax(0, 1fr)",
                            columnGap: compact ? 14 : 12,
                            rowGap: 4,
                            justifyContent: compact ? "start" : undefined,
                          }}>
                            {sectionRows.map(([label, value]) => (
                              <div key={`${title}:${label}`} style={{ display: "contents" }}>
                                <div style={{ color: "var(--text-dim)", whiteSpace: "nowrap" }}>{label}</div>
                                <div style={{
                                  color: "var(--text-muted)",
                                  minWidth: 0,
                                  overflowWrap: compact ? "normal" : "anywhere",
                                  textAlign: valueAlign,
                                  whiteSpace: valueAlign === "right" ? "nowrap" : "normal",
                                }}>{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    const copyTitleKey: Record<SessionCopyField, string> = {
                      file: "session.copyFile",
                      id: "session.copyId",
                      projectDir: "session.copyProjectDir",
                      gitBranch: "session.copyGitBranch",
                      gitWorktree: "session.copyGitWorktree",
                    };
                    const copyButton = (field: SessionCopyField, value: string) => {
                      const copied = copiedSessionField === field;
                      return (
                        <button
                          type="button"
                          title={copied ? translate("session.copied") : translate(copyTitleKey[field])}
                          onClick={() => handleCopySessionField(field, value)}
                          style={{
                            alignSelf: "start",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 22,
                            height: 22,
                            marginTop: -2,
                            color: copied ? "var(--accent)" : "var(--text-dim)",
                            flex: "0 0 auto",
                          }}
                          className="session-field-copy"
                        >
                          {copied ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          )}
                        </button>
                      );
                    };
                    const costBreakdownRows = shouldShowUsageBreakdown(sessionStats.costBreakdown, sessionStats.selectedModelKey)
                      ? (sessionStats.costBreakdown ?? []).map((entry) => [
                          entry.key === UNATTRIBUTED_USAGE_KEY ? translate("session.unattributedUsage") : entry.key,
                          `$${entry.cost.toFixed(4)} · ${formatCompact(entry.tokens)}`,
                        ])
                      : [];
                    const cacheWarmingInfo = panelCacheWarming ?? sessionStats.cacheWarming;
                    const cacheWarmingSectionRows = cacheWarmingInfo ? cacheWarmingRows(cacheWarmingInfo, translate) : [];
                    const sessionInfoSection = (
                      <div style={{ minWidth: 0 }}>
                         <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{translate("session.infoSection")}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", columnGap: 12, rowGap: 8, alignItems: "start" }}>
                          {sessionRows.map((row) => (
                            <div key={`session-info:${row.label}`} style={{ display: "contents" }}>
                              <div style={{ color: "var(--text-dim)", whiteSpace: "nowrap" }}>{row.label}</div>
                              <div style={{
                                color: "var(--text-muted)",
                                minWidth: 0,
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                                whiteSpace: "normal",
                              }}>{row.value}</div>
                              <div>{row.copyField ? copyButton(row.copyField, row.value) : null}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                    const projectInfoSection = projectRows.length > 0 ? (
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{translate("session.projectSection")}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", columnGap: 12, rowGap: 8, alignItems: "start" }}>
                          {projectRows.map((row) => (
                            <div key={`project-info:${row.label}`} style={{ display: "contents" }}>
                              <div style={{ color: "var(--text-dim)", whiteSpace: "nowrap" }}>{row.label}</div>
                              <div style={{
                                color: "var(--text-muted)",
                                minWidth: 0,
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                                whiteSpace: "normal",
                              }}>{row.value}</div>
                              <div>{row.copyField ? copyButton(row.copyField, row.value) : null}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;

                    return (
                      <div style={{
                        display: "grid",
                        // The clamped popover can be narrower than the three
                        // columns' combined min width (~770px); stack instead
                        // of overflowing under the file panel.
                        gridTemplateColumns: isMobile || topPanelPos.width < 780
                          ? "1fr"
                          : "minmax(360px, 1.7fr) minmax(140px, 0.55fr) minmax(190px, 0.75fr)",
                        gap: isMobile ? 16 : 24,
                        fontSize: 12,
                        lineHeight: 1.5,
                        fontFamily: "var(--font-mono)",
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 20 }}>
                          {sessionInfoSection}
                          {projectInfoSection}
                          {costBreakdownRows.length > 0 && section(translate("session.costByModel"), costBreakdownRows)}
                          {cacheWarmingSectionRows.length > 0 && section(translate("session.cacheWarming"), cacheWarmingSectionRows)}
                        </div>
                         {section(translate("session.messages"), messageRows)}
                         {section(translate("session.tokens"), [...tokenRows, ...extraTokenRows], "right", true)}
                      </div>
                    );
                  })() : (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                       {translate("session.load")}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Windows/Linux controls stay in the chat topbar while the floating
              panel is a separate card; the topbar still owns the visible edge. */}
          {/* A chat has no project workbench to toggle. */}
          {!isChatWorkspaceActive && (!isMobile && <WorkspacePaneControls openPanes={{ files: rightPanelOpen && openPanes.files, terminal: rightPanelOpen && openPanes.terminal, changes: rightPanelOpen && openPanes.changes, tasks: rightPanelOpen && openPanes.tasks }} onToggle={toggleWorkspacePane} />)}
          {showChat && !welcomeOpen && <button type="button" className="native-icon-button pilaude-context-toggle" title={translate("pilaude.contextPanel")} aria-label={translate("pilaude.contextPanel")} aria-pressed={contextDockOpen} onClick={() => setContextDockOpen(open => !open)}><PilaudeIcon name="context" /></button>}
          {(!rightPanelOpen || isMobile) && <WindowControls />}
        </div>
        <div className="pilaude-workspace-body" style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {/* Center: chat */}
      <div inert={rightPanelFullWidth} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, position: "relative" }}>
        {isMobile && renderProjectTrustWarning(true)}

        {/* Chat content */}
        <div inert={scheduledOpen || welcomeOpen} aria-hidden={scheduledOpen || welcomeOpen || undefined} style={{ flex: 1, overflow: "hidden", position: "relative", display: welcomeOpen ? "none" : undefined }}>
          {showChat ? (
            <TranscriptViewProvider mode={transcriptView} sessionId={selectedSession?.id ?? null}><ChatWindow
              key={sessionKey}
              session={selectedSession}
              workspaceKind={activeWorkspaceKind}
              searchTarget={searchTarget?.sessionId === selectedSession?.id ? searchTarget : null}
              onSearchTargetHandled={handleSearchTargetHandled}
              initialScrollPosition={selectedSession ? sessionScrollPositionsRef.current.get(selectedSession.id) ?? null : null}
              onScrollPositionChange={handleSessionScrollPositionChange}
              sessionRunning={Boolean(selectedSession && runningSessionIds.has(selectedSession.id))}
              newSessionCwd={effectiveNewSessionCwd}
              newSessionDraftKey={newSessionDraftKey}
              onAgentEnd={handleAgentEnd}
              onAttentionNeeded={handleAttentionNeeded}
              onSessionCreated={handleSessionCreated}
              onSessionForked={handleSessionForked}
              modelsRefreshKey={modelsRefreshKey}
              workspaceUnavailable={unavailableWorkspace}
              onRecheckWorkspace={recheckWorkspace}
              chatInputRef={chatInputRef}
              onBranchDataChange={isChatWorkspaceActive ? undefined : handleBranchDataChange}
              onSystemPromptChange={handleSystemPromptChange}
              onSystemToolsChange={handleSystemToolsChange}
              onSystemInfoLoaderChange={handleSystemInfoLoaderChange}
              onSessionStatsChange={handleSessionStatsChange}
              onSessionStatsPanelOpen={openSessionStatsPanel}
              onOpenSettings={openSettingsSection}
              onContextUsageChange={handleContextUsageChange}
              onSelectProject={desktopMode && !isChatWorkspaceActive
                ? () => void handleSelectProjectFromComposer()
                : undefined}
              projectOptions={selectedSession || isChatWorkspaceActive ? [] : availableProjectRoots}
              onProjectChange={selectedSession || isChatWorkspaceActive ? undefined : handleProjectChangeFromComposer}
              onOpenModelsConfig={() => setSettingsSection("models")}
              onOpenFile={isChatWorkspaceActive ? undefined : handleOpenLinkedFile}
              onOpenSession={handleOpenSession}
              onAskInNewChat={handleAskInNewChat}
              quoteSelectionEnabled={quoteSelectionEnabled}
              initialPrompt={pendingQuotePrompt?.sessionId === selectedSession?.id ? pendingQuotePrompt?.text : undefined}
              onInitialPromptConsumed={() => setPendingQuotePrompt(null)}
              soundEnabled={soundEnabled}
              playDoneSound={conversationWindow ? undefined : playDoneSound}
              unlockAudio={unlockAudio}
            /></TranscriptViewProvider>
          ) : initialCwdStatus === "validating" ? (
            <div
              role="status"
              style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 24, color: "var(--text-muted)", textAlign: "center" }}
            >
              <div style={{ fontSize: 14, color: "var(--text)" }}>{translate("workspace.opening")}</div>
            </div>
          ) : initialCwdStatus === "error" ? (
            <div
              role="alert"
              style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 24, color: "var(--text-muted)", textAlign: "center" }}
            >
              <div style={{ fontSize: 14, color: "#dc2626" }}>{translate("workspace.unable")}</div>
              {showInitialRequestedCwd && (
                <div style={{ maxWidth: "min(720px, 100%)", overflowWrap: "anywhere", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  {initialNavigation.requestedCwd}
                </div>
              )}
              <div style={{ maxWidth: 720, fontSize: 12 }}>{initialCwdError}</div>
            </div>
          ) : showPlaceholder ? (
            visibleProjectCwd ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 15 }}>
                 {translate("workspace.selectSession")}
              </div>
            ) : (
              <PilaudeWelcome
                onOpenProject={() => desktopMode ? void handleSelectProjectFromComposer() : setWelcomePickerOpen(true)}
                onOpenModels={() => openSettingsSection("models")}
              />
            )
          ) : null}
        </div>

        {welcomeOpen && (
          <PilaudeWelcome
            onOpenProject={() => desktopMode ? void handleSelectProjectFromComposer() : setWelcomePickerOpen(true)}
            onOpenModels={() => openSettingsSection("models")}
          />
        )}
        {scheduledOpen && (
          <ScheduledView
            projectRoots={availableProjectRoots}
            defaultCwd={isChatWorkspaceActive ? null : selectedSession?.cwd ?? newSessionCwd ?? activeCwd}
            onBrowseFolder={desktopMode ? handleBrowseScheduledFolder : undefined}
            onOpenSession={async (sessionId) => {
              // handleOpenSession only logs a failure; this page has to tell the user.
              const known = sessionCatalog.some((s) => s.id === sessionId && !s.transient);
              if (!known) {
                const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { cache: "no-store" }).catch(() => null);
                if (!response?.ok) return false;
              }
              await handleOpenSession(sessionId);
              return true;
            }}
          />
        )}
      </div>
      {showChat && contextDockOpen && !scheduledOpen && !welcomeOpen && !settingsSection && !projectTrustDialogOpen && !welcomePickerOpen && (
        <PilaudeWorkspaceContext
          session={selectedSession}
          cwd={isChatWorkspaceActive ? "" : selectedSession?.cwd ?? effectiveNewSessionCwd ?? activeCwd ?? ""}
          showChanges={!isChatWorkspaceActive}
          stats={sessionStats}
          usage={contextUsage}
          toolCount={systemTools?.length ?? null}
          rightPanelOpen={rightPanelOpen}
          rightPanelFullWidth={rightPanelFullWidth}
          onOpenContext={openSessionStatsPanel}
          onOpenTools={() => handleSystemInfoToggle("tools")}
          onOpenConnectors={() => openSettingsSection("mcp")}
          onClose={handleContextDockClose}
          onOpenFiles={() => { revealWorkspacePane("files"); setFileTreeOpen(true); setFileTreeNarrowOverride(true); }}
          onOpenChanges={() => revealWorkspacePane("changes")}
        />
      )}
        </div>
      </div>

      {/* Mobile keeps this fixed toggle (the desktop topbar renders its own);
          rendering both on desktop stacks two overlapping icons whose clicks
          intercept each other. Scheduled keeps it available because closing
          that page must not strand an open mobile overlay. */}
      {isMobile && showFilePanelToggle && !rightPanelOpen && (
        <button
          type="button"
          className={`right-panel-toggle-button${rightPanelOpen ? " is-open" : ""}`}
          onClick={handleRightPanelToggle}
          aria-controls="file-panel"
          aria-expanded={rightPanelOpen}
          title={rightPanelOpen ? translate("workspace.hidePanel") : translate("workspace.showPanel")}
          aria-label={rightPanelOpen ? translate("workspace.hidePanel") : translate("workspace.showPanel")}
          aria-pressed={rightPanelOpen}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>
      )}

      <div
        aria-hidden="true"
        className={`right-panel-overlay-backdrop${rightPanelOpen ? " is-open" : ""}`}
        onClick={handleRightPanelClose}
      />
      {shortcutHelpOpen && createPortal(
        <div
          className="shortcut-help-backdrop"
          onClick={toggleShortcutHelp}
        >
          <div
            className="shortcut-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={translate("shortcutHelp.title")}
            tabIndex={-1}
            ref={shortcutHelpDialogRef}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="shortcut-help-header">
              <strong>{translate("shortcutHelp.title")}</strong>
              <button
                type="button"
                className="file-workbench-icon-button"
                onClick={toggleShortcutHelp}
                aria-label={translate("i18n.close")}
                title={translate("i18n.close")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </header>
            <dl className="shortcut-help-list">
              <div><dt><kbd>Esc</kbd></dt><dd>{translate("shortcutHelp.stop")}</dd></div>
              <div><dt><kbd>⌘/Ctrl+N</kbd></dt><dd>{translate("shortcutHelp.newSession")}</dd></div>
              <div><dt><kbd>⌘/Ctrl+,</kbd></dt><dd>{translate("shortcutHelp.settings")}</dd></div>
              <div><dt><kbd>⌘/Ctrl+/</kbd></dt><dd>{translate("shortcutHelp.help")}</dd></div>
              <div><dt><kbd>⌘/Ctrl+\</kbd></dt><dd>{translate("shortcutHelp.hideWorkspace")}</dd></div>
              <div><dt><kbd>⌘/Ctrl+B</kbd></dt><dd>{translate("shortcutHelp.toggleSidebar")}</dd></div>
              <div><dt><kbd>⌘/Ctrl+L</kbd></dt><dd>{translate("shortcutHelp.focusComposer")}</dd></div>
              <div><dt><kbd>⌘/Ctrl+Enter</kbd></dt><dd>{translate("shortcutHelp.send")}</dd></div>
              <div><dt><kbd>↑</kbd></dt><dd>{translate("shortcutHelp.inputHistory")}</dd></div>
              <div><dt><kbd>Tab / →</kbd></dt><dd>{translate("shortcutHelp.acceptCompletion")}</dd></div>
            </dl>
          </div>
        </div>,
        document.body,
      )}
      {rightPanelOpen && (
        <div
          {...rightPanelResizer.separatorProps}
          inert={rightPanelFullWidth}
          aria-controls="file-panel"
          className={`panel-resize-handle right-panel-resize-handle${rightPanelResizer.isResizing ? " is-resizing" : ""}`}
          data-resize-handle="right-panel"
          title={`${translate("layout.resizeFilePanel")}: ${translate("layout.resizeHint")} · ${translate("files.closePanelHint")}`}
        />
      )}

      {/* Workspace panes stay mounted in this full-height row sibling. */}
      <div
        ref={rightPanelResizer.panelRef}
        id="file-panel"
        inert={!rightPanelOpen}
        className={`right-panel-container workspace-pane-workbench${rightPanelOpen ? " right-panel-open" : " right-panel-closed"}${rightPanelFullWidth ? " right-panel-full-width" : ""}${rightPanelResizer.isResizing ? " right-panel-resizing" : ""}`}
        style={{
          "--right-panel-width": `${rightPanelResizer.width}px`,
          display: "flex",
          flexDirection: "column",
          borderLeft: "var(--hairline) solid var(--separator)",
          background: "var(--bg)",
        } as React.CSSProperties}
      >
        <WorkspacePaneDock
          revealRequest={paneRevealRequest}
          headerDragProps={{ ...desktopChrome.dragRegionProps, ...windowDrag }}
          macWindowInset={macLightsOverPanel}
          windowControls={rightPanelOpen && !isMobile && desktopChrome.isDesktop && !desktopChrome.isMacOS ? <WindowControls /> : undefined}
          overlayControls={isMobile ? <div className="workspace-pane-mobile-controls" data-no-drag>
            <WorkspacePaneControls openPanes={openPanes} onToggle={toggleWorkspacePane} />
            <WorkspaceControlButton className="file-workbench-icon-button workspace-pane-hide-workbench"
              onClick={handleRightPanelClose} aria-controls="file-panel" label={translate("workspace.hidePanel")}>
              <PilaudeIcon name="panel" size={16} />
            </WorkspaceControlButton>
          </div> : rightPanelFullWidth ? <WorkspaceControlButton
            className="file-workbench-icon-button workspace-pane-restore-workbench"
            onClick={handleRightPanelExpandToggle} aria-controls="file-panel"
            label={translate("files.restorePanelWidth")} shortcut={desktopChrome.isMacOS ? "⌘⇧\\" : "Ctrl+Shift+\\"}
          ><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 9h5V4m11 11h-5v5M9 9 3 3m12 12 6 6" /></svg></WorkspaceControlButton> : undefined}
          expandLabel={translate("workspace.expandPane")}
          restoreLabel={translate("workspace.restorePane")}
          closeLabel={translate("workspace.hidePane", { name: "{name}" })}
          resizeColumnLabel={translate("workspace.resizePaneColumn")}
          resizeRowsLabel={translate("workspace.resizePaneRows")}
          panes={[
            {
              id: "files", title: translate("workspace.pane.files"), open: openPanes.files,
              onClose: () => hideWorkspacePane("files"),
              header: <>
                <span className="workspace-pane-title">{translate("workspace.pane.files")}</span>
                {visibleProjectCwd && <button type="button" className={`file-workbench-icon-button file-tree-toggle${fileTreeShown ? " is-active" : ""}`}
                  onClick={handleFileTreeToggle} title={translate(fileTreeShown ? "contextPanel.hideFileList" : "contextPanel.showFileList")}
                  aria-label={translate(fileTreeShown ? "contextPanel.hideFileList" : "contextPanel.showFileList")} aria-pressed={fileTreeShown}>
                  <PilaudeIcon name="folder" size={15} />
                </button>}
              </>,
              children: (filesVisible) => <>
                <div className="workspace-pane-tab-strip">
                  <TabBar tabs={filesPaneTabs} activeTabId={activeFileTabId ?? ""} onSelectTab={setActiveFileTabId} onCloseTab={handleCloseFileTab} />
                </div>
        {/* Only the active viewer is mounted. Lightweight per-tab state is restored on activation. */}
        <div ref={panelBodyRef} className="right-panel-body" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {activeArtifactTab ? (
            <ArtifactPanel
              key={activeArtifactTab.id}
              sessionId={activeArtifactTab.sessionId}
              identifier={activeArtifactTab.identifier}
              title={activeArtifactTab.title}
              versionRequest={activeArtifactTab.versionRequest}
            />
          ) : activeFileTab?.filePath ? (
            <FileViewer
              key={`${activeFileTab.id}:${activeFileTab.viewerRevision ?? 0}`}
              filePath={activeFileTab.filePath}
              cwd={visibleProjectCwd ?? undefined}
              sourceSessionId={activeFileTab.sourceSessionId}
              gitRefreshKey={explorerRefreshKey}
              initialDisplayMode={activeFileTab.initialDisplayMode}
              initialPage={activeFileTab.page}
              initialState={activeFileTab.viewerState}
              watchEnabled={rightPanelOpen && filesVisible}
              onStateChange={(viewerState) => handleFileViewerStateChange(
                activeFileTab.id,
                activeFileTab.viewerRevision ?? 0,
                viewerState,
              )}
              onMentionLines={rightPanelOpen && filesVisible ? handleFileLineMention : undefined}
              onAtMention={handleAtMention}
              onOpenFile={(filePath, page) => handleOpenFile(
                filePath,
                getFileName(filePath),
                { sourceSessionId: activeFileTab.sourceSessionId, page },
              )}
            />
          ) : (
            <div className="right-panel-empty">
              <span>{translate(artifactShelfOpen ? "pilaude.noArtifacts" : "files.noneOpen")}</span>
              {/* The file list starts hidden; offer it where the panel is empty. */}
              {visibleProjectCwd && !fileTreeShown && (
                <button type="button" className="right-panel-empty-action" onClick={handleFileTreeToggle}>
                  {translate("contextPanel.showFileList")}
                </button>
              )}
            </div>
          )}
        </div>
      
        {/* Explorer column — always-on project file tree */}
          {visibleProjectCwd && fileTreeShown && (
            <>
              <div
                {...fileTreeResizer.separatorProps}
                aria-controls="file-tree-panel"
                className={`panel-resize-handle file-tree-resize-handle${fileTreeResizer.isResizing ? " is-resizing" : ""}`}
                data-resize-handle="file-tree"
                title={`${translate("layout.resizeFileTree")}: ${translate("layout.resizeHint")}`}
              />
              <div
                ref={fileTreeResizer.panelRef}
                id="file-tree-panel"
                className="file-tree-panel"
                style={{ "--file-tree-width": `${fileTreeResizer.width}px` } as React.CSSProperties}
              >
              <div className="context-panel-files-toolbar">
                <div className="context-panel-file-filter-wrap">
                  <input
                    className="context-panel-file-filter"
                    value={fileExplorerQuery}
                    onChange={(event) => setFileExplorerQuery(event.target.value)}
                    placeholder={translate("sidebar.filterFiles")}
                    aria-label={translate("sidebar.filterFiles")}
                    spellCheck={false}
                  />
                </div>
                {changesCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setChangesCollapsed((v) => !v)}
                    title={translate("sidebar.changedFiles", { count: changesCount })}
                    aria-pressed={!changesCollapsed}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 26, height: 26, padding: 0,
                      background: changesCollapsed ? "none" : "var(--bg-selected)",
                      border: "none",
                      color: changesCollapsed ? "var(--text-dim)" : "var(--accent)",
                      cursor: "pointer", borderRadius: 5,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M3 12h6" />
                      <path d="M15 12h6" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileExplorerRef.current?.openUploadPicker()}
                  disabled={explorerUploadBusy}
                  title={translate("sidebar.uploadFilesTitle")}
                  aria-label={translate("sidebar.uploadFilesTitle")}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 26, height: 26, padding: 0,
                    background: "none", border: "none",
                    color: "var(--text-dim)", cursor: "pointer", borderRadius: 5,
                    opacity: explorerUploadBusy ? 0.6 : 1,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m17 8-5-5-5 5" />
                    <path d="M12 3v12" />
                  </svg>
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
                <FileExplorer
                  ref={fileExplorerRef}
                  cwd={visibleProjectCwd}
                  onOpenFile={handleOpenFile}
                  refreshKey={explorerRefreshKey}
                  onAtMention={handleAtMention}
                  onAtMentions={handleAtMentions}
                  onUploadBusyChange={setExplorerUploadBusy}
                  changesCollapsed={changesCollapsed}
                  onChangesCountChange={setChangesCount}
                />
              </div>
              </div>
            </>
          )}
      </div>
              </>,
            },
            {
              id: "terminal", title: translate("workspace.pane.terminal"), open: openPanes.terminal,
              onClose: () => hideWorkspacePane("terminal"),
              header: <><span className="workspace-pane-title">{translate("workspace.pane.terminal")}</span><TerminalSettingsMenu /></>,
              children: (terminalVisible) => <>
                <div className="workspace-pane-tab-strip" role="group" aria-label={translate("workspace.terminalTabs")}>
                  <TabBar tabs={terminalPaneTabs} activeTabId={activeTerminalTabId ?? ""}
                    onSelectTab={setActiveTerminalTabId} onCloseTab={handleCloseTerminalTab}
                    onNewTerminal={terminalCwd ? () => handleOpenTerminal(terminalCwd) : undefined}
                    onRestartTerminal={(id) => setTerminalTabs((tabs) => tabs.map((tab) => tab.id === id ? { ...tab, closing: "restart" } : tab))} />
                </div>
                <div className="workspace-terminal-tabs">
                  {terminalTabs.map((tab) => (
                    <div key={tab.id} hidden={tab.id !== activeTerminalTabId} className="workspace-terminal-tab">
                      <TerminalPanel tab={tab} active={rightPanelOpen && terminalVisible && tab.id === activeTerminalTabId}
                        onRestart={() => setTerminalTabs((tabs) => tabs.map((item) => item.id === tab.id ? { ...item, closing: "restart" } : item))}
                        onClosed={() => handleTerminalClosed(tab)}
                        onCloseError={() => setTerminalTabs((tabs) => tabs.map((item) => item.id === tab.id ? { ...item, closing: undefined } : item))} />
                    </div>
                  ))}
                  {!terminalTabs.length && <div className="right-panel-empty">
                    <span>{translate("workspace.terminalEmpty")}</span>
                    {terminalCwd && <button type="button" className="right-panel-empty-action" onClick={() => handleOpenTerminal(terminalCwd)}>{translate("terminal.newTerminal")}</button>}
                  </div>}
                </div>
              </>,
            },
            {
              id: "changes", title: translate("workspace.pane.changes"), open: openPanes.changes,
              customHeader: true,
              onClose: () => hideWorkspacePane("changes"),
              children: (changesVisible, chrome) => <>
                {changesWindowError && <div className="changes-window-error" role="alert">{changesWindowError}</div>}
                <ChangesPane cwd={changesCwd} visible={rightPanelOpen && changesVisible}
                  onAddFeedback={addChangesFeedback} onOpenWindow={openChangesPopout}
                  expanded={rightPanelFullWidth || chrome.expanded}
                  onExpand={rightPanelFullWidth ? handleRightPanelExpandToggle : chrome.onExpand}
                  onClose={() => hideWorkspacePane("changes")} headerExtra={chrome.overlayControls}
                  headerDragProps={{ ...desktopChrome.dragRegionProps, ...windowDrag }} />
              </>,
            },
            {
              id: "tasks", title: translate("workspace.pane.tasks"), open: openPanes.tasks,
              onClose: () => hideWorkspacePane("tasks"),
              children: <div className="workspace-tasks-content">
                {activeSessionFamily && selectedSession ? <AgentSessionPanel key={activeSessionFamily.root.id}
                  rootSession={activeSessionFamily.root} subagents={activeSessionFamily.subagents}
                  selectedSessionId={selectedSession.id} runningSessionIds={runningSessionIds}
                  onSelectSession={handleSelectSession} />
                  : <div className="right-panel-empty">{translate("workspace.noTaskSession")}</div>}
              </div>,
            },
          ]}
        />
      </div>
    </div>
    {settingsSection && (
      <SettingsPanel
        cwd={projectTrustCwd}
        sessionId={selectedSession?.id ?? null}
        initialSection={settingsSection}
        quoteSelectionEnabled={quoteSelectionEnabled}
        onQuoteSelectionChange={handleQuoteSelectionChange}
        soundEnabled={soundEnabled}
        onSoundToggle={onSoundToggle}
        onClose={() => {
          setSettingsSection(null);
          setModelsRefreshKey((key) => key + 1);
        }}
        onSessionReloaded={() => setSessionKey((key) => key + 1)}
        projectTrust={projectTrust}
        onOpenTrustDialog={openProjectTrustDialog}
        onProjectTrustChanged={handleProjectTrustChanged}
      />
    )}
    {welcomePickerOpen && <DirectoryPicker
      onCancel={() => setWelcomePickerOpen(false)}
      busy={welcomePickerBusy}
      error={welcomePickerError}
      onSelect={async (cwd) => {
        if (welcomePickerBusy) return;
        setWelcomePickerBusy(true);
        setWelcomePickerError(null);
        try {
          const response = await fetch("/api/cwd/validate", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cwd }),
          });
          const data = await response.json() as { cwd?: string; error?: string };
          if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
          handleNewSession(crypto.randomUUID(), data.cwd ?? cwd, "project");
          setWelcomePickerOpen(false);
        } catch (error) {
          setWelcomePickerError(error instanceof Error ? error.message : String(error));
        } finally { setWelcomePickerBusy(false); }
      }}
    />}
    {/* After Settings, so it opens above it (z-index 1100 over 1000) when Settings › MCP asks for it. */}
    {projectTrustDialogOpen && projectTrustCwd && (
      <ProjectTrustDialog
        cwd={projectTrustCwd}
        busy={projectTrustBusy}
        error={projectTrustError}
        onCancel={() => {
          if (!projectTrustBusy) setProjectTrustDialogOpen(false);
        }}
        onConfirm={() => void handleTrustProject()}
        onStatus={setProjectTrust}
      />
    )}
    <UpdateReminder onOpenSettings={() => setSettingsSection("general")} />
    {titleActionError && <div className="app-topbar-title-action-error native-popover app-menu" role="alert"><span>{titleActionError}</span><button type="button" className="native-icon-button" aria-label={translate("common.close")} onClick={() => setTitleActionError(null)}>×</button></div>}
    {titleDeleteSession && createPortal(<div className="app-topbar-title-delete-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !titleActionBusyRef.current) setTitleDeleteSession(null); }}>
      <div ref={titleDeleteDialogRef} className="app-topbar-title-delete-dialog native-popover app-menu" role="alertdialog" aria-modal="true" aria-labelledby="title-menu-delete-heading" aria-describedby="title-menu-delete-description" tabIndex={-1} onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        if (!buttons.length) { event.preventDefault(); return; }
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if ((event.shiftKey && at <= 0) || (!event.shiftKey && (at < 0 || at === buttons.length - 1))) { event.preventDefault(); buttons[event.shiftKey ? buttons.length - 1 : 0]?.focus(); }
      }}>
        <h2 id="title-menu-delete-heading">{translate("titleMenu.deleteHeading")}</h2>
        <p id="title-menu-delete-description">{translate("titleMenu.deleteDescription", { title: titleDeleteSession.name || titleDeleteSession.firstMessage || titleDeleteSession.id })}</p>
        {titleActionError && <p role="alert">{titleActionError}</p>}
        <div className="app-topbar-title-delete-actions"><button type="button" disabled={titleActionBusy} onClick={() => setTitleDeleteSession(null)}>{translate("chat.cancel")}</button><button type="button" className="is-danger" disabled={titleActionBusy} onClick={performTitleDelete}>{translate(titleActionBusy ? "titleMenu.deleting" : "titleMenu.delete")}</button></div>
      </div>
    </div>, document.body)}
    {outputStyle.error}
    {outputStyle.editor}
    <DomContextMenuHost />
    <AppNoticeShelf />
    </div>
    </>
  );
}
