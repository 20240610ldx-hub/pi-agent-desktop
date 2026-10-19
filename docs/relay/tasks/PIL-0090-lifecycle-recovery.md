---
id: PIL-0090
title: 生命周期与崩溃恢复
epic: E9
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: []
files_allowed: [src-tauri/src/lifecycle*, lib/workspace-state.ts, desktop/**]
files_shared: []
acceptance_sha: 
waivers: []
---

## 目标

关窗只隐藏，明确退出时终止任务且不留子进程；崩溃重启后状态可恢复、不自动重发。对应 GOALS E9。

## 背景与现状

Plan Task 9 与 Spec 第 11 节。

## 验收标准

- [ ] A1 规划者补全：按 Plan Task 9 写验收（注入运行中、待审批、写文件、下载、父子任务等状态）。

## 范围外

系统后台服务。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 草稿：验收需规划者核实现状后补全并冻结。
