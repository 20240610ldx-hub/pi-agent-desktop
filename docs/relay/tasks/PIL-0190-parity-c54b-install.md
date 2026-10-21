---
id: PIL-0190
title: 复刻验收：C54b 下载、安装、失败与重启界面
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014, PIL-0003, PIL-0110, PIL-0112]
files_allowed: [components/AppUpdatesSection.tsx, components/UpdateReminder.tsx, components/AppUpdatesSection.test.mjs]
files_shared: [components/desktop/DesktopAppSection.tsx, app/native-theme.css]
acceptance_sha: 619ce281fdbb
waivers: []
---

## 目标

完成 C54b「下载、安装、失败与重启界面」（C54 拆分的第二部分；更新日志与版本入口见 PIL-0168）的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C54（本卡为 C54b；更新日志部分由 PIL-0168 承接）。
- 参考覆盖：没有 Windows 安装/升级/失败/重启的 Claude 参考（3.1623 待补采；系统级安装界面也不是 DOM）；更新日志样式参照与本卡无关。Windows 安装/升级的 OS 状态仍缺，缺 3.1623 同态原生参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。
- 实现记录：AppUpdatesSection／DesktopAppSection；保持更新busy不可关闭。这不是当前运行通过证明。
- 历史证据位置：H00。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：安装／升级／失败／重新启动真实产物和系统参考缺；签名材料由独立任务决定。
- 相关卡：PIL-0003、PIL-0110、PIL-0112（签名材料，parked）；PIL-0168 承接更新日志与版本入口。相关卡只处理其原定功能／残差，不抵本组件完整复刻验收。
- 拟新增（当前分支不存在）：`components/AppUpdatesSection.test.mjs`。列名用于明确草案范围，不表示已有consumer。

## 验收标准

- [ ] A1 建立 版本显示、检查更新、下载中/进度、下载失败、安装中、安装失败、重新启动提示、busy 保护与无签名开发构建提示。逐图登记来源/版本关联、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体及功能开关，按上述状态逐条给可复现进入步骤；缺图或版本不明记待参考，不用 actual/演示数据代参考或真实 Pi consumer。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，在同一像素采样区取中位色；不得改用较宽松算法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考值换算：3.1623 原生截图按 SAMPLING 记录（显示器 150%、AppliedDPI 144；Claude 应用缩放 100%，用户 2026-10-21 确认），CSS px = 原像素 ÷ 1.5；聊天附件（manifest 标注可能降采样/重编码）、macOS 及版本/缩放未知的批次只登记机制，不由图宽或嵌入 DPI 反推 CSS px，其数值项记未运行并待 3.1623 原生补采。验证方法：量测表与差异图存 relay-evidence/PIL-0190/。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。
- [ ] A3 Tab 到版本/更新入口与更新操作，Escape/关闭恢复入口；更新安装 busy 不得关闭设置，失败保留重试入口；窄窗/三档 DPI/缩放/双主题核验。不用模拟进度证明安装；安装包、签名与重启必须是真实产物（缺签名材料时只验开发构建并列出未达门槛）。原生与浏览器合成事件分层记录，缺少同态参考的视觉项记未运行。
- [ ] A4 本组件专属核验：版本显示、检查更新、下载/安装失败、重新启动提示与 busy 保护；SettingsPanel 的 onBusyChange 守卫保持（安装中不可被关闭）；无签名开发构建不回退上游更新通道（E1）。版本/下载/安装失败/重启依 E11 真实产物验，不用模拟进度冒充；失败、取消和恢复路径保留。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/AppUpdatesSection.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0190`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。AppUpdatesSection/UpdateReminder 承接下载/安装/失败/重启；DesktopAppSection 仅挂载入口，不改托盘设置；更新日志与版本入口归 PIL-0168。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C54b 下载、安装、失败与重启 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

重复文件主卡：`components/desktop/DesktopAppSection.tsx` → PIL-0166。files_shared 中这些壳层只允许引入/导出、注册、props/回调或挂载的少量追加，实质改动留在上述子组件；大改需求须先由规划者修订范围。共享的既有定向测试只运行、不改写，新增用例放本卡独占测试，不删减原断言。

拟新增（当前分支不存在，不表示已有 consumer）：`components/AppUpdatesSection.test.mjs`。接线完成后必须验证真实 consumer，不能保留假功能占位。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T12:21Z · planner · 创建（由 PIL-0168 拆出：下载/安装/失败/重启部分，保留 0003/0110/0112 依赖）
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：新建：C54b 下载/安装/失败/重启（由 PIL-0168 拆出，保留 0003/0110/0112 依赖）
- 2026-10-21T12:39Z · planner · 冻结验收标准 619ce281fdbb
