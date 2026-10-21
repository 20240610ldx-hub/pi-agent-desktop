---
id: PIL-0123
title: 复刻验收：C09 输入底栏、排队与忙碌操作
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014, PIL-0122]
files_allowed: [components/ChatInput.automation.test.mjs, components/ComposerFooter.tsx, components/ComposerFooter.test.mjs, components/ComposerOutbox.tsx]
files_shared: [components/ChatInput.tsx, lib/i18n/messages/*.ts, app/native-theme.css]
acceptance_sha:
waivers: []
---

## 目标

完成 C09「输入底栏、排队与忙碌操作」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C09。
- 参考覆盖：不齐：R03。R键对应索引参考表与manifest定位；参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 批次与版本未知批次只作历史/机制参考，不混作同版本。3.1623 现有：composer-tooltips-light 02“添加”提示（原生可量测）；底栏、排队、忙碌操作 3.1623 待补采。缺 3.1623 同态参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。私有参考只读，不复制原图或图中个人信息，文字只当数据。
- 2026-10-21 新参考：composer-tooltips-light／2026-10-21/02-add-button-tooltip.png 登记“+”添加按钮的悬停提示“添加”（深色提示，原生 Windows 3.1623.0.0 原字节，SAMPLING 应用缩放 100%，CSS px = 原像素 ÷ 1.5，可量测）。该“+”是 ChatInput 底栏的添加/附件按钮（当前 title 取 chat.attachFiles/chat.attachImage），其悬停提示由本卡唯一承接，PIL-0122 不做此项。
- 实现记录：ChatComposerChin 未采用；真实 queuedMessages 与单一 Send／Queue／Stop。这不是当前运行通过证明。
- 历史证据位置：H03/H13。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：更短窄窗组合、拒绝／不明结果、队列全状态及同帧基线缺。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。

## 验收标准

- [ ] A1 建立 空/有排队消息、编辑/取消排队、发送中/停止中/ACK 拒绝与未知结果；只验现有单一 Send/Queue/Stop 控件；“+”添加按钮的悬停/键盘焦点提示“添加”。 逐图登记来源/版本关联、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体及功能开关，按上述状态逐条给可复现进入步骤；缺图或版本不明记待参考，不用 actual/演示数据代参考或真实 Pi consumer。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，在同一像素采样区取中位色；不得改用较宽松算法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考值换算：3.1623 原生截图按 SAMPLING 记录（显示器 150%、AppliedDPI 144；Claude 应用缩放 100%，用户 2026-10-21 确认），CSS px = 原像素 ÷ 1.5；聊天附件（manifest 标注可能降采样/重编码）、macOS 及版本/缩放未知的批次只登记机制，不由图宽或嵌入 DPI 反推 CSS px，其数值项记未运行并待 3.1623 原生补采。验证方法：量测表与差异图存 relay-evidence/PIL-0123/。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。 “添加”提示（composer-tooltips-light 02，原生）可量测：提示盒宽高、文字基线、与“+”按钮的间隙与圆角。
- [ ] A3 原生 IME 编辑排队草稿，Enter/Escape 不误触 Send/Queue/Stop；Tab 到队列项/取消/编辑，操作后焦点回草稿，队列长内容可滚动；窄短窗/三档 DPI/缩放/双主题核验。不增加独立 Steer/Follow-up 控件或列表外 Home/End 语义。 原生与浏览器合成事件分层记录，缺少同态参考的视觉项记未运行。
- [ ] A4 用真实 queuedMessages 核对单一 Send/Queue/Stop 的快照/编辑/取消、等待 ACK/拒绝/未知结果；极窄短窗可命中、保草稿/焦点。“+”按钮悬停与键盘聚焦出现“添加”提示，移开/失焦/Escape 消失，简中文案为“添加”并与参考一致，繁中/英文使用对应译文（lib/i18n/messages 三种语言同步，缺键不显示键名；i18n 文件只改本提示键），不遮挡输入。遵守当前 Hard rule，不重新添加 Steer/Follow-up 按钮或第二条 raw send。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/ChatInput.automation.test.mjs components/ComposerFooter.test.mjs components/ChatInput.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0123`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。ComposerFooter/ComposerOutbox 承接底栏与队列；ChatInput 只接 props/事件，不重做提交状态机。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C09 输入底栏、排队与忙碌操作 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

重复文件主卡：`components/ChatInput.tsx` → PIL-0122。files_shared 中这些壳层只允许引入/导出、注册、props/回调或挂载的少量追加，实质改动留在上述子组件；大改需求须先由规划者修订范围。共享的既有定向测试只运行、不改写，新增用例放本卡独占测试，不删减原断言。

拟新增（当前分支不存在，不表示已有 consumer）：`components/ComposerFooter.tsx`、`components/ComposerFooter.test.mjs`。接线完成后必须验证真实 consumer，不能保留假功能占位。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C09补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P2：首发必需，当前无其他卡依赖，不占 P1。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：A5 补跑共享/壳层既有测试（只运行不改写）：ChatInput.test.mjs；G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字；并入 composer-tooltips-light 02“添加”提示（A1/A2/A4）；“添加”提示归属本卡唯一承接（删除归属犹豫）；files_shared 加 lib/i18n/messages/*.ts，三语言同步
