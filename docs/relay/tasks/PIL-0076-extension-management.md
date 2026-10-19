---
id: PIL-0076
title: 扩展安装、启停、卸载与回退
epic: E8
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: []
files_allowed: [components/PluginsConfig.tsx, components/SkillsConfig.tsx, app/api/plugins/**, app/api/skills/**, lib/recommended-pi-extensions*, components/RecommendedPiExtensions*]
files_shared: []
acceptance_sha: 
waivers: []
---

## 目标

用户可以安装、启用、停用、卸载扩展，更新失败可回退，坏配置不导致崩溃，状态清楚区分已保存 / 待重载 / 运行中。对应 GOALS E8。

## 背景与现状

Plan Task 8；现有 Plugins / Skills / MCP 管理来自上游与 fork。

## 验收标准

- [ ] A1 规划者补全：核实现有覆盖，按 Plan Task 8 写缺口验收。

## 范围外

自建插件商店。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 草稿：验收需规划者核实现状后补全并冻结。
