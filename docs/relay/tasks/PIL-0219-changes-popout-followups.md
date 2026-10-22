---
id: PIL-0219
title: Changes 弹窗记录残留与校验断言
epic: PIL-0010
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0010]
files_allowed: [components/AppShell.tsx, lib/changes-window-state.ts, lib/changes-window-state.test.mjs, app/changes/page.tsx, app/changes/page.test.mjs, components/ChangesPane.tsx, components/ChangesPane.window.test.mjs]
files_shared: []
acceptance_sha:
waivers: []
---

## 目标

修掉 PIL-0010 评审（`D:\pilaude\relay-evidence\PIL-0010\review\REVIEW.md`）指出的两处残留：独立 Changes 窗口开窗失败时不再留下无效视图记录，视图记录被淘汰后保存失败可见，非法 id 记录不会被读取，并补上对应的直接断言。对应 [GOALS](../GOALS.md) 中独立 Changes 窗口的恢复与可靠性条目。

## 背景与现状

- F4（低）：`components/AppShell.tsx` 的 `openChangesPopout` 先写视图记录再开窗。开窗失败时记录残留，占用上限（8 条）并挤掉有效记录；`updateChangesWindowView` 找不到记录时静默返回，不触发 `saveFailed`。
- F2：`isChangesViewId` 没有直接断言。开窗边界由 `desktop-native.ts` 正则与 Rust 长度校验覆盖，但读取侧从未直接测试“存储里预置的非法 id 记录被过滤”。
- 可选（不阻断）：`components/ChangesPane.tsx` 的 diff 滚动 `onScroll` 每次都经 `onViewStateChange` 触发 `updateChangesWindowView`（多次 parse/stringify 全部记录）；可节流（rAF 或 200ms）。
- 视图记录存储位于 `lib/changes-window-state.ts`，相关测试在 `lib/changes-window-state.test.mjs` 与 `components/ChangesPane.window.test.mjs`。

## 验收标准

每条可以被一个不了解实现过程的人独立判定通过或失败。写清验证方式。

- [ ] A1 `openChangesPopout` 的 `.catch`（开窗失败）中删除刚创建的视图记录。验证：`node --experimental-strip-types --test components/ChangesPane.window.test.mjs` 退出码 0，且其中有一条用例模拟开窗失败后断言记录已被删除；把该删除行临时去掉时该用例变红。
- [ ] A2 `lib/changes-window-state.ts` 的 `updateChangesWindowView` 在记录不存在（已被淘汰）时返回 `false`（成功返回 `true`），`app/changes/page.tsx` 的调用方据此显示 `saveFailed`。验证：`node --experimental-strip-types --test lib/changes-window-state.test.mjs` 退出码 0，含“记录缺失返回 false”的断言；把返回值改回 `void` 时该断言变红。
- [ ] A3 存储中预置一条非法 viewId 的记录时，`records()` 过滤掉它，且不影响合法记录。验证：同上测试文件中有对应用例，通过；把 `isChangesViewId` 过滤去掉时该用例变红。
- [ ] A4 变异检查：分别破坏 A1、A2、A3 对应的一行代码，每次至少一条测试变红，还原后全绿（记录变异前后的命令输出）。
- [ ] A5 `node_modules/.bin/tsc --noEmit`、`npm run lint` 与上述测试文件通过；`node scripts/relay.mjs guard` 无阻断项。

## 范围外

- 不改 Rust 侧（`src-tauri/**`）与 capability 文件。
- 不改开窗的 origin/viewId 校验逻辑本身。
- 不做 F1（窗口生命周期，已归 PIL-0200）、F3（e2e 分组）、F5（提示措辞）。
- 可选的 diff 滚动节流与三语文案搬入 `copy` 表不是本卡验收项；如要做，单独记入日志并加一条 A 项。

## 实现提示

- 入口：`components/AppShell.tsx` 中 `openChangesPopout`（约 1941 行）；存储、`isChangesViewId`（约 99–131 行）与 `updateChangesWindowView` 在 `lib/changes-window-state.ts`；保存调用方在 `app/changes/page.tsx`（约 96 行）。
- 本卡不要求先读其他 docs/agents 主题。
- 测试为 jiti 加载 TS 的 `.test.mjs`，内存 localStorage，直接调用真实模块，不要 mock 被测逻辑。
- 已知坑：记录上限为 8 条，测试中需要构造 9 条以上记录才能触发淘汰。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T13:21Z · planner · 创建
- 2026-10-22 · planner · 依据 REVIEW.md F2、F4 与可选意见补全正文，files_allowed 收窄为壳文件、状态模块与对应测试；未 freeze
