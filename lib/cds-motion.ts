/** Local numerical adapter for open-claude-ui's MIT ClaudeMotionPresets solver. */
import { calcDampedHarmonicOscillator, SPRING_SNAPPY, type SpringParameters } from "../vendor/open-claude-ui/ClaudeMotionPresets.ts";

function validateSpring(spring: SpringParameters): void {
  const { stiffness, damping, mass } = spring;
  if (!Number.isFinite(stiffness) || stiffness <= 0 || !Number.isFinite(damping) || damping < 0
    || !Number.isFinite(mass) || mass <= 0 || !Number.isFinite(stiffness / mass)
    || stiffness / mass === 0 || !Number.isFinite(damping / mass)
    || !Number.isFinite(stiffness * mass) || stiffness * mass === 0) {
    throw new RangeError("A spring needs finite positive stiffness/mass and finite nonnegative damping");
  }
}

/** Normalized unit-step displacement: rest at 0, target at 1, time in seconds. */
export function springProgress(spring: SpringParameters, seconds: number): number {
  validateSpring(spring);
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("Spring time must be finite and nonnegative");
  if (seconds === 0) return 0;
  const omega = Math.sqrt(spring.stiffness / spring.mass);
  const zeta = spring.damping / (2 * Math.sqrt(spring.mass * spring.stiffness));
  let progress: number;
  if (zeta >= 1 && (zeta - 1 < 1e-4 || zeta > 1e4)) {
    // The source rounds slightly overdamped springs to critical and subtracts
    // nearly equal poles for very heavy damping. Keep its exact step response,
    // but rationalize the slow pole and use expm1 at these numerical edges.
    const root = Math.sqrt(zeta - 1) * Math.sqrt(zeta + 1);
    const slow = -omega / (zeta + root);
    const fast = -omega * (zeta + root);
    const decay = Math.exp(slow * seconds);
    if (decay === 0) return 1;
    const difference = fast - slow;
    progress = difference === 0
      ? -Math.expm1(slow * seconds) + slow * seconds * decay
      : -Math.expm1(slow * seconds) + slow * decay * Math.expm1(difference * seconds) / difference;
  } else if (zeta < 1 && zeta * omega * seconds > 745) {
    return 1;
  } else {
    progress = calcDampedHarmonicOscillator(spring.stiffness, spring.damping, spring.mass, seconds);
  }
  if (!Number.isFinite(progress)) throw new RangeError("Spring parameters/time exceed the supported numerical range");
  return progress;
}

export interface SpringSamples {
  /** A conservative settling duration, in milliseconds, rather than time scaled physics. */
  durationMs: number;
  /** Uniformly spaced displacement samples; values may overshoot 1. */
  values: number[];
}

/** Sample the source step response at 120Hz after bounding the settling tail. */
export function sampleSpring(spring: SpringParameters): SpringSamples {
  validateSpring(spring);
  if (spring.damping === 0) throw new RangeError("An undamped spring never settles");
  const omega = Math.sqrt(spring.stiffness / spring.mass);
  const zeta = spring.damping / (2 * Math.sqrt(spring.mass * spring.stiffness));
  const slowRate = zeta < 1 ? zeta * omega : omega / (zeta + Math.sqrt(zeta - 1) * Math.sqrt(zeta + 1));
  // Seven slow decay constants bound the tail below 0.8%, including the
  // critical response's (1 + omega*t) factor. Do not time-scale the spring.
  const duration = 7 / slowRate;
  if (!Number.isFinite(duration) || duration > 10 || duration < 1 / 120) {
    throw new RangeError("Spring settling time is outside the supported animation range");
  }
  const intervals = Math.ceil(duration * 120);
  const values = Array.from({ length: intervals + 1 }, (_, index) => springProgress(spring, duration * index / intervals));
  values[0] = 0;
  values[values.length - 1] = 1;
  return { durationMs: duration * 1000, values };
}

// Use actual source values (320/28/1), not its inconsistent AGENTS prose.
// Sample once; CSS linear() interpolates physical positions, not a linear fade.
const menuSamples = sampleSpring(SPRING_SNAPPY as SpringParameters);
export const CDS_MENU_ENTER = Object.freeze({
  durationMs: menuSamples.durationMs,
  easing: `linear(${menuSamples.values.map((value) => Number(value.toFixed(8))).join(", ")})`,
});
