---
id: PIL-0115
title: 复刻验收：C01 主题、文字与图标
epic: E2
priority: P1
status: in_progress
owner: claude:sonnet-high:impl
lease_until: 2026-10-21T15:40Z
branch: task/PIL-0115-parity-c01
implementers: [claude:sonnet-high:impl]
depends_on: [PIL-0014]
files_allowed: [components/PilaudeIcon.tsx, hooks/useChatAppearance.ts, components/ChatAppearance.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: 6cc05af0a7e0
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

- [ ] A1 建立 主题切换与跟随系统、中英文/数字/标点字体回退、图标大小与 disabled 色；主题资源本身无会话加载/错误/展开状态，不造此类状态。 逐图登记来源/版本关联、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体及功能开关，按上述状态逐条给可复现进入步骤；缺图或版本不明记待参考，不用 actual/演示数据代参考或真实 Pi consumer。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，在同一像素采样区取中位色；不得改用较宽松算法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考值换算：3.1623 原生截图按 SAMPLING 记录（显示器 150%、AppliedDPI 144；Claude 应用缩放 100%，用户 2026-10-21 确认），CSS px = 原像素 ÷ 1.5；聊天附件（manifest 标注可能降采样/重编码）、macOS 及版本/缩放未知的批次只登记机制，不由图宽或嵌入 DPI 反推 CSS px，其数值项记未运行并待 3.1623 原生补采。验证方法：量测表与差异图存 relay-evidence/PIL-0115/。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。
- [ ] A3 用主题切换器键盘进入/切换/返回，检查 100%/125%/150% DPI、应用缩放、中英文公开字体回退与深浅色。IME、列表滚动、方向/Home/End 不用于本体：主题/字形/图标无文本框或列表。 原生与浏览器合成事件分层记录，缺少同态参考的视觉项记未运行。
- [ ] A4 本组件专属核验：用公开字体回退和合法图标量测中英文、数字与标点的ink边界、行高和基线；私人字体实例不作发行结果。 对本卡已知残差逐条给出处理结果与可复现操作；真实请求／数据／状态与可见反馈一致，失败、取消和恢复保留，不伪造能力。
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
