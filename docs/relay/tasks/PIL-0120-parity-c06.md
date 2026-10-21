---
id: PIL-0120
title: 复刻验收：C06 工具权限决定卡
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014, PIL-0030]
files_allowed: [components/ToolPermissionDecisionCard.tsx, components/ToolPermissionDecisionCard.test.mjs]
files_shared: [components/ChatWindow.tsx, app/native-theme.css]
acceptance_sha:
waivers: []
---

## 目标

完成 C06「工具权限决定卡」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡；本卡由 PIL-0014 建立，标准未冻结，须规划者复核后再领取实现。

## 背景与现状

- 索引：分支 task/PIL-0014-parity-index 的 docs/relay/parity-index.md，组件 C06。合入后使用[索引](../parity-index.md#组件清单)。
- 参考覆盖：不齐：permission-card-light／2026-10-21 已补决定卡、分裂按钮、Auto 引导与切换通知；R13 权限模式菜单仍非决定卡；错误/取消及深色待补。R 键与目录名见索引；只读 manifest，不复制原图、账号、邮箱或个人路径。
- 实现记录：McpToolDecisionCard 未采用；真实阻塞 UI 独立。这不是当前运行通过证明。
- 历史证据位置：H00。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：pending／拒绝／取消／失败与统一 gate 真值；演示 timer 不能作成功。
- 相关卡：PIL-0030；相关卡只处理其原定功能／残差，不抵本组件完整复刻验收。
- 拟新增（当前分支不存在）：`components/ToolPermissionDecisionCard.tsx`、`components/ToolPermissionDecisionCard.test.mjs`。列名用于明确草案范围，不表示已有consumer。
- 2026-10-21 新参考：permission-card-light／2026-10-21。用户自报 Windows Claude 3.1623.0.0、2560×1600、150%，浅色/zh-CN；该批是聊天附件，缩放未知，不默认等于原始 CSS px。不与旧 2.42304.0 批次混作同版本；未有新运行/视觉通过证据。

- 邻接参考：agent-panels-light/2026-10-21/00-ask-user-question-card.png、06-ask-user-question-multi-step-first.png、07-ask-user-question-multi-step-last.png。已读 manifest；后两图登记多题分页“第1项，共2项”、末题“提交”及“需要您的输入”状态胶囊。索引 C01–C62 无独立 AskUserQuestion 组件，暂记 C06 邻接；提问收集答案与工具授权是不同的业务契约，本卡仍只实现权限决定卡，不把选择答案当作执行授权。是否另建提问卡由协调者提请用户决定。批次标记 Windows 3.1623.0.0；DPI/应用缩放/附件换算按该 manifest 单独核对，不继承其他批次条件。

## 验收标准

- [ ] A1 建立 决定卡 pending/允许一次/策略切换/拒绝/取消/失败，分裂按钮菜单、Auto 引导与切换通知；允许必须对应真实 gate。 逐图登记来源/版本关联、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体及功能开关，按上述状态逐条给可复现进入步骤；缺图或版本不明记待参考，不用 actual/演示数据代参考或真实 Pi consumer。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（同一色彩空间/算法并记录方法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考图若为缩放过的聊天附件，须先按 manifest 换算到原始 CSS px 再比较；附件缩放/应用缩放未知时不可仅按图宽或嵌入 DPI 反推，无法可比记未运行。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。
- [ ] A3 Tab/方向键操作决定卡和分裂菜单，Escape 先关当前层并恢复触发点；长命令区可滚动/复制，窄窗/三档 DPI/缩放/双主题可读。卡片无编辑输入，故 IME 不输入命令；相邻 composer 组合时审批快捷键不得误触。 原生与浏览器合成事件分层记录，缺少同态参考的视觉项记未运行。
- [ ] A4 按 permission-card-light／2026-10-21 核对权限决定卡命令区、拒绝/允许主按钮、允许一次/切换 Auto 的分裂菜单、引导气泡关闭及切换后会话提示。所有决定绑定 PIL-0030 真实 gate，pending/拒绝/取消执行计数为 0，允许仅执行一次；Auto 文案只能映射已授权策略，不照搬第三方账号权限或扩大授权。 新批次版本与附件换算边界按 A1/A2 记录。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/ToolPermissionDecisionCard.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0120`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。ToolPermissionDecisionCard 承接全部决定卡及分裂按钮；ChatWindow 只挂载 gate 事件 consumer。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C06 工具权限决定卡 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

重复文件主卡：`components/ChatWindow.tsx` → PIL-0137。files_shared 中这些壳层只允许引入/导出、注册、props/回调或挂载的少量追加，实质改动留在上述子组件；大改需求须先由规划者修订范围。共享的既有定向测试只运行、不改写，新增用例放本卡独占测试，不删减原断言。

拟新增（当前分支不存在，不表示已有 consumer）：`components/ToolPermissionDecisionCard.tsx`、`components/ToolPermissionDecisionCard.test.mjs`。接线完成后必须验证真实 consumer，不能保留假功能占位。

本轮保持 todo、acceptance_sha 为空；不 freeze，不记录实现或通过证据。原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C06补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。
- 2026-10-21T07:13Z · claude:opus-medium:coord · 新增参考：references/claude-desktop/permission-card-light/2026-10-21（权限决定卡、分裂按钮菜单：允许一次／允许并切换 Auto、自动模式引导气泡、切换后的会话内提示）。浅色、zh-CN，Claude 3.1623.0.0，2560×1600@150%（聊天附件，可能经缩放，见 manifest）。冻结前由规划者据此补全 A4。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P2：首发必需，当前无其他卡依赖，不占 P1。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。

