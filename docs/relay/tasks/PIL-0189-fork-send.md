---
id: PIL-0189
title: 在分叉会话中发送（fork-send）
epic: E9
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: []
files_allowed: [lib/fork-send.ts, lib/fork-send.test.mjs, lib/fork-send-client.ts, app/api/agent/[id]/fork-send/route.ts]
files_shared: [lib/rpc-manager.ts, lib/agent-client.ts]
acceptance_sha: 3d887a1c84ac
waivers: []
---

## 目标

让用户把当前输入框里的草稿"在分叉会话中发送"：从当前会话的最新位置分叉出一条新会话，并在新会话里发出这条草稿，原会话不被打扰。对应 GOALS E9（会话记录与恢复）；PIL-0122 的快捷键 Ctrl+Alt+Enter 与发送提示第二行消费本卡。

## 背景与现状

- Pi 与桌面已有分叉：`lib/rpc-manager.ts` 的 `fork`/`fork_branch` 命令在新文件里复制已完成的条目（`writeForkedSession()`），源会话在运行时保持运行（keepSource），浏览器通过 `useAgentSession.handleFork` → `onSessionForked` 跳到新会话。只有"按某条消息分叉"，没有"分叉并发送草稿"。
- 参考：composer-tooltips-light/2026-10-21 的 01 在发送按钮提示里有第二行"在分叉会话中发送"与 Ctrl Alt ⏎（只登记机制）。此前没有消费者，按"不做假功能"暂不显示；用户 2026-10-21 决定建本卡后显示。
- 提示错误语义可参照 `lib/agent-client.ts` 的 `AgentCommandError` 与 `prompt_rejected`（accepted:false）约定。

## 验收标准

- [ ] A1 主路径：对已持久化、空闲的会话调用 `POST /api/agent/[id]/fork-send`（草稿文本与可选图片，附请求键），返回不同于源会话的 `newSessionId`；新会话文件的 `parentSession` 指向源会话，内容为源会话到当前叶子的全部已完成条目，之后恰好追加一条内容等于草稿的用户消息并开始运行（其回复由新会话自己的事件流送出）；源会话文件没有新增条目。验证：本地 OpenAI 兼容夹具服务（证据标注"夹具"）走真实 Pi SDK，对比两份会话文件的条目数、`parentSession` 与用户消息文本；真实模型路径只用 deepseek-flash 且限制输出，能触发才验。
- [ ] A2 源会话运行中也可用：源会话正在流式输出时触发，源会话不被中断、其输出完整结束；新会话只含已完成条目，并发出草稿。验证：夹具返回长流式响应，触发期间核对源会话事件序列未断、结束条目完整、新会话条目不含未完成的助手内容。
- [ ] A3 失败路径：源会话未持久化（尚无条目）、正在运行 shell 命令、分叉写文件失败、新会话启动失败/提示被拒绝，分别返回可区分的错误码；分叉失败时没有任何提示被发出（工具/请求执行计数为 0）；提示发送失败但分叉已创建时，响应带 `newSessionId` 与 `promptSent:false`，已建分叉保留不自动删除，草稿未被消耗，源会话不变。验证：夹具逐项构造五种失败，核对错误码、响应字段、会话文件与请求计数。
- [ ] A4 取消与幂等：客户端在提示发出前中止请求，则不发提示（已创建的分叉保留并随响应上报）；同一请求键在处理中被重复触发（连按快捷键、重复提交）只产生一个分叉和一条提示，不同请求键各自产生独立分叉；已被接受的提示不会在重试时重发。验证：夹具下并发两次同键请求与两次异键请求，统计新会话文件数与提示请求数。
- [ ] A5 授权与继承：新会话与源会话使用同一项目 cwd、模型、思考强度与工具集，不放宽授权；源会话上待批的请求或权限状态不被带到新会话，也不会因草稿发送被自动批准。验证：夹具让源会话处于待批工具请求状态，触发后核对新会话的工具集/cwd 与源一致、源待批请求仍待批、新会话没有被批准的记录。
- [ ] A6 由独立验证者运行受影响定向测试：`node --test lib/fork-send.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0189`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程证据分层，缺条件记未运行。

## 范围外

快捷键绑定与发送提示文案（PIL-0122）；分叉后浏览器如何跳转与草稿清理（PIL-0122/PIL-0137 的 `onSessionForked` 接线）；分叉某条历史消息之前的位置；删除失败时遗留的分叉；多会话批量分叉。

## 实现提示

先读 docs/agents/sessions.md 与 fork-sessions.md 的分叉段落。`lib/fork-send.ts` 放编排（单飞锁按源会话与请求键、分叉到当前叶子、启动新会话并发提示、失败码映射），保持可注入依赖以便夹具测试；`app/api/agent/[id]/fork-send/route.ts` 只做请求解析与错误码映射；`lib/fork-send-client.ts` 提供类型化的客户端调用并复用 `AgentCommandError`。`lib/rpc-manager.ts` 只允许为取得当前叶子或复用 `writeForkedSession()` 追加极小的导出，不改既有 `fork`/`fork_branch` 行为；`lib/agent-client.ts` 只加类型。不得新建第二套分叉文件写入逻辑。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T12:16Z · planner · 创建
- 2026-10-21T12:27Z · claude:sonnet-high:planner · 冻结前修订第3轮：新建能力卡并写满验收；基于 Pi 现有 fork_branch 与 keepSource，从当前叶子分叉后在新会话发送草稿，含失败/取消/幂等路径；用户 2026-10-21 决定建本卡，PIL-0122 依赖它。
- 2026-10-21T12:39Z · planner · 冻结验收标准 3d887a1c84ac
