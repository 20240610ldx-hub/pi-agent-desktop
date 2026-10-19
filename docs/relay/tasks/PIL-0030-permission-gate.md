---
id: PIL-0030
title: 统一执行前授权并接入 pi-permission-system
epic: E4
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0001]
files_allowed: [lib/builtin-permission-extension*, lib/permission*, e2e/permission-child-lifecycle-compat.mjs, lib/subagent-lifecycle*, components/Permission*]
files_shared: [lib/rpc-manager*, hooks/useAgentSession*, lib/agent-event-stream*, lib/agent-event-wire*, lib/types.ts, lib/session-reader*, lib/i18n/messages/*.ts, app/native-theme.css, components/ChatWindow.tsx, package.json, package-lock.json, next.config.ts, scripts/prepare-desktop.mjs, scripts/stage-package*, scripts/web-package-layout.test.mjs, scripts/release-workflows.test.mjs, THIRD_PARTY_NOTICES.md, scripts/fork-ownership.json, docs/pilaude-pi-extensions.md, lib/subagent-runtime.ts]
acceptance_sha: 782beb95d005
waivers: []
---

## 目标

所有工具调用在执行前经过 Pilaude 的同一个授权门；拒绝或待批时执行计数为 0。`@gotgenes/pi-permission-system` 作为该授权门的策略来源接入普通 coding 会话。对应 GOALS E4 与 E8。

## 背景与现状

已有：child bridge 生命周期 6/6、真实 subscriber/registry/dialog/gate 组件 9/9、完整官方 factory / fs ConfigStore / Zod / WASM adapter 冻结并 review 通过（WIP，未提交）。缺口：普通 coding 会话注册行未接；`!bash`、PowerShell 原生 AST、扩展内部 IO、强制 child 上限与 parent absent 未覆盖。插件不得改变当前开发会话或系统权限。详见 `docs/engineering/pilaude-extensions/permissions-status-usage.md`（历史档案）。

## 验收标准

- [ ] A1 普通 coding 会话加载 permission 扩展（固定版本 41.0.0），工具调用前生效；对未授权项目执行写入、删除、越界路径与任意 shell，执行 spy 计数为 0，界面显示待批或已拒绝。验证：真实 SDK 集成测试。
- [ ] A2 批准后恰好执行一次；拒绝、取消、超时、撤权、重放审批都不执行。验证：执行计数测试逐项覆盖。
- [ ] A3 嵌套（子代理）、MCP 工具、定时任务的调用经过同一授权门，子代理不能获得父会话之外的权限。
- [ ] A4 列出仍未覆盖的入口（如 `!bash`、PowerShell AST），对这些入口默认拒绝执行而不是放行，并在设置页显示说明。
- [ ] A5 受影响的测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint` 通过；`node scripts/relay.mjs guard` 无未豁免阻断项。

## 范围外

计划审阅（PIL-0073）的批准不授予工具权限；Auto/Bypass 模式。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
- 2026-10-19T14:21Z · codex:gpt:coord · 做了：恢复原权限owner上下文并收只读迁移材料，D:/pilaude/relay-evidence/PIL-0001/recovery-permissions/handoff.md及manifest.json含六条原字节/source映射，均与working23329458一致，共享RPC两条与既有Plan owner快照一致；本轮无源码或index改动。状态：最后initial-health单hunk确有独立CLEAN，普通coding permission唯一注册已接，位于read-only MCP policy后，因此本卡背景未接线说明已过时；这不是本卡实际执行前授权验收通过。下一步：暂停，PIL-0001完成且用户恢复工作后再按任务worktree迁入精确权限hunks，优先真实normal操作计数及未覆盖入口默认拒绝，再独立验证。风险：!bash直executeBash、PowerShell原生AST、child权限上限/parent absent、真实MCP和scheduled同门、审批重放仍未覆盖；不把旧6/9/定向证据拼成完整AC通过。
