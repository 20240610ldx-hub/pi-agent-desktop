---
id: PIL-0075
title: pi-usage 真实账户额度验证
epic: E8
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: []
files_allowed: [components/ProviderUsageSummary*, lib/provider-usage*]
files_shared: []
acceptance_sha: 
waivers: []
---

## 目标

账户额度、速率窗口、费用与会话 token 分开显示，数据来自真实 provider；未知保持未知。对应 GOALS E8。

## 背景与现状

已发布（139c973）：provider/enabled scope 隔离、abort 与迟到结果拒绝、失败清快照、无账户身份 cache 停用，8/8 组件夹具。未验：真实账户与完整 schema；同 provider 下凭据更换（credential generation）未处理。

## 验收标准

- [ ] A1 规划者补全：确认用户可提供哪个 provider 的真实账户与测试额度上限，再写验收。

## 范围外

用 SDK token 冒充账户额度。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 草稿：验收需规划者核实现状后补全并冻结。
