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
files_allowed: [vendor/open-claude-ui/CdsButton.tsx, vendor/open-claude-ui/CdsButton.test.mjs, package.json, scripts/release-workflows.test.mjs]
files_shared: [components/PilaudeDataSection.tsx, components/SettingsUi.tsx, app/native-theme.css]
acceptance_sha: f290638aa589
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

- [ ] A1 本卡范围（用户 2026-10-22 决定拆卡）：仅已有 3.1623 原生同态参考的按钮状态——xs 描边钮默认（浅色，agent-panels-light/2026-10-21/00 Skip）、xs 填充主按钮默认（浅色，00/06 Submit/下一步）、sm 次级钮默认（深色，main-window-native/2026-10-22/09「管理」）、xs 图标钮悬停（深色，main-window-native/2026-10-22/07 复制钮）。逐图登记来源/版本关联、系统 DPI、应用缩放、主题/语言，给可复现进入步骤。其余尺寸、变体与 pressed/focus-visible/disabled/loading 原生外观转 PIL-0198，补采后另验。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，在同一像素采样区取中位色；不得改用较宽松算法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考值换算：3.1623 原生截图按 SAMPLING 记录（显示器 150%、AppliedDPI 144；Claude 应用缩放 100%，用户 2026-10-21 确认），CSS px = 原像素 ÷ 1.5；聊天附件（manifest 标注可能降采样/重编码）、macOS 及版本/缩放未知的批次只登记机制，不由图宽或嵌入 DPI 反推 CSS px，其数值项记未运行并待 3.1623 原生补采。验证方法：量测表与差异图存 relay-evidence/PIL-0116/。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。
- [ ] A3 Tab 到按钮，Enter/Space 仅触发一次，禁用/加载不触发且加载中保持可聚焦；窄窗（320/900）、长标签、DPR 1/1.5/2 与双主题不裁切、不溢出。本卡验浏览器合成事件层；Windows 原生/WebView2、真机三档 DPI 与 Claude 应用缩放层转 PIL-0198。IME、方向/Home/End、内部滚动不适用。
- [ ] A4 本组件专属核验：A1 所列四个状态的盒尺寸、圆角、文字墨迹边距/基线、填充/文字/边框色逐项给参考值、实现值与差值并达标；同一 consumer 的图标按钮与文本按钮各至少一个状态被量测。对本卡已知残差逐条给出处理结果；primary 改黑的依据记录在证据中。
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
| A1 | 核对实现者登记与 manifest：缺逐状态矩阵(pressed/focus/disabled/loading/长标签无原生参考)、客户区/字体/开关字段，真实 consumer(PilaudeDataSection)未在 next dev 页面渲染；仅夹具层(h/fixture.jsx) | 未运行 | D:/pilaude/relay-evidence/PIL-0116/verify/measurements.md | 8b5bdcc | claude:sonnet-high:verify |
| A2 | 夹具层 Chromium DPR1.5 独立量测子集：00 Skip 外框/墨迹/边框色/圆角、Submit 高/色，09 管理(sm 深色)外框/墨迹/圆角/色，07 复制钮宽/悬停色；全部在容差内(max ΔE 0.96) | 通过 | D:/pilaude/relay-evidence/PIL-0116/verify/measurements.md | 8b5bdcc | claude:sonnet-high:verify |
| A2 | 无 3.1623 原生同态参考或帧状态未确认：Submit 宽(键帽槽缺)、icon 高/纵向中心(tooltip 遮挡)、agent-panels 07 悬停归属、md/lg/xxs、深色 primary、secondary/ghost/danger 等其余态 | 未运行 | D:/pilaude/relay-evidence/PIL-0116/verify/measurements.md | 8b5bdcc | claude:sonnet-high:verify |
| A3 | 浏览器合成事件层 node h/keys.mjs：light/dark x DPR1/1.5/2 x 宽900/320；Tab 到 skip，Enter/Space 各 1 次，disabled/loading 不触发，loading 可聚焦，长标签省略无溢出 | 通过 | D:/pilaude/relay-evidence/PIL-0116/verify/keys-result.json | 8b5bdcc | claude:sonnet-high:verify |
| A3 | Windows 原生/WebView2、DPI 100/125/150 真机、真实 consumer 操作后焦点恢复、无原生同态参考的视觉项 | 未运行 | D:/pilaude/relay-evidence/PIL-0116/verify/measurements.md | 8b5bdcc | claude:sonnet-high:verify |
| A4 | 逐尺寸×逐状态矩阵不完整：pressed/focus/disabled/loading 全尺寸及 md/lg/xxs 无 3.1623 原生参考；仅 xs 文本/图标钮与 sm secondary 深色默认有参考 | 未运行 | D:/pilaude/relay-evidence/PIL-0116/verify/measurements.md | 8b5bdcc | claude:sonnet-high:verify |
| A5 | node --test 四个定向文件 40/40；tsc --noEmit 0；npm run lint 0；npm test 3605 例 12 失败均在 PIL-0113 基线名单，新增 0；relay guard --task PIL-0116 无问题 | 通过 | D:/pilaude/relay-evidence/PIL-0116/verify/A5-targeted.log; D:/pilaude/relay-evidence/PIL-0116/verify/A5-tsc.log; D:/pilaude/relay-evidence/PIL-0116/verify/A5-lint.log; D:/pilaude/relay-evidence/PIL-0116/verify/A5-npm-test.log; D:/pilaude/relay-evidence/PIL-0116/verify/fail-names.txt; D:/pilaude/relay-evidence/PIL-0116/verify/A5-guard.log | 8b5bdcc | claude:sonnet-high:verify |
| A1 | 夹具层(浏览器 Chromium)：按 amend 后范围逐图登记四个状态的来源/3.1623/150%/AppliedDPI144/缩放100%/zh-CN/主题与进入步骤，实现侧 node h/run.mjs 复现 | 通过 | D:/pilaude/relay-evidence/PIL-0116/verify/measurements.md(补充节) | 8b5bdcc | claude:sonnet-high:verify |
| A2 | 按 amend 后范围重判：四个状态的盒/墨迹/圆角/色全部在容差内（先前量测表，max ΔE 0.96；07 复制钮高度由墨迹对称推得 24.0、icon-centre.json dx0 dy0） | 通过 | D:/pilaude/relay-evidence/PIL-0116/verify/measurements.md; D:/pilaude/relay-evidence/PIL-0116/verify/icon-centre.json | 8b5bdcc | claude:sonnet-high:verify |
| A3 | 浏览器合成事件层 node h/keys.mjs（light/dark×DPR1/1.5/2×宽900/320）：Tab、Enter/Space 各1次、disabled/loading 不触发、loading 可聚焦、长标签省略无溢出；原生层转 PIL-0198 | 通过 | D:/pilaude/relay-evidence/PIL-0116/verify/keys-result.json | 8b5bdcc | claude:sonnet-high:verify |
| A4 | 夹具层：四状态逐项参考/实现/差值见量测表；文本钮(Skip/Submit/管理)与图标钮(复制钮)均量测；primary 改黑依据=00/06 原生 Submit (11,11,11)，ΔE 51.4→0 | 通过 | D:/pilaude/relay-evidence/PIL-0116/verify/measurements.md | 8b5bdcc | claude:sonnet-high:verify |

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
- 2026-10-21T13:08Z · claude:opus-medium:planner · 范围 [vendor/open-claude-ui/CdsButton.tsx, vendor/open-claude-ui/CdsButton.test.mjs] → [vendor/open-claude-ui/CdsButton.tsx, vendor/open-claude-ui/CdsButton.test.mjs, package.json, scripts/release-workflows.test.mjs]：卡定测试路径 vendor/open-claude-ui/CdsButton.test.mjs 不在 npm test glob 内，需把 vendor/**/*.test.mjs 纳入 npm test 与覆盖检查
- 2026-10-21T13:08Z · claude:sonnet-high:impl · verify → in_progress：补 npm test glob 覆盖 vendor 测试
- 2026-10-22T02:36Z · claude:sonnet-high:impl · 复述：补 npm test glob 与覆盖正则，并用新原生参考 main-window-native 补量 C02 的 sm/深色/图标钮悬停
- 2026-10-22T02:36Z · claude:sonnet-high:impl · 做了：合并 fusion 后 package.json npm test glob 加 vendor/**/*.test.mjs、release-workflows.test.mjs 覆盖正则加 vendor（仅放宽覆盖）；新参考量测后改值：sm 圆角 8→6、字号 12→14（设置页「管理」深色 72×42 raw 完全一致，填充 ΔE 0.96，文字色 #f0efec ΔE 1.98→0）；深色图标钮悬停填充 .08→.074、图标色→#f0efec（代码块复制钮 ΔE 0）；浅色图标填充改 alpha .05；文字上提改为仅 xs（sm 不上提，墨迹 11/10 raw 一致）；改前改后表在 relay-evidence/PIL-0116/impl/measurements.md 末节。 / 状态：提交 37604b5（glob）、8b5bdcc（量测改值）；npm test 12 失败=基线，新增 0；CdsButton 等定向 40/40、tsc、lint、guard、ui-menu-consistency 通过。 / 下一步：交验证。 / 风险：sm hover/pressed/focus、浅色 sm、md/lg/xxs、深色 primary 仍无参考；secondary 悬停色、primary 悬停(#2c2c2a 推定)待确认；未量工具栏/侧栏行等非 C02 组件。
- 2026-10-22T02:36Z · claude:sonnet-high:impl · in_progress → verify
- 2026-10-22T02:46Z · claude:sonnet-high:verify · 证据 A1：未运行
- 2026-10-22T02:46Z · claude:sonnet-high:verify · 证据 A2：通过
- 2026-10-22T02:46Z · claude:sonnet-high:verify · 证据 A2：未运行
- 2026-10-22T02:46Z · claude:sonnet-high:verify · 证据 A3：通过
- 2026-10-22T02:46Z · claude:sonnet-high:verify · 证据 A3：未运行
- 2026-10-22T02:46Z · claude:sonnet-high:verify · 证据 A4：未运行
- 2026-10-22T02:46Z · claude:sonnet-high:verify · 证据 A5：通过
- 2026-10-22T02:46Z · claude:sonnet-high:verify · 做了：独立重量测并跑 A5 全部命令。状态：8b5bdcc；A2/A3 已测子集与 A5 通过，A1/A4 及其余状态因无 3.1623 原生参考记未运行。下一步：补采参考后再验，保持 verify。风险：primary 变黑与 sm 字号 12→14 影响 PilaudeDataSection，sm primary 无原生参考；07 帧悬停归属未确认。证据 D:/pilaude/relay-evidence/PIL-0116/verify/
- 2026-10-22T03:20Z · claude:opus-medium:planner · 用户 2026-10-22 决定：UI 卡已量测部分达标即可拆卡合入，缺 3.1623 参考的状态转补采卡。A1/A3/A4 收窄为已有原生参考的状态，其余转 PIL-0198。
- 2026-10-22T02:47Z · user · 修订验收标准 4633dd54c86e → f290638aa589：用户 2026-10-22 决定拆卡：已有原生参考的状态在本卡验收合入，其余转 PIL-0198 补采后另验
- 2026-10-22T02:49Z · claude:sonnet-high:verify · 证据 A1：通过
- 2026-10-22T02:49Z · claude:sonnet-high:verify · 证据 A2：通过
- 2026-10-22T02:49Z · claude:sonnet-high:verify · 证据 A3：通过
- 2026-10-22T02:49Z · claude:sonnet-high:verify · 证据 A4：通过
