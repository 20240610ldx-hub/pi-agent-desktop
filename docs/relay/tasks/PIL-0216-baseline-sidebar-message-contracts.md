---
id: PIL-0216
title: 修复侧栏触屏菜单可达与中断工具调用标记契约测试
epic: E0
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0002]
files_allowed: [components/SessionSidebar.tsx, components/MessageView.tsx, components/sidebar-and-message-updates.test.mjs]
files_shared: []
acceptance_sha:
waivers: []
---

## 目标

让下列 Windows 基线失败用例通过且不引入新失败，使 `npm test` 基线可信（GOALS E11 Windows 基线）。

## 背景与现状

来源：PIL-0002 基线文档 `docs/relay/test-baseline.md`（证据 `D:/pilaude/relay-evidence/PIL-0002/impl/npm-test-bounded-cache.log`）。

- 失败测试：session rows keep the action menu reachable on touch devices；interrupted tool calls render a cancelled marker instead of success styling
- 测试文件：components/sidebar-and-message-updates.test.mjs
- 原因与归类：日志首行：`The input did not match the regular expression /hovered || treeFocused || touchMode || menuOpen ?/` 与 `/aborted={!isStreaming && !result}/`。两个源码模式在当前实现中不存在；upstream 两个用例均通过。归类：fork 回归。
- 复现：`node --test <测试文件>`

## 验收标准

- [ ] A1 上列失败测试全部通过。验证：对 components/sidebar-and-message-updates.test.mjs 逐个运行 `node --test <文件>` 退出码 0。
- [ ] A2 `npm test` 相对 PIL-0002 基线无新增失败，且基线中属本卡的用例消失。验证：全量运行并与基线文档对比失败名单。
- [ ] A3 不删除、跳过或放宽任何断言；`npm run lint`、`node_modules/.bin/tsc --noEmit` 通过；`node scripts/relay.mjs guard` 无阻断项。

## 范围外

基线文档列出的其他失败用例；与上述用例无关的重构。

## 实现提示

核对触屏下行内菜单可见性与被中断工具调用的取消标记是否仍有等价实现：丢失则恢复，仅测试模式过时则改为断言同一行为。不得删除或放宽。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T11:19Z · planner · 创建
- 2026-10-22T11:30Z · claude-cli:sonnet-medium:impl · 由 PIL-0002 基线 A4 转出，写入目标、背景与验收（未冻结）
