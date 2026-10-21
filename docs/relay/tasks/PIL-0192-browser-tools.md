---
id: PIL-0192
title: 受控浏览器会话核心与智能体工具注册
epic: E5
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0191]
files_allowed: [lib/managed-browser.ts, lib/managed-browser-tools.ts, lib/managed-browser-origin*.ts, lib/managed-browser*.test.mjs, lib/managed-browser-tools.integration.test.mjs, app/api/browser/route.ts, app/api/browser/session/**]
files_shared: [lib/builtin-extensions.ts, lib/rpc-manager.ts, lib/i18n/messages/*.ts, package.json, package-lock.json]
acceptance_sha:
waivers: []
---

## 目标

智能体能通过 Pi 扩展工具操作受控浏览器：导航、读取页面快照、截图、点击、输入、按键、滚动；动作参数带页面/定位目标版本，页面变化后要求重新观察；只读模式只暴露导航与观察。对应 [GOALS](../GOALS.md) E5。

## 背景与现状

- 依赖 PIL-0191 提供的 `BrowserEngine`（附着后得到 playwright-core 的 Browser/Page）。
- 规格：[Plan Task 5](../../superpowers/plans/2026-10-16-pilaude.md) 接口 `ManagedBrowser.open(projectId)/observe(sessionId)/execute(action, approvalId?)/close(sessionId)`，不暴露任意 evaluate；[Spec 第 9 节](../../superpowers/specs/2026-10-16-pilaude-spec.md)：禁止进入 localhost、私网、`file:`、调试端口，除非用户针对具体目标授权；不读密码框；不给模型 cookie/token。
- 复用：Playwright 的 aria 快照与 `aria-ref` 定位（microsoft/playwright-mcp 的做法，Apache-2.0；1.62 是否公开该 API 待本卡首先核实）和 playwright-mcp 的工具名/参数形状；不整体嵌入 `@playwright/mcp`（默认含任意 JS 执行、自管浏览器生命周期、无点击副作用预分类钩子）。真实消费者是下面注册的工具与 observe 的版本字段。
- 工具注册范式：`lib/chat-downloads-tool.ts`（`pi.registerTool(defineTool(...))`）、`lib/builtin-extensions.ts`。
- 授权门在 PIL-0030：本卡不实现审批，但交互类工具在没有可用授权门时必须不注册（fail-closed）；提交/上传逐次审批见 PIL-0193。

## 验收标准

- [ ] A1 本地测试站点上，真实 SDK 会话依次完成 navigate、snapshot、screenshot、click、type、press_key、scroll，返回结果包含页面版本与元素 ref 版本；截图为有效 PNG 且尺寸与视口一致。验证：`node --test lib/managed-browser-tools.integration.test.mjs`。
- [ ] A2 已注册工具名枚举中不含 evaluate/run_code/cookie/localStorage/网络拦截类工具；只读模式下注册表恰为 navigate、snapshot、screenshot，交互工具缺失。验证：测试枚举工具名并断言集合相等。
- [ ] A3 页面变化或 ref 已过期时，click/type 返回「需重新观察」且不对页面产生任何事件（页面侧事件计数为 0）；一个 ref 匹配多个元素时拒绝执行，不退化为按坐标或按文字猜点。验证：本地站点动态替换 DOM 的测试。
- [ ] A4 导航到 localhost、私网地址（10/172.16-31/192.168/链路本地）、`file:`、`chrome://`、受控浏览器自身调试端口，默认被拒并返回原因，不发出请求；公网 URL 正常。拒绝文本、日志、工具结果中不出现调试端口号与 cookie。验证：URL 矩阵测试 + 对日志/结果的字符串断言。
- [ ] A5 授权门不可用（未装载 PIL-0030 的门或其返回不可用）时，交互类工具不注册，只读工具仍可注册并提示；会话关闭/项目切换后 `observe` 返回结构化错误而不是旧页面。验证：两种装载条件下的注册表与错误路径测试。
- [ ] A6 受影响测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint` 通过；`node scripts/relay.mjs guard --task PIL-0192` 无阻断项。

## 范围外

提交/上传/下载/跨域导航审批（PIL-0193）；标签页与下载（PIL-0194）；接管与恢复（PIL-0195）；pane UI（PIL-0196/0165）；任意 JS 执行、cookie/存储读取、Cookie 导入；项目 origin 白名单的持久化与审批弹窗（PIL-0193 与 PIL-0030）。

## 实现提示

- 先读 `docs/agents/tools.md`（工具暴露、`builtin-extensions`、只读策略）与 `lib/chat-downloads-tool.ts`。
- ref 与页面版本：每次 observe 递增页面版本，execute 必须回传版本，不匹配即拒绝。
- 本卡不存 profile 或 cookie；profile 路径与回环端口只在 PIL-0191 的引擎内部使用，不进工具参数。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-21T12:28Z · planner · 创建
- 2026-10-21T12:40Z · claude:sonnet-high:planner · 填写目标/验收（由 PIL-0040 拆出）；未冻结，待规划者评审后 freeze。
