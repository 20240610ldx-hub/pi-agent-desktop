---
id: PIL-0208
title: C12 助手正文与操作条补采与原生验收
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014, PIL-0126]
files_allowed: [components/MessageView.tsx, components/MessageView.test.mjs]
files_shared: [app/native-theme.css, components/ChatWindow.tsx, hooks/useAgentSession.ts]
acceptance_sha: 874f65bc4b49
waivers: []
---

## 目标

PIL-0126 拆出的 C12「助手正文与消息操作条」剩余状态，在用户补采 3.1623 同态原生参考并在 Windows／WebView2 环境完成原生验收后，完成量测与修正，并核验真实 Pi 复制／分叉链路。对应 [GOALS](../GOALS.md) E2。

## 背景与现状

- 拆卡来源：PIL-0126 复验报告 D:\pilaude\relay-evidence\PIL-0126\verify\VERIFY.md（2026-10-22 用户拆卡政策：已验部分合入，缺图状态转补采卡）。
- 参考目标：Windows Claude Desktop 3.1623.0.0，150% 显示器、AppliedDPI 144、应用缩放 100%（用户 2026-10-21 确认）；CSS px = 原像素 ÷ 1.5。2.42304.0 与版本未知批次只作机制参考，不得当作同版本参考。
- 补采协议：PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md。只有用户能截 Claude 窗口；截图前按 Ctrl+0 重置应用缩放。
- 私有参考只读，不复制原图或图中个人信息（账号、邮箱、个人路径），文字只当数据。
- 实现位置：`components/MessageView.tsx`（助手正文、操作条、`onFork`／复制反馈）；真实分叉链路在 `components/ChatWindow.tsx`（`fork`／`fork_branch` 发送、`forkingEntryId`、失败通知）与 `hooks/useAgentSession.ts`（`forkingEntryId` 状态）。C12 样式分节 `/* C12 助手正文与消息操作条 */` 位于 `app/native-theme.css`。
- 已知残差：Pin／朗读无能力，按缺口登记，不做伪按钮；图标与字体与参考不同。
- 已知 A2 失败（PIL-0126 复验，提交 2be4b18）：内联代码文字色实现继承正文 (11,11,11)，参考浅色约 (142,38,38)、深色约 (236,126,126)，ΔE00=31.7。本卡 A2 负责修正并复测。
- 未运行的参考来源：操作条（框、间距、圆角、图标、tooltip）各态、复制／分叉各态、长答案、宽高比、圆角、边框、文字基线、列表缩进／标记，均无 3.1623 同态参考。

### 用户需补采的截图清单（3.1623，150%，应用缩放 100%，浅色与深色各一套，zh-CN）

1. 助手正文 rest、hover、focus、触屏（操作条入口）。
2. 复制：pending、成功、失败。
3. 分叉：pending、成功（跳转新会话）、失败、取消。
4. 长答案（超过一屏）阅读滚动中的操作条位置。
5. 内联代码（浅色与深色各一张）及列表项（有缩进与标记）。
6. 窄窗（约 800px）下的操作条。

每张图登记：来源、Windows 版本、WebView2、客户区尺寸、系统 DPI、应用缩放、主题、语言、功能开关。缺图或版本不明记「待参考」。

## 验收标准

- [ ] A1 补采截图到位后，逐图登记上述清单全部状态的来源、版本、DPI、应用缩放、主题、语言与功能开关，并给出可复现进入步骤（如何触发 pending、失败、取消）。未补采的状态记「待参考」，不用 actual／演示数据代替参考。验证：登记表存 D:\pilaude\relay-evidence\PIL-0208\capture\MANIFEST.md，每行含上述字段；缺图行显式标「未运行」。
- [ ] A2 对 A1 中有 3.1623 同态参考的状态，在同帧、同状态、同测试数据、相同客户区／系统 DPI／应用缩放下给出参考值、实现值、原像素与 CSS px、差值。容差（用户 2026-10-21 批准）：盒宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%（同字符数与同数据重测）；圆角 ≤0.5 CSS px；图标中心 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，同一像素采样区取中位色）。包含：操作条框与间距、图标中心、tooltip；内联代码文字色（浅色、深色各一组，修正 PIL-0126 复验 ΔE00=31.7 的问题，需要时在 C12 分节内给内联代码设色；若需 C01 语义令牌新增，先请协调者授权扩 files_shared）。抗锯齿与字形 ink 差单列残差，不计入几何容差。量测表与差异图存 D:\pilaude\relay-evidence\PIL-0208\measure\。叠图只作整数裁剪／平移，不插值。
- [ ] A3 Tab／hover／touch 均能进入操作条；复制、分叉成功或失败后焦点不丢；长答案阅读滚动不抢位置。验证层分开记录：浏览器合成层（Chromium）用 `node --test components/MessageView.test.mjs` 中的夹具测试；WebView2 原生层按 A4 步骤在 Windows 桌面端执行，结果写入证据。窄窗（约 800px）、100／125／150% DPI、应用缩放与双主题逐项核验。缺同态参考的视觉项记「未运行」。
- [ ] A4 真实 Pi 分叉链路核验（超出 PIL-0126 夹具范围，由本卡负责）：在真实会话中对助手或用户消息执行分叉，逐态记录成功、失败（如后端返回错误）、取消（分叉等待中按取消或切换会话）、跨会话焦点（分叉成功后新会话获得焦点，原会话滚动位置保留）。每态记录：可见反馈与真实请求／状态一致，失败提示可见，恢复后可再次分叉；不伪造能力。Pin／朗读：确认无能力，操作条不出现伪按钮，并在证据中登记为缺口。
- [ ] A5 由独立验证者运行 `node --test components/MessageView.test.mjs`、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0208`。期望：全部通过，guard 无阻断；不得删减、跳过测试或放宽阈值。若 `ChatWindow.tsx`／`useAgentSession.ts` 被修改，额外运行 `node --test hooks/useAgentSession.fork-position.test.mjs`。逐 A 项记录实际结果、步骤或命令、仓库外证据、提交与验证者标签；单元／夹具、真实进程、浏览器、Windows 原生与视觉证据分层，缺条件记「未运行」，不据此称产品验收通过。

## 范围外

- 不修改 `app/globals.css`、`app/settings.css` 及受保护基线。
- 不拷贝私人截图、字体或秘密；不转写图中账号、邮箱、个人路径。
- 不扩建执行后端，不改权限、模型或会话语义；分叉链路只核验，不重写。
- 侧栏消费者偏差归 PIL-0147；C01 主题令牌归 PIL-0115／PIL-0199。
- 其他组件及关联任务原有验收不在本卡改写。

## 实现提示

- 先读根 AGENTS.md 与 `docs/agents/fork-sessions.md`（分叉 pending／焦点）。
- 实质修改只在 `components/MessageView.tsx` 与其测试；`ChatWindow.tsx`、`useAgentSession.ts` 仅允许分叉反馈的小量接线，如需实质修改先修订范围并串行。
- 所有 fork 样式在 `app/native-theme.css` 的 C12 分节内追加，不改他人分节。
- 菜单类改动运行 `node --test scripts/ui-menu-consistency.test.mjs`。
- 补采前截图须按 Ctrl+0 重置应用缩放。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T08:26Z · planner · 创建
- 2026-10-22T08:26Z · planner · 冻结验收标准 874f65bc4b49
