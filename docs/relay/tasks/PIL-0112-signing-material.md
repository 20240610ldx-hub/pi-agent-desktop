---
id: PIL-0112
title: Windows 代码签名证书与更新密钥
epic: E11
priority: P2
status: parked
owner:
lease_until:
branch:
implementers: []
depends_on: []
files_allowed: [src-tauri/tauri.conf.json]
files_shared: []
acceptance_sha: 
waivers: []
---

## 目标

Pilaude 拥有自己的安装包签名和更新签名。对应 GOALS E11。

## 背景与现状

需要用户购买或提供代码签名证书（或签名服务）和更新密钥。agent 不能代办。

## 验收标准

- [ ] A1 用户提供证书或签名服务与更新密钥后，规划者补全验收。

## 范围外

—

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 草稿：验收需规划者核实现状后补全并冻结。
- 2026-10-19T09:50Z · claude:opus-medium:coord · parked：等待用户提供签名证书与更新密钥。
