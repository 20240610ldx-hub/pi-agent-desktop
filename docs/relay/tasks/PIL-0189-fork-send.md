---
id: PIL-0189
title: 在分叉会话中发送（fork-send）
epic: E9
priority: P1
status: verify
owner: claude:sonnet-high:impl
lease_until: 2026-10-21T15:40Z
branch: task/PIL-0189-fork-send
implementers: [claude:sonnet-high:impl]
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
| A1 | node --test lib/fork-send.test.mjs（15/15）；层级=夹具（本地 OpenAI 兼容服务，未调真实模型）+ 真实 Pi SDK/rpc-manager/writeForkedSession；A1 用例经真实 POST 路由：新 id≠源、parentSession=源文件、源条目 id 序列在前、其后恰好 1 条用户消息=草稿（计入 Pi 自带 system 条目）、回复来自子会话、源文件条目数不变、夹具仅 1 次请求。变异验证：把发送文本改成 +" extra" 时 A1/A2/A4/A5 共 4 例失败。图片仅在注入 deps 的 A5 用例里验透传，真实 SDK 图片路径未覆盖；真实 deepseek-flash 路径卡片写“能触发才验”，未运行 | 通过 | D:/pilaude/relay-evidence/PIL-0189/verify/fork-send-test.log; D:/pilaude/relay-evidence/PIL-0189/verify/mutant-M5-extratext.log | 1ee7898 | claude:sonnet-high:verify |
| A2 | 同上测试；层级=夹具+真实 SDK：源以 SLOW 流式输出中（isRunning=true）触发，源仍在跑、期间无 agent_end；新会话不含 part-one/SLOW-DONE，仅含已完成条目与草稿；放行后源出现 agent_end，末条助手文本完整 'part-one part-two SLOW-DONE'、stopReason=stop，草稿未进入源；子会话自行发 1 次请求 | 通过 | D:/pilaude/relay-evidence/PIL-0189/verify/fork-send-test.log | 1ee7898 | claude:sonnet-high:verify |

## 日志

- 2026-10-21T12:16Z · planner · 创建
- 2026-10-21T12:27Z · claude:sonnet-high:planner · 冻结前修订第3轮：新建能力卡并写满验收；基于 Pi 现有 fork_branch 与 keepSource，从当前叶子分叉后在新会话发送草稿，含失败/取消/幂等路径；用户 2026-10-21 决定建本卡，PIL-0122 依赖它。
- 2026-10-21T12:39Z · planner · 冻结验收标准 3d887a1c84ac
- 2026-10-21T12:40Z · claude:sonnet-high:impl · 领取，租约至 2026-10-21T15:40Z
- 2026-10-21T12:53Z · claude:sonnet-high:impl · 做了：新增 lib/fork-send.ts（单飞锁按源会话+请求键、分叉到当前叶子复用 writeForkedSession、新会话经 startRpcSession 启动并发提示、八个错误码、中止与重试复用已建分叉）、lib/fork-send-client.ts、app/api/agent/[id]/fork-send/route.ts、lib/fork-send.test.mjs（15 例，本地 OpenAI 兼容夹具服务 + 真实 Pi SDK；A3 的写文件失败/新会话启动失败为注入）；未改 rpc-manager.ts/agent-client.ts。空闲且未打开的源会话只读文件，不启动 wrapper（否则 pi 会向源文件追加 thinking_level_change）。 / 状态：分支提交 1ee7898；A1-A5 自测通过（node --test lib/fork-send.test.mjs 15/15）；tsc、lint、guard --task 通过；npm test 失败 12 例，全部在 PIL-0113 基线内，无新增；证据 D:/pilaude/relay-evidence/PIL-0189/impl/（first-run.log 为首轮失败记录） / 下一步：验证（未跑真实 deepseek-flash 路径，仅夹具） / 风险：1) 子会话第一次运行时 Pi 自己追加 developer/system 提示条目与 thinking_level_change，故'恰好一条用户消息'按用户消息计；2) 未完成工具调用的助手条目属于已完成条目，会被复制，子会话由 pi-ai 合成'No result provided'，未被执行或批准；3) 分叉后浏览器如何接到子会话事件（PIL-0122/0137）未接线
- 2026-10-21T12:53Z · claude:sonnet-high:impl · in_progress → verify
- 2026-10-21T13:00Z · claude:sonnet-high:verify · 证据 A1：通过
- 2026-10-21T13:00Z · claude:sonnet-high:verify · 证据 A2：通过
