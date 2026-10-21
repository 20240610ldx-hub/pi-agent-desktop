---
id: PIL-0196
title: 受控浏览器 pane 桥接契约
epic: E5
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: []
files_allowed: []
files_shared: []
acceptance_sha:
waivers: []
---

## 目标

一到三句话：完成后用户能做什么、产品哪里变了。写明对应 [GOALS](../GOALS.md) 的哪一条。

## 背景与现状

只写接手者开工需要的事实：现有代码位置、已知失败、相关文档段落链接。不写历史流水账。

## 验收标准

每条可以被一个不了解实现过程的人独立判定通过或失败。写清验证方式。

- [ ] A1 行为描述。验证：`具体命令` 退出码 0，或手动步骤 + 期望可见结果。
- [ ] A2 失败/取消/恢复路径。验证：……
- [ ] A3 `npm run lint`、`node_modules/.bin/tsc --noEmit` 与受影响测试文件通过；`node scripts/relay.mjs guard` 无阻断项。

## 范围外

明确不做的事，防止范围漂移。

## 实现提示

可选：建议入口文件、需要先读的 docs/agents 主题、已知坑。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-21T12:28Z · planner · 创建
