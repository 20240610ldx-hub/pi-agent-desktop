---
id: PIL-0168
title: 复刻验收：C54a 版本入口与更新日志
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014]
files_allowed: [components/ChangelogDialog.tsx, components/ChangelogDialog.test.mjs, lib/changelog.ts, lib/changelog.test.mjs, CHANGELOG.md]
files_shared: [components/AppUpdatesSection.tsx, components/desktop/DesktopAppSection.tsx, app/native-theme.css]
acceptance_sha:
waivers: []
---

## 目标

完成 C54a「版本入口与更新日志」（C54 拆分的第一部分；下载/安装/失败/重启见 PIL-0190）的真实产品呈现与逐状态复刻，更新日志不依赖签名材料也不等待安装链路，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C54（本卡为 C54a；下载/安装/失败/重启由 PIL-0190 承接）。
- 参考覆盖：用户 2026-10-21 指定 panyin-bid-intel 项目的更新日志为结构/样式参照（索引 R26：源 CSS 在同视口下的计算值，不是 Claude 截图，不涉及 3.1623 截图换算）；Windows 安装/升级的 OS 状态由 PIL-0190 处理，不用更新日志样式证明安装能力。
- 实现记录：AppUpdatesSection 现有版本显示；尚无更新日志入口与对话框。这不是当前运行通过证明。
- 历史证据位置：H00。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：更新日志条目源 CHANGELOG.md 尚不存在；入口按钮、对话框、动效与窄屏尚未复刻。安装/升级/失败/重启与签名材料归 PIL-0190。
- 相关卡：PIL-0190（C54b 下载/安装/失败/重启，依赖 0003/0110/0112）；相关卡只处理其原定功能／残差，不抵本组件完整复刻验收。
- 拟新增（当前分支不存在）：`components/ChangelogDialog.tsx`、`components/ChangelogDialog.test.mjs`、`lib/changelog.ts`、`lib/changelog.test.mjs`、`CHANGELOG.md`。列名用于明确草案范围，不表示已有consumer。
- 指定参考（只读）：panyin-bid-intel 的 src/bid_intel/web/templates/base.html（changelog-toggle/changelog-dialog）、src/bid_intel/web/static/style.css 的 changelog 规则、CHANGELOG.md 及 tests/test_changelog.py；仅复用结构/样式/分组与转义机制，内容使用 Pilaude 自己的版本记录。

- Pilaude 当前没有根 CHANGELOG.md；本卡范围明确新增该条目源，使用本产品版本记录。参考库路径仅用 panyin-bid-intel 相对名，既有历史日志原样保留。

## 验收标准

- [ ] A1 建立 版本入口、更新日志对话框的关闭/打开、空状态、长条目、焦点进入与恢复、缺失或格式错误的条目源。逐项登记来源（panyin-bid-intel 源文件与行为测试）、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言及功能开关，按上述状态逐条给可复现进入步骤；不用 actual/演示数据代参考，也不用日志样式证明安装能力。
- [ ] A2 参考值来自 panyin-bid-intel 的源 CSS（base.html 的 changelog-toggle/changelog-dialog 结构与 style.css 的 changelog 规则）在同一视口、同一 DPR 下渲染后的 getComputedStyle/getBoundingClientRect 计算值，不是 Claude 截图；验证者在同视口（至少 1280×800 与 390×844）分别记录源与实现的实测值，给出差值与残差。同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色按 Pilaude 主题令牌实现，改为核对令牌映射表，与源同色的项才比较 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，同一像素采样区取中位色）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。manifest 中的 Claude 参考批次不适用于本卡；量测表与差异图存 relay-evidence/PIL-0168/；取不到源渲染值的项记未运行。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。
- [ ] A3 Tab 到版本/日志入口，对话框内焦点循环，Escape/关闭按钮后焦点恢复到入口、背景锁滚；长日志在对话框内独立滚动；窄窗/三档 DPI/缩放/双主题与 reduced-motion 核验；保留可见的 focus-visible 样式（不复制参考中移除 focus-visible 的规则）。更新日志只读，IME/编辑 Home/End 不适用。原生与浏览器合成事件分层记录，缺少同态参考的视觉项记未运行。
- [ ] A4 按用户 2026-10-21 决定复刻 panyin-bid-intel 的更新日志：入口按钮与对话框结构取自 base.html 的 changelog-toggle/changelog-dialog，样式取自 style.css 的 changelog 规则，条目来源机制取自 CHANGELOG.md，分组顺序、空分类省略与内联 code 安全转义的行为参照 tests/test_changelog.py；只复用结构与样式机制，改用 Pilaude 主题令牌与 Pilaude 自己的版本内容，不复制参考项目业务文案或无关代码。几何与动效按源 CSS 逐项核对，验证者记录源值与实现值，不能仅以相似机制判通过：常规对话框宽 min(624px, calc(100vw - 32px), 50.5dvh)、宽高比 13/18、圆角 14px；窄屏宽 min(calc(100vw - 12px), 50.5dvh)；标题、日期与版本、类别、内联 code 的层级与字号按源表逐项映射，内容区独立滚动；进入动画 180ms，prefers-reduced-motion 下禁用；保留 focus-visible。Pilaude 当前没有根 CHANGELOG.md，本卡新增该文件作为条目源，条目为本产品真实版本记录；条目源缺失或格式错误时显示空状态而不是崩溃。实际验证打开/关闭/焦点恢复、空/长内容、深浅色、reduced-motion 与窄屏。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/ChangelogDialog.test.mjs lib/changelog.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0168`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。ChangelogDialog 承接更新日志；AppUpdatesSection 只允许追加版本入口的挂载（其主体由 PIL-0190 承接），不改下载/安装/重启逻辑；DesktopAppSection 仅挂载入口，不改托盘设置。panyin-bid-intel 的本机路径由协调者在领取时口头提供，不写入卡片。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C54a 版本入口与更新日志 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

重复文件主卡：`components/desktop/DesktopAppSection.tsx` → PIL-0166。files_shared 中这些壳层只允许引入/导出、注册、props/回调或挂载的少量追加，实质改动留在上述子组件；大改需求须先由规划者修订范围。共享的既有定向测试只运行、不改写，新增用例放本卡独占测试，不删减原断言。

拟新增（当前分支不存在，不表示已有 consumer）：`components/ChangelogDialog.tsx`、`components/ChangelogDialog.test.mjs`、`lib/changelog.ts`、`lib/changelog.test.mjs`、`CHANGELOG.md`。接线完成后必须验证真实 consumer，不能保留假功能占位。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C54补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。
- 2026-10-21T07:13Z · claude:opus-medium:coord · 用户 2026-10-21 决定：版本与更新的更新日志样式复刻本机项目 panyin-bid-intel（仅以相对名引用）的实现——入口按钮与对话框 src/bid_intel/web/templates/base.html（changelog-toggle、changelog-dialog，约第 71–94 行）、样式 src/bid_intel/web/static/style.css 中 changelog 相关规则、条目来源 CHANGELOG.md、行为测试 tests/test_changelog.py。只复用结构与样式机制，按 Pilaude 主题令牌改写，不复制无关代码；冻结前由规划者据此改写 A4。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P2：首发必需，当前无其他卡依赖，不占 P1。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字；日志中的本机绝对路径改为相对名 panyin-bid-intel；拆卡：本卡改为 C54a 版本入口与更新日志，依赖只留 PIL-0014（不再依赖 0003/0110/0112）；下载/安装/重启拆为 PIL-0190；G3 几何表（624px/13:18/14px/窄屏宽/180ms/reduced-motion/focus-visible）移入 A4；A2 参考值来自 panyin 源 CSS 计算值而非 Claude 截图
