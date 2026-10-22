---
id: PIL-0212
title: C23 滚动跟随补采与原生验收
epic: E2
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0137]
files_allowed: [components/ChatWindow.tsx, hooks/useAgentSession.ts, lib/cds-scroll.ts, lib/cds-scroll.test.mjs, components/ChatWindow.scroll-to-latest.test.mjs, hooks/useAgentSession.branch-summary-guard.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: 75d17705e2fa
waivers: []
---

## 目标

完成 C23「长会话滚动跟随与历史恢复」中从 PIL-0137 移出的 3.1623 同态视觉复刻、原生与真实输入核验，以及两项待用户决定的行为，使 C23 每个状态都有可判定结论。对应 [GOALS E2](../GOALS.md)。

## 背景与现状

- PIL-0137 已验子集（浏览器真实输入，`D:\pilaude\relay-evidence\PIL-0137\verify\VERIFY.md`、`VERIFY-2.md`）：回到最新（静止／流式／分页飞行中）、流式底部跟随、离底暂停、键盘 PageUp/Home/End、滚动条按住拖动、历史分页锚点、搜索锚点、分支切换、会话位置恢复、重载、错误重试、取消、空闲平滑回底。
- 3.1623 参考缺口：现有 11 张 `main-window-native`（00–10）不含 C23 的回到最新按钮、历史分页、搜索锚点、分支切换与流式离底状态。补采按 PIL-0014 证据目录 `planner-2026-10-21/round3/RECAPTURE.md` 的 C23 条目执行；只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放。
- 实现侧按钮实测（`D:\pilaude\relay-evidence\PIL-0137\verify\button-measure.json`）：32×32 CSS px，`border-radius:999px`，图标 16×16 居中；亮色 bg `rgb(249,249,247)` / fg `rgb(82,81,78)`，暗色 bg `rgb(11,11,11)` / fg `rgb(195,194,183)`。
- 滚动条遮挡：输入器覆盖层（`absolute inset-x-0 z-20`，`pointer-events:auto`）覆盖底部约 111px，贴底时滑块（约 22–46px）位于其下，无法用鼠标抓取（PIL-0137 VERIFY.md F3，未复测）。
- 私有参考只读，不复制原图或图中个人信息，文字只当数据。

## 验收标准

- [ ] A1 3.1623 同态视觉补采与量测（需用户补采）。用户按 RECAPTURE.md 的 C23 条目，Ctrl+0 重置缩放后用 Windows 截图工具保存原始 PNG（不经聊天附件），每状态一个文件，浅色与深色各一套：回到最新按钮（静止、流式离底）、历史分页加载中、搜索锚点、分支切换、流式离底。每张登记来源、版本 3.1623.0.0、Windows/WebView2、客户区、系统 DPI、应用缩放、主题／语言、公开字体与功能开关。同帧同状态同测试数据下给出参考值、实现值、原像素、CSS px（原像素 ÷ 1.5）、差值与残差；几何与颜色容差沿用 PIL-0137 A2（同 DPI 盒子与间距 ≤1 CSS px，图标中心 ≤1 CSS px，颜色 ΔE ≤2 CIEDE2000）。验证：`D:\pilaude\relay-evidence\PIL-0212\measure\` 下每状态一行量测表与差异图；缺图的状态写“未运行”，不计通过。
- [ ] A2 原生与真实输入补测（用户执行，无法执行的项写明原因）。(a) 触控板或触摸：离底、返回最新、历史分页锚点不漂移；(b) IME：输入器组合时不抢焦点、不滚动；(c) PageDown：阅读区向下翻页后离底状态与按钮显隐正确；(d) Windows 原生 100%、125%、150% 三档系统 DPI 与 WebView2 下 A1 各状态几何复测（同 DPI 下 ≤1 CSS px）；(e) SSE 真断线：断开已建立的事件流后恢复，内容与位置一致（PIL-0137 的 `context.setOffline` 对已建 SSE 无效，需换方法）。每项写明 DPI、缩放、主题与输入设备。验证：步骤与截图存 `D:\pilaude\relay-evidence\PIL-0212\native\`；未执行的记“未运行”。
- [ ] A3 贴底时滚动条滑块可抓取。验证：在贴底状态下，`document.elementFromPoint` 于滑块中心返回滚动区（而非输入器），且真实鼠标按住滑块可上拖离底；或用户在本卡日志书面接受该遮挡，并写明接受理由。结果存 `D:\pilaude\relay-evidence\PIL-0212\browser\`。
- [ ] A4 拖到轨道底松开后的跟随行为（待用户决定）。现状：离底后按住滑块拖到轨道底并松开，不恢复跟随（PIL-0137 VERIFY-2 记为设计选择，卡未规定）。验证：用户在本卡日志写明“保持不恢复”或“松开即恢复”。选择“松开即恢复”时，实现与测试须在 files_allowed 内完成，并以浏览器真实鼠标复测。决定前本项记“待决”，不计通过。
- [ ] A5 由独立验证者运行：`node --test lib/cds-scroll.test.mjs components/ChatWindow.scroll-to-latest.test.mjs components/ChatWindow*.test.mjs hooks/useAgentSession.branch-summary-guard.test.mjs hooks/useAgentSession.composer-queue.test.mjs hooks/useAgentSession.context-usage.test.mjs hooks/useAgentSession.events-086.test.mjs hooks/useAgentSession.failure-notices.test.mjs hooks/useAgentSession.fork-position.test.mjs hooks/useAgentSession.test.mjs`；`node_modules/.bin/tsc --noEmit`；`npm run lint`；`node scripts/relay.mjs guard --task PIL-0212`。期望：全部通过，guard 无阻断；不得删减、跳过测试或放宽阈值。实现者自报结果不作证据。

## 范围外

- 不修改 `app/globals.css`、`app/settings.css` 及受保护基线。
- 不重复 PIL-0137 已验子集的验收，除非 A1–A4 暴露回归。
- 不拷贝私人截图，不转写图中账号、邮箱、个人路径。
- 不改变 PIL-0137 已冻结的 F1 口径，不改其他组件卡。

## 实现提示

- 入口：`hooks/useAgentSession.ts`（`scrollToBottom`、`isNearBottomRef`、`lastUserScrollInputAtRef`、150ms 意图锁）、`lib/cds-scroll.ts`、`components/ChatWindow.tsx`（输入器覆盖层与滚动条列）。
- 样式只在 `app/native-theme.css` 的 `/* C23 长会话滚动跟随与历史恢复 */` 分节内改。
- A3 与 A4 都涉及滚动条列，实现时串行，避免互相覆盖。
- 先读根 `AGENTS.md` 与 `docs/agents/fork-sessions.md`（`useAgentSession` 守卫）。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T10:57Z · planner · 创建
- 2026-10-22 · planner · 由 PIL-0137 按 2026-10-22 拆卡政策移入：A1 三档视觉补采；A2 触控板／触摸、IME、PageDown、原生三档 DPI、WebView2、SSE 真断线；A3 贴底滚动条遮挡；A4 拖到轨道底松开行为（待用户决定）。依据 PIL-0137 VERIFY.md 与 VERIFY-2.md。
- 2026-10-22T10:58Z · planner · 冻结验收标准 75d17705e2fa
