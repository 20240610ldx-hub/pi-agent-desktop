---
id: PIL-0120
title: 复刻验收：C06 工具权限决定卡与 AskUserQuestion 提问卡
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014, PIL-0030, PIL-0188, PIL-0203]
files_allowed: [components/ToolPermissionDecisionCard.tsx, components/ToolPermissionDecisionCard.test.mjs, components/AskUserQuestionCard.tsx, components/AskUserQuestionCard.test.mjs]
files_shared: [components/ChatWindow.tsx, lib/i18n/messages/*.ts, app/native-theme.css]
acceptance_sha: 2ec85a002a42
waivers: []
---

## 目标

完成 C06「工具权限决定卡」与 AskUserQuestion 单题/多题提问卡的真实产品呈现与逐状态复刻（提问卡接 PIL-0188 的真实提问能力），使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C06。
- 参考覆盖：不齐：permission-card-light／2026-10-21 已补决定卡、分裂按钮、Auto 引导与切换通知（manifest 标记为聊天附件，缩放未知，仅登记机制）；R13 权限模式菜单仍非决定卡；错误/取消及深色待补。AskUserQuestion 提问卡参考为 agent-panels-light／2026-10-21 的 00、06、07（原生原字节，可按 CSS px = 原像素 ÷ 1.5 量测）。参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 与版本未知批次只作历史/机制参考。缺 3.1623 同态原生参考的状态（拒绝/取消/失败、深色、权限卡原生量测）严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。只读 manifest，不复制原图、账号、邮箱或个人路径。
- 实现记录：McpToolDecisionCard 未采用；真实阻塞 UI 独立；桌面端已有阻塞式扩展 UI 队列（ChatWindow 的对话请求），但尚无面向模型的提问工具与结构化请求，由 PIL-0188 补齐。这不是当前运行通过证明。
- 历史证据位置：H00。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：pending／拒绝／取消／失败与统一 gate 真值；演示 timer 不能作成功；提问卡的分页、其他输入、跳过、末题提交与等待输入状态尚未实现。
- 相关卡：PIL-0030（授权门）、PIL-0188（提问能力）；相关卡只处理其原定功能／残差，不抵本组件完整复刻验收。
- 拟新增（当前分支不存在）：`components/ToolPermissionDecisionCard.tsx`、`components/ToolPermissionDecisionCard.test.mjs`、`components/AskUserQuestionCard.tsx`、`components/AskUserQuestionCard.test.mjs`。列名用于明确草案范围，不表示已有consumer。
- 2026-10-21 新参考：permission-card-light／2026-10-21。用户自报 Windows Claude 3.1623.0.0、2560×1600、150%，浅色/zh-CN；manifest 标记该批为聊天附件（可能重编码/降采样，缩放未知），只登记机制，不当原生像素量测；A2 数值项待同状态 3.1623 原生补采，否则记未运行。不与 2.42304.0 批次混作同版本；未有新运行/视觉通过证据。

- 提问卡参考：agent-panels-light/2026-10-21/00-ask-user-question-card.png（单题：题头、带说明的单选项、"其他"、跳过、提交 Ctrl+Enter、"需要您的输入"状态胶囊）、06-ask-user-question-multi-step-first.png（多题第1项：灰色题头、分页"第1项，共2项"与左右箭头、选中项蓝色、跳过/下一步 Ctrl+Enter）、07-ask-user-question-multi-step-last.png（末题：左箭头可用、右箭头禁用、按钮变为"提交 Ctrl+Enter"）。用户 2026-10-21 决定：C06 实际实现 AskUserQuestion 单题/多题提问卡，接 Pi 真实提问能力（PIL-0188）。批次为 Windows 3.1623.0.0 原生原字节；提问答案是对模型的回答，不是工具授权，不进入授权门。

## 验收标准

- [ ] A1 建立 决定卡 pending/允许一次/策略切换/拒绝/取消/失败，分裂按钮菜单、Auto 引导与切换通知；提问卡 单题/多题第1项/中间项/末题、选项选中/未选/带说明、"其他"自由输入、跳过、提交中、已答/取消/失败、"需要您的输入"状态胶囊。允许必须对应真实 gate，提问卡必须对应 PIL-0188 的真实待答请求。逐图登记来源/版本关联、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体及功能开关，按上述状态逐条给可复现进入步骤；缺图或版本不明记待参考，不用 actual/演示数据代参考或真实 Pi consumer。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，在同一像素采样区取中位色；不得改用较宽松算法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考值换算：3.1623 原生截图按 SAMPLING 记录（显示器 150%、AppliedDPI 144；Claude 应用缩放 100%，用户 2026-10-21 确认），CSS px = 原像素 ÷ 1.5；聊天附件（manifest 标注可能降采样/重编码）、macOS 及版本/缩放未知的批次只登记机制，不由图宽或嵌入 DPI 反推 CSS px，其数值项记未运行并待 3.1623 原生补采。验证方法：量测表与差异图存 relay-evidence/PIL-0120/。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。 提问卡三图（agent-panels-light 00/06/07，原生）可量测：卡片宽高、题头与分页行高、选项行高与间距、说明文字基线、状态胶囊、跳过/下一步/提交按钮尺寸；权限决定卡参考为聊天附件，仅登记机制，其数值项待 3.1623 原生补采，缺则记未运行。
- [ ] A3 Tab/方向键操作决定卡和分裂菜单，Escape 先关当前层并恢复触发点；长命令区可滚动/复制，窄窗/三档 DPI/缩放/双主题可读。提问卡：方向键在选项间移动，空格/点击选择（多选题可多选），Ctrl+Enter 触发下一步/提交，分页箭头与 Tab 可达，Escape 取消并恢复触发点；"其他"输入框做原生 Windows IME 组合/选词/Enter/Escape/229 测试，组合期间不误提交、不误翻页。相邻 composer 组合时审批和提交快捷键不得误触。原生与浏览器合成事件分层记录，缺少同态参考的视觉项记未运行。
- [ ] A4 按 permission-card-light／2026-10-21 核对权限决定卡命令区、拒绝/允许主按钮、允许一次/切换 Auto 的分裂菜单、引导气泡关闭及切换后会话提示。所有决定绑定 PIL-0030 真实 gate，pending/拒绝/取消执行计数为 0，允许仅执行一次；Auto 文案只能映射已授权策略，不照搬第三方账号权限或扩大授权。新批次版本与附件换算边界按 A1/A2 记录。
- [ ] A5 提问卡核验：用 PIL-0188 的夹具会话（本地 OpenAI 兼容夹具，证据标注"夹具"）让模型发起单题与 2 题问题：核对分页"第N项，共M项"、选项带说明、"其他"自由输入、跳过、下一步/末题"提交 Ctrl+Enter"、"需要您的输入"胶囊；提交后答案原样回到模型且会话继续，跳过返回显式 skipped，Stop/取消后卡片消失且不发答案，SSE 断线重连后待答卡仍在、已答卡不重现；多个待答/待批请求按到达顺序排队，不互相遮蔽。答案不等于授权：选择"允许"类选项后，受门控工具仍显示权限决定卡且执行计数为 0，直到用户在权限卡上批准。真实模型路径只用 deepseek-flash 且限制输出，能触发才验，否则记未运行。 提问卡文案（第N项，共M项、跳过、下一步、提交、需要您的输入、其他等）在 lib/i18n/messages 的简中/繁中/英文三种语言同步，缺键不显示键名，i18n 文件只改本卡新增键。
- [ ] A6 由独立验证者运行受影响定向测试：`node --test components/ToolPermissionDecisionCard.test.mjs components/AskUserQuestionCard.test.mjs components/ChatWindow*.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0120`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。 本卡不实现提问能力本身（工具注册、请求/回传协议，归 PIL-0188），不把答案写入授权策略。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。ToolPermissionDecisionCard 承接全部决定卡及分裂按钮；AskUserQuestionCard 承接提问卡（消费 PIL-0188 的 ask_user_question 请求与响应形状）；ChatWindow 只挂载 gate 事件与提问请求的 consumer，不在 ChatWindow 内实现卡片本体。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C06 工具权限决定卡 */ 与 /* C06 提问卡 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

重复文件主卡：`components/ChatWindow.tsx` → PIL-0137。files_shared 中这些壳层只允许引入/导出、注册、props/回调或挂载的少量追加，实质改动留在上述子组件；大改需求须先由规划者修订范围。共享的既有定向测试只运行、不改写，新增用例放本卡独占测试，不删减原断言。

拟新增（当前分支不存在，不表示已有 consumer）：`components/ToolPermissionDecisionCard.tsx`、`components/ToolPermissionDecisionCard.test.mjs`、`components/AskUserQuestionCard.tsx`、`components/AskUserQuestionCard.test.mjs`。接线完成后必须验证真实 consumer，不能保留假功能占位。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C06补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。
- 2026-10-21T07:13Z · claude:opus-medium:coord · 新增参考：references/claude-desktop/permission-card-light/2026-10-21（权限决定卡、分裂按钮菜单：允许一次／允许并切换 Auto、自动模式引导气泡、切换后的会话内提示）。浅色、zh-CN，Claude 3.1623.0.0，2560×1600@150%（聊天附件，可能经缩放，见 manifest）。冻结前由规划者据此补全 A4。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P2：首发必需，当前无其他卡依赖，不占 P1。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T08:06Z · claude:opus-medium:planner · 用户 2026-10-21 决定：AskUserQuestion 单题/多题问答卡不单独建卡，保留在 C06 邻接（参考 agent-panels-light/2026-10-21/00、06、07）
- 2026-10-21T12:03Z · claude:opus-medium:planner · 用户 2026-10-21 澄清：C06 实际实现 AskUserQuestion 单题/多题问答卡（取代此前「仅邻接登记」的理解）；「在分叉会话中发送」建小能力卡；C25 完成音用开源方案。由规划第 3 轮落实。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：A5 补跑共享/壳层既有测试（只运行不改写）：ChatWindow*.test.mjs；G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字；按用户决定实际实现 AskUserQuestion 提问卡：加 AskUserQuestionCard 文件、A1/A3 扩展、新增 A5（分页/其他/跳过/提交/胶囊/答案非授权）；依赖加 PIL-0188；参考归属 agent-panels-light 00/06/07（原生可量测）；files_shared 加 lib/i18n/messages/*.ts，提问卡文案三语言同步
- 2026-10-21T12:35Z · planner · 冻结验收标准 2ec85a002a42
