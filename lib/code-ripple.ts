/** Synthetic decoration only; never sample project files or conversation content. */
export const RIPPLE_GLYPHS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]<>:=/+-";

function cellPhase(column: number, row: number): number {
  let hash = Math.imul(column + 1, 374761393) ^ Math.imul(row + 1, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

function smooth(value: number): number {
  const unit = Math.min(1, Math.max(0, value));
  return unit * unit * (3 - 2 * unit);
}

function noise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const sx = smooth(x - ix), sy = smooth(y - iy);
  const top = cellPhase(ix, iy) * (1 - sx) + cellPhase(ix + 1, iy) * sx;
  const bottom = cellPhase(ix, iy + 1) * (1 - sx) + cellPhase(ix + 1, iy + 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

export type CodeLightCell = { field: number; crossing: number; cloud: number };

/** Sample the stationary light texture once when the character grid changes size. */
export function codeLightCell(x: number, y: number): CodeLightCell {
  const u = x / 150, v = y / 150;
  const bendX = noise(u * 0.72 + 7, v * 0.72 + 13) * 2.8;
  const bendY = noise(u * 0.72 + 31, v * 0.72 + 3) * 2.8;
  const flowX = u + bendX, flowY = v + bendY;
  return {
    field: noise(flowX, flowY) * 2.6 + noise(flowX * 2.1 + 19, flowY * 2.1) * 0.65,
    crossing: noise(flowX * 0.85 + 43, flowY * 1.15 + 11) * 2.2,
    cloud: smooth((noise(u * 0.48 + 5, v * 0.48 + 29) - 0.18) / 0.62),
  };
}

/** Narrow folds with a faint shoulder, carried by a continuous irregular field. */
export function codeLightInk(cell: CodeLightCell, seconds: number, phase = 0): number {
  const a = Math.sin(cell.field * Math.PI * 2 - seconds * 0.24 + phase);
  const b = Math.sin(cell.crossing * Math.PI * 2 + seconds * 0.17 - phase * 0.7);
  const folds = Math.exp(-(a * a) / 0.07) * 0.74 + Math.exp(-(b * b) / 0.1) * 0.42;
  const shoulder = Math.exp(-(a * a) / 0.5) * 0.28;
  return Math.min(1, (folds + shoulder) * (0.5 + cell.cloud * 0.5));
}

/** Several thin, uneven light fronts travel outwards over the stationary texture. */
export function rippleLightEnergy(cell: CodeLightCell, originField: number, dx: number, dy: number, radius: number, strength: number, seed: number): number {
  const angle = seed * Math.PI * 2;
  const nx = dx * Math.cos(angle) + dy * Math.sin(angle);
  const ny = -dx * Math.sin(angle) + dy * Math.cos(angle);
  const direction = Math.atan2(ny, nx);
  const spread = smooth(radius / 70);
  const distance = Math.hypot(nx * 0.92, ny * 1.04)
    + spread * ((cell.field - originField) * 92
      + radius * (0.08 * Math.sin(direction * 3 + angle) + 0.035 * Math.sin(direction * 5 - angle)));
  const arcs = 0.22 + 0.78 * smooth((Math.sin(direction * 2 + angle) + cell.cloud * 0.7 + 0.7) / 2);
  let light = 0;
  for (let front = 0; front < 3; front++) {
    const frontRadius = radius - front * 38;
    if (frontRadius <= 0) continue;
    const delta = distance - frontRadius;
    const core = Math.exp(-(delta * delta) / (2 * 7.5 ** 2));
    const tail = Math.exp(-((delta + 12) ** 2) / (2 * 15 ** 2)) * 0.14;
    light += (core + tail) * (front === 0 ? 0.9 : front === 1 ? 0.48 : 0.22) * smooth(frontRadius / 22);
  }
  return Math.min(1, light * strength * arcs);
}

/** Expansion slows gradually while the independent light envelope fades to zero. */
export function rippleLightState(age: number, lifetime: number, maxRadius: number): { radius: number; strength: number } {
  const progress = Math.min(1, Math.max(0, age / lifetime));
  const enter = smooth(age / 0.35);
  const fade = smooth((progress - 0.3) / 0.7);
  return { radius: maxRadius * (0.12 + 0.88 * (1 - (1 - progress) ** 2)), strength: enter * (1 - fade) };
}

/** Stable outside light; separate idle and click clocks are independent of paint rate. */
export function rippleGlyph(base: string, column: number, row: number, seconds: number, energy: number, seed: number, rate = 24): string {
  if (!Number.isFinite(energy) || energy < 0.035 || !Number.isFinite(seconds)) return base;
  const stagger = rate < 24 ? cellPhase(column, row) : 0;
  const epoch = Math.floor(Math.max(0, seconds) * rate + stagger);
  let hash = Math.imul(column + 1, 374761393) ^ Math.imul(row + 1, 668265263)
    ^ Math.imul(epoch + 1, 1274126177) ^ Math.floor(seed * 0x7fffffff);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  const index = ((hash ^ (hash >>> 16)) >>> 0) % (RIPPLE_GLYPHS.length - 1);
  const baseIndex = RIPPLE_GLYPHS.indexOf(base);
  return RIPPLE_GLYPHS[index >= baseIndex && baseIndex >= 0 ? index + 1 : index];
}
