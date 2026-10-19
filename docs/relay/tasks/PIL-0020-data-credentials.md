---
id: PIL-0020
title: 本地数据隔离与凭据加密验收
epic: E3
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: []
files_allowed: [lib/paths.ts, lib/pilaude-data*, scripts/check-native-credentials.mjs, docs/pilaude-data.md]
files_shared: []
acceptance_sha: 
waivers: []
---

## 目标

独立数据根、DPAPI 加密凭据、可选导入与脱敏都有端到端证据。对应 GOALS E3。

## 背景与现状

README 记录"已接入独立数据/加密凭据和自定义请求头保护"；Plan Task 3 复选框未勾选。说明文档：`docs/pilaude-data.md`。

## 验收标准

- [ ] A1 规划者补全：对照 Plan Task 3 与 Spec 第 5 节逐项核实现状并写验收。

## 范围外

云同步。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 草稿：验收需规划者核实现状后补全并冻结。
