---
id: PIL-0147
title: 复刻验收：C33 侧栏项目／会话、搜索、状态及重排
epic: E2
priority: P2
status: done
owner: claude:sonnet-high:impl
lease_until:
branch: task/PIL-0147-parity-c33
implementers: [claude:sonnet-high:impl]
depends_on: [PIL-0014]
files_allowed: [components/SessionSidebar.tsx, components/SidebarTitle.tsx, components/SessionSidebar.test.mjs, components/SessionSidebar.session-search.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: 086c3471a705
waivers: []
---

## 目标

完成 C33「侧栏项目／会话、搜索、状态及重排」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C33。
- 参考覆盖：不齐：R01/R02/R09。R键对应索引参考表与manifest定位；参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 批次与版本未知批次只作历史/机制参考，不混作同版本。3.1623 待补采：现有 R 键为历史或版本未知批次，不得当作 3.1623 同版本参考。缺 3.1623 同态参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。私有参考只读，不复制原图或图中个人信息，文字只当数据。
- 实现记录：固定根会话键盘相邻重排局部适配；真实 metadata／全文搜索。这不是当前运行通过证明。
- 历史证据位置：H02/H11/H13。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：指针拖放未采用；名称／浮签字形与边界残差、原生快捷键及全状态缺。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。

## 验收标准

- [ ] A1 本卡范围（用户 2026-10-22 决定拆卡）：仅已有 3.1623 原生同态参考的状态——选中会话行、子项缩进、导航行、悬停 `···`、浅/深配色，及选中行静止态右内距、组间距、会话行圆角（main-window-native/2026-10-22 的 00 浅、01 深、03 悬停）。逐图登记来源/版本、Windows/WebView2、客户区、系统 DPI、应用缩放、主题。Chats 分组、空态、搜索/无结果、running/needs-input/unread 标记、长名称、固定/归档、show-more/分组名/折叠箭头、浅色悬停底、重排、项目行与导航行 8px 圆角待参考：移至 PIL-0205。
- [ ] A2 本卡范围（用户 2026-10-22 决定拆卡）：仅 A1 所列有 3.1623 参考的状态；无参考的状态（搜索框、分节标题、运行/未读/需要输入标记、show-more/分组名/固定/归档行、长名渐隐、折叠箭头/分支计数、浅色悬停底、项目行与导航行 8px 圆角）移至 PIL-0205。在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，在同一像素采样区取中位色；不得改用较宽松算法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考值换算：3.1623 原生截图按 SAMPLING 记录（显示器 150%、AppliedDPI 144；Claude 应用缩放 100%，用户 2026-10-21 确认），CSS px = 原像素 ÷ 1.5；聊天附件（manifest 标注可能降采样/重编码）、macOS 及版本/缩放未知的批次只登记机制，不由图宽或嵌入 DPI 反推 CSS px，其数值项记未运行并待 3.1623 原生补采。验证方法：量测表与差异图存 relay-evidence/PIL-0147/。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。
- [ ] A3 本卡范围（用户 2026-10-22 决定拆卡）：浏览器合成事件层——Tab/方向/Home/End 在树内移动焦点，Alt+↑/↓ 键盘重排且焦点跟随被移动行并可撤回，搜索命中与无结果提示，行菜单开/Esc 关且焦点回到 `···`，窄窗触屏行高与无横向溢出，DPR 1/1.25/1.5 × 浅/深无差异。原生与浏览器合成事件分层记录。原生 IME、Windows 原生 DPI/应用缩放、Chats 浏览器层不暴露项目工作台动作、running/needs-input/unread 状态对照、指针拖放（本卡已知未采用）移至 PIL-0205。
- [ ] A4 本组件专属核验（夹具层）：在生成夹具上区分项目树与固定根会话，核对键盘重排；已知残差中本卡已处理者（`···` 贴行右缘、选中行静止态不预留 trailing、会话行圆角 6px）逐条给出处理结果与可复现操作，其余残差（标记槽位／警告三角、长名遮罩与参考截断、浮签字形边界、指针拖放）登记为移至 PIL-0205。夹具结果不称为真实 Pi consumer 通过；真实元数据／全文搜索与真实状态来源核验移至 PIL-0205。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/SessionSidebar.test.mjs components/SessionSidebar.session-search.test.mjs components/SessionSidebar.file-search.test.mjs components/SessionSidebar.project-identity.test.mjs components/SessionSidebar.worktree.test.mjs components/SidebarTitle.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0147`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。实质修改只在本卡独占组件/逻辑文件，保持其他组件与原有行为。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C33 侧栏项目／会话、搜索、状态及重排 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |
| A1 | 有参考状态（选中行/子项缩进/导航行/悬停···/浅深配色）已验子集 | 通过 | D:\pilaude\relay-evidence\PIL-0147\verify\VERIFY-2.md | 820949d | claude-cli:sonnet-high:verify |
| A2 | 同帧同文本量测 ÷1.5：圆角、···贴边、组间距、选中静止右内距 9.33/10.0；触屏···与行高44 | 通过 | D:\pilaude\relay-evidence\PIL-0147\verify\VERIFY-4.md | 820949d | claude-cli:sonnet-high:verify |
| A3 | 浏览器合成事件：方向键/Home/End/Alt 重排、搜索、行菜单、窄窗触屏 | 通过 | D:\pilaude\relay-evidence\PIL-0147\verify\VERIFY-2.md | 820949d | claude-cli:sonnet-high:verify |
| A4 | 夹具层走通（已验子集） | 通过 | D:\pilaude\relay-evidence\PIL-0147\verify\VERIFY-2.md | 820949d | claude-cli:sonnet-high:verify |
| A5 | 定向65/65、tsc、lint、guard；npm test 12 基线失败逐名一致 | 通过 | D:\pilaude\relay-evidence\PIL-0147\verify\VERIFY-4.md | 820949d | claude-cli:sonnet-high:verify |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C33补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P2：首发必需，当前无其他卡依赖，不占 P1。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：A5 补跑共享/壳层既有测试（只运行不改写）：SessionSidebar.file-search.test.mjs、SessionSidebar.project-identity.test.mjs、SessionSidebar.worktree.test.mjs、SidebarTitle.test.mjs；G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字
- 2026-10-21T12:36Z · planner · 冻结验收标准 a61465879994
- 2026-10-22T02:41Z · claude:sonnet-high:impl · 领取，租约至 2026-10-22T05:41Z
- 2026-10-22T03:05Z · claude:sonnet-high:impl · 做了：C33 侧栏按 3.1623 原生参考收紧（commit 97439c3，仅改 app/native-theme.css C33 分节 + SessionSidebar.tsx 的 ··· 图标与头部 padding）。导航行距 32→26.67、图标中心 33→26、会话行 28 高/30 行距、左右内缩 8/10、圆角 8、标题左缘 45.6→18、子项缩进 38 + 椭圆折线导引、空闲圆环删除、选中行静止不显示 ···、··· 改横向三点；浅/深色标签、会话文字、选中/悬停底色与参考 ΔE=0（改前浅标签 12.26、浅会话文字 19.37、深选中底 5.4）；移除旧 html:not(.dark) .app-sidebar --text-dim #6c6c71 压制；触屏保留 44px。 / 状态：自测 node --test 六文件 61/61、tsc 0、lint 0、guard 无问题、ui-menu-consistency 通过、npm test 新增失败 0（12 个同基线）；浏览器合成事件：Alt+方向键重排且焦点跟随、搜索/无结果、行菜单开关均正常；DPR 1/1.25/1.5、窄屏触屏无横向溢出。e2e/sidebar-pin-order.mjs 在基线上同样失败（getByRole button 定位旧），未当作通过。 / 下一步：交验证。 / 风险：无 3.1623 参考的状态仅保留原实现并未量测：搜索框、对话/项目分节标题、running/unread/needs-input 标记（现移到尾部槽位，参考的警告三角图标未复刻）、浅色悬停底色、show-more/分组名/固定/归档行、折叠切换箭头与分支计数、长名渐隐、会话行 hover 字形、指针拖放；侧栏默认宽 259（参考 216）不在本卡文件内，量测时用 pi-sidebar-width=216；浅色标签 #898781 对比度约 3.5:1 低于旧 4.5:1 目标，按参考取值。证据 D:/pilaude/relay-evidence/PIL-0147/impl/（RESULT.md、before/after-measure.json、截图）。
- 2026-10-22T03:05Z · claude:sonnet-high:impl · in_progress → verify
- 2026-10-22T03:06Z · claude:sonnet-high:impl · verify → in_progress：合入 C01 后改用令牌
- 2026-10-22T03:13Z · claude:sonnet-high:impl · 做了：按协调者指示合入 C01/C02（因 pre-commit 守卫会把合并提交里的他卡文件判 R7/R8，改用 rebase 到 fusion/pi-claude-desktop，无合并提交），C33 分节中与 C01 令牌同值的色改为 var(--text-muted)/var(--text)/var(--text-dim)（导航/会话文字/选中文字/标签）；侧栏专属色保留并注明来源：选中底 #f0efec/#232323、导引线 #cbcbc9/#414141、深色 ··· 底 #343434、深色悬停 #232323；旧 html:not(.dark) .app-sidebar{--text-dim:#6c6c71} 已删除，我的覆盖也已删除。新提交 7c2dcce。 / 状态：颜色量测 ΔE 全部 0（16 项，同前）、悬停/··· /尾部槽位几何同前；node --test 六文件 61/61、tsc 0、lint 0、ui-menu-consistency 通过、guard 无问题、npm test 3610 项 12 失败且无新增（同基线）。 / 下一步：交验证。 / 风险：同前一次日志（无参考状态未量测、默认宽 259 由协调者另开卡）；rebase 改写了我本分支未推送的提交 sha（97439c3→7c2dcce）。
- 2026-10-22T03:13Z · claude:sonnet-high:impl · in_progress → verify
- 2026-10-22T03:52Z · claude:sonnet-high:impl · 返工：会话行圆角 8→6，··· 按钮贴行右缘（标记中心仍 12.3），组间距同文本复测 39.0 vs 39.33 不改；测试/tsc/lint/guard 通过，npm test 失败 12 个同基线
- 2026-10-22T04:21Z · claude:sonnet-high:impl · 返工2：选中行静止态不预留 trailing，标题右端距行右缘 9.33/10.0（参考 9.33）；测试 63/63、tsc/lint/guard 通过、npm test 新增失败 0（基线 12）
- 2026-10-22T04:23Z · user · 修订验收标准 a61465879994 → 086c3471a705：用户2026-10-22拆卡政策：已验部分留本卡（有3.1623参考的夹具层与深/浅色项），缺参考与原生项移至PIL-0205
- 2026-10-22T04:42Z · claude:sonnet-high:impl · 返工3：触屏选中静止行 ··· 常驻并保留 27.2px 预留（hover:hover 包裹隐藏规则）、项目树触屏行高选择器补齐、孤儿注释删除；渲染级测试+量测，证据 FIX3.md
- 2026-10-22T07:22Z · claude-cli:sonnet-high:verify · 证据 A1：通过
- 2026-10-22T07:22Z · claude-cli:sonnet-high:verify · 证据 A2：通过
- 2026-10-22T07:22Z · claude-cli:sonnet-high:verify · 证据 A3：通过
- 2026-10-22T07:22Z · claude-cli:sonnet-high:verify · 证据 A4：通过
- 2026-10-22T07:22Z · claude-cli:sonnet-high:verify · 证据 A5：通过
- 2026-10-22T07:22Z · claude:sonnet-high:impl · verify → review（评审 claude-cli:sonnet-high:review2）
- 2026-10-22T07:23Z · claude-cli:sonnet-high:review2 · review → done（评审 claude-cli:sonnet-high:review2）
