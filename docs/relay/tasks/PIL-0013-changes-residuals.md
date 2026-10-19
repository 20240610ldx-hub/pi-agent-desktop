---
id: PIL-0013
title: Changes 面板剩余交互与视觉残差
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0010]
files_allowed: [components/ChangesPane*, components/ReviewDiff*, e2e/changes-focus.mjs]
files_shared: []
acceptance_sha: 
waivers: []
---

## 目标

收尾 Changes 面板：真实窗口反馈与草稿 ACK、83 行换行、滚动条、外卡、字形，以及 inline comment 的参考补齐。对应 GOALS E2。

## 背景与现状

Changes 已迁移到 `react-diff-view@3.3.3`（提交 5974352），九组浏览器与真实 Git 证据保留；残差记录在复刻基准（历史档案）。

## 验收标准

- [ ] A1 规划者补全：按残差逐条写验收（需先由 PIL-0014 的索引确认参考图可用）。

## 范围外

Changes 独立窗口（PIL-0010）。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 草稿：验收需规划者核实现状后补全并冻结。
