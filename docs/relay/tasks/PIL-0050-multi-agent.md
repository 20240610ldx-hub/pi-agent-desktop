---
id: PIL-0050
title: 多代理完整流程与 pi-subagents 适配
epic: E6
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0030, PIL-0202]
files_allowed: [lib/subagent*, app/api/subagents/**, components/AgentsConfig.tsx]
files_shared: [lib/rpc-manager*, hooks/useAgentSession*, lib/agent-event-stream*, lib/agent-event-wire*, lib/types.ts, lib/session-reader*, lib/i18n/messages/*.ts, app/native-theme.css, components/ChatWindow.tsx]
acceptance_sha: 
waivers: []
---

## 目标

多代理有可控并行、深度上限、父子取消传播、撤权与重启中断标记；明确 `pi-subagents` 与现有执行器的关系并做最小真实适配。对应 GOALS E6 与 E8。

## 背景与现状

产品现用 `subagent-extension` / runtime 与 Agents UI；`pi-subagents` 0.79.1 未安装为第二执行器。已发布：真实 loader alias 识别（2254561，27/27）。Plan Task 6 要求 4 活动总额、深度 2、超额队列等。

## 验收标准

- [ ] A1 规划者补全：写出 pi-subagents 与现有执行器的差距表，选定最小适配，按 Plan Task 6 写验收。

## 范围外

无限递归、自组织团队、跨机器协同。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 草稿：验收需规划者核实现状后补全并冻结。
