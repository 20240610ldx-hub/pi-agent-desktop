/*
 * Adapted from open-claude-ui/code-examples/MediaLightboxViewer.tsx
 * (contain geometry, cursor anchor zoom, near-fit pan bounds).
 * https://github.com/Caho1/open-claude-ui — MIT License
 * Copyright (c) 2026 Caho1
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

export interface ImageViewRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ImageViewFit {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  viewport: ImageViewRect;
  maxScale: number;
}

export interface ImageViewTransform {
  scale: number;
  x: number;
  y: number;
}

export function resetImageView(): ImageViewTransform {
  return { scale: 1, x: 0, y: 0 };
}

export function fitImageView(naturalWidth: number, naturalHeight: number, viewport: ImageViewRect): ImageViewFit | null {
  if (![naturalWidth, naturalHeight, viewport.width, viewport.height].every(value => Number.isFinite(value) && value > 0)
    || !Number.isFinite(viewport.left) || !Number.isFinite(viewport.top)) return null;
  const scale = Math.min(1, viewport.width / naturalWidth, viewport.height / naturalHeight);
  if (!(scale > 0) || !Number.isFinite(1 / scale)) return null;
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
    centerX: viewport.left + viewport.width / 2,
    centerY: viewport.top + viewport.height / 2,
    viewport,
    maxScale: Math.max(2, 1 / scale),
  };
}

export function zoomImageView(
  fit: ImageViewFit | null,
  current: ImageViewTransform,
  targetScale: number,
  pointer?: { x: number; y: number },
): ImageViewTransform {
  if (!fit) return resetImageView();
  current = sanitizeTransform(fit, current);
  const scale = Math.min(fit.maxScale, Math.max(1, Number.isFinite(targetScale) ? targetScale : current.scale));
  if (scale === 1) return resetImageView();
  const ratio = scale / current.scale;
  const offsetX = pointer && Number.isFinite(pointer.x) ? pointer.x - fit.centerX : 0;
  const offsetY = pointer && Number.isFinite(pointer.y) ? pointer.y - fit.centerY : 0;
  return clampImageView(fit, {
    scale,
    x: offsetX - (offsetX - current.x) * ratio,
    y: offsetY - (offsetY - current.y) * ratio,
  });
}

function panBounds(fit: ImageViewFit, scale: number): { maxX: number; maxY: number } {
  // Keep the source's gentle near-fit pan boundary, then the true overflow.
  const factor = Math.min(1, Math.max(0, (scale - 1.05) / 0.95));
  return {
    maxX: Math.max(0, (fit.width * scale - fit.viewport.width) / 2) * factor,
    maxY: Math.max(0, (fit.height * scale - fit.viewport.height) / 2) * factor,
  };
}

function clampImageView(fit: ImageViewFit, transform: ImageViewTransform): ImageViewTransform {
  const { maxX, maxY } = panBounds(fit, transform.scale);
  return {
    scale: transform.scale,
    x: Math.min(maxX, Math.max(-maxX, transform.x)),
    y: Math.min(maxY, Math.max(-maxY, transform.y)),
  };
}

function sanitizeTransform(fit: ImageViewFit, current: ImageViewTransform): ImageViewTransform {
  const scale = Number.isFinite(current.scale) ? Math.min(fit.maxScale, Math.max(1, current.scale)) : 1;
  if (scale === 1) return resetImageView();
  return clampImageView(fit, {
    scale,
    x: Number.isFinite(current.x) ? current.x : 0,
    y: Number.isFinite(current.y) ? current.y : 0,
  });
}

export function imageViewCapabilities(fit: ImageViewFit | null, current: ImageViewTransform) {
  const transform = fit ? sanitizeTransform(fit, current) : resetImageView();
  const { maxX, maxY } = fit ? panBounds(fit, transform.scale) : { maxX: 0, maxY: 0 };
  return {
    zoomIn: Boolean(fit && transform.scale < fit.maxScale),
    zoomOut: transform.scale > 1,
    reset: transform.scale > 1 || transform.x !== 0 || transform.y !== 0,
    panLeft: transform.x > -maxX,
    panRight: transform.x < maxX,
    panUp: transform.y > -maxY,
    panDown: transform.y < maxY,
  };
}

export function wheelImageView(
  fit: ImageViewFit | null,
  current: ImageViewTransform,
  deltaY: number,
  pointer?: { x: number; y: number },
): ImageViewTransform {
  if (!fit || !Number.isFinite(deltaY)) return fit ? sanitizeTransform(fit, current) : resetImageView();
  current = sanitizeTransform(fit, current);
  // Bound the exponent before exp so a huge device delta cannot overflow.
  return zoomImageView(fit, current, current.scale * Math.exp(Math.min(50, Math.max(-50, -deltaY * 0.01))), pointer);
}

export function reconcileImageView(
  current: ImageViewTransform,
  previous: ImageViewFit | null,
  next: ImageViewFit | null,
  previousSource: string,
  nextSource: string,
): ImageViewTransform {
  if (!previous || !next || previousSource !== nextSource
    || previous.width !== next.width || previous.height !== next.height
    || previous.viewport.width !== next.viewport.width || previous.viewport.height !== next.viewport.height) return resetImageView();
  return sanitizeTransform(next, current);
}

export function panImageView(fit: ImageViewFit | null, current: ImageViewTransform, dx: number, dy: number): ImageViewTransform {
  if (!fit) return resetImageView();
  current = sanitizeTransform(fit, current);
  return clampImageView(fit, {
    scale: current.scale,
    x: current.x + (Number.isFinite(dx) ? dx : 0),
    y: current.y + (Number.isFinite(dy) ? dy : 0),
  });
}
