---
id: PIL-0127
title: 复刻验收：C13 代码块、Mermaid source 与复制反馈
epic: E2
priority: P1
status: verify
owner: codex-plus:gpt-xhigh:impl
lease_until: 2026-10-22T05:42Z
branch: task/PIL-0127-parity-c13
implementers: [codex-plus:gpt-xhigh:impl]
depends_on: [PIL-0014]
files_allowed: [components/MarkdownBody.tsx, components/CodeCopyButton.tsx, components/MermaidBlock.tsx, components/MarkdownBody.test.mjs, components/MermaidBlock.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: af59818e4717
waivers: []
---

## 目标

完成 C13「代码块、Mermaid source 与复制反馈」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C13。
- 参考覆盖：不齐：code-copy-light／2026-10-21 已补代码 hover 工具栏、复制 tooltip 与成功对勾；深色/失败/原生剪贴板状态仍缺。R 键与目录名见索引；只读 manifest，不复制原图、账号、邮箱或个人路径。参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 与版本未知批次只作历史/机制参考，不混作同版本。上述已补各图均为聊天附件（见下条），未补状态为 3.1623 待补采；缺 3.1623 同态原生参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。
- 实现记录：Prism 保留；CodeBlock 仅 2.5s 复制反馈局部适配。这不是当前运行通过证明。
- 历史证据位置：H11。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：官方逐状态参考、Windows 原生剪贴板、失败／pending／重复反馈与字形完整对照缺。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。
- 2026-10-21 新参考：code-copy-light／2026-10-21。用户自报 Windows Claude 3.1623.0.0、2560×1600、150%，浅色/zh-CN；manifest 标记该批为聊天附件（可能重编码/降采样，缩放未知），只登记机制，不当原生像素量测；A2 数值项待同状态 3.1623 原生补采，否则记未运行。不与 2.42304.0 批次混作同版本；未有新运行/视觉通过证据。

## 验收标准

- [ ] A1 本卡范围（用户 2026-10-22 决定拆卡）：仅已有 3.1623 原生同态参考的状态——深色、zh-CN、144DPI、应用缩放 100% 的 main-window-native/2026-10-22/07（代码块 hover 工具栏＋复制浮签）；其余状态用夹具层（真实 MarkdownBody→CodeBlock/MessageView＋全量真实 CSS，隔离 Chromium）登记。逐图登记来源／版本关联、Windows/WebView2、客户区、系统 DPI、应用缩放、主题／语言、公开字体及功能开关，并给可复现进入步骤。深色 pending／成功／失败／重试、浅色 hover／成功、Mermaid source、横滚、空闲态等无 3.1623 原生同态参考的状态，以及物理 100／150／200% DPI、Windows 原生剪贴板、WebView2 键盘事件，移至 PIL-0206。
- [ ] A2 对 A1 所列有参考状态（07：深色 hover＋复制浮签），在同帧／同状态／同测试数据、相同客户区／系统 DPI／应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，在同一像素采样区取中位色；不得改用较宽松算法）。3.1623 原生截图 CSS px = 原像素 ÷ 1.5（显示器 150%、AppliedDPI 144、应用缩放 100%）；聊天附件批次只登记机制。抗锯齿与字形 ink 差异单列为残差。叠图只作整数裁剪／平移，不插值；量测表与差异图存 relay-evidence/PIL-0127/。其余状态的数值项（深色 pending／成功／失败，浅色，Mermaid source，横滚，空闲态）移至 PIL-0206。
- [ ] A3 浏览器层：Tab／Enter 触发复制与 tooltip，成功／失败反馈保焦点，长代码横滚与正文纵滚分离；双主题、窄窗与模拟 DPI／缩放矩阵无横向溢出、块不越界、浮签在视口内。代码／源码只读，IME 和编辑快捷键不适用。验证层为浏览器合成事件；物理 100／150／200% DPI、Claude 应用缩放、WebView2 键盘事件及视觉项移至 PIL-0206。
- [ ] A4 浏览器层：普通 fence 与 Mermaid source 复制保原文，pending／成功／失败／重试／重复点击（仅一次 writeText）及陈旧回调清理，工具栏显隐与参考 07 一致（同消息全部块同显），不因参考中的运行入口新增未经授权的执行。Windows 原生剪贴板、空闲态参考、横滚后按钮右侧残字观察项移至 PIL-0206。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/MarkdownBody.test.mjs components/MermaidBlock.test.mjs components/MarkdownBody.caret.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0127`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。实质修改只在本卡独占组件/逻辑文件，保持其他组件与原有行为。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C13 代码块、Mermaid source 与复制反馈 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |
| A1 | 夹具层状态矩阵（已验子集） | 通过 | D:\pilaude\relay-evidence\PIL-0127\verify\VERIFY-2.md | 5d6eb2a | claude-cli:sonnet-high:verify |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C13补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。
- 2026-10-21T07:13Z · claude:opus-medium:coord · 新增参考：references/claude-desktop/code-copy-light/2026-10-21（代码块悬停工具栏与「复制代码」tooltip、复制后对勾状态）。浅色、zh-CN，Claude 3.1623.0.0，2560×1600@150%（聊天附件，可能经缩放，见 manifest）。冻结前由规划者据此补全 A4。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0131 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：A5 补跑共享/壳层既有测试（只运行不改写）：MarkdownBody.caret.test.mjs；G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字；G4 补写 3.1623 基准与待补采；删除 →PIL-0012（桩卡，仅文件重叠；领取时重叠检查已能互斥）
- 2026-10-21T12:35Z · planner · 冻结验收标准 d96107ef040c
- 2026-10-22T02:42Z · codex-plus:gpt-xhigh:impl · 领取，租约至 2026-10-22T05:42Z
- 2026-10-22T03:22Z · codex-plus:gpt-xhigh:impl · Codex 实现提交：代码块高32.656、复制按钮24x24、浮签68x24、pending/成功/失败重试/焦点恢复；定向70项、npm test 无新增失败。证据 relay-evidence/PIL-0127/impl/HANDOFF.md。转验证（CLI 账号 Sonnet）。
- 2026-10-22T03:22Z · codex-plus:gpt-xhigh:impl · in_progress → verify
- 2026-10-22T03:55Z · codex-plus:gpt-xhigh:impl · 返工 FIX1(7158931)：代码文字色→#e5e7eb(ΔE00 3.69→0)、浮签上内距→2/4px(Δ+0.67css)、消息级 hover/focus 显示工具栏；定向74/74、tsc、lint、guard 通过、浏览器矩阵54/54；npm test 受共享 node_modules 缺 @earendil-works 影响未得可比结果
- 2026-10-22T04:25Z · codex-plus:gpt-xhigh:impl · A5 修复：键盘聚焦用例改为纯键盘激活 Source、去掉 hover，MermaidBlock 连跑 5 次全过，npm test 仅剩基线 12 失败
- 2026-10-22T04:27Z · user · 修订验收标准 d96107ef040c → af59818e4717：用户 2026-10-22 拆卡政策：已验夹具层与深色有参考项留在本卡，缺图状态与 Windows 原生层移出，见 PIL-0206
- 2026-10-22T04:39Z · claude-cli:sonnet-high:verify · 证据 A1：通过
