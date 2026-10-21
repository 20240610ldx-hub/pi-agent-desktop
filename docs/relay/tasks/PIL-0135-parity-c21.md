---
id: PIL-0135
title: 复刻验收：C21 当前上下文圆环与用量浮层
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014]
files_allowed: [components/ContextUsageRing.tsx, components/SessionStatsPanel.tsx, components/ContextUsageRing.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: d5eeac5e1b42
waivers: []
---

## 目标

完成 C21「当前上下文圆环与用量浮层」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C21。
- 参考覆盖：不齐：R01 局部／R27（rate-limit-light 底栏红色圆环，聊天附件降采样，只登记机制），数值状态缺。R键对应索引参考表与manifest定位；参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 批次与版本未知批次只作历史/机制参考，不混作同版本。3.1623 现有：rate-limit-light 的底栏红色圆环（聊天附件，2000px 降采样，仅登记机制）；其余用量圆环/浮层状态 3.1623 待补采。缺 3.1623 同态参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。私有参考只读，不复制原图或图中个人信息，文字只当数据。
- 2026-10-21 新参考：rate-limit-light／2026-10-21/00 的输入框底栏出现红色圆环状态；manifest 标明该图为聊天附件并被降采样到 2000px 宽，只登记机制与层级，不量 CSS px；该红色状态的语义（上下文用量触顶还是会话限额）由实现者对照 PIL-0151 的限额状态与现有 ContextUsageRing 语义核实后在 A1 登记，不凭图编造数据来源。
- 实现记录：消费 SDK 当前 context percent；无效值保未知。这不是当前运行通过证明。
- 历史证据位置：H08。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：NaN／Infinity 仅 SSR；不能用累计账单反推占比，Windows 逐态参考缺。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。

## 验收标准

- [ ] A1 建立 当前 context 0/中间值/100/未知/NaN/Infinity、浮层开合和长用量；账单累计值不得当当前占比；底栏红色圆环触顶状态（rate-limit-light 参考，只登记机制，数据来源以实际语义为准）。 逐图登记来源/版本关联、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体及功能开关，按上述状态逐条给可复现进入步骤；缺图或版本不明记待参考，不用 actual/演示数据代参考或真实 Pi consumer。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，在同一像素采样区取中位色；不得改用较宽松算法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考值换算：3.1623 原生截图按 SAMPLING 记录（显示器 150%、AppliedDPI 144；Claude 应用缩放 100%，用户 2026-10-21 确认），CSS px = 原像素 ÷ 1.5；聊天附件（manifest 标注可能降采样/重编码）、macOS 及版本/缩放未知的批次只登记机制，不由图宽或嵌入 DPI 反推 CSS px，其数值项记未运行并待 3.1623 原生补采。验证方法：量测表与差异图存 relay-evidence/PIL-0135/。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。
- [ ] A3 Tab/Enter 开关用量浮层，Escape/外点关闭回圆环，长数字/浮层内部溢出与窄窗避让、三档 DPI/缩放/双主题核验。数值只读，IME/文本编辑和列表方向导航不适用，不改变正文历史滚动。 原生与浏览器合成事件分层记录，缺少同态参考的视觉项记未运行。
- [ ] A4 本组件专属核验：圆环与浮层使用当前context；0／100／未知／无效值、长数字逐态检查，累计账单不能反推占比；红色触顶状态只在真实触顶（夹具返回额度耗尽/上下文已满）时出现，恢复后消失，不编造重置时间或比例；参考为降采样附件，数值项待 3.1623 原生补采，缺则记未运行。 对本卡已知残差逐条给出处理结果与可复现操作；真实请求／数据／状态与可见反馈一致，失败、取消和恢复保留，不伪造能力。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/ContextUsageRing.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0135`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。实质修改只在本卡独占组件/逻辑文件，保持其他组件与原有行为。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C21 当前上下文圆环与用量浮层 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C21补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P2：首发必需，当前无其他卡依赖，不占 P1。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字；并入 rate-limit-light 底栏红色圆环（只登记机制，不量 px）
- 2026-10-21T12:36Z · planner · 冻结验收标准 d5eeac5e1b42
