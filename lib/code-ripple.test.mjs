import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";

const rippleSource = readFileSync(new URL("../components/PilaudeCodeRipple.tsx", import.meta.url), "utf8");
const rippleAst = ts.createSourceFile("PilaudeCodeRipple.tsx", rippleSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function findNode(node, predicate) {
  return predicate(node) ? node : ts.forEachChild(node, child => findNode(child, predicate));
}

test("only the home background creates click light; controls and their icons do not", () => {
  const pointer = findNode(rippleAst, node => ts.isFunctionDeclaration(node) && node.name?.text === "onPointerDown");
  assert.ok(pointer);
  class Element {
    constructor(interactive) { this.interactive = interactive; }
    closest() { return this.interactive ? {} : null; }
  }
  const ripples = [];
  const source = ts.transpileModule(`(${pointer.getText(rippleAst)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const onPointerDown = new Script(source).runInNewContext({
    Element, ripples, reducedMotion: false, opacity: 0.62, canPaint: () => true,
    width: 1000, height: 800, elapsed: 0, MAX_RIPPLES: 6, TAU: Math.PI * 2,
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800 }) },
    codeLightCell: () => ({ field: 0 }),
  });
  for (const label of ["project button", "model settings", "tab", "SVG icon inside button"]) {
    onPointerDown({ button: 0, target: new Element(true), clientX: 500, clientY: 400 });
    assert.equal(ripples.length, 0, `${label} must not start a ripple`);
  }
  onPointerDown({ button: 0, target: new Element(false), clientX: 500, clientY: 400 });
  assert.equal(ripples.length, 1);
  assert.ok(ripples[0].maxRadius > 100 && ripples[0].maxRadius <= 300);
  assert.ok(ripples[0].lifetime >= 3.6 && ripples[0].lifetime <= 4.1);
});

test("symbols change continuously under ambient light and stabilize outside it", async () => {
  const { rippleGlyph } = await import("./code-ripple.ts");
  const lit = Array.from({ length: 24 }, (_, tick) => rippleGlyph("a", 12, 8, tick / 24, 0.8, 0.4, 6));
  const dark = Array.from({ length: 24 }, (_, tick) => rippleGlyph("a", 12, 8, tick / 24, 0, 0.4, 6));
  const click = Array.from({ length: 24 }, (_, tick) => rippleGlyph("a", 12, 8, tick / 24, 0.8, 0.4));
  assert.ok(new Set(lit).size >= 4 && new Set(lit).size <= 7, "Illuminated ambient symbols change continuously at a moderate cadence");
  assert.deepEqual([...new Set(dark)], ["a"], "Unilluminated symbols stay stable");
  assert.ok(new Set(click).size >= 12, "Click-local symbols retain the faster sequence");
});

test("light folds form a continuous irregular texture and change without moving its sample points", async () => {
  const { codeLightCell, codeLightInk } = await import("./code-ripple.ts");
  const sample = codeLightCell(250, 180);
  assert.deepEqual(codeLightCell(250, 180), sample);
  const adjacent = codeLightCell(250.01, 180.01);
  assert.ok(Math.abs(sample.field - adjacent.field) < 0.01);
  const values = Array.from({ length: 48 }, (_, index) => codeLightInk(sample, index / 6));
  assert.ok(values.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  assert.ok(Math.max(...values) - Math.min(...values) > 0.1);
  const angles = Array.from({ length: 24 }, (_, index) => {
    const angle = index * Math.PI / 12;
    return codeLightInk(codeLightCell(300 + Math.cos(angle) * 100, 250 + Math.sin(angle) * 100), 1);
  });
  assert.ok(Math.max(...angles) - Math.min(...angles) > 0.15, "Equal-radius points must not form a uniformly bright circular edge");
});

test("click light has multiple thin fronts that visibly travel away from its origin", async () => {
  const { codeLightCell, rippleLightEnergy } = await import("./code-ripple.ts");
  const origin = codeLightCell(300, 250);
  const profile = radius => Array.from({ length: 500 }, (_, dx) => rippleLightEnergy(codeLightCell(300 + dx, 250), origin.field, dx, 0, radius, 1, 0.3));
  const first = profile(90), later = profile(170);
  const peak = values => values.indexOf(Math.max(...values));
  assert.ok(peak(later) > peak(first) + 30, "The brightest front must propagate, rather than only brighten an area");
  assert.ok(later[0] < 0.03, "The clicked center does not remain a filled bright disc");
  const peaks = later.flatMap((value, index) => value > 0.08 && value > (later[index - 1] ?? 0) && value > (later[index + 1] ?? 0) ? [index] : []);
  assert.ok(peaks.length >= 2, "Following narrow fronts remain separately visible");
  assert.ok(Math.min(...later.slice(peaks[0], peaks[1])) < Math.min(later[peaks[0]], later[peaks[1]]) * 0.6, "A dark valley separates the two travelling fronts");
});

test("click light spreads gently and fades without a sudden terminal edge", async () => {
  const { rippleLightState } = await import("./code-ripple.ts");
  const frames = Array.from({ length: 91 }, (_, frame) => rippleLightState(frame / 30, 3, 200));
  assert.equal(frames[0].strength, 0, "Click light enters continuously");
  assert.ok(frames[30].strength > 0.8, "The ripple remains visible after one second");
  assert.ok(frames[60].strength > 0.25, "The ripple has a gentle tail after two seconds");
  assert.ok(frames.every((state, i) => i === 0 || state.radius >= frames[i - 1].radius));
  assert.ok(frames[30].radius - frames[29].radius > frames[60].radius - frames[59].radius, "Expansion slows gradually");
  assert.ok(frames[89].strength < 0.002, "Light is already imperceptible before its lifetime ends");
  assert.equal(frames[90].strength, 0);
  assert.ok(frames.every((state, i) => i === 0 || Math.abs(state.strength - frames[i - 1].strength) < 0.2), "No single frame abruptly turns the ring on or off");
});

test("ripple glyphs change quickly only where a live wave passes", async () => {
  const { rippleGlyph, RIPPLE_GLYPHS } = await import("./code-ripple.ts");
  for (const energy of [0, 0.01, NaN]) {
    assert.equal(rippleGlyph("a", 12, 8, 0.25, energy, 0.4), "a");
    assert.equal(rippleGlyph("a", 12, 8, 4.2, energy, 0.4), "a");
  }
  const frames = Array.from({ length: 12 }, (_, tick) => rippleGlyph("a", 12, 8, tick / 24, 0.8, 0.4));
  assert.ok(new Set(frames).size >= 8, "An illuminated character must not stay fixed across the sweep");
  assert.ok(frames.every(glyph => RIPPLE_GLYPHS.includes(glyph) && glyph !== "a"));
  assert.equal(rippleGlyph("a", 12, 8, 0.251, 0.8, 0.4), rippleGlyph("a", 12, 8, 0.26, 0.8, 0.4), "Same 24Hz epoch stays stable regardless of paint frequency");
  assert.equal(rippleGlyph("a", 12, 8, 0.5, 0, 0.4), "a", "The original background character returns behind the wave");
  assert.notEqual(rippleGlyph("a", 12, 8, 0.25, 0.8, 0.4), rippleGlyph("a", 13, 8, 0.25, 0.8, 0.4));
});
