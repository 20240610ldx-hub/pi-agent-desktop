import assert from "node:assert/strict";
import test from "node:test";
import { canFollowStream, revealScrollToLatest } from "./cds-scroll.ts";

test("streaming respects the CDS 150ms manual-input cooldown", () => {
  assert.equal(canFollowStream(100, 100), false);
  assert.equal(canFollowStream(100, 250), false);
  assert.equal(canFollowStream(100, 251), true);
  assert.equal(canFollowStream(-Infinity, 0), true);
});

test("the back-to-latest button hides while an attached run is streaming", () => {
  assert.equal(revealScrollToLatest(true, true), false);
  assert.equal(revealScrollToLatest(true, false), true);
  assert.equal(revealScrollToLatest(false, false), false);
  assert.equal(revealScrollToLatest(false, true), false);
});
