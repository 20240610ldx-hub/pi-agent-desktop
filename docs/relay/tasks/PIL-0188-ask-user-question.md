---
id: PIL-0188
title: 提问能力：模型向用户提问与答案回传（AskUserQuestion）
epic: E4
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0030]
files_allowed: [lib/ask-user-question.ts, lib/ask-user-question.test.mjs, lib/ask-user-question-extension.ts, lib/ask-user-question-extension.test.mjs]
files_shared: [lib/rpc-manager.ts, lib/types.ts, hooks/useAgentSession.ts]
acceptance_sha: 84e5165da004
waivers: []
---

## 目标

让模型在会话中能真正向用户提出 1–4 个带选项的问题、暂停等待、拿到用户的选择或自由输入后继续，而不是只在界面上画一张问答卡。对应 GOALS E4（答案不是授权）；C06/PIL-0120 的问答卡消费本卡。

## 背景与现状

- Pi SDK 没有面向模型的提问工具：`examples/extensions/question.ts`、`questionnaire.ts` 只是示例，且依赖 `ctx.ui.custom()`，在 RPC/桌面里不可用；`@juicesharp/rpiv-ask-user-question` 未安装（项目只装了 rpiv-config 与 rpiv-todo）。
- 桌面端已有可复用的阻塞式请求通道：`lib/rpc-manager.ts` 的 `requestExtensionUi()`（待答请求、SSE 重连重放、Stop 取消、`extension_ui_closed`），以及 `ExtensionUiRequest`/`ExtensionUiResponse`（`lib/types.ts`）与 `hooks/useAgentSession.ts` 的 `handleExtensionUiRequest` 队列。但内置 `select` 只有字符串选项，没有说明文字、多题、多选、跳过。
- 内置工具扩展的注册方式参照 `lib/conversation-chapter-extension.ts`（`defineTool` + `extensionFactories`）。
- 参考（只读，只登记机制）：agent-panels-light/2026-10-21 的 00、06、07：单题卡（题头、带说明的单选项、"其他"、跳过、提交 Ctrl+Enter）、多题分页（"第N项，共M项"）与末题提交。界面由 PIL-0120 实现，本卡只做能力。

## 验收标准

- [ ] A1 工具契约：在普通项目会话注册内置工具 `ask_user_question`，参数为 1–4 个问题，每题含 `id`、短题头 `header`、问题正文、2–4 个选项（`label` 必填、`description` 可选）和 `multiSelect`；"其他/自由输入"由界面隐式提供，不在 options 中。超出个数、空 label、重复 label、重复 id 的调用被拒绝并把明确错误返回给模型，不崩溃、不挂起。验证：`node --test lib/ask-user-question.test.mjs` 逐条覆盖校验规则；用真实 Pi SDK 会话加载扩展，列出工具并确认 schema（证据标注"真实 SDK"）。
- [ ] A2 阻塞与回传：模型调用该工具后，工具执行阻塞在一条待答请求上，经现有 SSE 以新增的 `ask_user_question` 请求方法发给所有已连接客户端（载荷含问题数组），在答案到达前后续工具不执行、模型回合不继续；客户端通过现有 `extension_ui_response` 命令回传结构化答案（每题所选 label 列表、自由输入文本、或 skipped），工具把答案转成明确的文本结果返回给模型，模型据此继续。同一请求只接受第一个答案，重复答案被忽略。验证：用本地 OpenAI 兼容夹具服务（证据标注"夹具"）驱动确定性的工具调用，走真实 Pi SDK 与 `/api/agent/[id]` 命令通道：看到待答请求、此时后续工具计数为 0、提交答案后工具结果文本与提交内容逐字段一致；真实模型路径只用 deepseek-flash 且限制输出，能触发才验，否则记未运行。
- [ ] A3 失败/取消/恢复：用户对某题或全部题选择跳过时返回显式 skipped 状态，不得替用户挑选默认项或伪造答案；Stop/中止取消待答请求（发出 `extension_ui_closed`），工具结果为 cancelled，且不再执行后续工具；SSE 断开重连时仍待答的请求被重放，已答/已取消的不会重放；服务或会话重启后遗留的待答请求不被当作已答，也不重发提示。不设自动超时、不自动选默认项。验证：夹具会话下逐项操作（跳过、Stop、断流重连、重启服务）并检查事件序列、工具结果文本与会话文件中请求次数不增加。
- [ ] A4 答案不是授权：答案只作为工具结果文本回传，不写入任何授权/策略存储；即使选项文字像"允许"，也不改变 PIL-0030 授权门状态——此后同一会话中被授权门拦截的工具仍然待批，授权门执行计数不变。本工具自身不读写文件、不执行命令，按只读无副作用登记，经授权门时不弹授权卡。验证：夹具让模型先提问"允许执行写入吗"，用户选"允许"，模型随后发起受门控写入，核对授权卡仍出现、写入计数为 0 直到用户在授权卡上批准；对比提问前后策略文件字节不变。
- [ ] A5 无人值守会话：没有交互界面的会话（定时任务的隐藏窗口、子代理、Chat-only/聊天工作区）不提供该工具，工具列表中不出现它，也不会产生挂起的待答请求；验证：定时任务路径用领取时已存在的夹具验证工具列表与待答请求数为 0；子代理路径依赖 PIL-0050，待其完成后由 PIL-0050 卡复验。
- [ ] A6 由独立验证者运行受影响定向测试：`node --test lib/ask-user-question.test.mjs lib/ask-user-question-extension.test.mjs lib/rpc-manager-extension-ui.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0188`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程证据分层，缺条件记未运行。

## 范围外

问答卡的界面与分页/快捷键/状态胶囊（PIL-0120）；把答案当作授权或写入授权策略；跨会话保存答案；模型自行决定"其他"选项文案；自动超时；选择题之外的富文本/图片问题。

## 实现提示

先读 docs/agents/sessions.md、tools.md、fork-sessions.md 的扩展 UI 与事件管线段落。新增的两个模块各一职：`lib/ask-user-question.ts` 放参数 schema、校验与答案→文本归一化（纯函数，便于测试），`lib/ask-user-question-extension.ts` 放 `defineTool` 注册，通过 rpc-manager 注入的回调（绑定到会话的 `requestExtensionUi`）发请求。`lib/rpc-manager.ts`、`lib/types.ts`、`hooks/useAgentSession.ts` 只做小量追加：注册扩展、增加 `ask_user_question` 请求/响应类型与解析、把该请求送入现有对话队列，不改其他方法的行为。

请求形状（供 PIL-0120 消费）：`{ type: "extension_ui_request", id, method: "ask_user_question", questions: [{ id, header, question, multiSelect, options: [{ label, description? }] }] }`；响应：`{ type: "extension_ui_response", id, answers: [{ questionId, selected: string[], other?: string, skipped?: boolean }] }` 或 `{ cancelled: true }`。不新建第二套待答注册表，沿用 `pendingUiRequests`。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T12:16Z · planner · 创建
- 2026-10-21T12:27Z · claude:sonnet-high:planner · 冻结前修订第3轮：新建能力卡并写满验收。调研结论：Pi SDK 无面向模型的提问工具（仅 TUI 示例，rpiv-ask-user-question 未安装），桌面端已有阻塞式扩展 UI 通道可复用；用户 2026-10-21 决定 C06 实际实现 AskUserQuestion，故建此卡，PIL-0120 依赖本卡。
- 2026-10-21T12:39Z · planner · 冻结验收标准 84e5165da004
