"use client";

import { useEffect, useRef } from "react";

// Fixed synthetic alphabet: no documents, source files, or user text are sampled.
const GLYPHS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]<>:=/+-";
const TAU = Math.PI * 2;
const FRAME_INTERVAL = 1000 / 30;
const MAX_RIPPLES = 6;
const MAX_CELLS = 26_000;
// Shared by the visible canvas and its isolated character layer.
const MAX_BACKING_PIXELS = 8_000_000;

type GridAxis = {
  position: number;
  unit: number;
  center: number;
  breadth: number;
  strength: number;
  drift: number;
  bend: number;
};
type Cell = { column: number; row: number; glyph: string; weight: number };
type Ripple = {
  x: number;
  y: number;
  startedAt: number;
  lifetime: number;
  speed: number;
  band: number;
  wavelength: number;
  phase: number;
  asymmetry: number;
  cos: number;
  sin: number;
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
    let opacity = 0.12;
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
        : dark ? 0.14 : 0.12;
      const mono = styles.getPropertyValue("--font-mono").trim();
      font = `9.5px ${mono || "ui-monospace, Consolas, monospace"}`;
    }

    function makeGrid() {
      cells = [];
      columns = [];
      rows = [];
      // Dense 5.7px character advance / 11px lines at normal window sizes.
      // Larger surfaces spread the sample lattice instead of growing memory forever.
      const spacing = Math.max(1, Math.sqrt((width * height) / (5.7 * 11 * MAX_CELLS)));
      const stepX = 5.7 * spacing;
      const stepY = 11 * spacing;
      const axis = (position: number, size: number): GridAxis => ({
        position, unit: position / size, center: 0, breadth: 0,
        strength: 0, drift: 0, bend: 0,
      });
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
          });
        }
      }
    }

    function shapeStreams(time: number) {
      // Shared row/column curves preserve continuous lines instead of per-cell jitter.
      for (const column of columns) {
        const u = column.unit;
        column.center = height * (0.17 + 0.115 * Math.cos((u - 0.48) * 4.5)
          + 0.018 * Math.sin(u * 6.8 + time * 0.11));
        column.breadth = Math.max(30, Math.min(74, height * (0.078 + 0.012 * Math.sin(u * 5.3 - time * 0.08))));
        column.strength = Math.exp(-(((u - 0.69) / 0.31) ** 4))
          * (0.76 + 0.24 * Math.sin(u * 3.2 + time * 0.07) ** 2);
        column.drift = Math.cos(u * 6.2 + time * 0.1) * 2.5;
        column.bend = Math.sin(u * 7.4 - time * 0.13) * 3.2;
      }
      for (const row of rows) {
        const v = row.unit;
        row.center = width * (0.21 + 0.082 * Math.sin(v * 7.2 - 1.25)
          + 0.026 * Math.sin(v * 13.2 + 0.8 + time * 0.065)
          + 0.018 * Math.sin(v * 5.5 - time * 0.12));
        row.breadth = Math.max(28, Math.min(82, width * (0.062 + 0.009 * Math.sin(v * 6.8 + time * 0.09))));
        row.strength = Math.exp(-(((v - 0.65) / 0.48) ** 4));
        row.drift = Math.sin(v * 7.8 + time * 0.12) * 3;
        row.bend = Math.cos(v * 5.6 - time * 0.1) * 1.3;
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
      shapeStreams(time);
      for (let index = ripples.length - 1; index >= 0; index--) {
        if (time - ripples[index].startedAt >= ripples[index].lifetime) ripples.splice(index, 1);
      }
      const waves = ripples.map((ripple) => {
        const age = Math.max(0, time - ripple.startedAt);
        return {
          ...ripple,
          originX: ripple.x * width,
          originY: ripple.y * height,
          radius: age * ripple.speed,
          strength: Math.min(1, age * 4) * (1 - age / ripple.lifetime) ** 2,
        };
      });

      for (const cell of cells) {
        const column = columns[cell.column];
        const row = rows[cell.row];
        const x = column.position;
        const y = row.position;
        const acrossTop = (y - column.center) / column.breadth;
        const acrossLeft = (x - row.center) / row.breadth;
        const top = Math.exp(-(acrossTop * acrossTop)) * column.strength;
        const left = Math.exp(-(acrossLeft * acrossLeft)) * row.strength * 0.9;
        const mask = 1 - (1 - top) * (1 - left);
        // No ambient symbol wall: the space between streams is effectively empty.
        if (mask < 0.018 || cell.weight === 0) continue;
        let field = 0;
        let offsetX = 0;
        let offsetY = 0;
        for (const wave of waves) {
          const dx = x - wave.originX;
          const dy = y - wave.originY;
          const distance = Math.hypot(dx, dy);
          const unitX = dx / Math.max(1, distance);
          const unitY = dy / Math.max(1, distance);
          const nx = unitX * wave.cos + unitY * wave.sin;
          const ny = -unitX * wave.sin + unitY * wave.cos;
          const warp = 1 + wave.asymmetry * (nx * (nx * nx - 3 * ny * ny) + nx * ny);
          const delta = distance * warp - wave.radius;
          if (Math.abs(delta) > wave.band * 3) continue;
          const envelope = Math.exp(-(delta * delta) / (2 * wave.band * wave.band));
          const value = Math.cos(delta / wave.wavelength * TAU + wave.phase) * envelope * wave.strength;
          field += value;
          // A tangential component bends the lines instead of drawing perfect rings.
          offsetX += (unitX - unitY * wave.asymmetry * 3) * value * 7;
          offsetY += (unitY + unitX * wave.asymmetry * 3) * value * 5;
        }
        const topVein = Math.sin(acrossTop * 3.3 + column.unit * 9.5 - time * 0.11);
        const leftVein = Math.sin(acrossLeft * 3.6 - row.unit * 8.8 + time * 0.09);
        const filament = (top * topVein + left * leftVein) / Math.max(0.001, top + left);
        const intensity = Math.min(0.9, (0.64 + filament * 0.16 + Math.abs(field) * 0.45)
          * mask ** 1.35);
        inkContext!.globalAlpha = opacity * cell.weight * intensity;
        inkContext!.fillText(cell.glyph,
          x + row.drift * left + column.drift * top + offsetX,
          y + column.bend * top + row.bend * left + offsetY);
      }
      inkContext!.globalAlpha = 1;
      // These are copies of sparse character ink, never a blur of the full page.
      context!.filter = "blur(1.3px)";
      context!.globalAlpha = 0.13;
      context!.drawImage(ink, 0, 0, width, height);
      context!.filter = "blur(0.5px)";
      context!.globalAlpha = 0.09;
      context!.drawImage(ink, 2.4, 3.2, width, height);
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
      const bounds = canvas!.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      const rotation = Math.random() * TAU;
      const speed = 125 + Math.random() * 60;
      if (ripples.length >= MAX_RIPPLES) ripples.shift();
      ripples.push({
        x, y, startedAt: elapsed, speed,
        lifetime: Math.max(3, Math.min(9, (Math.hypot(width, height) + 160) / speed)),
        band: 26 + Math.random() * 24,
        wavelength: 38 + Math.random() * 28,
        phase: Math.random() * TAU,
        asymmetry: 0.08 + Math.random() * 0.16,
        cos: Math.cos(rotation),
        sin: Math.sin(rotation),
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
