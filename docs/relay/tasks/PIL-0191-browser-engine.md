---
id: PIL-0191
title: 受控浏览器引擎与 pane 内核（含 spike）
epic: E5
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0001]
files_allowed: [src-tauri/src/managed_browser*.rs, src-tauri/capabilities/managed-browser*.json, lib/managed-browser-engine*, app/api/browser/engine/**, e2e/managed-browser-engine*.mjs]
files_shared: [src-tauri/Cargo.toml, src-tauri/Cargo.lock, src-tauri/src/lib.rs, package.json, package-lock.json, THIRD_PARTY_NOTICES.md, scripts/prepare-desktop.mjs, scripts/fork-ownership.json]
acceptance_sha:
waivers: []
---

## 目标

应用里能创建一个内嵌在 pane 区域的受控浏览器（Windows WebView2 子 webview），每个项目有独立 profile，Node 侧能通过本机回环 CDP 用 `playwright-core` 附着它；spike 先实测主线可行，失败则回退到系统 Edge 独立有头窗口（`launch({channel:"msedge", headless:false})`）。对应 [GOALS](../GOALS.md) E5「可见的专用 Chromium」。用户 2026-10-21 已决定：内嵌 WebView2 子 webview + playwright-core 附着；Tauri `unstable` 由本卡实测决定；首发只验 Windows。

## 背景与现状

- 现状：`components/BrowserPanel.tsx` 仅为地址栏＋iframe（见 PIL-0165）；`lib/`、`app/api/`、`src-tauri/src/` 无受控浏览器、CDP、Playwright 运行时代码。`package.json` 里 `playwright ^1.62.1` 只在 devDependencies；`src-tauri/Cargo.toml` 的 tauri 2.12.1 未开 `unstable`，现有窗口（`changes_window.rs`、`conversation_window.rs`）只用 `WebviewWindowBuilder`，没有子 webview。
- 规格：[Plan Task 5](../../superpowers/plans/2026-10-16-pilaude.md)（历史档案，只查此节）、[Spec 第 9 节](../../superpowers/specs/2026-10-16-pilaude-spec.md)：外站不得进入有应用 IPC 的 renderer；调试端口受限；退出只回收本应用自有进程。
- 设计与调研：`D:/pilaude/relay-evidence/PIL-0040/research-2026-10-21/PROPOSAL.md`。Tauri `WebviewBuilder`（需 `unstable`）提供 `data_directory`、`additional_browser_args`（参数不同必须不同数据目录）、`on_download`、`on_navigation`、`on_new_window`；Playwright 官方文档支持 `chromium.connectOverCDP` 附着 WebView2。
- 要实测的六项风险：①开 `unstable` 后现有窗口是否回归；②原生子 webview 盖在 DOM 之上，React 浮层被遮；③150% DPI 与多显示器几何；④随机调试端口的发现方式；⑤`connectOverCDP` 到 WebView2 的功能边界（单 context、下载行为）；⑥WebView2 Evergreen 与 Playwright 1.62 的 CDP 兼容。

## 验收标准

- [ ] A1 spike 报告 `D:/pilaude/relay-evidence/PIL-0191/spike.md` 对上述六项逐项给出实测值与结论，并明确写出「继续主线」或「切回退」；若回退，同卡内用系统 Edge 有头窗口实现同一 `BrowserEngine` 接口（open/attach/close），其余验收项按回退引擎重跑。验证：报告存在、六项齐全，每项附命令或步骤与原始输出。
- [ ] A2 隔离：受控页面内调用 `window.__TAURI__`/`invoke` 失败（无 IPC、子 webview 未授予任何 capability）；调试端口只监听 127.0.0.1；对该端口请求 `/json/list` 只列受控浏览器目标，不含主应用 webview；端口号不出现在任何 API 响应、日志或错误文本。验证：真实进程集成测试断言。
- [ ] A3 profile 隔离：项目 A 的受控浏览器写入的 cookie 在项目 B 不可见；「清除 profile」后 A 的 cookie 消失；两个项目互不共享数据目录；不读取、不导入日常 Chrome/Edge 的任何数据。验证：真实 WebView2 进程测试。
- [ ] A4 失败路径：WebView2 运行时缺失、调试端口被占用、子 webview 崩溃或被关闭、CDP 附着超时，各自返回结构化错误（含原因），界面/调用方不得显示成功；应用明确退出与异常退出后，用 `tasklist` 核对没有本应用遗留的浏览器进程，且不终止用户自己的 Edge。验证：逐项注入故障的测试输出。
- [ ] A5 启用 `unstable`（若主线）后既有桌面回归不变：changes/conversation 窗口、托盘、窗口状态相关既有测试全部通过且未删减；`playwright-core` 作为生产依赖加入并登记 `THIRD_PARTY_NOTICES.md`，记录对安装包体积的实测增量。验证：既有定向测试 + 体积记录。
- [ ] A6 受影响测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`cargo check`（src-tauri）通过；`node scripts/relay.mjs guard --task PIL-0191` 无阻断项。

## 范围外

工具注册、审批、标签页/下载、接管与恢复（见 PIL-0192~0195）；pane 几何同步、浮层遮挡与控制条 UI（PIL-0196、PIL-0165）；Cookie 导入、导入日常浏览器登录状态；macOS/Linux；捆绑 Chromium。

## 实现提示

- 先读 `docs/agents/fork-desktop.md`（Tauri 外壳、版本配对）与 `src-tauri/src/changes_window.rs`；`tauri-plugin-*` 的版本关系见 AGENTS.md Hard rules。
- 子 webview 用 `unstable` 的 `Window::add_child` + `WebviewBuilder`；不要授予 capability；调试端口优先由 Rust 先挑空闲端口再经 `additional_browser_args` 传入，若 `DevToolsActivePort` 可用也可采用，以 spike 结论为准。
- 不要把调试端口或 `playwright` 句柄暴露给 renderer；Node 与 Rust 之间沿用 `lib/desktop-api-auth` 的进程令牌。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-21T12:28Z · planner · 创建
- 2026-10-21T12:40Z · claude:sonnet-high:planner · 填写目标/验收（由 PIL-0040 拆出，用户 2026-10-21 引擎决定）；未冻结，待规划者评审后 freeze。
