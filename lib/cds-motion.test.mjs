import assert from "node:assert/strict";
import test from "node:test";
import { CDS_MENU_ENTER, sampleSpring, springProgress } from "./cds-motion.ts";

const close = (actual, expected, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test("spring progress matches independent unit-step reference points in each damping regime", () => {
  // Unit-step response of x'' + c*x' + 4*x = 4, with x(0)=x'(0)=0.
  close(springProgress({ stiffness: 4, damping: 2, mass: 1 }, 1), 0.8494256348541123);
  close(springProgress({ stiffness: 4, damping: 4, mass: 1 }, 1), 0.5939941502901619);
  close(springProgress({ stiffness: 4, damping: 6, mass: 1 }, 1), 0.4555043339901371);
});

test("spring progress rejects nonphysical parameters and invalid time instead of producing NaN", () => {
  const valid = { stiffness: 4, damping: 2, mass: 1 };
  for (const invalid of [
    { stiffness: 0 }, { stiffness: -1 }, { stiffness: NaN }, { stiffness: Infinity },
    { damping: -1 }, { damping: NaN }, { damping: Infinity },
    { mass: 0 }, { mass: -1 }, { mass: NaN }, { mass: Infinity },
  ]) assert.throws(() => springProgress({ ...valid, ...invalid }, 1), RangeError);
  for (const invalid of [-1, NaN, Infinity, -Infinity]) assert.throws(() => springProgress(valid, invalid), RangeError);
  assert.equal(springProgress({ ...valid, damping: 0 }, 0), 0, "undamped progress is valid even though it does not settle");
  assert.throws(() => springProgress({ stiffness: 1e308, damping: 1, mass: 1e-308 }, 1), RangeError);
});

test("near-critical and heavily overdamped springs keep finite accurate progress", () => {
  // 70-digit independent Taylor solution of x''+4.0002*x'+4*x=4 at t=1.
  close(springProgress({ stiffness: 4, damping: 4.0002, mass: 1 }, 1), 0.5939761061270560);
  for (const damping of [4 - 1e-12, 4, 4 + 1e-12]) {
    close(springProgress({ stiffness: 4, damping, mass: 1 }, 1), 0.5939941502901619, 1e-12);
  }
  // For c=1e12 the fast transient vanishes; slow pole approaches -k/c.
  close(springProgress({ stiffness: 4, damping: 1e12, mass: 1 }, 1e12), 0.9816843611112658, 1e-12);
  for (const damping of [0, 2, 4, 6, 1e12]) {
    const spring = { stiffness: 4, damping, mass: 1 };
    assert.equal(springProgress(spring, 0), 0);
    assert.ok(Number.isFinite(springProgress(spring, 1e-10)));
    if (damping) close(springProgress(spring, 1e15), 1);
  }
});

test("bounded samples preserve physical overshoot and settle before the exact final target", () => {
  for (const spring of [
    { stiffness: 100, damping: 10, mass: 1 },
    { stiffness: 100, damping: 20, mass: 1 },
    { stiffness: 100, damping: 30, mass: 1 },
  ]) {
    const samples = sampleSpring(spring);
    assert.equal(samples.values[0], 0);
    assert.equal(samples.values.at(-1), 1);
    assert.ok(samples.durationMs > 0 && samples.durationMs <= 10_000);
    assert.ok(samples.values.length >= 2 && samples.values.length <= 1201);
    assert.ok(samples.values.every(Number.isFinite));
    for (const fraction of [1, 1.1, 1.5]) {
      assert.ok(Math.abs(springProgress(spring, samples.durationMs / 1000 * fraction) - 1) < 0.01);
    }
    if (spring.damping === 10) assert.ok(Math.max(...samples.values) > 1.15, "do not clamp physical overshoot");
    else assert.ok(Math.max(...samples.values) <= 1);
  }
  assert.throws(() => sampleSpring({ stiffness: 4, damping: 0, mass: 1 }), RangeError);
  assert.throws(() => sampleSpring({ stiffness: 1e-8, damping: 1e-8, mass: 1 }), RangeError, "unsettled curves must not snap after a capped duration");
});

test("menu entry easing samples the source SNAPPY 320/28/1 instead of the contradictory prose preset", () => {
  assert.equal(CDS_MENU_ENTER.durationMs, 500);
  assert.match(CDS_MENU_ENTER.easing, /^linear\(0, /);
  assert.match(CDS_MENU_ENTER.easing, /, 1\)$/);
  const values = CDS_MENU_ENTER.easing.slice(7, -1).split(", ").map(Number);
  assert.equal(values.length, 61);
  // Independent source spring response at 0.1 seconds, not a CSS bezier proxy.
  close(values[12], 0.6129509860753413, 1e-8);
  assert.ok(Math.max(...values) > 1.019 && Math.max(...values) < 1.020);
});
