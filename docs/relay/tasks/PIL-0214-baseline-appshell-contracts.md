---
id: PIL-0214
title: 对齐 AppShell 两处源码契约测试（desktop 门控、工作区可见性恢复）
epic: E0
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0002]
files_allowed: [components/AppShell.tsx, components/AppShell-session-reset.test.mjs, components/AppShell.terminal.test.mjs]
files_shared: []
acceptance_sha:
waivers: []
---

## 目标

让下列 Windows 基线失败用例通过且不引入新失败，使 `npm test` 基线可信（GOALS E11 Windows 基线）。

## 背景与现状

来源：PIL-0002 基线文档 `docs/relay/test-baseline.md`（证据 `D:/pilaude/relay-evidence/PIL-0002/impl/npm-test-bounded-cache.log`）。

- 失败测试：desktop-only workspace and health behavior is gated before use；workspace visibility restores independently of file or terminal tabs
- 测试文件：components/AppShell-session-reset.test.mjs、components/AppShell.terminal.test.mjs
- 原因与归类：日志首行：`The input did not match the regular expression /desktopMode ? getPrefJson<PersistedWorkspace>/` 与 `/if (workspacePanesRestored) setPrefJson(APP_PREF_KEYS.workspacePaneVisibility, rightPanelOpen)/`。静态源码模式在当前 AppShell.tsx 中找不到。分开归类：`desktop-only workspace and health behavior is gated before use`（`/desktopMode ? getPrefJson<PersistedWorkspace>/`）upstream 通过，归类 fork 回归（既有契约被 fork 改动破坏）；`workspace visibility restores independently of file or terminal tabs`（`/if (workspacePanesRestored) setPrefJson(...)/`）upstream 无此用例（fork 自有测试，同文件另两例 upstream 通过），归类 既有缺陷（fork-only 测试与实现漂移）。
- 复现：`node --test <测试文件>`

## 验收标准

- [ ] A1 上列失败测试全部通过。验证：对 components/AppShell-session-reset.test.mjs、components/AppShell.terminal.test.mjs 逐个运行 `node --test <文件>` 退出码 0。
- [ ] A2 `npm test` 相对 PIL-0002 基线无新增失败，且基线中属本卡的用例消失。验证：全量运行并与基线文档对比失败名单。
- [ ] A3 不删除、跳过或放宽任何断言；`npm run lint`、`node_modules/.bin/tsc --noEmit` 通过；`node scripts/relay.mjs guard` 无阻断项。

## 范围外

基线文档列出的其他失败用例；与上述用例无关的重构。

## 实现提示

先判断是 AppShell.tsx 行为漂移还是测试模式过时：若行为仍正确，改写测试为断言同一行为（不得删除/跳过/放宽）；若行为丢失，恢复实现。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T11:19Z · planner · 创建
- 2026-10-22T11:30Z · claude-cli:sonnet-medium:impl · 由 PIL-0002 基线 A4 转出，写入目标、背景与验收（未冻结）
