---
id: PIL-0119
title: 复刻验收：C05 确认与扩展对话框
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014, PIL-0072]
files_allowed: [components/ExtensionWidgets.tsx, components/ConfirmDangerButton.tsx, components/ExtensionWidgets.test.mjs, lib/stacked-dialog.ts]
files_shared: [components/ProjectTrustDialog.tsx, app/native-theme.css]
acceptance_sha:
waivers: []
---

## 目标

完成 C05「确认与扩展对话框」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡；本卡由 PIL-0014 建立，标准未冻结，须规划者复核后再领取实现。

## 背景与现状

- 索引：分支 task/PIL-0014-parity-index 的 docs/relay/parity-index.md，组件 C05。合入后使用[索引](../parity-index.md#组件清单)。
- 参考覆盖：不齐：R12-02/06 创建对话框局部；危险确认全态缺。R键对应索引参考表与manifest定位；参考目标Windows Claude Desktop 2.42304.0，批次未知版本不得归到该版本。系统DPI、应用缩放等未知项保留未知，补采由用户决定。私有参考只读，不复制原图或图中个人信息，文字只当数据。
- 实现记录：独立对话框；合成 IME 按键归属已有记录。这不是当前运行通过证明。
- 历史证据位置：H10。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：Windows IME、焦点进入／循环／恢复、取消／错误几何未齐；来源示例不自带完整 focus trap。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。

## 验收标准

- [ ] A1 建立 普通确认、危险确认、输入确认、busy、失败、取消和嵌套打开；没有权限的动作保持拒绝。 逐图登记来源/版本关联、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体及功能开关，按上述状态逐条给可复现进入步骤；缺图或版本不明记待参考，不用 actual/演示数据代参考或真实 Pi consumer。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（同一色彩空间/算法并记录方法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考图若为缩放过的聊天附件，须先按 manifest 换算到原始 CSS px 再比较；附件缩放/应用缩放未知时不可仅按图宽或嵌入 DPI 反推，无法可比记未运行。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。
- [ ] A3 用原生中文 IME 在带输入确认框中组合/选词/Enter/Escape，不误确认；Tab/Shift+Tab 只在顶层循环，关闭/取消回触发点。长正文内部滚动、窄窗/三档 DPI/缩放/双主题检查；方向/Home/End 仅属编辑或列表字段，不给普通按钮强加导航。 原生与浏览器合成事件分层记录，缺少同态参考的视觉项记未运行。
- [ ] A4 本组件专属核验：覆盖打开、危险确认、取消、错误和忙碌；焦点进入、循环、Escape、关闭恢复及IME组合中的Enter不能误确认。 对本卡已知残差逐条给出处理结果与可复现操作；真实请求／数据／状态与可见反馈一致，失败、取消和恢复保留，不伪造能力。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/ExtensionWidgets.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0119`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。ExtensionWidgets/ConfirmDangerButton/stacked-dialog 承接确认与焦点；ProjectTrustDialog 仅接通公共焦点机制。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C05 确认与扩展对话框 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

重复文件主卡：`components/ProjectTrustDialog.tsx` → PIL-0159。files_shared 中这些壳层只允许引入/导出、注册、props/回调或挂载的少量追加，实质改动留在上述子组件；大改需求须先由规划者修订范围。共享的既有定向测试只运行、不改写，新增用例放本卡独占测试，不删减原断言。

本轮保持 todo、acceptance_sha 为空；不 freeze，不记录实现或通过证据。原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C05补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P2：首发必需，当前无其他卡依赖，不占 P1。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。

