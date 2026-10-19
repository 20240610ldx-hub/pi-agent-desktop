---
id: PIL-0010
title: Changes 面板在独立 Windows 窗口打开
epic: E2
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0001]
files_allowed: [app/changes/**, components/ChangesPane*, components/WorkspacePane*, components/AppShell.tsx, lib/changes-window*, lib/workspace-popout-copy.ts, lib/desktop-native.ts, lib/app-prefs.ts, src-tauri/src/changes_window.rs, e2e/changes-window*.mjs, e2e/native-changes-window.mjs, e2e/native-window-probe.ps1, e2e/sidebar-pin-order.mjs, docs/engineering/pilaude-ui/new-window.md]
files_shared: [src-tauri/src/lib.rs, lib/i18n/messages/*.ts, app/native-theme.css, scripts/fork-ownership.json]
acceptance_sha: c2217a05b17c
waivers: []
---

## 目标

右侧 pane 工具条提供"在新窗口打开"，Changes 在独立窗口中保留文件树、提交与 diff 范围，主会话留在背景。对应 GOALS E2。

## 背景与现状

用户提供两张参考图（版本/DPI 未知）。旧会话已实现并精确暂存 window 相关 19 个源文件（index tree `2e534f9…`），浏览器检查 897204 五组与 874096 滚动专项通过、delta review 通过；尚未完成合并后的组合测试、ownership 核对与 Windows 原生窗口实测。PIL-0001 之后代码位于 `wip/pre-relay-2026-10-19-index`。详细切片记录：`docs/engineering/pilaude-ui/new-window.md`（历史档案）。

## 验收标准

- [ ] A1 右侧 pane 工具条显示双窗图标和三语 tooltip，可用键盘聚焦和触发。验证：受影响组件测试 + 浏览器截图。
- [ ] A2 Changes 在独立窗口中保留 file tree、commits、diff scope（同一 comparisonId）与滚动位置；主会话窗口状态不变。验证：`node e2e/changes-window.mjs`、`node e2e/changes-window-restore.mjs`。
- [ ] A3 关闭独立窗口后，主窗口的会话、草稿和 Changes 选择不丢失。
- [ ] A4 Windows 原生：在桌面开发构建中实际打开、移动、关闭独立窗口，截图存证。验证：`e2e/native-changes-window.mjs` 或等价手动步骤。
- [ ] A5 受影响的测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint` 通过；`node scripts/relay.mjs guard` 无未豁免阻断项。

## 范围外

会话级"新窗口"、其他 pane 类型的弹出、与参考图的像素级比对（另由 E2 复刻卡处理）。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
- 2026-10-19T14:20Z · codex:gpt:coord · 做了：恢复原窗口上下文并只读核对源与最后失败，证据D:/pilaude/relay-evidence/PIL-0001/recovery-windows/recovery.json。状态：19条窗口源在index快照5193f1e，native lib.rs/checker/probe三个blob匹配working23329458；四轮自建进程与调试端口当前无匹配残留，无需终止。最后run1792392333147预期about:blank但实际已是30142根页，真实开窗IPC、OS1到2到1、移动/DPI/关闭后草稿均未到达，不作为A4通过。下一步：用户恢复工作且PIL-0001完成后，在PIL-0010任务worktree交调试者解决初始导航隔离，再独立验证。风险：空API数组不覆盖CDP接入前请求，不降低真实IPC和窗口验收要求；本轮未改源或启动GUI。
