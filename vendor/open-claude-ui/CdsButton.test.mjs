import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { CdsButton } = await jiti.import("./CdsButton.tsx");
const h = React.createElement;
const render = (props, ...children) => renderToStaticMarkup(h(CdsButton, props, ...children));
const css = readFileSync(new URL("../../app/native-theme.css", import.meta.url), "utf8");
const c02 = css.slice(css.indexOf("/* ===== C02 按钮尺寸与交互状态"), css.indexOf("/* ===== /C02 ====="));

test("按钮只输出语义类名，尺寸与颜色不再混用 Tailwind 工具类", () => {
  const html = render({ size: "xs", variant: "outline" }, "跳过");
  assert.match(html, /class="cds-button cds-button--outline cds-button--xs"/);
  assert.doesNotMatch(html, /\b(h-\d|px-|rounded|border-neutral|ring-|bg-clay|animate-spin|group\/btn)/);
  assert.match(html, /<span class="cds-button__label">跳过<\/span>/);
});

test("图标按钮与带文字按钮走同一套尺寸令牌", () => {
  const icon = render({ size: "xs", variant: "ghost", "aria-label": "复制", icon: h("svg") });
  assert.match(icon, /cds-button--icon-only/);
  assert.match(icon, /<span class="cds-button__icon"><svg><\/svg><\/span>/);
  assert.doesNotMatch(icon, /cds-button__label/);
  const text = render({ size: "xs", icon: h("svg") }, "复制");
  assert.doesNotMatch(text, /cds-button--icon-only/);
  assert.match(render({ size: "icon", icon: h("svg") }), /cds-button--icon-only/);
});

test("加载中保持可聚焦但不触发点击，禁用按钮由浏览器拦截", () => {
  let clicks = 0;
  const loading = h(CdsButton, { isLoading: true, onClick: () => { clicks += 1; } }, "导入");
  const tree = CdsButton.render(loading.props, null);
  assert.equal(tree.props.onClick, undefined);
  assert.equal(tree.props.disabled, false);
  assert.equal(tree.props["aria-busy"], true);
  assert.equal(tree.props["aria-disabled"], true);
  assert.equal(clicks, 0);
  const idle = CdsButton.render({ onClick: () => { clicks += 1; }, children: "导入" }, null);
  idle.props.onClick();
  assert.equal(clicks, 1);
  assert.match(render({ disabled: true }, "导入"), /<button[^>]* disabled=""/);
  assert.match(render({ isLoading: true }, "导入"), /cds-button__spinner/);
});

test("xs 档令牌等于 3.1623 原生量测值", () => {
  const token = (name) => c02.match(new RegExp(`${name}: ([^;]+);`))?.[1];
  assert.equal(token("--cds-btn-xs-h"), "22.67px");
  assert.equal(token("--cds-btn-xs-h-outline"), "24px");
  assert.equal(token("--cds-btn-xs-px"), "7px");
  assert.equal(token("--cds-btn-xs-r"), "5.33px");
  assert.equal(token("--cds-btn-xs-fs"), "13px");
  assert.equal(token("--cds-btn-icon-xs"), "24px");
  assert.equal(token("--cds-btn-primary-bg"), "var(--cds-gray-900)");
  assert.equal(token("--cds-btn-primary-bg-hover"), "var(--cds-gray-750)");
});

test("C02 分节覆盖所有尺寸、变体与全部交互状态选择器", () => {
  for (const size of ["xxs", "xs", "sm", "lg", "icon", "icon-only"]) assert.match(c02, new RegExp(String.raw`\.cds-button--${size}\b`));
  for (const variant of ["primary", "brand", "secondary", "ghost", "outline", "danger", "onContent"]) assert.match(c02, new RegExp(String.raw`\.cds-button--${variant}\b`));
  for (const state of [":hover", ":active", ":disabled", ":focus-visible", ".is-loading"]) assert.ok(c02.includes(state), state);
  assert.match(c02, /\.cds-button__label \{[^}]*text-overflow: ellipsis/);
  assert.doesNotMatch(c02, /!important/);
});
