---
id: PIL-0073
title: Plannotator 计划审阅接入
epic: E8
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0001]
files_allowed: [lib/builtin-plannotator-extension*, lib/plannotator-extension*, lib/plan-review-runtime.ts, lib/session-plan-review*, components/PlanReviewPanel*, hooks/usePlanReview.ts, e2e/plannotator-compat.mjs]
files_shared: [lib/rpc-manager*, hooks/useAgentSession*, lib/agent-event-stream*, lib/agent-event-wire*, lib/types.ts, lib/session-reader*, lib/i18n/messages/*.ts, app/native-theme.css, components/ChatWindow.tsx, package.json, package-lock.json, next.config.ts, scripts/prepare-desktop.mjs, scripts/stage-package*, scripts/web-package-layout.test.mjs, scripts/release-workflows.test.mjs, THIRD_PARTY_NOTICES.md, scripts/fork-ownership.json, docs/pilaude-pi-extensions.md]
acceptance_sha: b8f45ffadac9
waivers: []
---

## 目标

智能体提交的计划可以在 Pilaude 中审阅、修订、批准或拒绝，决策回流到会话；计划批准不授予工具权限，资源缺失时不会伪造批准。对应 GOALS E8。

## 背景与现状

已有（WIP）：guard 真实 SDK 3 项、本机 HTTP approve 与 deny/abort、branch/shutdown late、event API、asset race 各自定向通过。未完成：projection、RPC、UI（`components/PlanReviewPanel*`、`hooks/usePlanReview.ts`）、整体 review、Windows。

## 验收标准

- [ ] A1 普通会话中调用计划审阅，界面出现审阅面板，内容与提交的计划一致。验证：组件测试 + 浏览器截图。
- [ ] A2 批准、拒绝、修订、取消、关闭窗口、重连、迟到结果各路径的会话状态正确；迟到结果不会覆盖已作出的决定。
- [ ] A3 审阅服务资源缺失或启动失败时，结果为错误而非批准；历史中的 pending 状态不显示为可用的活动端口。
- [ ] A4 计划批准后，工具调用仍需经过 PIL-0030 的授权门（若 PIL-0030 未完成，以执行计数测试证明批准本身不放行工具）。
- [ ] A5 受影响的测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint` 通过；`node scripts/relay.mjs guard` 无未豁免阻断项。

## 范围外

计划编辑器的高级标注功能。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
