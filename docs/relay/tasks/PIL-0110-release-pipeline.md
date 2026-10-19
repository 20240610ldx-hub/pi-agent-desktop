---
id: PIL-0110
title: 发布检查器与 Windows 安装包流水线
epic: E11
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: []
files_allowed: [scripts/verify-release-components.mjs, scripts/release-*.mjs, .github/workflows/**, docs/release*.md]
files_shared: []
acceptance_sha: 
waivers: []
---

## 目标

发布检查器能识别缺签名、错更新源、缺浏览器、缺验收记录等问题；能产出可审阅的开发安装包、校验值与第三方声明。对应 GOALS E11。

## 背景与现状

Plan Task 11；`desktop:prepare` 与 `desktop:verify` 曾通过。签名材料见 PIL-0112。

## 验收标准

- [ ] A1 规划者补全：按 Plan Task 11 写验收（先用错误夹具证明检查器会失败）。

## 范围外

真实签名（PIL-0112）。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 草稿：验收需规划者核实现状后补全并冻结。
