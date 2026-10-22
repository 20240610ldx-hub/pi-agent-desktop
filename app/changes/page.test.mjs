import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// Exercise the standalone page's callbacks without mounting the app shell or
// starting Next. Only React hook scheduling and unrelated UI are substituted.
const modules = {
  react: `
    export const Suspense = ({children}) => children;
    export const useState = (...args) => globalThis.__changesRouteTest.useState(...args);
    export const useRef = (...args) => globalThis.__changesRouteTest.useRef(...args);
    export const useEffect = () => {};
    export const useCallback = (fn) => fn;
    export const useSyncExternalStore = (_subscribe, snapshot) => snapshot();`,
  "react/jsx-runtime": `export const jsx = (type, props) => ({type, props}); export const jsxs = jsx;`,
  "next/navigation": `export const useSearchParams = () => globalThis.__changesRouteTest.params;`,
  "@/components/ChangesPane": `export const ChangesPane = "ChangesPane";`,
  "@/hooks/useI18n": `export const I18nProvider = ({children}) => children; export const useI18n = () => ({locale: globalThis.__changesRouteTest.locale});`,
  "@/lib/changes-feedback": `export const requestChangesFeedback = (...args) => globalThis.__changesRouteTest.request(...args);`,
  "@/lib/clipboard": `export const copyText = (...args) => globalThis.__changesRouteTest.copy(...args);`,
  "@/lib/desktop-native": `export const closeChangesWindow = () => globalThis.__changesRouteTest.close();`,
};
const { outputFiles } = await build({
  absWorkingDir: fileURLToPath(new URL("../../", import.meta.url)),
  entryPoints: ["app/changes/page.tsx"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  plugins: [{ name: "standalone-page-contract", setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path }) => path in modules ? { path, namespace: "route-test" } : undefined);
    builder.onLoad({ filter: /.*/, namespace: "route-test" }, ({ path }) => ({ contents: modules[path] }));
  } }],
});
const { default: ChangesPage } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

function harness({ deliver = false, targetId = "main-123", viewId } = {}) {
  const states = [];
  let index = 0;
  const env = {
    locale: "en",
    params: new URLSearchParams({ cwd: "D:/project", ...(targetId ? { targetId } : {}), ...(viewId ? { viewId } : {}) }),
    sent: [], copied: [], closed: 0,
    async request(value) { env.sent.push(value); return deliver; },
    async copy(text) { env.copied.push(text); },
    async close() { env.closed++; },
    useState(initial) {
      const slot = index++;
      if (!(slot in states)) states[slot] = initial;
      return [states[slot], (value) => { states[slot] = value; }];
    },
    useRef(initial) {
      const slot = index++;
      if (!(slot in states)) states[slot] = { current: initial };
      return states[slot];
    },
  };
  function resolve(element) {
    if (Array.isArray(element)) return element.map(resolve);
    if (!element || typeof element !== "object") return element;
    if (typeof element.type === "function") return resolve(element.type(element.props));
    return { ...element, props: { ...element.props, children: resolve(element.props?.children) } };
  }
  return {
    env,
    render() {
      globalThis.__changesRouteTest = env;
      index = 0;
      return resolve(ChangesPage());
    },
  };
}

const pane = (tree) => tree.props.children;
const status = (tree) => pane(tree).props.headerExtra;
const statusText = (tree) => status(tree)?.props.children[0].props.children;

test("standalone route renders the full-height ChangesPane with its own close action", async () => {
  const view = harness();
  const tree = view.render();
  assert.equal(tree.type, "main");
  assert.equal(tree.props.style.height, "100dvh");
  assert.equal(pane(tree).type, "ChangesPane");
  assert.equal(pane(tree).props.cwd, "D:/project");
  assert.equal(pane(tree).props.visible, true);
  assert.equal(pane(tree).props.expanded, true);
  assert.equal(pane(tree).props.onOpenWindow, undefined);
  assert.equal(pane(tree).props.onExpand, undefined);
  pane(tree).props.onClose();
  await Promise.resolve();
  assert.equal(view.env.closed, 1);
});

test("only acknowledged delivery returns success for the pane's draft notice", async () => {
  const view = harness({ deliver: true });
  assert.equal(await pane(view.render()).props.onAddFeedback("Review `src/file.ts` old line 82"), true);
  assert.deepEqual(view.env.sent, [{ targetId: "main-123", cwd: "D:/project", text: "Review `src/file.ts` old line 82" }]);
  assert.match(statusText(view.render()), /saved Changes view expired or is unavailable/, "delivery does not hide the missing-view recovery status");
  assert.deepEqual(view.env.copied, []);
});

test("unacknowledged feedback offers an explicit Copy feedback action and truthful status", async () => {
  const view = harness({ targetId: "" });
  assert.equal(await pane(view.render()).props.onAddFeedback("Review new lines 12–15"), false);
  let tree = view.render();
  assert.match(statusText(tree), /Chat draft unavailable/);
  const button = status(tree).props.children[1];
  assert.equal(button.type, "button");
  assert.equal(button.props.children, "Copy feedback");
  button.props.onClick();
  await Promise.resolve();
  tree = view.render();
  assert.deepEqual(view.env.copied, ["Review new lines 12–15"]);
  assert.equal(statusText(tree), "Feedback copied. Paste it into chat.");
});

test("failed copies stay retryable and a late earlier delivery cannot replace newer feedback", async () => {
  const view = harness();
  let finishFirst;
  view.env.request = () => new Promise((resolve) => { finishFirst = resolve; });
  const first = pane(view.render()).props.onAddFeedback("first feedback");
  view.env.request = async () => false;
  await pane(view.render()).props.onAddFeedback("second feedback");
  finishFirst(true); await first;
  assert.match(statusText(view.render()), /unavailable/);
  view.env.copy = async () => { throw new Error("clipboard denied"); };
  status(view.render()).props.children[1].props.onClick();
  await Promise.resolve();
  const tree = view.render();
  assert.match(statusText(tree), /Copy failed/);
  assert.equal(status(tree).props.children[1].props.children, "Copy feedback");
});

test("feedback fallback follows Simplified and Traditional Chinese locale changes", async () => {
  const view = harness();
  await pane(view.render()).props.onAddFeedback("Review changed line 2");
  view.env.locale = "zh-CN";
  let tree = view.render();
  assert.match(statusText(tree), /聊天草稿不可用/);
  assert.equal(status(tree).props.children[1].props.children, "复制反馈");
  view.env.locale = "zh-TW";
  tree = view.render();
  assert.match(statusText(tree), /聊天草稿無法使用/);
  assert.equal(status(tree).props.children[1].props.children, "複製回饋");
});

test("an unavailable addressed view gives an explicit recovery status", () => {
  const tree = harness({ viewId: "31b2ff61-9167-42ca-b241-8f95792acdf4" }).render();
  assert.match(statusText(tree), /saved Changes view expired or is unavailable/);
});

test("missing and malformed view IDs show recovery while the latest comparison stays usable", () => {
  for (const viewId of [undefined, "../api/home", "invalid"]) {
    const tree = harness({ viewId }).render();
    assert.match(statusText(tree), /saved Changes view expired or is unavailable/);
    assert.equal(pane(tree).props.visible, true);
    assert.equal(pane(tree).props.initialViewState, undefined);
  }
});

test("addressed standalone route consumes the saved view and persists its own changes for refresh", async () => {
  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
  const api = await jiti.import("../../lib/changes-window-state.ts");
  const values = new Map();
  const previous = globalThis.window;
  globalThis.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } };
  try {
    const viewId = api.createChangesWindowView({ cwd: "D:/project", targetId: "main-123", sessionId: "session-A", state: { version: 1, scope: "uncommitted", selectedPath: "src/file.ts", scrollTop: 420 } });
    const tree = harness({ viewId }).render();
    assert.equal(pane(tree).props.initialViewState.scope, "uncommitted");
    assert.equal(pane(tree).props.initialViewState.selectedPath, "src/file.ts");
    pane(tree).props.onViewStateChange({ ...pane(tree).props.initialViewState, scrollTop: 820 });
    assert.equal(api.readChangesWindowView(viewId, "D:/project", "main-123").state.scrollTop, 820);
    const restored = harness({ viewId }).render();
    assert.equal(pane(restored).props.initialViewState.scrollTop, 820);
  } finally { globalThis.window = previous; }
});

test("a view that grows past storage bounds keeps the pane usable and reports save failure", async () => {
  const { createJiti } = await import("jiti");
  const api = await createJiti(import.meta.url, { tsconfigPaths: true }).import("../../lib/changes-window-state.ts");
  const values = new Map();
  const previous = globalThis.window;
  globalThis.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } };
  try {
    const viewId = api.createChangesWindowView({ cwd: "D:/project", targetId: "main-123", state: { version: 1 } });
    const view = harness({ viewId });
    const initial = pane(view.render()).props.initialViewState;
    const oversized = { ...initial, openPaths: Array.from({ length: 129 }, (_, i) => `src/${i}.ts`) };
    assert.doesNotThrow(() => pane(view.render()).props.onViewStateChange(oversized));
    assert.match(statusText(view.render()), /could not be saved/);
    assert.equal(pane(view.render()).props.visible, true);
    pane(view.render()).props.onViewStateChange(initial);
    assert.equal(status(view.render()), undefined);
  } finally { globalThis.window = previous; }
});

test.after(() => { delete globalThis.__changesRouteTest; });
