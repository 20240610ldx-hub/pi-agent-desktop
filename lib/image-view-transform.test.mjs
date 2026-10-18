import assert from "node:assert/strict";
import test from "node:test";

const subject = () => import("./image-view-transform.ts");

test("zoom keeps the image pixel under the cursor when neither axis reaches an edge", async () => {
  const { fitImageView, zoomImageView, resetImageView } = await subject();
  const fit = fitImageView(1600, 1200, { left: 100, top: 50, width: 800, height: 600 });
  assert.deepEqual({ width: fit.width, height: fit.height, centerX: fit.centerX, centerY: fit.centerY },
    { width: 800, height: 600, centerX: 500, centerY: 350 });
  const zoomed = zoomImageView(fit, resetImageView(), 2, { x: 600, y: 400 });
  assert.deepEqual(zoomed, { scale: 2, x: -100, y: -50 });
  assert.deepEqual(zoomImageView(fit, zoomed, 1, { x: 600, y: 400 }), resetImageView());
});

test("zoom and pan stop at the image edges and leave a fitting axis centered", async () => {
  const { fitImageView, zoomImageView, resetImageView, panImageView } = await subject();
  const fit = fitImageView(1600, 400, { left: 0, top: 0, width: 800, height: 600 });
  const maximum = zoomImageView(fit, resetImageView(), 100, { x: 10000, y: -10000 });
  assert.deepEqual(maximum, { scale: 2, x: -400, y: 0 });
  assert.deepEqual(panImageView(fit, maximum, 10000, 10000), { scale: 2, x: 400, y: 0 });
  assert.deepEqual(zoomImageView(fit, maximum, -10), resetImageView());
  const tall = fitImageView(400, 1600, { left: 0, top: 0, width: 800, height: 600 });
  assert.deepEqual(panImageView(tall, zoomImageView(tall, resetImageView(), 2), 500, -1000), { scale: 2, x: 0, y: -300 });
});

test("invalid dimensions and nonfinite input never produce a nonfinite transform", async () => {
  const { fitImageView, zoomImageView, panImageView, resetImageView } = await subject();
  for (const size of [0, -1, NaN, Infinity]) {
    assert.equal(fitImageView(size, 100, { left: 0, top: 0, width: 800, height: 600 }), null);
    assert.equal(fitImageView(100, 100, { left: 0, top: 0, width: size, height: 600 }), null);
  }
  assert.equal(fitImageView(100, 100, { left: Infinity, top: 0, width: 800, height: 600 }), null);
  const fit = fitImageView(1600, 1200, { left: 0, top: 0, width: 800, height: 600 });
  const corrupt = { scale: NaN, x: Infinity, y: -Infinity };
  assert.deepEqual(zoomImageView(fit, corrupt, NaN), resetImageView());
  assert.deepEqual(panImageView(fit, corrupt, Infinity, NaN), resetImageView());
  assert.deepEqual(zoomImageView(null, corrupt, 2), resetImageView());
});

test("wheel zoom is bounded and reset or changed viewport/source returns to fit", async () => {
  const { fitImageView, zoomImageView, wheelImageView, resetImageView, reconcileImageView } = await subject();
  const fit = fitImageView(1600, 1200, { left: 0, top: 0, width: 800, height: 600 });
  assert.deepEqual(wheelImageView(fit, resetImageView(), -Infinity), resetImageView());
  assert.equal(wheelImageView(fit, resetImageView(), -1000000).scale, 2);
  const zoomed = zoomImageView(fit, resetImageView(), 2, { x: 500, y: 350 });
  assert.deepEqual(reconcileImageView(zoomed, fit, fit, "one", "one"), zoomed);
  const resized = fitImageView(1600, 1200, { left: 0, top: 0, width: 600, height: 600 });
  assert.deepEqual(reconcileImageView(zoomed, fit, resized, "one", "one"), resetImageView());
  assert.deepEqual(reconcileImageView(zoomed, fit, fit, "one", "two"), resetImageView());
});

test("contain geometry never upscales a small image and exposes only usable zoom and pan directions", async () => {
  const { fitImageView, imageViewCapabilities, resetImageView, zoomImageView } = await subject();
  const small = fitImageView(100, 50, { left: 10, top: 20, width: 800, height: 600 });
  assert.equal(small.width, 100);
  assert.equal(small.height, 50);
  assert.equal(small.centerX, 410);
  assert.equal(small.centerY, 320);
  assert.deepEqual(imageViewCapabilities(small, resetImageView()), { zoomIn: true, zoomOut: false, reset: false, panLeft: false, panRight: false, panUp: false, panDown: false });
  const fit = fitImageView(1600, 400, { left: 0, top: 0, width: 800, height: 600 });
  const atRightEdge = zoomImageView(fit, resetImageView(), 2, { x: -10000, y: 0 });
  assert.deepEqual(imageViewCapabilities(fit, atRightEdge), { zoomIn: false, zoomOut: true, reset: true, panLeft: true, panRight: false, panUp: false, panDown: false });
  assert.equal(imageViewCapabilities(null, resetImageView()).zoomIn, false);
});
