---
id: PIL-0158
title: 复刻验收：C44 模型配置与提供商凭据界面
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014, PIL-0020]
files_allowed: [components/ModelsConfig.tsx, components/EnabledModelsSection.tsx, components/NonChatModelsDetail.tsx, components/ModelsConfig.test.mjs, components/EnabledModelsSection.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha:
waivers: []
---

## 目标

完成 C44「模型配置与提供商凭据界面」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡；本卡由 PIL-0014 建立，标准未冻结，须规划者复核后再领取实现。

## 背景与现状

- 索引：分支 task/PIL-0014-parity-index 的 docs/relay/parity-index.md，组件 C44。合入后使用[索引](../parity-index.md#组件清单)。
- 参考覆盖：不齐：model-picker-light／2026-10-21 已补模型/更多模型菜单；provider-config-3p／2026-10-21 是 macOS 深色供应商配置窗，仅作机制参考，版本/缩放未知，不是 Windows 同态证据。R 键与目录名见索引；只读 manifest，不复制原图、账号、邮箱或个人路径。
- 实现记录：ModelsConfig、EnabledModels 与真实 Pi 配置／凭据独立实现。这不是当前运行通过证明。
- 历史证据位置：H00。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：启停／未知／错误／重试／脱敏参考、完整键盘及原生度量未齐。
- 相关卡：PIL-0020；相关卡只处理其原定功能／残差，不抵本组件完整复刻验收。
- 2026-10-21 新参考：model-picker-light／2026-10-21、provider-config-3p／2026-10-21。model-picker-light 为用户自报 Windows 3.1623.0.0/2560×1600/150%；provider-config-3p 为 macOS 深色，版本和缩放未知，不能把推测的 Retina 2× 当已知条件。不与旧 2.42304.0 批次混作同版本；未有新运行/视觉通过证据。

## 验收标准

- [ ] A1 建立 模型菜单/更多模型与提供商配置分开列：当前/不可用、凭据遮蔽、必填不足、应用中/失败和非聊天模型。 逐图登记来源/版本关联、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体及功能开关，按上述状态逐条给可复现进入步骤；缺图或版本不明记待参考，不用 actual/演示数据代参考或真实 Pi consumer。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（同一色彩空间/算法并记录方法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考图若为缩放过的聊天附件，须先按 manifest 换算到原始 CSS px 再比较；附件缩放/应用缩放未知时不可仅按图宽或嵌入 DPI 反推，无法可比记未运行。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。
- [ ] A3 凭据/模型搜索原生 IME，Tab/菜单方向/Home/End/Escape 和取消/应用后焦点恢复；长提供商/模型列表内部滚动，窄窗/三档 DPI/缩放/双主题核验。密码遮蔽/复制不泄密；macOS 3P 仅参考布局机制，不算 Windows 字体/原生边框通过。 原生与浏览器合成事件分层记录，缺少同态参考的视觉项记未运行。
- [ ] A4 分别对照 model-picker-light／2026-10-21 的当前项/默认标记/快捷键/更多模型层级，以及 provider-config-3p／2026-10-21 的分组导航、供应商选择、URL/自定义 header/凭据类型、模型发现、必填不足提示与 Apply 禁用机制；后者只复用布局/校验机制，不复制 macOS 窗口装饰、企业字段或账号。只绑定现有 Pi 配置/凭据/非聊天模型，遮蔽敏感值，刷新目录仍只按用户操作触发，不能复制买额度/托管计费功能。 新批次版本与附件换算边界按 A1/A2 记录。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/ModelsConfig.test.mjs components/EnabledModelsSection.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0158`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。实质修改只在本卡独占组件/逻辑文件，保持其他组件与原有行为。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C44 模型配置与提供商凭据界面 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

本轮保持 todo、acceptance_sha 为空；不 freeze，不记录实现或通过证据。原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C44补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。
- 2026-10-21T07:11Z · claude:opus-medium:coord · 新增参考：references/claude-desktop/model-picker-light/2026-10-21（模型菜单与更多模型）与 provider-config-3p/2026-10-21（官方 3P 供应商连接配置窗，macOS 深色）。浅色、zh-CN，Claude 3.1623.0.0，2560×1600@150%（附件可能经聊天客户端缩放至 2000px 宽，见 manifest）。冻结前由规划者据此补全 A4。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P2：首发必需，当前无其他卡依赖，不占 P1。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。

