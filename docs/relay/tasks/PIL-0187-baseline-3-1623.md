---
id: PIL-0187
title: 视觉复刻基准迁移到 Windows Claude Desktop 3.1623.0.0（用户决定）
epic: E2
priority: P1
status: verify
owner: claude:opus-medium:impl
lease_until: 2026-10-21T11:07Z
branch: task/PIL-0187-baseline-3-1623
implementers: [claude:opus-medium:impl]
depends_on: []
files_allowed: [docs/relay/GOALS.md]
files_shared: []
acceptance_sha: 619f325ee013
waivers: [R6]
---

## 目标

GOALS E2 的组件复刻参照版本从 Windows Claude Desktop 2.42304.0 改为 3.1623.0.0，使 62 张组件卡以 2026-10-21 起的新参考批次为最高视觉基准。

## 背景与现状

- `docs/relay/GOALS.md` 第 17 行："每个组件以 Windows Claude Desktop 2.42304.0 为参照逐状态对照"。
- 2026-10-21 用户在对话中决定："the baseline move to 3.1623"。新批次采样条件记录在私有 `references/claude-desktop/SAMPLING.md`（MSIX 3.1623.0.0、2560×1600、150%／AppliedDPI 144），本卡只引用版本号与采样条件类别，不复制私有内容。
- GOALS.md 为受保护文件；用户授权本卡修改（豁免 R6）。组件卡与 `parity-index.md` 中的版本表述由规划者在冻结前修订轮另行同步，不在本卡范围。

## 验收标准

- [ ] A1 GOALS.md 中组件复刻参照版本写为 Windows Claude Desktop 3.1623.0.0，并注明：采样条件见私有参考的采样记录；旧 2.42304.0 批次只作历史参考，不与新批次混作同版本；"只接主题或功能可用不算复刻通过"的要求原样保留。验证：`git diff` 阅读。
- [ ] A2 GOALS.md 其他条目无任何改动（diff 只涉及该条目）；`node scripts/relay.mjs check` 通过；`node scripts/relay.mjs guard --task PIL-0187` 除已豁免 R6 外无阻断项。

## 范围外

组件卡、parity-index 的版本文字同步；任何产品代码。

## 实现提示

只改一条；不要重写 GOALS 其他段落。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-21T08:06Z · planner · 创建
- 2026-10-21T08:07Z · planner · 冻结验收标准 619f325ee013
- 2026-10-21T08:07Z · claude:opus-medium:planner · 用户 2026-10-21 在对话中决定视觉基准迁移到 3.1623，授权修改受保护的 GOALS.md（豁免 R6）
- 2026-10-21T08:07Z · claude:opus-medium:impl · 领取，租约至 2026-10-21T11:07Z
- 2026-10-21T08:07Z · claude:opus-medium:impl · 做了：GOALS.md 第 17 行参照版本改为 3.1623.0.0，注明用户决定、采样记录出处与旧批次仅历史参考，保留复刻通过要求 / 状态：提交 34bbe6c，guard 仅已豁免 R6 / 下一步：验证 / 风险：组件卡与 parity-index 的版本文字仍为旧版，待规划修订轮同步
- 2026-10-21T08:07Z · claude:opus-medium:impl · in_progress → verify
