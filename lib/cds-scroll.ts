/** Adapted from open-claude-ui/useClaudeScrollPinning.ts (MIT, Caho1).
 * Keep user input authoritative while streamed tokens change the scroll height.
 */
export function canFollowStream(lastUserInputAt: number, now: number): boolean {
  return now - lastUserInputAt > 150;
}
