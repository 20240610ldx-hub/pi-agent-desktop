---
id: PIL-0014
title: 把组件复刻基准拆成逐组件任务卡
epic: E2
priority: P1
status: in_progress
owner: claude:sonnet-high:impl
lease_until: 2026-10-19T17:09Z
branch: task/PIL-0014-parity-index
implementers: [claude:sonnet-high:impl]
depends_on: []
files_allowed: [docs/relay/parity-index.md]
files_shared: []
acceptance_sha: 3b883a2b6317
waivers: []
---

## 目标

让界面复刻从一份 108KB 的长文变成可领取、可验收的组件任务。对应 GOALS E2。

## 背景与现状

`docs/pilaude-ui-parity.md`（复刻基准）、`docs/pilaude-component-adoption.md`（open-claude-ui 采用账本）、`docs/pilaude-agent-output-ui.md` 记录了逐组件的参考、残差与证据；私有参考图在工作区 `references/`（不得复制进仓库）。

## 验收标准

- [ ] A1 产出 `docs/relay/parity-index.md`：每个组件一行，列出参考图是否齐全（版本、DPI 是否已知）、当前实现状态、已有证据的位置、已知残差。不复制参考图内容。
- [ ] A2 每个尚未通过复刻验收的组件都有一张 E2 任务卡（可不冻结），卡片验收要求同帧量测（宽高、比例、间距、基线、对齐）与交互核验（适用的输入法、焦点、滚动、缩放、深浅色）。
- [ ] A3 列出缺少参考图的组件清单，交给用户决定是否补采。
- [ ] A4 不修改任何产品代码。

## 范围外

实现任何组件改动。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
- 2026-10-19T14:09Z · claude:sonnet-high:impl · 领取，租约至 2026-10-19T17:09Z
