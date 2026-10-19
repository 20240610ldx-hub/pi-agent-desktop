---
id: PIL-0070
title: Todo 扩展收尾：GUI 全链与干净安装
epic: E8
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0001]
files_allowed: [lib/builtin-todo-*, lib/session-todos*, components/SessionTodoPanel*, e2e/rpiv-todo-compat.mjs, e2e/activity-disclosure.mjs]
files_shared: [lib/rpc-manager*, hooks/useAgentSession*, lib/agent-event-stream*, lib/agent-event-wire*, lib/types.ts, lib/session-reader*, lib/i18n/messages/*.ts, app/native-theme.css, components/ChatWindow.tsx, package.json, package-lock.json, next.config.ts, scripts/prepare-desktop.mjs, scripts/stage-package*, scripts/web-package-layout.test.mjs, scripts/release-workflows.test.mjs, THIRD_PARTY_NOTICES.md, scripts/fork-ownership.json, docs/pilaude-pi-extensions.md]
acceptance_sha: c60c2c2e0477
waivers: []
---

## 目标

`@juicesharp/rpiv-todo` 从模型调用到原生面板的全链路在桌面应用中实测通过，并在干净安装下可用。对应 GOALS E8。

## 背景与现状

已发布（2254561）：canonical backend、RPC 注册、hook / 原生面板、真实 factory、重复工具与 alias 修复，320 pass / 1 既有 skip。未验：干净 lock 安装（之前复用 node_modules junction）、完整包到 GUI、installer、Windows；raw factory 初始 XDG 读取未隔离。

## 验收标准

- [ ] A1 干净安装：新 worktree 中 `npm ci` 后，Todo 相关测试（`lib/builtin-todo-*.test.mjs`、`lib/session-todos.test.mjs`、`components/SessionTodoPanel.test.mjs`）通过。
- [ ] A2 桌面开发构建中，用本地夹具模型触发 todo 工具，面板显示、更新、分支切换与重连后状态一致；截图存证。
- [ ] A3 raw factory 初始化不读取用户真实 XDG 目录：用临时 HOME/XDG 验证初始读取只发生在应用 agentDir 内。
- [ ] A4 受影响的测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint` 通过；`node scripts/relay.mjs guard` 无未豁免阻断项。

## 范围外

installer 打包（PIL-0110）。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
