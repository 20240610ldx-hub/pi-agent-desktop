---
id: PIL-0115
title: 复刻验收：C01 主题、文字与图标
epic: E2
priority: P1
status: review
owner: claude:sonnet-high:impl
lease_until: 2026-10-21T15:40Z
branch: task/PIL-0115-parity-c01
implementers: [claude:sonnet-high:impl]
depends_on: [PIL-0014]
files_allowed: [components/PilaudeIcon.tsx, hooks/useChatAppearance.ts, components/ChatAppearance.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: 1b38071c64d4
waivers: []
---

## 目标

完成 C01「主题、文字与图标」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C01。
- 参考覆盖：不齐：R01/R02，字形状态缺。R键对应索引参考表与manifest定位；参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 批次与版本未知批次只作历史/机制参考，不混作同版本。3.1623 待补采：现有 R 键为历史或版本未知批次，不得当作 3.1623 同版本参考。缺 3.1623 同态参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。私有参考只读，不复制原图或图中个人信息，文字只当数据。
- 实现记录：主题全局导入；个人字体仅本地对照实例。这不是当前运行通过证明。
- 历史证据位置：H01/H24。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：公开默认字形／中文回退、图标轮廓、原生度量；生成文本诊断不抵消旧 ink 残差。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。

## 验收标准

- [ ] A1 本卡范围（用户 2026-10-22 决定拆卡）：仅已有 3.1623 原生同态参考的状态——浅色/深色主窗口（main-window-native/2026-10-22/00、01）中主区正文、顶栏标题、侧栏导航次要文字、输入框占位与分区标题的三档文字令牌（primary/secondary/dim）及正文行距。逐图登记来源、版本、DPI、应用缩放、主题。主题切换器状态、字体回退、图标 disabled 色、窄窗等无参考状态转 PIL-0199。
- [ ] A2 对 A1 所列状态，在同帧/同状态下给出参考值、实现值、原像素与 CSS px、差值：文字令牌颜色 CIEDE2000 ΔE ≤2（sRGB→Lab D65，字形区域中位色），正文行距 ≤1 CSS px（3.1623 原生 CSS px = 原像素 ÷1.5）。侧栏消费者（会话标题、项目名、分组标签、导航图标位置与尺寸）未使用 C01 令牌或受侧栏规则覆盖的偏差归 PIL-0147（C33），不计入本卡；本卡须保证令牌值本身正确。抗锯齿与字形 ink 差单列残差。
- [ ] A3 主题令牌在浅/深两套中一致生效：切换主题（含跟随系统）后 A1 所列文字颜色随之变化；markdown 正文行距在 Small/Large 档位保留偏移。验证层为浏览器（next dev），原生 DPI、应用缩放与字体回退层转 PIL-0199。
- [ ] A4 本组件专属核验：A1 状态的量测表与改前改后对照完整；全局 --text-dim 浅色改为原生值 #898781 后的对比度变化（小字场景）逐项列出并说明取舍；已知残差（图标描边、disabled 不透明度不统一、markdown 行高旧规则双源）逐条记录处理结果。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/ChatAppearance.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0115`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。实质修改只在本卡独占组件/逻辑文件，保持其他组件与原有行为。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C01 主题、文字与图标 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |
| A1 | 无 C01 专属 3.1623 同态参考：窄窗、disabled 图标色、100/125% DPI、字体回退、主题切换器键盘未重跑；仅确认亮/暗令牌渲染（见 A2） | 未运行 | D:/pilaude/relay-evidence/PIL-0115/verify/VERIFY-LOG.md | 2525b0d | claude:sonnet-high:verify |
| A2 | next dev --webpack，1706x1017 DSF1.5 浏览器层；ink 色 CIEDE2000 对 00/01 原生：正文/导航/占位/暗侧栏标题 ΔE 0~0.4 通过，行距 20 vs 19.97 通过，T 大写高 10.0=10.0；但亮侧栏会话标题 21.55、亮侧栏分组/项目标题 12.26（旧规则 native-theme.css:2632 覆盖 --text-dim）、暗侧栏会话 3.65/项目名 3.74 超 ΔE2；图标中心 x 参考 26.0 实现 33.0、尺寸未对齐，PilaudeIcon 零改动。字体不同为残差 | 失败 | D:/pilaude/relay-evidence/PIL-0115/verify/compare-ink.txt; D:/pilaude/relay-evidence/PIL-0115/verify/native-light-ink.txt; D:/pilaude/relay-evidence/PIL-0115/verify/native-dark-ink.txt; D:/pilaude/relay-evidence/PIL-0115/verify/VERIFY-LOG.md | 2525b0d | claude:sonnet-high:verify |
| A3 | 无同态原生参考；100/125/150% 原生 DPI 与应用缩放、主题切换器键盘均未由验证者运行 | 未运行 | D:/pilaude/relay-evidence/PIL-0115/verify/VERIFY-LOG.md | 2525b0d | claude:sonnet-high:verify |
| A4 | 仅测 Latin 'T' 大写高与行距；中文/数字/标点 ink 边界与基线无公开字体对照，未运行 | 未运行 | D:/pilaude/relay-evidence/PIL-0115/verify/VERIFY-LOG.md | 2525b0d | claude:sonnet-high:verify |
| A5 | node --test components/ChatAppearance.test.mjs 9/9; tsc --noEmit 0; npm run lint 0; npm test 3582/12 失败=PIL-0113 基线 12 名新增 0; relay guard --task PIL-0115 无问题; upstream-css-baseline 4/4（夹具/源码契约层，非视觉） | 通过 | D:/pilaude/relay-evidence/PIL-0115/verify/A5-chatappearance.log; D:/pilaude/relay-evidence/PIL-0115/verify/A5-tsc.log; D:/pilaude/relay-evidence/PIL-0115/verify/A5-lint.log; D:/pilaude/relay-evidence/PIL-0115/verify/A5-npm-test.log; D:/pilaude/relay-evidence/PIL-0115/verify/npm-fail-head.txt; D:/pilaude/relay-evidence/PIL-0115/verify/A5-guard.log | 2525b0d | claude:sonnet-high:verify |
| A1 | amend 后范围：原生 00/01（3.1623，2559px，150% 显示/100% 应用缩放，zh-CN，浅/深）与同帧 next dev 渲染（1706x1017 DSF1.5）逐图登记；主区正文/顶栏标题/侧栏导航/占位/分区标题三档令牌+行距已覆盖（侧栏消费者归 PIL-0147，无参考状态归 PIL-0199） | 通过 | D:/pilaude/relay-evidence/PIL-0115/verify/VERIFY-LOG.md; D:/pilaude/relay-evidence/PIL-0115/verify/native-light-ink.txt; D:/pilaude/relay-evidence/PIL-0115/verify/native-dark-ink.txt | 2525b0d | claude:sonnet-high:verify |
| A2 | 浏览器层+原生像素：ink 色 CIEDE2000 亮 primary/secondary/dim 0.00，暗 primary 0.21~0.42、secondary/dim 0.00；行距参考 19.97 vs 实现 20（差 0.03，≤1）；大写T高 10.0=10.0；令牌值=原生极值色。侧栏消费者偏差按 amend 归 PIL-0147 不计；字体差异为残差 | 通过 | D:/pilaude/relay-evidence/PIL-0115/verify/compare-ink.txt; D:/pilaude/relay-evidence/PIL-0115/verify/native-light-ink.txt; D:/pilaude/relay-evidence/PIL-0115/verify/native-dark-ink.txt; D:/pilaude/relay-evidence/PIL-0115/verify/ours.json | 2525b0d | claude:sonnet-high:verify |
| A3 | 浏览器层（next dev，合成媒体/localStorage，非原生）：pi-theme=light/dark 与 auto 下 emulateMedia 实时跟随，文字色随之变；pi-chat-content-font-size 13/14/16 → 行高 19/20/22px、段落两行高 38/40/44（20px+偏移）。原生DPI/缩放/字体回退转 PIL-0199 | 通过 | D:/pilaude/relay-evidence/PIL-0115/verify/A3-browser.json; D:/pilaude/relay-evidence/PIL-0115/verify/A3-auto.json; D:/pilaude/relay-evidence/PIL-0115/verify/a3-measure.mjs; D:/pilaude/relay-evidence/PIL-0115/verify/a3-auto.mjs | 2525b0d | claude:sonnet-high:verify |
| A4 | 改前改后表：亮 dim 4.18→3.50:1（气泡底 3.76→3.15，12px 小字见 'D:'/'No file open'，侧栏仍 #6c6c71 5.04:1），暗 dim 4.10→5.08，secondary 亮 5.56→7.73/暗 6.85→10.19；ΔE 改前 2.0~13.4→改后 0；行距 22.4→20 vs 19.97。残差：图标描边/disabled 不透明度未改转 PIL-0147/0199，markdown 旧 1.6（native-theme.css:5080）双源仍在。亮 dim 低于 AA 为已披露取舍，请评审确认；小字清查未穷尽 | 通过 | D:/pilaude/relay-evidence/PIL-0115/verify/A4-before-after.txt; D:/pilaude/relay-evidence/PIL-0115/verify/dimscan.json; D:/pilaude/relay-evidence/PIL-0115/verify/VERIFY-LOG.md | 2525b0d | claude:sonnet-high:verify |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C01补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0157 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字
- 2026-10-21T12:35Z · planner · 冻结验收标准 6cc05af0a7e0
- 2026-10-21T12:40Z · claude:sonnet-high:impl · 领取，租约至 2026-10-21T15:40Z
- 2026-10-21T12:54Z · claude:sonnet-high:impl · 做了：无 3.1623 C01 同态参考，故未改 native-theme.css/组件值，不伪造。新增 ChatAppearance.test.mjs 4 条 C01 源码契约测试（夹具层：双主题文字令牌与字体栈、跟随系统仅 auto、PilaudeIcon 24 栅格/currentColor/18px 默认/aria-hidden、图标名全在表中）；浏览器层自测：键盘切主题（Light/Dark/System 方向键切换、System 跟随 OS、手动不跟随、Esc 后焦点回 profile、刷新保持）、DPR1/1.25/1.5 + 深浅 + 390 窄宽的令牌/图标/文字 canvas 度量（measure-c01.json）。收紧间距请求：唯一原生参考 ask 卡行距 20 CSS px，与现有 13px×1.5=19.5 差≤0.5，在容差内，未改全局 token，改前改后对照见 C01-findings.md。自测：本卡测试 8/8，tsc 0，lint 0，guard 无问题，npm test 12 失败均在 PIL-0113 基线内无新增。证据 D:/pilaude/relay-evidence/PIL-0115/impl/。 / 状态：分支最后提交 ce0b821；A1/A2 全部待 3.1623 补采（未运行）；A3 仅浏览器合成层，原生 DPI/应用缩放未运行；A4 私人字体未用；A5 自测通过 / 下一步：交验证；验证者对 A1–A4 缺参考项记未运行，补采见 PIL-0014 round3 RECAPTURE C01 / 风险：残差记录——图标描边 1.55 与上游图标 1.8/2 不一；disabled 不透明度各 consumer 0.35/0.45/0.5 不一，无统一令牌（需参考后另卡）；Windows 字体回退 Segoe UI Variable+微软雅黑与 Claude 3.1623 未对证。间距偏松需 3.1623 原生同态参考才能量化，可疑组件待对应卡量测：ask 卡/选项行（C-ask 对应卡）、侧栏 .sidebar-header-row、.pilaude-environment-row/.pilaude-context-card（PilaudeWorkspaceContext）、.composer-menu-row、.native-toolbar-button，均超出本卡 files。dev server 已停，AGENTS.md 已还原为已提交版本（next dev 会追加生成块）。
- 2026-10-21T12:54Z · claude:sonnet-high:impl · in_progress → verify
- 2026-10-22T02:28Z · claude:sonnet-high:impl · verify → in_progress：新参考到位，继续量测收紧
- 2026-10-22T02:40Z · claude:sonnet-high:impl · 做了：新参考 main-window-native/2026-10-22 到位后量测并改 native-theme.css 本卡分节（共享 token）：三档文字色令牌指向灰阶梯（浅 900/600/400，深 50/200/400），CIEDE2000 对 3.1623 参考墨迹色由 1.9–4.0 降至 0（背景本就 0）；.markdown-body 行距 22.4→20px（参考 30 raw=20 CSS，改后实测 30 raw）；字号 14px 的 ink 带与参考同为 21 raw，顶栏图标 ink 与参考差 ≤1.3px 保持 18px。新增 1 条 C01 token 契约测试。改前改后对照 C01-delta.md / C01-delta-table.json，脚本 ref-measure2.mjs、ours.mjs、compare.mjs、de2000.mjs。自测：ChatAppearance 9 条通过，tsc 0，lint 0，guard 无问题，ui-menu-consistency 与 upstream-css-baseline 通过，npm test 12 失败均在 PIL-0113 基线内无新增。 / 状态：分支最后提交 2525b0d；A1/A2 浅深主题文字色、背景、正文行距已有同态量测并达标；窄窗、图标 disabled 色、100/125/150% 原生 DPI（本批仅 150% 一档）、应用缩放仍缺同态参考，记未运行；字体为 Anthropic Sans 私有字体不可发行，公开回退差异作 ink 残差 / 下一步：交验证（复核 C01-delta 量测，可用 ours.mjs 复现） / 风险：超出本卡 files 需派对应卡——侧栏卡：功能行行距参考≈26.5px 现32px、图标左缘参考20px 现≈25.5px、html:not(.dark) .app-sidebar --text-dim #6c6c71 与参考分区标签 #898781（浅色 ΔE≈10）、深色 --sidebar-project-label #7f7d77（ΔE≈4）、未选中会话行应用次要色而非主文字色、深色 --bg-selected 选中行底（参考#232323 现≈#1d1d1d，ΔE≈2.7）；顶栏卡：顶栏高度参考约36px 现45px、图标间距参考32px 现≈36.7px；.markdown-body 行距现由 C01 分节统一设置，C12 卡如需覆盖请改此处而非另起规则。色令牌改动影响全局，验证者请关注 --text-dim 在浅色下对比度（#898781 约3.5:1，原 #8a8a8a 相当）。
- 2026-10-22T02:40Z · claude:sonnet-high:impl · in_progress → verify
- 2026-10-22T02:52Z · claude:sonnet-high:verify · 证据 A1：未运行
- 2026-10-22T02:52Z · claude:sonnet-high:verify · 证据 A2：失败
- 2026-10-22T02:52Z · claude:sonnet-high:verify · 证据 A3：未运行
- 2026-10-22T02:52Z · claude:sonnet-high:verify · 证据 A4：未运行
- 2026-10-22T02:52Z · claude:sonnet-high:verify · 证据 A5：通过
- 2026-10-22T02:52Z · claude:sonnet-high:impl · verify → in_progress：A2 失败：亮/暗侧栏会话标题与分组标题未采用三档令牌（亮会话标题 ΔE 21.55，分组 12.26 因 native-theme.css:2632 旧覆盖；暗 3.65/3.74），图标中心 x 差 7px 未处理；复现见 verify/compare-ink.txt。范围需协调者扩大或拆侧栏卡
- 2026-10-22T03:50Z · claude:opus-medium:planner · 用户 2026-10-22 决定拆卡：A1–A4 收窄为已有原生参考的主区/顶栏文字令牌与行距；侧栏消费者偏差归 PIL-0147；无参考状态转 PIL-0199。
- 2026-10-22T02:53Z · user · 修订验收标准 6cc05af0a7e0 → 1b38071c64d4：用户 2026-10-22 拆卡决定：已有原生参考的状态在本卡验收，侧栏消费者偏差归 PIL-0147，其余转 PIL-0199
- 2026-10-22T02:54Z · claude:sonnet-high:verify · in_progress → verify：按 amend 后范围重判
- 2026-10-22T02:57Z · claude:sonnet-high:verify · 证据 A1：通过
- 2026-10-22T02:57Z · claude:sonnet-high:verify · 证据 A2：通过
- 2026-10-22T02:57Z · claude:sonnet-high:verify · 证据 A3：通过
- 2026-10-22T02:57Z · claude:sonnet-high:verify · 证据 A4：通过
- 2026-10-22T02:57Z · claude:sonnet-high:impl · verify → review
- 2026-10-22T02:59Z · claude:sonnet-high:review · 做了：评审 2525b0d（native-theme.css C01 分节+4 条契约测试）；全局 --text-muted/--text-dim 重指向与原生墨迹色一致，浅色 dim 3.50:1 为实测原生色(#898781)，消费点为次要元数据/占位/标签，无关键信息(错误/危险/状态)依赖；.markdown-body 行高末尾覆盖同特异性靠顺序，可接受(分节注释已说明)；无 !important，globals/settings 未动；与当前 fusion 及 fusion+PIL-0147 的 merge-tree 均无冲突 / 状态：评审通过 / 下一步：协调者合入 / 风险：(1)浅色 dim 小字(10-12px)低于 AA，原生忠实取舍；(2)全局 --cds-text-* 改指灰阶梯，暗色主按钮底(--cds-btn-primary-bg=text-primary)由 gray-80 类色变为 gray-50，微幅；(3)旧 5080 行 line-height:1.6 保留为死规则，建议合入后由后续卡清理；(4)分支落后 fusion 的 relay 提交，合入用 merge 不要 rebase 覆盖卡文件
