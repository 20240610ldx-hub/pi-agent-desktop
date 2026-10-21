---
id: PIL-0177
title: 删除无消费者的 recent-sessions 并把菜单文档改为全走 DOM（用户决定）
epic: E2
priority: P2
status: review
owner: codex-plus:gpt-xhigh:impl
lease_until: 2026-10-21T09:56Z
branch: task/PIL-0177-recent-sessions-dom-menus
implementers: [codex-plus:gpt-xhigh:impl]
depends_on: [PIL-0113]
files_allowed: [lib/recent-sessions.ts, lib/recent-sessions.test.mjs, docs/agents/fork-desktop.md, AGENTS.md, docs/merge-history.md, components/ChatInput.tsx]
files_shared: []
acceptance_sha: 6e4cea828ac8
waivers: [R1]
---

## 目标

清掉 PIL-0113 合入后留下的两处与用户决定不符的残留：`lib/recent-sessions.ts` 已无消费者；菜单已按用户决定全部走 DOM（`NATIVE_POPUP_MENUS_ENABLED = false`），文档仍描述原生弹出。对应 GOALS E2。

## 背景与现状

- 2026-10-21 用户决定：删除 `lib/recent-sessions.ts`（含测试，豁免 R1）；菜单全走 DOM。
- PIL-0113 评审非阻断项：`docs/agents/fork-desktop.md` 第 12–13 行仍写文件右键为原生菜单、`NEXT_PUBLIC_NATIVE_POPUP_MENUS=0` 关闭原生弹出；`components/ChatInput.tsx` 约 1060 行 `restoreSubmission` 注释仍提已删除的 `clearInput`；AGENTS.md「Declined upstream UI」清单列有 `DirectoryPicker`、`SessionSearch`，但两者在合并前已被使用。
- AGENTS.md Hard rule「Native popup menus are built in Rust (`show_popup_menu`); do not go back to the JS `Menu` API」仍成立（DOM 菜单不是 JS `Menu` API），只需补充说明当前默认走 DOM。

## 验收标准

- [ ] A1 `lib/recent-sessions.ts` 与 `lib/recent-sessions.test.mjs` 删除；`git grep -n "recent-sessions"` 在代码中无引用（`docs/merge-history.md` 历史记录除外）；R1 豁免引用本卡与用户决定。
- [ ] A2 `docs/agents/fork-desktop.md` 与 AGENTS.md 准确描述：所有弹出菜单走 DOM 主题菜单，`NATIVE_POPUP_MENUS_ENABLED = false`，Rust `show_popup_menu` 保留为备用路径；不再出现与现状矛盾的句子。AGENTS.md 已拒绝 UI 清单订正 `DirectoryPicker`／`SessionSearch` 的实际状态（写明它们是 fork 自己在用的组件，拒绝的是上游的对应放置方式），并在 `docs/merge-history.md` 记一行。
- [ ] A3 `ChatInput.tsx` 的过时注释更新为当前行为；不改任何逻辑（`git diff` 仅注释行）。
- [ ] A4 `npm test` 相对 PIL-0113 合入后基线无新增失败；`tsc --noEmit`、`npm run lint` 通过；`node scripts/relay.mjs guard` 除已豁免的 R1 外无阻断项。

## 范围外

两套置顶／归档存储的统一、composer e2e 几何覆盖（另行开卡）。

## 实现提示

先读 AGENTS.md 的 Hard rules 与「Upstream merge decisions」，以及 `docs/merge-history.md` 最新段落。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |
| A1 | ls lib/recent-sessions* 无文件；git grep -n recent-sessions 仅命中 docs/merge-history.md 历史、STATUS/任务卡、SessionSidebar.test.mjs 的 doesNotMatch 负向断言，代码无引用；guard 显示 R1 已豁免 | 通过 | D:/pilaude/relay-evidence/PIL-0177/verify/A1.log | 418cb12 | claude:sonnet-high:verify |
| A2 | git diff 418cb12^ 418cb12 -- docs AGENTS.md；确认 lib/desktop-menu.ts:29 NATIVE_POPUP_MENUS_ENABLED=false；grep 全部 AGENTS.md/docs/agents 无矛盾句；Hard rule 保留 JS Menu API 禁令；DirectoryPicker/SessionSearch 订正与源码（AppShell/ProjectPicker/SessionSidebar 使用）一致；merge-history 新增一段 | 通过 | D:/pilaude/relay-evidence/PIL-0177/verify/A2.log | 418cb12 | claude:sonnet-high:verify |
| A3 | git diff 418cb12^ 418cb12 -- components/ChatInput.tsx：仅 1 处注释（-3/+2 行），无逻辑改动；新注释与 restoreSubmission 的 mergeRestoredSubmissionDraft 行为一致 | 通过 | D:/pilaude/relay-evidence/PIL-0177/verify/A3.log | 418cb12 | claude:sonnet-high:verify |
| A4 | npm test 3574 例 12 败（与 PIL-0113 基线 12 败名称一致，新增 0；总数 -3 即已删测试 3 例）；tsc --noEmit 退出 0；npm run lint 0 错 1 警告（既有）；relay guard --task PIL-0177 仅 WAIVED R1 | 通过 | D:/pilaude/relay-evidence/PIL-0177/verify/A4-npm-test.log、A4-tsc.log、A4-lint.log、A4-guard.log | 418cb12 | claude:sonnet-high:verify |

## 日志
- 2026-10-21T07:10Z · planner · 创建
- 2026-10-21T07:11Z · claude:opus-medium:planner · 用户 2026-10-21 决定删除 recent-sessions（R1 豁免）、菜单全走 DOM；合并 PIL-0113 评审非阻断项 1、2、5 与 AGENTS 清单订正。
- 2026-10-21T06:56Z · planner · 冻结验收标准 6e4cea828ac8
- 2026-10-21T06:56Z · codex-plus:gpt-xhigh:impl · 领取，租约至 2026-10-21T09:56Z
- 2026-10-21T07:16Z · codex-plus:gpt-xhigh:impl · 做了：删除 recent-sessions 与测试；AGENTS.md/fork-desktop.md 改为菜单默认走 DOM 并保留 Rust 硬规则、订正 DirectoryPicker/SessionSearch 说法；merge-history 一行；ChatInput 只改注释 / 状态：提交见分支 tip；npm test 新增失败 0（基线 12）、tsc/lint/guard 0（仅已豁免 R1）/ 下一步：验证 / 风险：无
- 2026-10-21T07:16Z · codex-plus:gpt-xhigh:impl · in_progress → verify
- 2026-10-21T07:21Z · claude:sonnet-high:verify · 证据 A1：通过
- 2026-10-21T07:21Z · claude:sonnet-high:verify · 证据 A2：通过
- 2026-10-21T07:21Z · claude:sonnet-high:verify · 证据 A3：通过
- 2026-10-21T07:21Z · claude:sonnet-high:verify · 证据 A4：通过
- 2026-10-21T07:21Z · claude:sonnet-high:verify · 验证 418cb12：A1–A4 全部通过。做了：独立核对删除与 grep（无代码引用）、文档 diff 与 desktop-menu.ts 旗标、ChatInput 仅注释变更、npm test/tsc/lint/guard。状态：418cb12，工作树干净；npm test 3574 例 12 败且与 PIL-0113 基线同名无新增（-3 为被删测试），tsc 0，lint 0 错 1 既有警告，guard 仅 WAIVED R1。下一步：送评审。风险：.github/workflows/desktop-test-build.yml 的 native_popup_menus 输入描述与 NEXT_PUBLIC_NATIVE_POPUP_MENUS 在代码中已无效，仍写着可开关，不在本卡 files_allowed 内，建议另开卡；demo/lib/desktop-menu.ts 仍为旧旗标（demo 目录非本卡范围）。
- 2026-10-21T07:21Z · claude:sonnet-high:verify · verify → review
