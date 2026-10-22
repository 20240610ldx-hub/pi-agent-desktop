/** Adapted from open-claude-ui/useClaudeScrollPinning.ts (MIT, Caho1).
 * Keep user input authoritative while streamed tokens change the scroll height.
 */
export function canFollowStream(lastUserInputAt: number, now: number): boolean {
  return now - lastUserInputAt > 150;
}

/**
 * While a run streams and the view is still attached to the tail, the gap to
 * the bottom is only the follow loop lagging a frame behind new tokens, so the
 * "back to latest" button stays hidden instead of flashing on every chunk.
 */
export function revealScrollToLatest(detachedFromTail: boolean, followingStream: boolean): boolean {
  return detachedFromTail && !followingStream;
}
