---
id: PIL-0179
title: Side chat 独立会话服务与权限隔离
epic: E6
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0030, PIL-0203]
files_allowed: [lib/side-chat-service.ts, lib/side-chat-service.test.mjs, lib/side-chat-store.ts, lib/side-chat-session-adapter.ts, app/api/side-chat/route.ts, app/api/side-chat/[id]/route.ts, app/api/side-chat/[id]/events/route.ts]
files_shared: []
acceptance_sha: b9238c755409
waivers: []
---

## 目标

让同一项目的 Side chat 使用独立 Pi 会话、事件与停止控制，保留父会话关联并可恢复，主支线互不串消息。对应 GOALS E6 与 E9；PIL-0170/0171 消费该能力。

## 背景与现状

当前只有 pane 展示参考，没有 Side chat 会话服务。用户决定能力先行。复用 startRpcSession/会话查找与现有事件流，不新建第二套 AgentSession 注册表；P1：C56/C57 的真实回复/菜单状态依赖。

## 验收标准

- [ ] A1 通过 POST /api/side-chat 在已授权项目创建具有独立 sessionId/持久会话文件的支线，并记录 parentSessionId；同父项目重复创建按请求幂等键返回同一支线，不能误用父会话文件。验证：真实 SDK 创建/读取、两文件标识与新增条目核对。
- [ ] A2 主/支线各发送一条标记不同的真实请求（付费只用 deepseek-flash 且每条限制输出），订阅各自 SSE，事件和回复只归属对应 sessionId；停止支线只取消支线请求，父会话仍可查询。验证：接口步骤、会话文件与事件序列；重复回归可用明确标注的本地夹具，不能只给 mock SDK 结果。
- [ ] A3 支线继承父项目可用工具与授权上限，不能借新 sessionId 放宽路径或工具；未授权/撤权/审批拒绝时工具执行计数为 0。两个已授权项目之间互相读取/发送/停止/订阅 SSE 一律拒绝（返回明确越权状态），拒绝后会话文件写入与工具执行计数均为 0。验证：PIL-0030 gate 实际执行计数，以及用两个真实已授权项目构造的越权/嵌套用例。
- [ ] A4 关闭订阅/打开面板不重发 prompt；服务重启后关联可恢复，先前运行标为中断且只允许手动继续。未知提交结果/取消/创建失败返回明确状态。验证：真实服务重启/断流步骤，文件中请求次数不增加。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test lib/side-chat-service.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0179`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

SideChatPanel 布局/输入器、自动启动子代理、复制主会话全部上下文、隐式重发与额外模型预算。

## 实现提示

读 docs/agents/sessions.md、fork-sessions.md、subagents.md；通过 side-chat-session-adapter 调现有导出，不改 rpc-manager；保留现有 isRunning/isIdle/启动锁/关闭等待。

所列新文件为拟新增能力入口；只在这些后端/服务文件实现，UI 归对应 E2 卡。files_shared 仅少量类型/桥接/模块注册，不转移实质逻辑；不绕过现有授权与生命周期。

幂等键作用域为父会话与创建请求；不同幂等键可创建独立支线，重复同键不会新增会话文件（A1 验证）。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T07:22Z · codex-plus:gpt-xhigh:planner · 创建
- 2026-10-21T07:37Z · codex-plus:gpt-xhigh:planner · 做了：创建能力卡编号并完成仓库外待应用规划草案，尚未填写本卡模板 / 状态：原组件卡 PIL-0115 写入经文件接口、apply_patch、独立 Node 三次均 EPERM，按规则停止；本卡仍未冻结，不可领取，P1 为对应界面/能力依赖路径的拟定优先级 / 下一步：宿主修复既有任务文件写权限后，协调者从 planner-2026-10-21/draft-card-changes.json 核对差异与当前 tip，再由规划者应用和复核，勿直接当完成卡 / 风险：62 原卡及 parity-index 尚未修订，重叠和依赖问题未解决；未改 ACL、未运行 Git 写命令或产品测试。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0170、PIL-0171 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：删除 →PIL-0050（支线复用 startRpcSession，非子代理）；G3 越权用例移入 A3；G6 删除“本轮不实现、不 freeze”
- 2026-10-21T12:39Z · planner · 冻结验收标准 b9238c755409
