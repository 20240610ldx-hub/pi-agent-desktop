---
id: PIL-0074
title: pi-background-tasks 接入界面与普通会话
epic: E8
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0001]
files_allowed: [lib/background-task-host*, lib/pi-background-tasks-extension*, app/api/background-tasks/**, vendor/pi-background-tasks/**, e2e/background-tasks-native.mjs, e2e/pi-background-tasks-compat.mjs, components/BackgroundTask*]
files_shared: [lib/rpc-manager*, hooks/useAgentSession*, lib/agent-event-stream*, lib/agent-event-wire*, lib/types.ts, lib/session-reader*, lib/i18n/messages/*.ts, app/native-theme.css, components/ChatWindow.tsx, package.json, package-lock.json, next.config.ts, scripts/prepare-desktop.mjs, scripts/stage-package*, scripts/web-package-layout.test.mjs, scripts/release-workflows.test.mjs, THIRD_PARTY_NOTICES.md, scripts/fork-ownership.json, docs/pilaude-pi-extensions.md]
acceptance_sha: c0b9ccf3dd51
waivers: []
---

## 目标

后台任务有真实身份、输出、退出/失败状态、停止、重连与孤儿清理，并在界面中可见；不出现双执行器。对应 GOALS E8。

## 背景与现状

已有（WIP）：SDK 1.3 兼容 gate、原样 compiled core 与 ISC 许可、host / thin SDK 工具 / HTTP 与 SSE、3 个竞态修复；Windows 完整实测 4/4（stop、timeout、close、SDK reload）。未完成：界面与普通 RPC 接线、full factory、installer。代码：`lib/background-task-host*`、`lib/pi-background-tasks-extension*`、`app/api/background-tasks/`、`vendor/pi-background-tasks/`。

## 验收标准

- [ ] A1 普通 coding 会话注册后台任务工具；启动的任务在界面列表中显示 ID、命令、状态和输出。
- [ ] A2 停止、超时、进程自行退出、失败各状态在界面与 API 一致；重连后输出不重复、不丢失。
- [ ] A3 应用退出后没有遗留的后台任务进程（Windows 上用进程列表验证）。
- [ ] A4 与现有 terminal / agent tasks 不形成两套执行器：在日志中说明二者边界并有测试固定。
- [ ] A5 受影响的测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint` 通过；`node scripts/relay.mjs guard` 无未豁免阻断项。

## 范围外

放宽 peer 依赖或强装整包。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
