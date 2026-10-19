---
id: PIL-0012
title: 公式流式光标的特殊情形
epic: E2
priority: P3
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: []
files_allowed: [lib/markdown-streaming-caret.ts, components/MarkdownBody*, e2e/streaming-caret-boundaries.mjs]
files_shared: []
acceptance_sha: 
waivers: []
---

## 目标

公式的 tag、fleqn、leqno、多行、wide、katex-error 与 raw 情形下，流式光标位置正确或明确不显示。对应 GOALS E2。

## 背景与现状

simple display 公式已在 7339326 通过；特殊情形未支持或未验证。相关代码：`lib/markdown-streaming-caret.ts`、`components/MarkdownBody.tsx`，e2e：`E2E_CARET_FORMULA_ONLY=1 node e2e/streaming-caret-boundaries.mjs`。

## 验收标准

- [ ] A1 规划者补全：逐个特殊情形写出期望行为与验证命令。

## 范围外

simple display 已通过的部分。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 草稿：验收需规划者核实现状后补全并冻结。
