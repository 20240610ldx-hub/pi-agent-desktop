---
id: PIL-0205
title: C33 侧栏补采与原生验收
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0147]
files_allowed: [components/SessionSidebar.tsx, components/SidebarTitle.tsx, components/SessionSidebar.test.mjs, components/SessionSidebar.session-search.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: d381a6bd7ecf
waivers: []
---

## 目标

PIL-0147 拆出的 C33 侧栏剩余状态，在用户补采 3.1623 原生参考并完成原生步骤后量测、修正与验收。对应 [GOALS](../GOALS.md) E2。

## 背景与现状

用户 2026-10-22 拆卡决定（已验部分合入，缺图状态转补采卡）。依据：relay-evidence/PIL-0147/verify/VERIFY-2.md 的 BLOCKED／未运行项。补采协议见 relay-evidence/PIL-0014/planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放；3.1623 原生 CSS px = 原像素 ÷1.5；私有参考只读，不复制原图或个人信息）。PIL-0147 已合入的部分：选中会话行、子项缩进、导航行、悬停 `···`、浅/深配色、组间距、会话行圆角 6px、选中行静止态右内距。已知残差：运行/未读/需要输入标记现位于尾部槽位，参考的警告三角图标未复刻；长名渐隐为遮罩而参考疑为按字硬截；指针拖放未采用；侧栏默认宽 259（参考 216）不在本卡文件内。

**需要用户补采的 3.1623 截图清单**（浅/深各一，150% DPI，应用缩放 100%）：
1. 侧栏含 Chats 分组（有会话）；2. Chats 空态与项目空态（无会话）；3. 搜索框聚焦与有输入、搜索无结果；4. 会话行 running、needs-input、unread 三种标记（含悬停）；5. 超长会话名/项目名（含悬停时 `···`）；6. 固定、归档分组与对应行；7. show-more 行、分组名行、折叠箭头与分支计数；8. 浅色悬停行；9. 项目行与导航行的非悬停、非选中状态（用于圆角 8px 核对）；10. 拖动重排中的行（若 3.1623 有指针拖放）。
**需要用户做的原生步骤**：Windows 原生桌面中用真实输入法（IME）在搜索框与重命名框输入并上屏；Tab／方向／Home／End 在树与菜单内导航；100%／125%／150% 系统 DPI 与 Claude 应用缩放各一轮。

## 验收标准

- [ ] A1 补采后覆盖：Chats 分组、空态（Chats／项目）、搜索与无结果、running／needs-input／unread 标记、长名称、固定／归档、show-more、分组名、折叠箭头与分支计数、浅色悬停底、重排；项目行与导航行圆角 8px 对照参考。逐图登记来源／版本、Windows／WebView2、客户区、系统 DPI、应用缩放、主题／语言；缺图的状态继续记未运行，不用夹具或演示数据代参考。
- [ ] A2 上述状态在同帧／同状态／同文本下按用户批准容差量测：盒子宽高与间距 ≤1 CSS px、文字基线 ≤1、圆角 ≤0.5、图标中心 ≤1、颜色 CIEDE2000 ΔE ≤2（3.1623 原生 CSS px = 原像素 ÷1.5）；给出参考值、实现值、差值；含 running／needs-input／unread 标记形态与位置（含警告三角图标）、长名遮罩与参考截断的处理结果。量测表与差异图存 relay-evidence/PIL-0205/。
- [ ] A3 Windows 原生桌面层：搜索与重命名的原生 IME；Tab／方向／Home／End 在树与菜单；键盘重排与（若采用）指针拖放及取消后的焦点跟随；长树／搜索列表滚动、固定／归档后位置；窄窗、100%／125%／150% DPI、应用缩放、双主题；Chats 不暴露项目工作台动作（浏览器层须有含 Chats 会话的夹具覆盖，原生层核对）。原生与浏览器合成事件分层记录。
- [ ] A4 真实 Pi consumer 核验：用真实 Pi 会话数据（非夹具）验证项目树与固定根会话区分、真实 metadata 与全文搜索结果、运行／未读／需要输入的真实状态来源；已知残差（名称／浮签字形边界、指针拖放取舍、标记槽位）逐条给出处理结果与可复现操作。
- [ ] A5 由独立验证者运行 `node --test components/SessionSidebar.test.mjs components/SessionSidebar.session-search.test.mjs components/SessionSidebar.file-search.test.mjs components/SessionSidebar.project-identity.test.mjs components/SessionSidebar.worktree.test.mjs components/SidebarTitle.test.mjs`、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0205`，全部通过、guard 无阻断；不删减／跳过测试或放宽阈值。逐 A 项分层记录（单元／夹具、真实进程、浏览器、Windows 原生、视觉），缺条件记未运行。

## 范围外

不改 app/globals.css、app/settings.css 及受保护基线；不拷贝私人截图、字体或秘密。PIL-0147 已验收的状态（除非补采显示回归）。侧栏默认宽度（259 vs 216）若需改动，先由规划者调整 files_allowed。不扩建执行后端或改变会话／权限语义。

## 实现提示

先读 PIL-0147 日志与 relay-evidence/PIL-0147/（impl／verify，含量测工具 verify/v2/tools）。只改 C33 分节（/* C33 侧栏项目／会话、搜索、状态及重排 */）与 files_allowed。补采到位前不开工；无参考的状态不凭推断改样式。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T04:22Z · planner · 创建
- 2026-10-22T04:23Z · planner · 冻结验收标准 d381a6bd7ecf
