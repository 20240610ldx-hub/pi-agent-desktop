---
id: PIL-0124
title: 复刻验收：C10 提及、路径与斜杠建议
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014, PIL-0122]
files_allowed: [components/SessionMentionMenu.tsx, hooks/useSessionMentionPalette.ts, components/SessionMentionMenu.test.mjs, components/ComposerSuggestionMenu.tsx]
files_shared: [components/ChatInput.tsx, app/native-theme.css]
acceptance_sha:
waivers: []
---

## 目标

完成 C10「提及、路径与斜杠建议」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C10。
- 参考覆盖：不齐：composer-suggestions-light／2026-10-21 已补 slash 说明浮签、@ 会话/文件夹/文件类型图标与列表；深色/错误/完整 IME 状态仍缺。R 键与目录名见索引；只读 manifest，不复制原图、账号、邮箱或个人路径。参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 与版本未知批次只作历史/机制参考，不混作同版本。上述已补各图均为聊天附件（见下条），未补状态为 3.1623 待补采；缺 3.1623 同态原生参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。
- 实现记录：RichComposerWithMentions 未采用；Pi @／#／slash 独立实现。这不是当前运行通过证明。
- 历史证据位置：H03（仅邻接提交）。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：建议列表全部状态、路径边界、IME／229、焦点与滚动专项未齐。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。
- 2026-10-21 新参考：composer-suggestions-light／2026-10-21。用户自报 Windows Claude 3.1623.0.0、2560×1600、150%，浅色/zh-CN；manifest 标记该批为聊天附件（可能重编码/降采样，缩放未知），只登记机制，不当原生像素量测；A2 数值项待同状态 3.1623 原生补采，否则记未运行。不与 2.42304.0 批次混作同版本；未有新运行/视觉通过证据。

## 验收标准

- [ ] A1 建立 @/#/slash 的打开、匹配/无结果、加载/失败、当前行、说明浮签与长路径列表；建议数据来自真实可访问资源。 逐图登记来源/版本关联、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体及功能开关，按上述状态逐条给可复现进入步骤；缺图或版本不明记待参考，不用 actual/演示数据代参考或真实 Pi consumer。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，在同一像素采样区取中位色；不得改用较宽松算法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考值换算：3.1623 原生截图按 SAMPLING 记录（显示器 150%、AppliedDPI 144；Claude 应用缩放 100%，用户 2026-10-21 确认），CSS px = 原像素 ÷ 1.5；聊天附件（manifest 标注可能降采样/重编码）、macOS 及版本/缩放未知的批次只登记机制，不由图宽或嵌入 DPI 反推 CSS px，其数值项记未运行并待 3.1623 原生补采。验证方法：量测表与差异图存 relay-evidence/PIL-0124/。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。
- [ ] A3 原生 IME 组合时保留输入所有权，选词后的方向/Enter/Escape 才交建议菜单；Tab/方向/Home/End 导航、无结果/长列表滚动保持高亮，关闭回输入器。窄窗避让、三档 DPI/缩放/双主题及 tooltip 锚点核验。 原生与浏览器合成事件分层记录，缺少同态参考的视觉项记未运行。
- [ ] A4 按 composer-suggestions-light／2026-10-21 核对 slash 高亮行/说明 tooltip、@ 会话/文件夹/文件图标与附属元数据、底部渐隐和滚动条；用公开路径验证 @/#/slash 的边界/长词/尾标点，组合输入不误选择，滚动不丢选中。 新批次版本与附件换算边界按 A1/A2 记录。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/SessionMentionMenu.test.mjs components/ChatInput.test.mjs components/ChatInput.automation.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0124`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。SessionMentionMenu/ComposerSuggestionMenu/useSessionMentionPalette 承接建议；ChatInput 只挂载与转交按键。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C10 提及、路径与斜杠建议 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

重复文件主卡：`components/ChatInput.tsx` → PIL-0122；`components/ChatInput.test.mjs` → PIL-0122。files_shared 中这些壳层只允许引入/导出、注册、props/回调或挂载的少量追加，实质改动留在上述子组件；大改需求须先由规划者修订范围。共享的既有定向测试只运行、不改写，新增用例放本卡独占测试，不删减原断言。

拟新增（当前分支不存在，不表示已有 consumer）：`components/SessionMentionMenu.test.mjs`、`components/ComposerSuggestionMenu.tsx`。接线完成后必须验证真实 consumer，不能保留假功能占位。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C10补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。
- 2026-10-21T07:13Z · claude:opus-medium:coord · 新增参考：references/claude-desktop/composer-suggestions-light/2026-10-21（/ 命令菜单带说明 tooltip、@ 提及菜单含会话／文件夹／文件图标）。浅色、zh-CN，Claude 3.1623.0.0，2560×1600@150%（聊天附件，可能经缩放，见 manifest）。冻结前由规划者据此补全 A4。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P2：首发必需，当前无其他卡依赖，不占 P1。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：A5 补跑共享/壳层既有测试（只运行不改写）：ChatInput.test.mjs、ChatInput.automation.test.mjs；G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字；G4 补写 3.1623 基准与待补采
