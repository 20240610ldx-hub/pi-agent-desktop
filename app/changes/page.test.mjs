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
    export const useCallback = (fn) => fn;`,
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

function harness({ deliver = false, targetId = "main-123" } = {}) {
  const states = [];
  let index = 0;
  const env = {
    locale: "en",
    params: new URLSearchParams({ cwd: "D:/project", ...(targetId ? { targetId } : {}) }),
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
  assert.equal(status(view.render()), undefined, "the pane owns the success notice; the route adds no duplicate");
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

test.after(() => { delete globalThis.__changesRouteTest; });
