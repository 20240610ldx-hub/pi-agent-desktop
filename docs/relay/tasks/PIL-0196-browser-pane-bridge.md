---
id: PIL-0196
title: 受控浏览器 pane 桥接契约
epic: E5
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0191, PIL-0195]
files_allowed: [lib/browser-ui-bridge*.ts, lib/browser-ui-bridge*.test.mjs, hooks/useManagedBrowser*.ts, hooks/useManagedBrowser*.test.mjs, app/api/browser/ui/**, src-tauri/src/managed_browser_pane*.rs]
files_shared: [components/WorkspacePaneDock.tsx, src-tauri/src/lib.rs, lib/i18n/messages/*.ts]
acceptance_sha:
waivers: []
---

## 目标

给 Browser pane 的前端（PIL-0165 的 `BrowserPanel`）一个稳定契约：子 webview 与 pane 区域的几何同步、React 浮层打开时不被原生 webview 遮挡、地址/前进/后退/刷新/停止/接管状态与受控页面一致、域名被拒时显示权限拒绝。对应 [GOALS](../GOALS.md) E5 与 E2（C51）。本卡不做像素复刻，也不改 `components/BrowserPanel.tsx`。

## 背景与现状

- PIL-0165（C51）独占 `components/BrowserPanel.tsx` 的控制条与新标签复刻，且要求「iframe 不抵受控 Chromium 验收」；它需要本卡提供真实受控能力，PIL-0165 的 `depends_on` 需加上本卡（由协调者处理，本卡不编辑 PIL-0165）。
- 原生子 webview 永远盖在 DOM 之上，所以菜单、对话框、Show 勾选菜单等 React 浮层会被遮住——这是 PIL-0191 spike 的风险②，本卡给出解决机制（浮层打开时隐藏或以截图占位，关闭后恢复且保留滚动位置）。
- `components/WorkspacePaneDock.tsx` 主卡为 PIL-0144，本卡只做挂载处的少量追加。
- 用户决定首发只验 Windows，150% 缩放为参考环境（见 PIL-0165 A2）。

## 验收标准

- [ ] A1 几何同步：pane 缩放、拖动分栏、侧栏显隐、窗口最大化/还原、Windows 150% 缩放下，子 webview 矩形与 pane 占位矩形偏差 ≤1 CSS px；pane 隐藏时子 webview 同步隐藏。验证：真实 Windows 窗口量测表（原像素与 CSS px 两列）存 `relay-evidence/PIL-0196/`。
- [ ] A2 浮层遮挡：打开任一应用菜单、对话框、Show 勾选菜单、命令面板时，受控页面内容不遮挡浮层；关闭后恢复可见，页面滚动位置与输入框内容保留。验证：真实窗口逐类浮层截图对比 + 状态断言。
- [ ] A3 契约驱动真实页面：地址栏提交、返回/前进/刷新/停止、接管/交还通过契约调用真实受控页面，`useManagedBrowser` 返回的地址、加载中、可前进/后退、接管状态与受控页面实际一致；加载被中断时停止按钮生效。验证：hook 测试 + 本地站点集成测试。
- [ ] A4 权限与失败可见：被域名授权拒绝、引擎不可用、会话 `lost` 时，契约返回结构化状态（拒绝原因、可重试），不静默失败，也不回退到 iframe 伪装成功。验证：三类失败状态的 hook 测试。
- [ ] A5 焦点与 IME：Tab 可在控制条与受控网页之间进出，取消/接管/返回应用后焦点恢复；中文 IME 在受控网页输入框可用。验证：真实 Windows 窗口手动步骤记录；原生层与合成事件分层记录，缺少环境的项记未运行。
- [ ] A6 受影响测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`cargo check`（src-tauri）通过；`node --test components/WorkspacePaneDock.test.mjs` 既有断言不变；`node scripts/relay.mjs guard --task PIL-0196` 无阻断项。

## 范围外

控制条、新标签页、Cookie 导入对话框的视觉复刻与量测（PIL-0165；Cookie 导入已被用户决定不做）；工具、审批、下载、接管与恢复逻辑本身（PIL-0192~0195）；修改 `components/BrowserPanel.tsx`、`app/native-theme.css`。

## 实现提示

- 先读 `docs/agents/fork-ui.md` 与 `components/WorkspacePaneDock.tsx` 现有挂载方式；几何用 `ResizeObserver` + 设备像素换算，在 Rust 侧设置子 webview 位置与大小。
- 浮层检测可用已有的 `stacked-dialog` 或 `.app-menu` 的打开状态，集中成一个信号，不要在每个浮层里各写一份。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-21T12:28Z · planner · 创建
- 2026-10-21T12:40Z · claude:sonnet-high:planner · 填写目标/验收（由 PIL-0040 拆出）；PIL-0165 的 depends_on 需加本卡，由协调者处理；未冻结，待规划者评审后 freeze。
