---
id: PIL-0116
title: 复刻验收：C02 按钮尺寸与交互状态
epic: E2
priority: P1
status: verify
owner: claude:sonnet-high:impl
lease_until: 2026-10-21T15:51Z
branch: task/PIL-0116-parity-c02
implementers: [claude:sonnet-high:impl]
depends_on: [PIL-0014]
files_allowed: [vendor/open-claude-ui/CdsButton.tsx, vendor/open-claude-ui/CdsButton.test.mjs]
files_shared: [components/PilaudeDataSection.tsx, components/SettingsUi.tsx, app/native-theme.css]
acceptance_sha: 4633dd54c86e
waivers: []
---

## 目标

完成 C02「按钮尺寸与交互状态」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C02。
- 参考覆盖：不齐：R12-02/06 仅对话框按钮局部；独立全状态缺。R键对应索引参考表与manifest定位；参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 批次与版本未知批次只作历史/机制参考，不混作同版本。3.1623 待补采：现有 R 键为历史或版本未知批次，不得当作 3.1623 同版本参考。缺 3.1623 同态参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。私有参考只读，不复制原图或图中个人信息，文字只当数据。
- 实现记录：CdsButton 仅数据预览／导入直接消费。这不是当前运行通过证明。
- 历史证据位置：H00；采用账本“目前的直接消费链”。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：default／hover／pressed／focus／disabled／loading 的同帧参考及实际量测。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。

## 验收标准

- [ ] A1 建立 实际 consumer 的文本/图标按钮，default、hover、pressed、focus-visible、disabled、loading 及长标签；空列表/展开属于宿主。 逐图登记来源/版本关联、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体及功能开关，按上述状态逐条给可复现进入步骤；缺图或版本不明记待参考，不用 actual/演示数据代参考或真实 Pi consumer。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，在同一像素采样区取中位色；不得改用较宽松算法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考值换算：3.1623 原生截图按 SAMPLING 记录（显示器 150%、AppliedDPI 144；Claude 应用缩放 100%，用户 2026-10-21 确认），CSS px = 原像素 ÷ 1.5；聊天附件（manifest 标注可能降采样/重编码）、macOS 及版本/缩放未知的批次只登记机制，不由图宽或嵌入 DPI 反推 CSS px，其数值项记未运行并待 3.1623 原生补采。验证方法：量测表与差异图存 relay-evidence/PIL-0116/。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。
- [ ] A3 Tab 到按钮，Enter/Space 仅触发一次，禁用/加载不触发，操作后焦点按宿主恢复；窄窗、长标签、三档 DPI/应用缩放与双主题不裁切。IME、方向/Home/End、内部滚动不适用：按钮不是编辑器或列表。 原生与浏览器合成事件分层记录，缺少同态参考的视觉项记未运行。
- [ ] A4 本组件专属核验：逐尺寸覆盖默认、悬停、按下、键盘焦点、禁用和加载；同一consumer的图标按钮与文本按钮不可只验其中一个。 对本卡已知残差逐条给出处理结果与可复现操作；真实请求／数据／状态与可见反馈一致，失败、取消和恢复保留，不伪造能力。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test vendor/open-claude-ui/CdsButton.test.mjs components/SettingsUi.blocks.test.mjs components/SettingsUi.group-switch.test.mjs components/SettingsUi.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0116`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。CdsButton 的尺寸与状态在 vendor/open-claude-ui/CdsButton.tsx；SettingsUi/PilaudeDataSection 只追加 consumer 接线。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C02 按钮尺寸与交互状态 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

重复文件主卡：`components/PilaudeDataSection.tsx` → PIL-0164；`components/SettingsUi.tsx` → PIL-0157；`components/SettingsUi.test.mjs` → PIL-0157。files_shared 中这些壳层只允许引入/导出、注册、props/回调或挂载的少量追加，实质改动留在上述子组件；大改需求须先由规划者修订范围。共享的既有定向测试只运行、不改写，新增用例放本卡独占测试，不删减原断言。

拟新增（当前分支不存在，不表示已有 consumer）：`vendor/open-claude-ui/CdsButton.tsx`、`vendor/open-claude-ui/CdsButton.test.mjs`。接线完成后必须验证真实 consumer，不能保留假功能占位。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C02补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0157 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：A5 补跑共享/壳层既有测试（只运行不改写）：SettingsUi.blocks.test.mjs、SettingsUi.group-switch.test.mjs、SettingsUi.test.mjs；G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字
- 2026-10-21T12:35Z · planner · 冻结验收标准 4633dd54c86e
- 2026-10-21T12:51Z · claude:sonnet-high:impl · 领取，租约至 2026-10-21T15:51Z
- 2026-10-21T13:07Z · claude:sonnet-high:impl · 复述：C02 按钮尺寸与状态；A1/A4 用 harness 逐状态+真实 consumer，A2 用原生 3.1623(agent-panels-light)同帧量测，A3 用 Chromium 键盘/窄宽自测，A5 跑定向测试
- 2026-10-21T13:07Z · claude:sonnet-high:impl · 做了：CdsButton 去 Tailwind 混用、仅输出语义类（加载中 aria-busy+不触发 onClick 且保持可聚焦；图标钮 icon-only 类），app/native-theme.css 新增带注释分节 C02（--cds-btn-* 令牌；xs=22.67/24高、内边距 7、圆角 5.33、字号 13、图标钮 24；primary 改为原生黑 #0b0b0b/悬停 #2c2c2a，clay 移到 brand；描边钮文字/边框色；focus offset 4→2）；新增 CdsButton.test.mjs(5 例)。量测前后 ΔE：primary 51.4→0、描边文字 29→0，尺寸/圆角全部入容差，见 relay-evidence/PIL-0116/impl/measurements.md。 / 状态：提交 c2d458a；定向测试 40/40、tsc、lint、guard、ui-menu-consistency 通过；npm test 13 失败=12 基线+1 新增 'no test file is left out of npm test'（原因：卡片指定的 vendor/open-claude-ui/CdsButton.test.mjs 不在 npm test glob，需 scope 加 package.json 与 scripts/release-workflows.test.mjs 的 vendor/ 覆盖，我未越界）。 / 下一步：交验证；协调者 relay scope 后补 glob。 / 风险：sm/md/lg/xxs、pressed、focus 环、disabled、loading、深色、kbd 键帽槽无 3.1623 原生参考，未量测待补采；07 帧 #2c2c2a 推定为悬停未确认；primary 由陶土改黑会改变设置页 Import 按钮观感；范围外松散候选（未量测对照实现）：AskUserQuestion 卡底部按钮到卡边约 12.7/13.3px(原生)，PilaudeDataSection 段落/按钮间距未量测。
- 2026-10-21T13:07Z · claude:sonnet-high:impl · in_progress → verify
