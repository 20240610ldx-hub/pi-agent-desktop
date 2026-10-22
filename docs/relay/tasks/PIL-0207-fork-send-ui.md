---
id: PIL-0207
title: C08 分叉发送入口（待用户开启）
epic: E2
priority: P3
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0122, PIL-0189]
files_allowed: [components/ChatInput.tsx, components/ChatInput.test.mjs, components/ChatInput.fork-send.test.mjs]
files_shared: [components/ChatWindow.tsx, components/AppShell.tsx, hooks/useAgentSession.ts, lib/i18n/messages/*.ts, app/native-theme.css]
acceptance_sha: a691d9889660
waivers: []
---

## 目标

把 PIL-0189 已完成的"在分叉会话中发送"能力接到输入器：发送按钮提示第二行显示"在分叉会话中发送 Ctrl Alt ⏎"，Ctrl+Alt+Enter 与点击该提示项即从当前会话分叉并在新会话发送草稿。对应 [GOALS](../GOALS.md) E2（输入法、焦点、交互逐项核验）与 E9（会话记录与恢复）。

**用户决定先隐藏**：用户 2026-10-21 决定 PIL-0122 中分叉发送 UI 先不显示。本卡不得在用户确认开启前领取；领取前需用户明确同意开启。

## 背景与现状

- 能力已就绪：PIL-0189（done）提供 `POST /api/agent/[id]/fork-send`，客户端 `lib/fork-send-client.ts` 的 `forkSend()` 与 `createForkSendKey()`；错误码见 `lib/fork-send.ts`。
- 参考：`composer-tooltips-light/2026-10-21` 的 01 号图（Windows 3.1623.0.0 原生，CSS px = 原像素 ÷ 1.5）：发送提示第一行"发送 ⏎"，第二行"在分叉会话中发送 Ctrl Alt ⏎"（键帽样式）。量测与容差沿用 PIL-0122 A2。
- PIL-0122 已做单行布局与发送提示（commit 2a40c84）；本卡只加分叉相关部分，不改 PIL-0122 的单行量测结果。
- 输入器主文件 `components/ChatInput.tsx` 由 PIL-0122 持有，故依赖 PIL-0122 完成后串行领取。
- 壳层接线（`ChatWindow.tsx`、`AppShell.tsx`、`useAgentSession.ts`）属 files_shared：只允许小量追加（跳转到新会话、清理源草稿的回调）；`useAgentSession.ts` 的 `onSessionForked` 与 PIL-0137 重叠，必须先读 PIL-0137 的 files_allowed 与日志再动手。
- PIL-0189 评审非阻断意见，需在本卡落实：源会话运行中分叉会复制未回复的用户消息，子会话出现连续两条用户消息，界面需说明（见 PIL-0122 日志 2026-10-21T13:04Z）。

## 验收标准

- [ ] A1 发送按钮悬停或键盘聚焦时，提示显示两行：第一行"发送 ⏎"，第二行"在分叉会话中发送 Ctrl Alt ⏎"（键帽呈现）；与 composer-tooltips-light 01 的文案、键帽、行距、圆角、与按钮间隙逐项量测，差异按 PIL-0122 A2 容差。验证：`node --test components/ChatInput.fork-send.test.mjs` 通过，并附同帧量测表到 relay-evidence/PIL-0207/。
- [ ] A2 Ctrl+Alt+Enter 与点击第二行提示项调用 `forkSend()`，发送当前草稿（文本与图片），不经过普通发送路径；普通 Enter 行为不变。IME 组合期间两者都不触发、不误发。验证：`node --test components/ChatInput.fork-send.test.mjs`（覆盖 Ctrl+Alt+Enter、点击、IME 组合中按键三种）。
- [ ] A3 成功：跳转到新会话（经 `onSessionForked` 或等价接线），源会话草稿被清空。失败或取消：源草稿保留，显示可区分的错误提示（错误码映射到 i18n 文案）。快速连按只产生一个分叉（同一请求键）。验证：ChatInput 与壳层相关测试通过；手动步骤：在浏览器中连按 Ctrl+Alt+Enter 三次，侧栏仅新增一个子会话，源输入框为空（成功）或保留草稿（失败）。
- [ ] A4 不可分叉时第二行置灰且快捷键不响应：源会话未持久化、正在运行 shell 命令时，提示第二行置灰（禁用样式，与 PIL-0122 的焦点/禁用状态一致），Ctrl+Alt+Enter 无动作、点击无动作；不显示假能力。验证：`node --test components/ChatInput.fork-send.test.mjs` 覆盖两种状态；手动步骤在未保存的新会话中确认第二行置灰。
- [ ] A5 运行中分叉时界面说明"未回复的用户消息会一并复制到新会话"（或等价提示），文案三语言齐全（lib/i18n/messages/en.ts、zh-CN.ts、zh-TW.ts 同步，缺键不显示键名）。提示只放在分叉相关的界面范围内，不遮挡输入。验证：三语言键存在性测试通过（`node --test lib/i18n/*.test.mjs` 若存在则一并运行）；手动步骤：源会话流式输出中触发，看到说明。
- [ ] A6 `npm run lint`、`node_modules/.bin/tsc --noEmit`、`node --test components/ChatInput.test.mjs components/ChatInput.automation.test.mjs lib/ime.test.mjs` 全部通过；`node scripts/relay.mjs guard --task PIL-0207` 无阻断。不得删减或跳过测试、不得放宽阈值。

## 范围外

- 分叉后端与会话文件写入（PIL-0189 已完成，不改 `lib/fork-send*.ts`、`app/api/agent/[id]/fork-send/`）。
- 麦克风与语音转文字（PIL-0178/PIL-0140 parked，首发不做）。
- 分叉某条历史消息之前的位置、批量分叉、删除失败遗留分叉（PIL-0189 范围外项）。
- `app/globals.css`、`app/settings.css` 及受保护基线。

## 实现提示

- 先读 `docs/agents/fork-sessions.md` 的分叉段落、`docs/agents/fork-ui.md` 与 PIL-0189 的 `lib/fork-send-client.ts`。
- 第二行提示与快捷键放在 `ChatInput.tsx` 的发送控件附近，复用 PIL-0122 已有的提示组件，不新建第二套提示。
- IME 判断复用 `lib/ime.ts` 的组合状态，不另写判断。
- 壳层接线只追加回调参数，不重写 `onSessionForked` 的既有行为（PIL-0137 所有）。
- 样式只写在 `app/native-theme.css` 的 `/* C08 分叉发送入口 */` 分节内。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T07:58Z · planner · 创建
- 2026-10-22T08:10Z · claude-cli:haiku:planner · 由 PIL-0122 拆出：分叉发送 UI（第二行提示、Ctrl+Alt+Enter、置灰、运行中说明、三语言键）；依赖 PIL-0122、PIL-0189；用户 2026-10-21 决定先隐藏，需用户确认开启后才领取；ChatInput.tsx 属 PIL-0122 files_allowed，壳层文件放 files_shared。
- 2026-10-22T07:58Z · claude-cli:haiku:planner · 冻结验收标准 a691d9889660
