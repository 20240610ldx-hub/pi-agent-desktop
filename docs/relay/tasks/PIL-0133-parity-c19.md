---
id: PIL-0133
title: 复刻验收：C19 模型切换菜单
epic: E2
priority: P2
status: verify
owner: codex-plus:gpt-xhigh:impl
lease_until: 2026-10-22T05:42Z
branch: task/PIL-0133-parity-c19
implementers: [codex-plus:gpt-xhigh:impl]
depends_on: [PIL-0014]
files_allowed: [components/ModelSelector.tsx, components/SelectorRow.tsx, components/ModelSelector.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: 2a97764096d2
waivers: []
---

## 目标

完成 C19「模型切换菜单」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C19。
- 参考覆盖：不齐：R03/R13-03，模型菜单局部。R键对应索引参考表与manifest定位；参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 批次与版本未知批次只作历史/机制参考，不混作同版本。3.1623 现有：model-picker-light（聊天附件，缩放未知，仅机制）；其余模型菜单状态 3.1623 待补采。缺 3.1623 同态参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。私有参考只读，不复制原图或图中个人信息，文字只当数据。
- 实现记录：ModelSwitcherWithTokenGauge 未采用；Pi 模型选择独立实现。这不是当前运行通过证明。
- 历史证据位置：H00。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：能力／未知值／长名／错误菜单、同帧字号与对齐；不使用示例固定模型／窗口值。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。

## 验收标准

- [ ] A1 本卡范围（用户 2026-10-22 决定拆卡）：仅浏览器夹具层的状态矩阵——模型/提供商分组、当前/不可用/未知、长名称、搜索/无结果、失败（真实 Chromium 测试夹具，模型值由夹具提供，不冒充真实 Pi），并登记深色主窗口 05-model-picker-more-models-dark（3.1623，150%，应用缩放 100%，zh-CN）的来源、版本、DPI、缩放、主题。真实 Pi 目录下的分组/搜索/无结果/不可用/失败与浅色等无 3.1623 同态参考的状态移至 PIL-0204。
- [ ] A2 仅对有 3.1623 深色同态参考的原语（对勾位置与颜色、正文颜色、菜单宽、行高、hover inset、外/行圆角、文字左 ink、面板底色/边框/hover 底）在同帧/同状态下给出参考值、实现值、原像素与 CSS px（原像素 ÷1.5）、差值：盒宽高与间距 ≤1 CSS px，文字基线 ≤1，圆角 ≤0.5，图标中心 ≤1，颜色 CIEDE2000 ΔE ≤2（sRGB→Lab D65，同一像素采样区取中位色）。叠图只做整数裁剪/平移，不插值；字形 ink 差单列残差。量测表与差异图存 relay-evidence/PIL-0133/。浅色菜单、浅色对勾色、星按钮行、文字行内垂直基线及缺同态参考的状态移至 PIL-0204。
- [ ] A3 浏览器层：Tab/方向/Home/End 访问分组/当前项，Escape 只关本层并回触发点；搜索框 IME 合成事件下 Enter 不选中；长列表滚动保当前项；菜单走 DOM `.app-menu`，`NATIVE_POPUP_MENUS_ENABLED` 保持 false，不弹系统原生菜单（PIL-0177、用户决定）；无搜索框的菜单项不套文本编辑语义。原生与浏览器合成事件分层记录。WebView2 原生 IME、100/125/150% 三档 DPI、应用缩放、窄窗原生核验移至 PIL-0204。
- [ ] A4 浏览器夹具层专属核验：当前项对勾与星按钮避让（鼠标/触屏）无重叠回归，提供商/模型列表、长名、搜索、当前项、不可用和错误逐态在夹具下核验；已知残差逐条给出处理结果与可复现操作。真实模型切换成功/失败/取消/恢复、真实 Pi 数据逐态核验移至 PIL-0204。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/ModelSelector.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0133`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。实质修改只在本卡独占组件/逻辑文件，保持其他组件与原有行为。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C19 模型切换菜单 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C19补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P2：首发必需，当前无其他卡依赖，不占 P1。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字；G8 A3 写明走 DOM、不开原生弹出
- 2026-10-21T12:36Z · planner · 冻结验收标准 a4cb17ca21d9
- 2026-10-22T02:42Z · codex-plus:gpt-xhigh:impl · 领取，租约至 2026-10-22T05:42Z
- 2026-10-22T03:13Z · codex-plus:gpt-xhigh:impl · Codex 实现提交：搜索/当前项/键盘/IME/焦点；行高24、圆角10.667；定向88/88，npm test 无新增失败。证据 relay-evidence/PIL-0133/impl/HANDOFF.md。转验证（CLI 账号 Sonnet）。
- 2026-10-22T03:13Z · codex-plus:gpt-xhigh:impl · in_progress → verify
- 2026-10-22T03:42Z · user · 修订验收标准 a4cb17ca21d9 → a4cb17ca21d9：用户 2026-10-22 拆卡政策：已验夹具层与有参考的深色项留在本卡，浅色/分组/搜索/无结果/不可用/长名/错误/星按钮行同态参考、真实 Pi 切换与失败恢复、WebView2 IME、三档 DPI、浅色对勾色移至 PIL-0204
- 2026-10-22T03:43Z · user · 修订验收标准 a4cb17ca21d9 → 2a97764096d2：用户 2026-10-22 拆卡政策（移出项见 PIL-0204）：浅色/分组/搜索/无结果/不可用/长名/错误/星按钮行同态参考、真实 Pi 切换与失败恢复、WebView2 IME、三档 DPI、浅色对勾色移至 PIL-0204
