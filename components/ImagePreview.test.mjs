import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script } from "node:vm";
import ts from "typescript";
import * as transforms from "../lib/image-view-transform.ts";

const source = await readFile(new URL("./ImagePreview.tsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

function previewCallback(name, context) {
  const file = ts.createSourceFile("ImagePreview.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function locate(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name) return node.initializer;
    return ts.forEachChild(node, locate);
  }
  const callback = locate(file);
  assert.ok(callback, `Missing viewer action ${name}`);
  return new Script(ts.transpileModule(callback.getText(file), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText)
    .runInNewContext({ ...transforms, ...context });
}

function keyEvent(key, overrides = {}) {
  const event = { key, prevented: false, stopped: false, nativeEvent: {},
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...overrides };
  return event;
}

test("viewer keyboard zoom/reset respects IME, limits and unavailable pan axes", () => {
  const fitRef = { current: transforms.fitImageView(1600, 400, { left: 0, top: 0, width: 800, height: 600 }) };
  const transformRef = { current: transforms.resetImageView() };
  let closed = 0;
  const handle = previewCallback("handleKeyDown", {
    fitRef, transformRef, dragRef: { current: null },
    isImeComposing: event => Boolean(event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229),
    applyTransform(next) { transformRef.current = next; },
    closePreview() { closed += 1; },
  });
  const composing = keyEvent("+", { nativeEvent: { isComposing: true } });
  handle(composing);
  assert.equal(transformRef.current.scale, 1);
  assert.equal(composing.prevented, false);
  handle(keyEvent("+")); assert.equal(transformRef.current.scale, 1.25);
  handle(keyEvent("0")); assert.deepEqual(transformRef.current, transforms.resetImageView());
  const up = keyEvent("ArrowUp"); handle(up); assert.equal(up.prevented, false);
  handle(keyEvent("Escape", { nativeEvent: { keyCode: 229 } })); assert.equal(closed, 0);
  const escape = keyEvent("Escape"); handle(escape); assert.equal(closed, 1); assert.equal(escape.stopped, true);
});

test("viewer wheel zoom is local to its viewport and drag deltas use the original pointer anchor", () => {
  const fitRef = { current: transforms.fitImageView(1600, 1200, { left: 0, top: 0, width: 800, height: 600 }) };
  const transformRef = { current: transforms.resetImageView() };
  const dragRef = { current: null };
  const applyTransform = next => { transformRef.current = next; };
  const context = { fitRef, transformRef, dragRef, applyTransform };
  const wheel = previewCallback("handleWheel", context);
  const event = { deltaY: -100, deltaMode: 0, clientX: 500, clientY: 350, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
  wheel(event);
  assert.deepEqual(transformRef.current, { scale: 2, x: -100, y: -50 });
  assert.equal(event.prevented, true); assert.equal(event.stopped, true);
  const pointer = id => ({ pointerId: id, button: 0, pointerType: "mouse", clientX: 400, clientY: 300,
    currentTarget: { setPointerCapture() {} }, preventDefault() {} });
  const down = previewCallback("handlePointerDown", context);
  const move = previewCallback("handlePointerMove", context);
  down(pointer(1));
  move({ ...pointer(2), clientX: 900 });
  assert.equal(transformRef.current.x, -100, "another pointer cannot move this drag");
  move({ ...pointer(1), clientX: 402 });
  assert.equal(transformRef.current.x, -100, "jitter below four pixels is ignored");
  move({ ...pointer(1), clientX: 420 }); assert.equal(transformRef.current.x, -80);
  move({ ...pointer(1), clientX: 430 }); assert.equal(transformRef.current.x, -70, "total delta must not be accumulated repeatedly");
  move({ ...pointer(1), clientX: 402 }); assert.equal(transformRef.current.x, -98, "an active drag may return inside the initial deadzone");
});

test("double click toggles fit and maximum zoom, while cancelled pointer drags stop moving", () => {
  const fitRef = { current: transforms.fitImageView(1600, 1200, { left: 0, top: 0, width: 800, height: 600 }) };
  const transformRef = { current: transforms.resetImageView() };
  const dragRef = { current: null };
  const context = { fitRef, transformRef, dragRef, applyTransform(next) { transformRef.current = next; } };
  const doubleClick = previewCallback("handleDoubleClick", context);
  doubleClick({ clientX: 500, clientY: 350 }); assert.equal(transformRef.current.scale, 2);
  doubleClick({ clientX: 500, clientY: 350 }); assert.deepEqual(transformRef.current, transforms.resetImageView());
  const pointer = { pointerId: 1, button: 0, clientX: 400, clientY: 300, currentTarget: { setPointerCapture() {}, hasPointerCapture() { return true; }, releasePointerCapture() {} }, preventDefault() {} };
  doubleClick({ clientX: 500, clientY: 350 });
  previewCallback("handlePointerDown", context)(pointer);
  previewCallback("handlePointerUp", context)(pointer);
  previewCallback("handlePointerMove", context)({ ...pointer, clientX: 700 });
  assert.equal(transformRef.current.x, -100);
});

test("a source replacement or failed image cannot reuse a stale fit or drag", () => {
  let sourceUrl = "new.png";
  const image = { complete: true, naturalWidth: 1600, naturalHeight: 1200, getAttribute() { return sourceUrl; } };
  let rect = { left: 0, top: 0, width: 800, height: 600 };
  const fitRef = { current: transforms.fitImageView(1600, 1200, rect) };
  const transformRef = { current: { scale: 2, x: 10, y: 10 } };
  const dragRef = { current: { pointerId: 1 } };
  const context = { src: "new.png", imageRef: { current: image }, viewportRef: { current: { getBoundingClientRect: () => rect } }, fitRef, transformRef, dragRef,
    setFit() {}, applyTransform(next) { transformRef.current = next; } };
  const measure = previewCallback("measureImage", context);
  sourceUrl = "old.png"; measure(); assert.equal(transformRef.current.scale, 2, "stale source callback is ignored");
  sourceUrl = "new.png"; rect = { ...rect, width: 600 }; measure();
  assert.deepEqual(transformRef.current, transforms.resetImageView());
  assert.equal(dragRef.current, null);
  image.naturalWidth = 0; measure();
  assert.equal(fitRef.current, null);
  assert.equal(transforms.imageViewCapabilities(fitRef.current, transformRef.current).zoomIn, false);
  assert.match(source, /ImagePreviewDialog key=\{src\}/, "new sources mount an isolated load lifecycle");
});

test("an image load failure finishes loading and clears unavailable zoom state", () => {
  const fitRef = { current: {} }, dragRef = { current: { pointerId: 1 } };
  const transformRef = { current: { scale: 2, x: 10, y: 0 } };
  let status = "loading";
  const fail = previewCallback("handleImageError", { fitRef, dragRef, setFit() {}, setLoadStatus(next) { status = next; }, applyTransform(next) { transformRef.current = next; } });
  fail();
  assert.equal(status, "error");
  assert.equal(fitRef.current, null);
  assert.equal(dragRef.current, null);
  assert.deepEqual(transformRef.current, transforms.resetImageView());
});

test("composer attachments open in the shared preview with a separate remove button", async () => {
  const inputSource = await readFile(new URL("./ChatInput.tsx", import.meta.url), "utf8");
  assert.match(inputSource, /import \{ ImagePreview \} from "\.\/ImagePreview"/);
  assert.match(
    inputSource,
    /<ImagePreview key=\{img\.previewUrl\} src=\{img\.previewUrl\}>[\s\S]*?<img[\s\S]*?src=\{img\.previewUrl\}[\s\S]*?<\/ImagePreview>\s*<button\s*type="button"\s*className="composer-attachment-remove"\s*onClick=\{\(\) => removeImage\(i\)\}/,
  );
});

test("uses a native modal dialog and restores focus to its trigger", () => {
  assert.match(source, /useRef<HTMLDialogElement>\(null\)/);
  assert.match(source, /dialog\.showModal\(\)/);
  assert.match(source, /closeButtonRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /const trigger = triggerRef\.current[\s\S]*?trigger\?\.isConnected[\s\S]*?trigger\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(source, /createPortal/);
});

test("Escape closes image preview without reaching global shortcuts", () => {
  assert.match(
    source,
    /const closePreview = \(\) => \{[\s\S]*?dialogRef\.current\?\.open[\s\S]*?dialogRef\.current\.close\(\)[\s\S]*?onClose\(\)/,
  );
  assert.match(
    source,
    /if \(isImeComposing\(event\)\) return;[\s\S]*?event\.key === "Escape"[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)[\s\S]*?closePreview\(\)/,
  );
  assert.match(
    source,
    /onCancel=\{\(event\) => \{[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)[\s\S]*?closePreview\(\)/,
  );
});

test("closes only when the backdrop itself is clicked", () => {
  assert.match(source, /event\.target === event\.currentTarget[\s\S]*?closePreview\(\)/);
});

test("keeps the preview and Pi-style close button inside mobile safe areas", () => {
  assert.match(
    cssSource,
    /\.image-preview-dialog \{[\s\S]*?env\(safe-area-inset-top\)[\s\S]*?env\(safe-area-inset-right\)[\s\S]*?env\(safe-area-inset-bottom\)[\s\S]*?env\(safe-area-inset-left\)/,
  );
  assert.match(
    cssSource,
    /\.image-preview-close \{[\s\S]*?top: max\(12px, env\(safe-area-inset-top\)\)[\s\S]*?right: max\(12px, env\(safe-area-inset-right\)\)[\s\S]*?border-radius: 6px[\s\S]*?background: var\(--bg-panel\)/,
  );
  assert.match(cssSource, /@media \(pointer: coarse\) \{[\s\S]*?\.image-preview-close \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/);
  assert.match(source, /<path d="M6 6l12 12M18 6 6 18" \/>/);
});
