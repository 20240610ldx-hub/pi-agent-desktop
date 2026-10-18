/** Adapted from open-claude-ui/AttachmentCard.tsx (MIT, Copyright 2026 Caho1).
 * Preserve the last extension separately from the shrinking filename prefix.
 * CSS owns truncation; source labels never lose Unicode graphemes or path identity.
 */
export function splitFileName(name: string): { stem: string; extension: string } {
  const fileStart = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\")) + 1;
  const dot = name.lastIndexOf(".");
  if (dot <= fileStart || dot === name.length - 1) return { stem: name, extension: "" };
  return { stem: name.slice(0, dot), extension: name.slice(dot) };
}
