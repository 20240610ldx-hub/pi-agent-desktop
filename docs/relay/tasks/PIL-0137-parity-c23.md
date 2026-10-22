---
id: PIL-0137
title: 复刻验收：C23 长会话滚动跟随与历史恢复
epic: E2
priority: P1
status: verify
owner: codex-plus:luna-high:impl
lease_until: 2026-10-22T12:04Z
branch: task/PIL-0137-parity-c23
implementers: [codex-plus:luna-high:impl]
depends_on: [PIL-0014]
files_allowed: [components/ChatWindow.tsx, hooks/useAgentSession.ts, lib/cds-scroll.ts, lib/cds-scroll.test.mjs, components/ChatWindow.scroll-to-latest.test.mjs, hooks/useAgentSession.branch-summary-guard.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: 43195e1eb4a1
waivers: []
---

## 目标

完成 C23「长会话滚动跟随与历史恢复」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C23。
- 参考覆盖：不齐：R00。R键对应索引参考表与manifest定位；参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 批次与版本未知批次只作历史/机制参考，不混作同版本。3.1623 待补采：现有 R 键为历史或版本未知批次，不得当作 3.1623 同版本参考。缺 3.1623 同态参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。私有参考只读，不复制原图或图中个人信息，文字只当数据。
- 实现记录：useClaudeScrollPinning 仅150ms意图锁；保 Pi 分页／锚点。这不是当前运行通过证明。
- 历史证据位置：H01/H13。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：原生滚动、长耗时／重连、历史定位全矩阵；其他源阈值不算采用。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。

## 验收标准

- [ ] A1 长会话状态进入与来源登记（已验子集）。底部跟随／离底、历史分页、搜索锚点、分支切换、重连／错误恢复、返回最新的进入步骤逐条可复现，并登记测试环境（Chromium、mock 流式模型、600 条会话、dev server）。3.1623 同态参考的逐图登记与视觉量测移至 PIL-0212（A1）；本卡不判定视觉通过。
- [ ] A2 几何与颜色量测（实现侧记录，同态比对移至 PIL-0212）。实现侧按钮几何、颜色及 dsf 1／1.5／2 下 CSS px 恒定性记录于 `D:pilaudeelay-evidencePIL-0137erifyutton-measure.json`。与 3.1623 的同帧比对、差值与 ΔE 判定移至 PIL-0212（A1）；本卡不计通过。
- [ ] A3 真实输入（浏览器层）：鼠标滚轮、键盘 PageUp/Home/End、滚动条按住滑块与轨道的离底与返回最新；流式、历史分页、分支／会话切换后锚点不漂移；150ms 意图锁按实际记录。回到最新后的跟随口径：距底不累积漂移，逐块滞后不超过一个流式块（块约 50px，瞬时可达 100px，纯跟随基线同样出现），不以字面 96px（`CHAT_SCROLL_REATTACH_TOLERANCE`）作逐采样判定。浏览器层 dsf 1／1.5／2、390／1280 宽、亮暗主题的分页锚点已测。触控板／触摸、IME、PageDown、原生系统 DPI、WebView2、贴底滚动条遮挡移至 PIL-0212（A2、A3）。
- [ ] A4 本组件专属核验（已验子集）：用长会话、分页、搜索锚点、分支切换、流式与重连验证 150ms 意图锁及历史恢复；手动滚动不得被错误展开抢回；流式中点击回到最新须重新跟随。已知残差：原生滚动、SSE 真断线、三档系统 DPI、IME 移至 PIL-0212（A2）；拖到轨道底松开的行为移至 PIL-0212（A4，待用户决定）。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test lib/cds-scroll.test.mjs components/ChatWindow.scroll-to-latest.test.mjs components/ChatWindow*.test.mjs hooks/useAgentSession.branch-summary-guard.test.mjs hooks/useAgentSession.composer-queue.test.mjs hooks/useAgentSession.context-usage.test.mjs hooks/useAgentSession.events-086.test.mjs hooks/useAgentSession.failure-notices.test.mjs hooks/useAgentSession.fork-position.test.mjs hooks/useAgentSession.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0137`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。实质修改只在本卡独占组件/逻辑文件，保持其他组件与原有行为。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C23 长会话滚动跟随与历史恢复 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C23补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0129、PIL-0148、PIL-0151 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：A5 补跑共享/壳层既有测试（只运行不改写）：ChatWindow*.test.mjs、useAgentSession.branch-summary-guard.test.mjs、useAgentSession.composer-queue.test.mjs、useAgentSession.context-usage.test.mjs、useAgentSession.events-086.test.mjs、useAgentSession.failure-notices.test.mjs、useAgentSession.fork-position.test.mjs、useAgentSession.test.mjs；G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字
- 2026-10-21T12:36Z · planner · 冻结验收标准 dfacd004c1ef
- 2026-10-22T09:04Z · codex-plus:luna-high:impl · 领取，租约至 2026-10-22T12:04Z
- 2026-10-22T09:43Z · codex-plus:luna-high:impl · in_progress → verify
- 2026-10-22T10:29Z · claude:opus:coordinator · 范围 [components/ChatWindow.tsx, hooks/useAgentSession.ts, lib/cds-scroll.ts, lib/cds-scroll.test.mjs, components/ChatWindow.scroll-to-latest.test.mjs] → [components/ChatWindow.tsx, hooks/useAgentSession.ts, lib/cds-scroll.ts, lib/cds-scroll.test.mjs, components/ChatWindow.scroll-to-latest.test.mjs, hooks/useAgentSession.branch-summary-guard.test.mjs]：A5 要求定向测试全过；该测试夹具缺 todoBranchSelectionRef，实现前即失败，需修夹具
- 2026-10-22T10:43Z · codex-plus:luna-high:impl · 返工 F1-F4：回到最新流式中立即重新跟随(scrollToLatest)、分页前插不顶回、流式跟随时按钮不闪、移除无效 pointerdown 监听；定向158/158，npm test 失败集=基线减1；证据 impl/FIX1.md
- 2026-10-22T11:00Z · user · 修订验收标准 dfacd004c1ef → 43195e1eb4a1：拆卡政策（用户 2026-10-22 决定：已验部分合入，缺图状态转补采卡）：缺 3.1623 同态参考的视觉项，以及触控板／触摸、IME、PageDown、原生三档 DPI、WebView2、SSE 真断线、贴底滚动条遮挡、拖到轨道底松开行为，移至 PIL-0212。F1 口径（用户 2026-10-22 批准）：“距底 ≤96px”明确为“不累积漂移，逐块滞后不超过一个流式块”；流式中回到最新后瞬时 100px 属块级滞后，纯跟随基线同样出现，VERIFY-2 已实测无累积漂移。
