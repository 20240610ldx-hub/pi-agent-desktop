---
id: PIL-0211
title: C16 工具步骤补采与原生验收
epic: E2
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0130]
files_allowed: [components/CompactCommandText.tsx, components/CodemodeToolView.tsx, components/CompactCommandText.test.mjs, components/ToolStepView.tsx, components/ToolStepView.test.mjs, components/restored-wiring.test.mjs, components/NonChatModels.wiring.test.mjs]
files_shared: [components/MessageView.tsx, app/native-theme.css]
acceptance_sha: 5d1335169db4
waivers: []
---

## 目标

完成 C16「工具步骤、参数结果与紧凑命令」中从 PIL-0130 移出的全部 3.1623 同态参考复刻、原生与视觉核验，使工具步骤的每个状态都有可判定的量测结论。对应 [GOALS E2](../GOALS.md)。

## 背景与现状

- PIL-0130 已验子集：command-only 紧凑盒（06 图覆盖项）、真实接线 `MessageView.tsx → ToolStepView`、浏览器层 Tab/双轴滚动/390px、复制 CRLF/Tab/尾空格（浏览器层）。证据：`D:\pilaude\relay-evidence\PIL-0130\verify\VERIFY.md`、`VERIFY-2.md`。
- 唯一 3.1623 同态参考为 06 图（紧凑命令盒）。其余状态无 3.1623 参考，现按 PIL-0014 证据目录 `planner-2026-10-21/round3/RECAPTURE.md` 的 PIL-0130 条目补采（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。
- 换算与容差沿用 PIL-0130 A2：参考 CSS px = 原像素 ÷ 1.5；颜色 ΔE 用 CIEDE2000（sRGB→CIELAB D65，同一像素采样区取中位色）。聊天附件图只登记机制，不做数值量测。
- 私有参考只读，不复制原图或图中个人信息。

## 验收标准

- [ ] A1 3.1623 同态参考补采与逐状态量测（需用户补采）。用户按 RECAPTURE.md 的 PIL-0130 条目，以 Ctrl+0 重置缩放后用 Windows 截图工具保存原始 PNG（不经聊天附件），每状态一个文件，浅色与深色各一套：错误、运行中、取消、空结果、超长输出、MCP 文本、富视图（参数／结果／图片各类）。每张登记来源、版本 3.1623.0.0、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体与功能开关；同帧同状态同测试数据下给出参考值、实现值、原像素、CSS px、差值与残差。验证：`relay-evidence/PIL-0211/measure/` 下每个状态一行量测表与差异图，缺图的状态写“未运行”且不计通过。
- [ ] A2 卡片与结果底色 ΔE。在真实对话背景（不是测试页背景，PIL-0130 首轮 ΔE00 3.73 受测试页背景干扰）上，同帧同状态取卡片与结果底色的同一像素采样区中位色，CIEDE2000 ΔE ≤2。验证：量测表写明采样区坐标、背景来源与两侧 Lab 值；超过 2 记 FAIL，回到实现修正并重测，不放宽算法。
- [ ] A3 视觉核验（浏览器层，有 3.1623 参考的项才判定）。浅色与深色主题、窄窗（约 800 px 与 390 px）下，紧凑命令盒与结果区与对应参考逐项比对；图标中心对齐 ≤1 CSS px；文字基线 ≤1 CSS px；富视图计算内距（结果 pre 与 ResultImages）在浏览器中重测，与改前 `8px 10px` / gap 8 一致。验证：`getComputedStyle` 输出与截图存 `relay-evidence/PIL-0211/browser/`；无参考的项记“未运行”。
- [ ] A4 Windows 原生核验（用户执行，WebView2）。
  - (a) 100%、125%、150% 三档系统 DPI 下各截一张紧凑命令盒与结果区，几何与 A1 参考一致（同 DPI 下 ≤1 CSS px）。
  - (b) 原生剪贴板：会话执行一条只读命令，其输出含 Tab 与行尾空格；展开工具步骤，点击复制参数与结果，粘贴到记事本，确认 CRLF、Tab、行尾空格均保留。
  - (c) 焦点返回：用 Tab 聚焦某工具步骤，按 Enter 展开后再收起，焦点回到原项。
  - 每项写明 DPI、缩放、主题；未执行的记“未运行”。验证：步骤记录与截图存 `relay-evidence/PIL-0211/native/`。
- [ ] A5 由独立验证者运行：`node --test components/CompactCommandText.test.mjs components/ToolStepView.test.mjs components/MessageView.test.mjs`；`node_modules/.bin/tsc --noEmit`；`npm run lint`；`node scripts/relay.mjs guard --task PIL-0211`。期望：全部通过，guard 无阻断；不得删减、跳过测试或放宽阈值。

## 范围外

- 不修改 `app/globals.css`、`app/settings.css` 及受保护基线。
- 不做 PIL-0130 已验子集的重复验收，除非 A1–A4 量测暴露回归。
- 只为通过 A1–A3 量测做必要的样式修正，修正后须重跑对应量测；不改其他组件的分节。
- 不拷贝私人截图，不转写图中账号、邮箱、个人路径。
- 其余 3.1623 状态（如分组、菜单、其他组件）不在本卡。

## 实现提示

- 入口：`components/ToolStepView.tsx`、`components/CompactCommandText.tsx`、`components/CodemodeToolView.tsx`；样式只在 `app/native-theme.css` 的 `/* C16 工具步骤、参数结果与紧凑命令 */` 分节内改。
- 先读根 `AGENTS.md` 及 `docs/agents/artifacts.md`（富视图渲染）、`docs/agents/fork-ui.md`。
- 用户补采前，实现方可先把 A2 的采样区与背景方案定好，减少补采返工。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T10:42Z · planner · 创建
- 2026-10-22T11:00Z · planner · 由 PIL-0130 拆卡移入：3.1623 同态参考缺失状态、卡片/结果底色 ΔE（真实背景复量）、浅色与双主题、窄窗视觉、原生剪贴板、三档 DPI、展开后焦点返回、图标中心与富视图计算内距的浏览器重测；依据用户 2026-10-22 拆卡政策（已验部分合入，缺图状态转补采卡）。
- 2026-10-22T10:43Z · planner · 冻结验收标准 5d1335169db4
