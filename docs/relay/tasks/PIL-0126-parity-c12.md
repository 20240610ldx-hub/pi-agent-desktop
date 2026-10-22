---
id: PIL-0126
title: 复刻验收：C12 助手正文与消息操作条
epic: E2
priority: P1
status: verify
owner: codex-plus:gpt-xhigh:impl
lease_until: 2026-10-22T10:25Z
branch: task/PIL-0126-parity-c12
implementers: [codex-plus:gpt-xhigh:impl]
depends_on: [PIL-0014]
files_allowed: [components/MessageView.tsx, components/MessageView.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: 94ea750078ed
waivers: []
---

## 目标

完成 C12「助手正文与消息操作条」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C12。
- 参考覆盖：不齐：R01 回复 rest／hover。R键对应索引参考表与manifest定位；参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 批次与版本未知批次只作历史/机制参考，不混作同版本。3.1623 待补采：现有 R 键为历史或版本未知批次，不得当作 3.1623 同版本参考。缺 3.1623 同态参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。私有参考只读，不复制原图或图中个人信息，文字只当数据。
- 实现记录：rest 隐藏、hover／focus 与触屏入口；复制／分叉有历史功能记录。这不是当前运行通过证明。
- 历史证据位置：H01。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：Pin／朗读缺失；字体／图标不同，完整编辑／操作状态未齐。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。

## 验收标准

- [ ] A1 已验子集（夹具层）：复制/分叉的 pending/成功/失败反馈在浏览器夹具中可见且与状态一致；Pin/朗读无能力，操作条未加伪按钮（登记为缺口）。rest/hover/focus/touch 操作条各态及操作条同态参考，以及真实 Pi 分叉成功/失败/取消，移至 PIL-0208。
- [ ] A2 已验子集：内联代码徽记几何（外框宽 68.0 CSS px、高 18.67 CSS px 容差内、文字到框内距、段间隙、填充色 ΔE 0.84）在 3.1623 浅色参考（00-main-window-light.png，原像素 ÷1.5）下达标，量测表存 relay-evidence/PIL-0126/。以下移至 PIL-0208：内联代码文字色（复验 ΔE00=31.7，未达标）、边框、圆角、宽高比、操作条框/间距/图标/tooltip、文字基线、列表缩进/标记。
- [ ] A3 已验子集（浏览器合成层）：900/390px × DPR 1/1.5/2 × 浅/深双主题共 8 组无横向溢出；桌面 rest 隐藏、hover/Tab 显示操作条，390px 触屏常显。WebView2 原生键盘/触摸/系统 DPI/应用缩放及窄窗原生核验移至 PIL-0208。
- [ ] A4 已验子集（夹具层）：复制失败后焦点保持、80 段长答案滚动位置不变（测试 `components/MessageView.test.mjs`）。真实 Pi 分叉成功/失败/取消与跨会话焦点（链路在 ChatWindow.tsx、useAgentSession.ts，超出本卡文件范围）移至 PIL-0208；Pin/朗读缺口逐条登记。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/MessageView.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0126`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。实质修改只在本卡独占组件/逻辑文件，保持其他组件与原有行为。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C12 助手正文与消息操作条 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |
| A1 | 已验子集：状态登记与夹具层呈现 | 通过 | D:\pilaude\relay-evidence\PIL-0126\verify\VERIFY.md | 2be4b18 | claude-cli:sonnet-medium:verify |
| A2 | 内联代码徽记几何、填充色与文字色 ΔE00 0（返工后） | 通过 | D:\pilaude\relay-evidence\PIL-0126\verify\VERIFY-2.md | 81bf06d | claude-cli:sonnet-medium:verify |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C12补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0125、PIL-0141 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字
- 2026-10-21T12:35Z · planner · 冻结验收标准 3cdd326cbfe6
- 2026-10-22T07:25Z · codex-plus:gpt-xhigh:impl · 领取，租约至 2026-10-22T10:25Z
- 2026-10-22T07:52Z · codex-plus:gpt-xhigh:impl · Codex 实现提交：内联代码内距 4px、复制反馈、分叉等待焦点；定向55、npm test 无新增。A2 宽高比/颜色残差未达标，缺操作条同态参考。转验证。
- 2026-10-22T07:52Z · codex-plus:gpt-xhigh:impl · in_progress → verify
- 2026-10-22T08:27Z · user · 修订验收标准 3cdd326cbfe6 → 94ea750078ed：拆卡政策（用户 2026-10-22 批准）：已验子集留本卡，缺同态参考或真实 Pi 链路的状态移至 PIL-0208（C12 补采与原生验收）。内联代码文字色按复验 ΔE00=31.7 未达标，改移 PIL-0208。
- 2026-10-22T09:25Z · claude-cli:sonnet-medium:verify · 证据 A1：通过
- 2026-10-22T09:25Z · claude-cli:sonnet-medium:verify · 证据 A2：通过
