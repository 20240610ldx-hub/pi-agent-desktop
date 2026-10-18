"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChangesPane } from "@/components/ChangesPane";
import { I18nProvider, useI18n } from "@/hooks/useI18n";
import { requestChangesFeedback } from "@/lib/changes-feedback";
import { copyText } from "@/lib/clipboard";
import { closeChangesWindow } from "@/lib/desktop-native";

const copy = {
  en: {
    loading: "Loading Changes…",
    adding: "Adding to chat draft…",
    unavailable: "Chat draft unavailable. Copy feedback to paste into chat.",
    copied: "Feedback copied. Paste it into chat.",
    copyFailed: "Copy failed. Try copying feedback again.",
    copyFeedback: "Copy feedback",
    closeFailed: "Could not close this window. Use the window close button.",
  },
  "zh-CN": {
    loading: "正在加载更改…",
    adding: "正在添加到聊天草稿…",
    unavailable: "聊天草稿不可用。请复制反馈并粘贴到聊天中。",
    copied: "反馈已复制。请粘贴到聊天中。",
    copyFailed: "复制失败，请重试。",
    copyFeedback: "复制反馈",
    closeFailed: "无法关闭此窗口。请使用窗口关闭按钮。",
  },
  "zh-TW": {
    loading: "正在載入變更…",
    adding: "正在加入聊天草稿…",
    unavailable: "聊天草稿無法使用。請複製回饋並貼到聊天中。",
    copied: "回饋已複製。請貼到聊天中。",
    copyFailed: "複製失敗，請重試。",
    copyFeedback: "複製回饋",
    closeFailed: "無法關閉此視窗。請使用視窗關閉按鈕。",
  },
};

type FeedbackStatus = {
  text: string;
  message: "adding" | "unavailable" | "copied" | "copyFailed";
  canCopy: boolean;
};

function ChangesWindowContent({ cwd, targetId }: { cwd: string; targetId?: string }) {
  const { locale } = useI18n();
  const words = copy[locale as keyof typeof copy] ?? copy.en;
  const [feedback, setFeedback] = useState<FeedbackStatus | null>(null);
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

  const statusMessage = windowError ? words.closeFailed : feedback ? words[feedback.message] : undefined;
  return (
    <main style={{ height: "100dvh", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--text)" }}>
      <ChangesPane
        cwd={cwd}
        visible
        expanded
        onAddFeedback={addFeedback}
        onClose={() => { void closeChangesWindow().catch(() => setWindowError(true)); }}
        headerExtra={feedback || windowError ? (
          <span role="status" aria-live="polite" style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, maxWidth: "min(30vw, 320px)", fontSize: 12, color: "var(--text-muted)" }}>
            <span title={statusMessage} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{statusMessage}</span>
            {feedback?.canCopy && <button type="button" style={{ flexShrink: 0 }} onClick={() => { void copyFeedback(); }}>{words.copyFeedback}</button>}
          </span>
        ) : undefined}
      />
    </main>
  );
}

function ChangesWindowRoute() {
  const params = useSearchParams();
  const cwd = params.get("cwd") ?? "";
  const targetId = params.get("targetId") || undefined;
  return <ChangesWindowContent key={JSON.stringify([cwd, targetId])} cwd={cwd} targetId={targetId} />;
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
