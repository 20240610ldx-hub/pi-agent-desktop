---
id: PIL-0060
title: 定时任务接入授权与浏览器
epic: E7
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0030]
files_allowed: [lib/scheduled-tasks/**, app/api/scheduled-tasks/**, components/scheduled/**, hooks/useScheduledTasks.ts]
files_shared: []
acceptance_sha: 
waivers: []
---

## 目标

定时任务默认只读，接入授权、队列与浏览器；时区、夏令时、睡眠补跑、去重、不重叠、隐藏窗口审批都有假时钟测试。对应 GOALS E7。

## 背景与现状

上游已有定时任务（ADR 0007、`docs/agents/scheduled-tasks.md`）。Plan Task 7 要求在此之上接入授权与浏览器。

## 验收标准

- [ ] A1 规划者补全：核实上游已有覆盖，只为缺口写验收。

## 范围外

应用退出后仍运行的系统后台服务。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 草稿：验收需规划者核实现状后补全并冻结。
