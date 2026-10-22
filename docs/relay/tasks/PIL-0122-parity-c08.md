---
id: PIL-0122
title: 复刻验收：C08 输入器主框与提交控件
epic: E2
priority: P1
status: verify
owner: claude-cli:sonnet-high:impl
lease_until: 2026-10-22T10:23Z
branch: task/PIL-0122-parity-c08
implementers: [claude-cli:sonnet-high:impl]
depends_on: [PIL-0014, PIL-0177, PIL-0189]
files_allowed: [components/ChatInput.tsx, components/ChatInput.test.mjs, lib/ime.ts]
files_shared: [lib/i18n/messages/*.ts, app/native-theme.css]
acceptance_sha: 6024aa17a06c
waivers: []
---

## 目标

完成 C08「输入器主框与提交控件」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C08。
- 参考覆盖：不齐：R01/R03，焦点状态未独立确认。R键对应索引参考表与manifest定位；参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 批次与版本未知批次只作历史/机制参考，不混作同版本。3.1623 现有：composer-tooltips-light 01 发送按钮提示（原生可量测）；输入框主框、焦点、附件、busy 等 3.1623 待补采。缺 3.1623 同态参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。私有参考只读，不复制原图或图中个人信息，文字只当数据。
- 2026-10-21 新参考：composer-tooltips-light／2026-10-21。01-send-tooltip-fork-shortcut.png 登记发送按钮悬停提示：第一行“发送 ⏎”，第二行“在分叉会话中发送 Ctrl Alt ⏎”（键帽样式）；00-mic-hold-to-record-tooltip.png 登记麦克风按钮与其悬停提示（“按住以录音”“右键单击可打开麦克风设置”）；02 的“添加”提示归 PIL-0123。该批为 Windows 3.1623.0.0 原生原字节（SAMPLING，应用缩放 100%），CSS px = 原像素 ÷ 1.5，可量测。用户 2026-10-21 决定：麦克风/语音转文字首发不做，输入器工具栏首发不显示麦克风按钮（PIL-0178/PIL-0140 parked），00 号参考的麦克风提示只登记不实现；“在分叉会话中发送”由 PIL-0189 提供真实能力后显示。
- 实现记录：Pi 输入器、紧凑 48px／14.4px 圆角、中性边线；单次提交锁。这不是当前运行通过证明。
- 历史证据位置：H03/H24。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：字体 ink 宽／高、回车图标和边线抗锯齿仍不同；Windows 原生 IME 未验。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。

## 验收标准

- [ ] A1 已验子集：在夹具层（真实 ChatInput + 真实 CSS）建立空白、附件、busy／发送／停止、未知提交结果状态，逐态保留同一次提交快照；有 3.1623 原生参考的深色附件态、发送按钮悬停提示第一行“发送 ⏎”（composer-tooltips-light 01）；麦克风按钮首发隐藏（DOM 无按钮、无占位）。逐图登记来源、版本、DPI、应用缩放、主题。无同态参考的状态（单行、多行、长草稿、窄窗、暗色提示、busy 与禁用态的同态、亮色聚焦、亮色附件态、亮色缩略图描边）移至 PIL-0209。分叉相关状态移至 PIL-0207。
- [ ] A2 已验子集量测：对 A1 有参考的项，按 PIL-0122 批准容差给出参考值、实现值、原像素与 CSS px、差值（3.1623 CSS px = 原像素 ÷ 1.5）。覆盖：深色附件态卡色与卡高、缩略图位置与尺寸与 1px 描边、“+”底色、发送按钮尺寸与底色（悬停）、发送图标垂直位置、提示第一行底色／圆角／文字 ink／键帽。颜色 ΔE ≤2（CIEDE2000）。提示整体框宽高（参考为两行）移至 PIL-0207；其余量测移至 PIL-0209。量测表存 relay-evidence/PIL-0122/verify/。
- [ ] A3 已验交互（夹具层浏览器合成事件，非原生）：Enter 发送恰一次；composition 期间 Enter 与 keyCode 229 不误发；Tab 聚焦发送钮出现提示，Escape、失焦、移开后消失；提示不遮挡输入。原生 Windows IME、三档 DPI、应用缩放移至 PIL-0209（A3、A4）。Ctrl+Alt+Enter 与分叉发送移至 PIL-0207。
- [ ] A4 本组件专属：单次提交；未知提交结果不重放；输入器工具栏无麦克风按钮、DOM 无其 aria-label 与残留空位；发送提示第一行文案与 composer-tooltips-light 01 一致。提示 i18n 三语言同步、第二行文案与键、分叉相关交互移至 PIL-0207。已知残差（字形 ink 宽高、回车图标、边线抗锯齿）移至 PIL-0209（A6）。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/ChatInput.test.mjs components/ChatInput.automation.test.mjs lib/ime.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0122`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减／跳过测试或放宽阈值。逐 A 项记录实际结果、步骤／命令、仓库外证据、对应提交和验证者标签；夹具层与浏览器层证据分开记录，缺条件记未运行，不能据此称 C08 产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。实质修改只在本卡独占组件/逻辑文件，保持其他组件与原有行为。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C08 输入器主框与提交控件 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C08补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0121、PIL-0123、PIL-0124、PIL-0134、PIL-0140、PIL-0141、PIL-0151 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：A5 补跑共享/壳层既有测试（只运行不改写）：ChatInput.automation.test.mjs、ime.test.mjs；G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字；并入 composer-tooltips-light 01 发送提示；依赖加 PIL-0189（分叉发送，A1/A3/A4 验证快捷键与文案）；麦克风首发隐藏（00 号参考仅登记）；files_shared 加 lib/i18n/messages/*.ts（发送提示三语言同步）
- 2026-10-21T12:35Z · planner · 冻结验收标准 042e78bfeb93
- 2026-10-21T13:04Z · claude:opus-medium:planner · PIL-0189 评审非阻断意见供本卡落实：源会话运行中分叉会把未回复的用户消息一并复制，子会话出现连续两条用户消息，界面需说明；分叉后接入新会话事件流（onSessionForked）属本卡/0137。
- 2026-10-22T07:23Z · claude-cli:sonnet-high:impl · 领取，租约至 2026-10-22T10:23Z
- 2026-10-22T07:34Z · claude-cli:sonnet-high:impl · 复述：A1 单行/多行/附件/busy 布局+发送提示；A2 同帧量测参考 3.1623 (00/04/tooltips-01)；分叉发送无真实 consumer 文件在范围，先隐藏。阶段1：卡内布局+提示已提交
- 2026-10-22T07:34Z · claude-cli:sonnet-high:impl · 做了：卡内单行布局+发送提示(dea19aa) / 状态：A1/A2 部分，分叉发送因 consumer 不在范围未做，A3/A4/A5 未跑；额度用尽 / 下一步：读 evidence/PIL-0122/impl/HANDOFF.md，补测试、窄窗/多行/busy 量测、npm test 对比基线 / 风险：+ 位置与 PIL-0123 交叠
- 2026-10-22T07:35Z · claude-cli:sonnet-high:impl · 协调者：分叉发送 UI（提示第二行、Ctrl+Alt+Enter、置灰、i18n）按 2026-10-21 用户决定 分叉发送先隐藏不在本卡实现，验收中相关项待拆卡；CLI 额度重置后继续剩余项（组件测试、夹具报错、窄窗/多行/busy、提示颜色基线、npm test 对比）。
- 2026-10-22T07:55Z · claude-cli:sonnet-high:impl · implementer：量测校准(卡内行起点/文字基线/发送图标/聚焦亮边框/键帽色，ΔE≤2)、补 5 项 ChatInput 测试、窄窗底栏空首列修复；tsc/lint/guard/定向71通过，npm test 12 失败与基线逐名一致；分叉发送移出待拆卡，麦克风不渲染；提交 2a40c84，待验证。交接见 relay-evidence/PIL-0122/impl/HANDOFF.md
- 2026-10-22T07:55Z · claude-cli:sonnet-high:impl · in_progress → verify
- 2026-10-22T07:59Z · user · 修订验收标准 042e78bfeb93 → 7f2336e0b28d：分叉发送 UI 按用户决定先隐藏，移至 PIL-0207
- 2026-10-22T08:19Z · claude-cli:sonnet-high:impl · fix F1-F4（附件+透明、缩略图1px描边、Esc关提示、发送图标0.4px）；Ctrl+Alt+Enter 在分叉 UI 隐藏期间按普通发送，协调者接受
- 2026-10-22T08:27Z · user · 修订验收标准 7f2336e0b28d → 6024aa17a06c：拆卡政策（用户 2026-10-22 批准）：已验子集留在本卡，无参考或需原生环境的状态移至 PIL-0209，分叉相关移至 PIL-0207
