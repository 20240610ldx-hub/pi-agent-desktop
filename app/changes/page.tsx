"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { ChangesPane } from "@/components/ChangesPane";
import { I18nProvider, useI18n } from "@/hooks/useI18n";
import { requestChangesFeedback } from "@/lib/changes-feedback";
import { copyText } from "@/lib/clipboard";
import { closeChangesWindow } from "@/lib/desktop-native";
import { readChangesWindowView, updateChangesWindowView, type ChangesViewState } from "@/lib/changes-window-state";

const copy = {
  en: {
    loading: "Loading Changes…",
    adding: "Adding to chat draft…",
    unavailable: "Chat draft unavailable. Copy feedback to paste into chat.",
    copied: "Feedback copied. Paste it into chat.",
    copyFailed: "Copy failed. Try copying feedback again.",
    copyFeedback: "Copy feedback",
    closeFailed: "Could not close this window. Use the window close button.",
    missingView: "The saved Changes view expired or is unavailable. Showing the latest changes.",
    saveFailed: "This Changes view could not be saved. Keep this page open to preserve your current view.",
  },
  "zh-CN": {
    loading: "正在加载更改…",
    adding: "正在添加到聊天草稿…",
    unavailable: "聊天草稿不可用。请复制反馈并粘贴到聊天中。",
    copied: "反馈已复制。请粘贴到聊天中。",
    copyFailed: "复制失败，请重试。",
    copyFeedback: "复制反馈",
    closeFailed: "无法关闭此窗口。请使用窗口关闭按钮。",
    missingView: "保存的更改视图已过期或不可用，现显示最新更改。",
    saveFailed: "无法保存此更改视图。请保持页面打开，以保留当前视图。",
  },
  "zh-TW": {
    loading: "正在載入變更…",
    adding: "正在加入聊天草稿…",
    unavailable: "聊天草稿無法使用。請複製回饋並貼到聊天中。",
    copied: "回饋已複製。請貼到聊天中。",
    copyFailed: "複製失敗，請重試。",
    copyFeedback: "複製回饋",
    closeFailed: "無法關閉此視窗。請使用視窗關閉按鈕。",
    missingView: "儲存的變更檢視已過期或無法使用，目前顯示最新變更。",
    saveFailed: "無法儲存此變更檢視。請保持頁面開啟，以保留目前檢視。",
  },
};

type FeedbackStatus = {
  text: string;
  message: "adding" | "unavailable" | "copied" | "copyFailed";
  canCopy: boolean;
};

function ChangesWindowContent({ cwd, targetId, viewId, initialViewState }: { cwd: string; targetId?: string; viewId?: string; initialViewState?: ChangesViewState }) {
  const { locale } = useI18n();
  const words = copy[locale as keyof typeof copy] ?? copy.en;
  const [feedback, setFeedback] = useState<FeedbackStatus | null>(null);
  const [viewError, setViewError] = useState(false);
  const [windowError, setWindowError] = useState(false);
  const feedbackRequest = useRef(0);
  useEffect(() => () => { feedbackRequest.current++; }, []);

  const addFeedback = useCallback(async (text: string) => {
    const request = ++feedbackRequest.current;
    setFeedback({ text, message: "adding", canCopy: false });
    const delivered = await requestChangesFeedback({ targetId, cwd, text }).catch(() => false);
    if (request !== feedbackRequest.current) return false;
    // The pane reports acknowledged success. Keep this extra status for
    // pending delivery and the explicit clipboard fallback only.
    setFeedback(delivered ? null : {
      text,
      message: "unavailable",
      canCopy: true,
    });
    return delivered;
  }, [cwd, targetId]);

  const copyFeedback = useCallback(async () => {
    if (!feedback) return;
    const request = ++feedbackRequest.current;
    try {
      await copyText(feedback.text);
      if (request === feedbackRequest.current) {
        setFeedback({ ...feedback, message: "copied", canCopy: false });
      }
    } catch {
      if (request === feedbackRequest.current) {
        setFeedback({ ...feedback, message: "copyFailed", canCopy: true });
      }
    }
  }, [feedback]);

  const saveView = useCallback((state: ChangesViewState) => {
    if (!viewId) return;
    try {
      updateChangesWindowView(viewId, cwd, targetId, state);
      setViewError(false);
    } catch { setViewError(true); }
  }, [viewId, cwd, targetId]);
  const missingView = !initialViewState;
  const statusMessage = windowError ? words.closeFailed : viewError ? words.saveFailed : feedback ? words[feedback.message] : missingView ? words.missingView : undefined;
  return (
    <main style={{ height: "100dvh", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--text)" }}>
      <ChangesPane
        cwd={cwd}
        visible
        expanded
        onAddFeedback={addFeedback}
        initialViewState={initialViewState}
        onViewStateChange={saveView}
        onClose={() => { void closeChangesWindow().catch(() => setWindowError(true)); }}
        headerExtra={feedback || windowError || viewError || missingView ? (
          <span role="status" aria-live="polite" style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, maxWidth: "min(30vw, 320px)", fontSize: 12, color: "var(--text-muted)" }}>
            <span title={statusMessage} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{statusMessage}</span>
            {feedback?.canCopy && <button type="button" style={{ flexShrink: 0 }} onClick={() => { void copyFeedback(); }}>{words.copyFeedback}</button>}
          </span>
        ) : undefined}
      />
    </main>
  );
}

const subscribeHydration = () => () => {};
function ChangesWindowRoute() {
  const params = useSearchParams();
  // Server HTML cannot read localStorage. Mount the stateful pane only after
  // hydration so saved commit/sidebar state cannot mismatch the server markup.
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  if (!hydrated) return <ChangesLoading />;
  const cwd = params.get("cwd") ?? "";
  const targetId = params.get("targetId") || undefined;
  const viewId = params.get("viewId") || undefined;
  const retained = viewId ? readChangesWindowView(viewId, cwd, targetId) : null;
  return <ChangesWindowContent key={JSON.stringify([cwd, targetId, viewId])} cwd={cwd} targetId={targetId} viewId={viewId} initialViewState={retained?.state} />;
}

function ChangesLoading() {
  const { locale } = useI18n();
  return <main role="status">{(copy[locale as keyof typeof copy] ?? copy.en).loading}</main>;
}

export default function ChangesPage() {
  return (
    <I18nProvider>
      <Suspense fallback={<ChangesLoading />}>
        <ChangesWindowRoute />
      </Suspense>
    </I18nProvider>
  );
}
