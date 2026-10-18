import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  clampPanelWidth,
  getDefaultRightPanelWidth,
  getContextPresentation,
  getRightPanelMaxWidth,
  getSidebarMaxWidth,
  SPLIT_PANEL_MIN_WIDTH,
} = await jiti.import("./panel-layout.ts");

test("context shares a wide workspace and floats beside a split file panel", () => {
  const split = { viewportWidth: 2048, rightPanelOpen: true, rightPanelFullWidth: false };
  assert.equal(getContextPresentation({ ...split, availableWidth: 1100 }), "dock");
  assert.equal(getContextPresentation({ ...split, availableWidth: 770 }), "dock");
  assert.equal(getContextPresentation({ ...split, availableWidth: 769 }), "floating");
});

test("context uses a modal only without a competing panel and yields to a full or compact file overlay", () => {
  const compact = { viewportWidth: 960, availableWidth: 700, rightPanelOpen: false, rightPanelFullWidth: false };
  assert.equal(getContextPresentation(compact), "modal");
  assert.equal(getContextPresentation({ ...compact, rightPanelOpen: true }), "hidden");
  assert.equal(getContextPresentation({ ...compact, viewportWidth: 1504, rightPanelOpen: true }), "floating");
  assert.equal(getContextPresentation({ ...compact, viewportWidth: 2048, availableWidth: 1500, rightPanelOpen: true, rightPanelFullWidth: true }), "hidden");
});

test("clamps panel widths to finite bounds", () => {
  assert.equal(clampPanelWidth(420.4, 180, 480), 420);
  assert.equal(clampPanelWidth(120, 180, 480), 180);
  assert.equal(clampPanelWidth(600, 180, 480), 480);
  assert.equal(clampPanelWidth(Number.NaN, 180, 480), 180);
  assert.equal(clampPanelWidth(200, 300, 250), 300);
});

test("keeps the responsive right panel default within useful limits", () => {
  assert.equal(getDefaultRightPanelWidth(700), 360);
  assert.equal(getDefaultRightPanelWidth(1366), 574);
  assert.equal(getDefaultRightPanelWidth(1920), 640);
});

test("reserves chat space while split panels are visible", () => {
  assert.equal(getSidebarMaxWidth({
    viewportWidth: 700,
    rightPanelOpen: true,
    rightPanelWidth: 560,
  }), 380);
  assert.equal(getSidebarMaxWidth({
    viewportWidth: 1366,
    rightPanelOpen: true,
    rightPanelWidth: 686,
  }), 260);
  assert.equal(getRightPanelMaxWidth({
    viewportWidth: 1024,
    sidebarOpen: true,
    sidebarWidth: 260,
  }), 1200);
  assert.equal(getRightPanelMaxWidth({
    viewportWidth: 1366,
    sidebarOpen: true,
    sidebarWidth: 260,
  }), 686);
});

test("does not rewrite desktop widths while the file panel is in overlay mode", () => {
  assert.equal(SPLIT_PANEL_MIN_WIDTH, 1100);
  assert.equal(getRightPanelMaxWidth({
    viewportWidth: 900,
    sidebarOpen: true,
    sidebarWidth: 480,
  }), 1200);
});
