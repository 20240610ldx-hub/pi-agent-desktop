"use client";

import { useEffect, useRef } from "react";
import { RIPPLE_GLYPHS as GLYPHS, codeLightCell, codeLightInk, rippleGlyph, rippleLightState, rippleLightEnergy, type CodeLightCell } from "@/lib/code-ripple";
const FRAME_INTERVAL = 1000 / 30;
const MAX_RIPPLES = 6;
const MAX_CELLS = 26_000;
// Shared by the visible canvas and its isolated character layer.
const MAX_BACKING_PIXELS = 8_000_000;

type GridAxis = { position: number; unit: number };
type Cell = { column: number; row: number; glyph: string; weight: number; light: CodeLightCell };
type Ripple = {
  x: number;
  y: number;
  startedAt: number;
  lifetime: number;
  maxRadius: number;
  originField: number;
  seed: number;
};

function cellNoise(column: number, row: number): number {
  let value = Math.imul(column + 1, 374761393) ^ Math.imul(row + 1, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** Decorative, full-parent background. Mount inside a positioned, sized container. */
export function PilaudeCodeRipple() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const context = canvas?.getContext("2d");
    if (!canvas || !parent || !context) return;
    // Soften only the masked character ink; the sharp pass and page stay crisp.
    const ink = document.createElement("canvas");
    const inkContext = ink.getContext("2d");
    if (!inkContext) return;

    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionQuery?.matches ?? false;
    let intersecting = typeof IntersectionObserver === "undefined";
    let disposed = false;
    let width = 0;
    let height = 0;
    let pixelRatio = 0;
    let cells: Cell[] = [];
    let columns: GridAxis[] = [];
    let rows: GridAxis[] = [];
    const ripples: Ripple[] = [];
    let color = "#536d83";
    let fallbackColor = color;
    let opacity = 0.26;
    let waveOpacity = 0.88;
    let font = "9.5px ui-monospace, Consolas, monospace";
    let frameId: number | null = null;
    let previousTick: number | null = null;
    let previousPaint: number | null = null;
    // Active time freezes while hidden/offscreen, so waves resume without a jump.
    let elapsed = 0;

    function readTheme() {
      const styles = window.getComputedStyle(canvas!);
      const dark = canvas!.closest("[data-theme]")?.getAttribute("data-theme") === "dark";
      fallbackColor = dark ? "#7893b2" : "#536d83";
      color = styles.getPropertyValue("--pilaude-ripple-color").trim() || fallbackColor;
      const rawOpacity = styles.getPropertyValue("--pilaude-ripple-opacity").trim();
      const parsedOpacity = Number.parseFloat(rawOpacity) / (rawOpacity.endsWith("%") ? 100 : 1);
      opacity = Number.isFinite(parsedOpacity)
        ? Math.min(1, Math.max(0, parsedOpacity))
        : dark ? 0.32 : 0.24;
      const rawWaveOpacity = Number.parseFloat(styles.getPropertyValue("--pilaude-ripple-wave-opacity"));
      waveOpacity = Number.isFinite(rawWaveOpacity) ? Math.min(1, Math.max(0, rawWaveOpacity)) : 0.88;
      const mono = styles.getPropertyValue("--font-mono").trim();
      font = `9.5px ${mono || "ui-monospace, Consolas, monospace"}`;
    }

    function makeGrid() {
      cells = [];
      columns = [];
      rows = [];
      // Dense 6px character advance / 12px lines at normal window sizes.
      // Larger surfaces spread the sample lattice instead of growing memory forever.
      const spacing = Math.max(1, Math.sqrt((width * height) / (6 * 12 * MAX_CELLS)));
      const stepX = 6 * spacing;
      const stepY = 12 * spacing;
      const axis = (position: number, size: number): GridAxis => ({ position, unit: position / size });
      for (let column = 0; column < Math.floor(width / stepX); column++) {
        columns.push(axis((column + 0.5) * stepX, width));
      }
      for (let row = 0; row < Math.floor(height / stepY); row++) {
        rows.push(axis((row + 0.5) * stepY, height));
      }
      for (let row = 0; row < rows.length; row++) {
        for (let column = 0; column < columns.length; column++) {
          const seed = cellNoise(column, row);
          const x = columns[column].position;
          const y = rows[row].position;
          const edge = Math.min(1, Math.min(x, y, width - x, height - y) / 36);
          cells.push({
            column, row,
            glyph: GLYPHS[Math.floor(seed * GLYPHS.length)],
            weight: (0.68 + seed * 0.32) * edge,
            light: codeLightCell(x, y),
          });
        }
      }
    }

    function canPaint() {
      return !disposed && !document.hidden && intersecting && width > 0 && height > 0;
    }

    function paint() {
      context!.clearRect(0, 0, width, height);
      inkContext!.clearRect(0, 0, width, height);
      if (opacity === 0) return;
      inkContext!.font = font;
      inkContext!.textAlign = "center";
      inkContext!.textBaseline = "middle";
      // Invalid custom colors leave the safe fallback in place.
      inkContext!.fillStyle = fallbackColor;
      inkContext!.fillStyle = color;
      const time = reducedMotion ? 0 : elapsed;
      for (let index = ripples.length - 1; index >= 0; index--) {
        if (time - ripples[index].startedAt >= ripples[index].lifetime) ripples.splice(index, 1);
      }
      const waves = ripples.map((ripple) => {
        const age = Math.max(0, time - ripple.startedAt);
        return {
          ...ripple,
          age,
          originX: ripple.x * width,
          originY: ripple.y * height,
          ...rippleLightState(age, ripple.lifetime, ripple.maxRadius),
        };
      });

      for (const cell of cells) {
        const column = columns[cell.column];
        const row = rows[cell.row];
        const x = column.position;
        const y = row.position;
        if (cell.weight === 0) continue;
        const texture = codeLightInk(cell.light, time);
        const ambientEnergy = texture * (0.18 + cell.light.cloud * 0.82);
        let waveEnergy = 0;
        let waveSeed = 0;
        for (const wave of waves) {
          const dx = x - wave.originX;
          const dy = y - wave.originY;
          const energy = rippleLightEnergy(cell.light, wave.originField, dx, dy, wave.radius, wave.strength, wave.seed);
          if (energy > waveEnergy) { waveEnergy = energy; waveSeed = wave.seed; }
        }
        // A faint full field stays visible beneath the narrow, moving light paths.
        const ambient = opacity * (0.1 + ambientEnergy * 0.9);
        const sweep = waveOpacity * waveEnergy;
        const litEnergy = Math.max(waveEnergy, ambientEnergy >= 0.18 ? ambientEnergy * 0.65 : 0);
        const glyphRate = waveEnergy >= 0.035 ? 24 : 6;
        const glyph = reducedMotion ? cell.glyph : rippleGlyph(cell.glyph, cell.column, cell.row, time, litEnergy, waveSeed, glyphRate);
        // Quiet characters are neutral; only passing click light contributes blue ink.
        inkContext!.fillStyle = "#929598";
        inkContext!.globalAlpha = cell.weight * ambient;
        inkContext!.fillText(glyph, x, y);
        if (sweep > 0.003) {
          inkContext!.fillStyle = fallbackColor;
          inkContext!.fillStyle = color;
          inkContext!.globalAlpha = cell.weight * Math.min(0.96, sweep);
          inkContext!.fillText(glyph, x, y);
        }
      }
      inkContext!.globalAlpha = 1;
      // These are copies of sparse character ink, never a blur of the full page.
      context!.filter = "blur(1.3px)";
      context!.globalAlpha = 0.13;
      context!.drawImage(ink, 0, 0, width, height);
      context!.filter = "none";
      context!.globalAlpha = 0.84;
      context!.drawImage(ink, 0, 0, width, height);
      context!.globalAlpha = 1;
    }

    function stopAnimation() {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      previousTick = null;
      previousPaint = null;
    }

    function frame(now: number) {
      frameId = null;
      if (!canPaint() || reducedMotion || opacity === 0) {
        stopAnimation();
        return;
      }
      if (previousTick !== null) elapsed += Math.min(0.1, Math.max(0, (now - previousTick) / 1000));
      previousTick = now;
      if (previousPaint === null || now - previousPaint >= FRAME_INTERVAL - 0.25) {
        paint();
        const remainder = previousPaint === null ? 0
          : Math.max(0, now - previousPaint - FRAME_INTERVAL) % FRAME_INTERVAL;
        previousPaint = now - remainder;
      }
      frameId = window.requestAnimationFrame(frame);
    }

    function refresh() {
      if (!canPaint()) {
        stopAnimation();
        return;
      }
      paint();
      if (reducedMotion || opacity === 0) {
        stopAnimation();
      } else if (frameId === null) {
        frameId = window.requestAnimationFrame(frame);
      }
    }

    function resizeCanvas() {
      if (disposed) return;
      const nextWidth = canvas!.clientWidth;
      const nextHeight = canvas!.clientHeight;
      const nextRatio = Math.min(window.devicePixelRatio || 1, 2,
        Math.sqrt(MAX_BACKING_PIXELS / Math.max(1, nextWidth * nextHeight * 2)));
      const sizeChanged = width !== nextWidth || height !== nextHeight;
      if (sizeChanged || pixelRatio !== nextRatio) {
        width = nextWidth;
        height = nextHeight;
        pixelRatio = nextRatio;
        canvas!.width = ink.width = Math.max(1, Math.floor(width * pixelRatio));
        canvas!.height = ink.height = Math.max(1, Math.floor(height * pixelRatio));
        context!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        inkContext!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        if (sizeChanged) makeGrid();
      }
      refresh();
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0 || reducedMotion || !canPaint() || opacity === 0) return;
      if (event.target instanceof Element && event.target.closest("button, a, input, textarea, select, [role='button'], [role='tab'], [contenteditable]")) return;
      const bounds = canvas!.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      const maxRadius = Math.min(300, Math.min(width, height) * 0.42);
      if (ripples.length >= MAX_RIPPLES) ripples.shift();
      ripples.push({
        x, y, startedAt: elapsed,
        maxRadius, lifetime: 3.6 + Math.random() * 0.5,
        originField: codeLightCell(x * width, y * height).field,
        seed: Math.random(),
      });
    }

    function onThemeChange() {
      if (disposed) return;
      readTheme();
      refresh();
    }

    function onMotionChange() {
      if (disposed) return;
      reducedMotion = motionQuery?.matches ?? false;
      ripples.length = 0;
      refresh();
    }

    function onVisibilityChange() {
      if (document.hidden) stopAnimation();
      else {
        readTheme();
        resizeCanvas();
      }
    }

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resizeCanvas);
    const intersectionObserver = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      if (disposed) return;
      const entry = entries.find((entry) => entry.target === canvas);
      if (!entry) return;
      intersecting = entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0;
      if (intersecting) resizeCanvas();
      else stopAnimation();
    });
    const themeObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(onThemeChange);
    // Observe only the inheritance chain, including locally scoped data-theme overrides.
    for (let ancestor: HTMLElement | null = canvas; ancestor; ancestor = ancestor.parentElement) {
      themeObserver?.observe(ancestor, { attributes: true, attributeFilter: ["data-theme"] });
    }
    resizeObserver?.observe(parent);
    intersectionObserver?.observe(canvas);
    parent.addEventListener("pointerdown", onPointerDown, { passive: true });
    motionQuery?.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", resizeCanvas);
    readTheme();
    resizeCanvas();

    return () => {
      disposed = true;
      stopAnimation();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      themeObserver?.disconnect();
      parent.removeEventListener("pointerdown", onPointerDown);
      motionQuery?.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", resizeCanvas);
      ripples.length = 0;
      cells = [];
      columns = [];
      rows = [];
      ink.width = ink.height = 1;
    };
  }, []);

  return <canvas ref={canvasRef} className="pilaude-code-ripple" aria-hidden="true" />;
}
