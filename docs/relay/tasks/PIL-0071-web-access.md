---
id: PIL-0071
title: pi-web-access 接入普通会话
epic: E8
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0001]
files_allowed: [lib/pi-web-access-extension*]
files_shared: [lib/rpc-manager*, hooks/useAgentSession*, lib/agent-event-stream*, lib/agent-event-wire*, lib/types.ts, lib/session-reader*, lib/i18n/messages/*.ts, app/native-theme.css, components/ChatWindow.tsx, package.json, package-lock.json, next.config.ts, scripts/prepare-desktop.mjs, scripts/stage-package*, scripts/web-package-layout.test.mjs, scripts/release-workflows.test.mjs, THIRD_PARTY_NOTICES.md, scripts/fork-ownership.json, docs/pilaude-pi-extensions.md]
acceptance_sha: 258420678750
waivers: []
---

## 目标

普通 coding 会话可以使用 `pi-web-access` 0.42.0 的搜索与抓取，来源在界面中可见；网页内容不能成为指令或审批来源。对应 GOALS E8。

## 背景与现状

已有（WIP，未提交）：真实 published dist 受限 raw fetch 与 branch-owned retrieval 11/11、RPC 注册接点、web/Plan 临时 staging。未验：真实公网 provider、full factory 跨会话、GUI、Windows、干净安装。代码见 `lib/pi-web-access-extension*`，PIL-0001 后在 `wip/pre-relay-2026-10-19`。

## 验收标准

- [ ] A1 普通 coding 会话注册 web 工具，工具列表中可见且不重复。验证：真实 SDK 集成测试。
- [ ] A2 用本地 HTTP 夹具服务器验证抓取、取消、超时、错误与缓存隔离（不同会话不共享）；网页中「忽略以上指令」之类的文本不会改变工具权限或触发审批。
- [ ] A3 用一次真实公网请求（无需凭据的 provider）在桌面开发构建中完成搜索或抓取，来源链接在消息中可见；截图存证。
- [ ] A4 打包 staging 包含运行所需全部文件：`npm run desktop:prepare && npm run desktop:verify` 通过。
- [ ] A5 受影响的测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint` 通过；`node scripts/relay.mjs guard` 无未豁免阻断项。

## 范围外

需要付费凭据的 provider。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
