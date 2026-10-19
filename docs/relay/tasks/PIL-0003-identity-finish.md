---
id: PIL-0003
title: 产品与更新身份收尾核验
epic: E1
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: []
files_allowed: [src-tauri/tauri.conf.json, src-tauri/tauri.*.conf.json, lib/branding*, components/AppUpdatesSection.tsx]
files_shared: []
acceptance_sha: 
waivers: []
---

## 目标

确认 Plan Task 1 的每一项身份要求都有证据：UI、窗口、托盘、安装包、单实例为 Pilaude，无自有签名时不回退上游更新通道。对应 GOALS E1。

## 背景与现状

`tauri.conf.json` 已为 Pilaude / `io.github.20240610ldx-hub.pilaude`，`lib/branding.test.mjs` 存在；Plan Task 1 的复选框均未勾选，实际完成度未核实。

## 验收标准

- [ ] A1 规划者补全：对照 Plan Task 1 逐项核实，已满足的写成验证命令，未满足的写成实现项。

## 范围外

签名证书本身（PIL-0112）。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 草稿：验收需规划者核实现状后补全并冻结。
