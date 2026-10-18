import type { SVGProps } from "react";

const paths = {
  menu: "M4 6h16M4 12h12M4 18h9",
  panel: "M9 3v18M4 3h16v18H4z",
  back: "m13 5-7 7 7 7M6 12h15",
  forward: "m11 5 7 7-7 7M18 12H3",
  chat: "M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0Z",
  code: "m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16",
  artifacts: "M5 3h14v18H5zM8 7h8m-8 5h8m-8 5h5",
  customize: "M3 7h18M3 17h18M8 4v6m8 4v6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  folder: "M3 7h7l2 2h9v11H3zM3 7V4h7l2 3",
  terminal: "m4 6 6 6-6 6m8 0h8",
  changes: "M9 4h11M9 9h11M9 14h11M9 19h11M4 4h.01M4 9h.01M4 14h.01M4 19h.01",
  context: "M3 4h18v16H3zM9 4v16m4-12h4m-4 4h4m-4 4h4",
  globe: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
  plus: "M12 5v14M5 12h14",
  chevron: "m7 10 5 5 5-5",
  computer: "M4 4h16v12H4zM2 20h20l-2-4H4z",
  branch: "M6 3v14m0-9h8a4 4 0 0 0 4-4M8 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
} as const;

export function PilaudeIcon({ name, size = 18, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
