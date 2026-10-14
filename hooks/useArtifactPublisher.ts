"use client";

import { useEffect, useMemo, useRef } from "react";
import { assistantTexts, collectArtifacts } from "@/lib/artifacts";
import { publishSessionArtifacts, setActiveArtifactSession, setArtifactFixHandler } from "@/lib/artifact-store";

type MessageLike = { role?: unknown; content?: unknown };

/**
 * Publishes the artifacts of the session ChatWindow shows, including the one
 * a streaming reply is writing, so the side panel can follow it live.
 */
export function useArtifactPublisher(
  sessionId: string | null | undefined,
  messages: readonly MessageLike[],
  streamingMessage: MessageLike | null | undefined,
  send?: (text: string) => void,
): void {
  const entries = useMemo(() => {
    const last = messages.at(-1);
    // The finished reply can be in `messages` while the stream state still
    // holds it; counting both would add a phantom version.
    const streaming = streamingMessage && streamingMessage !== last
      && JSON.stringify(streamingMessage.content) !== JSON.stringify(last?.content)
      ? [streamingMessage]
      : [];
    return collectArtifacts(assistantTexts([...messages, ...streaming]));
  }, [messages, streamingMessage]);

  useEffect(() => {
    setActiveArtifactSession(sessionId ?? null);
  }, [sessionId]);

  useEffect(() => () => setActiveArtifactSession(null), []);

  useEffect(() => {
    if (sessionId) publishSessionArtifacts(sessionId, entries);
  }, [sessionId, entries]);

  // "Fix" in a preview sends through the composer's normal path, which keeps
  // the text in the composer instead when a run is still busy.
  const sendRef = useRef(send);
  sendRef.current = send;
  const canSend = Boolean(send);
  useEffect(() => {
    if (!sessionId || !canSend) return;
    return setArtifactFixHandler(sessionId, (text) => sendRef.current?.(text));
  }, [sessionId, canSend]);
}
