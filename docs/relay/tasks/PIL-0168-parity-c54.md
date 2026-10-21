---
id: PIL-0168
title: 复刻验收：C54 安装、更新与版本提示界面
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014, PIL-0003, PIL-0110, PIL-0112]
files_allowed: [components/AppUpdatesSection.tsx, components/UpdateReminder.tsx, components/AppUpdatesSection.test.mjs, components/ChangelogDialog.tsx, components/ChangelogDialog.test.mjs, lib/changelog.ts, lib/changelog.test.mjs, CHANGELOG.md]
files_shared: [components/desktop/DesktopAppSection.tsx, app/native-theme.css]
acceptance_sha:
waivers: []
---

## 目标

完成 C54「安装、更新与版本提示界面」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡；本卡由 PIL-0014 建立，标准未冻结，须规划者复核后再领取实现。

## 背景与现状

- 索引：分支 task/PIL-0014-parity-index 的 docs/relay/parity-index.md，组件 C54。合入后使用[索引](../parity-index.md#组件清单)。
- 参考覆盖：用户 2026-10-21 指定 panyin-bid-intel 项目的更新日志为本卡更新日志结构/样式参照；Windows 安装/升级的 OS 状态仍缺，不用更新日志样式证明安装能力。
- 实现记录：AppUpdatesSection／DesktopAppSection；保持更新busy不可关闭。这不是当前运行通过证明。
- 历史证据位置：H00。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：安装／升级／失败／重新启动真实产物和系统参考缺；签名材料由独立任务决定。
- 相关卡：PIL-0003、PIL-0110、PIL-0112；相关卡只处理其原定功能／残差，不抵本组件完整复刻验收。
- 拟新增（当前分支不存在）：`components/AppUpdatesSection.test.mjs`。列名用于明确草案范围，不表示已有consumer。
- 指定参考（只读）：panyin-bid-intel 的 src/bid_intel/web/templates/base.html（changelog-toggle/changelog-dialog）、src/bid_intel/web/static/style.css 的 changelog 规则、CHANGELOG.md 及 tests/test_changelog.py；仅复用结构/样式/分组与转义机制，内容使用 Pilaude 自己的版本记录。

- Pilaude 当前没有根 CHANGELOG.md；本卡范围明确新增该条目源，使用本产品版本记录。参考库路径仅用 panyin-bid-intel 相对名，既有历史日志原样保留。

## 验收标准

- [ ] A1 建立 版本入口/更新日志关闭打开/空/长条目、下载/安装中/失败/重启、busy 保护与无签名开发构建提示。 逐图登记来源/版本关联、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体及功能开关，按上述状态逐条给可复现进入步骤；缺图或版本不明记待参考，不用 actual/演示数据代参考或真实 Pi consumer。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（同一色彩空间/算法并记录方法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考图若为缩放过的聊天附件，须先按 manifest 换算到原始 CSS px 再比较；附件缩放/应用缩放未知时不可仅按图宽或嵌入 DPI 反推，无法可比记未运行。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。
- [ ] A3 Tab 到版本/日志入口，dialog 内焦点循环，Escape/关闭恢复入口、背景锁滚；长日志内部滚动，更新安装 busy 不得关闭，失败保重试入口。窄窗/三档 DPI/缩放/双主题与 reduced-motion 核验。更新日志只读，IME/编辑 Home/End 不适用，不用模拟进度证明安装。 原生与浏览器合成事件分层记录，缺少同态参考的视觉项记未运行。
- [ ] A4 按用户 2026-10-21 决定复刻 panyin-bid-intel 的更新日志：以 base.html 的 changelog-toggle/changelog-dialog 为入口/对话框结构，以 style.css 的 changelog 规则为标题/日期版本/分类条目/滚动/遮罩/窄屏/动效机制，CHANGELOG.md 为条目来源机制，tests/test_changelog.py 为分组顺序、空分类省略与内联 code 安全转义的行为参照。只复用结构与样式机制并改用 Pilaude 主题令牌和 Pilaude 版本内容，不复制参考项目业务文案/无关代码。实际验证打开/关闭/焦点恢复、空/长内容、深浅色/reduced-motion；版本/下载/安装失败/重启及 busy 保护仍依 A1/A3/A5 和 E11 真实产物验，不用模拟进度冒充。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/AppUpdatesSection.test.mjs components/ChangelogDialog.test.mjs lib/changelog.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0168`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。AppUpdatesSection/UpdateReminder 承接更新及更新日志；DesktopAppSection 仅挂载入口，不改托盘设置。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C54 安装、更新与版本提示界面 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

重复文件主卡：`components/desktop/DesktopAppSection.tsx` → PIL-0166。files_shared 中这些壳层只允许引入/导出、注册、props/回调或挂载的少量追加，实质改动留在上述子组件；大改需求须先由规划者修订范围。共享的既有定向测试只运行、不改写，新增用例放本卡独占测试，不删减原断言。

拟新增（当前分支不存在，不表示已有 consumer）：`components/AppUpdatesSection.test.mjs`、`components/ChangelogDialog.tsx`、`components/ChangelogDialog.test.mjs`、`lib/changelog.ts`、`lib/changelog.test.mjs`。接线完成后必须验证真实 consumer，不能保留假功能占位。

本轮保持 todo、acceptance_sha 为空；不 freeze，不记录实现或通过证据。原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

更新日志必须包含实际核对的参考几何：常规 dialog 宽 min(624px, calc(100vw - 32px), 50.5dvh)、宽高比 13/18、圆角 14px，窄屏宽 min(calc(100vw - 12px), 50.5dvh)；标题/日期版本/类别/内联 code 的层级与独立内容滚动按参考源表逐项映射。180ms 进入动画和 reduced-motion 禁用采用参考机制；颜色使用 Pilaude 令牌。焦点可见性按项目要求保留，不复制参考中移除 focus-visible 的规则。由独立验证者记录源 CSS 值与实现值，不能仅以“相似机制”判通过。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C54补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。
- 2026-10-21T07:13Z · claude:opus-medium:coord · 用户 2026-10-21 决定：版本与更新的更新日志样式复刻本机项目 D:/磐隐商机情报系统/panyin-bid-intel 的实现——入口按钮与对话框 src/bid_intel/web/templates/base.html（changelog-toggle、changelog-dialog，约第 71–94 行）、样式 src/bid_intel/web/static/style.css 中 changelog 相关规则、条目来源 CHANGELOG.md、行为测试 tests/test_changelog.py。只复用结构与样式机制，按 Pilaude 主题令牌改写，不复制无关代码；冻结前由规划者据此改写 A4。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P2：首发必需，当前无其他卡依赖，不占 P1。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。

