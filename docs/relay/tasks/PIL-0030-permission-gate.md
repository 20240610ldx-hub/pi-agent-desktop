---
id: PIL-0030
title: 统一执行前授权并接入 pi-permission-system（普通 coding 会话授权门）
epic: E4
priority: P1
status: in_progress
owner: codex-plus:sol-xhigh:impl
lease_until: 2026-10-22T12:54Z
branch: task/PIL-0030-permission-gate
implementers: [codex-plus:sol-xhigh:impl]
depends_on: [PIL-0001]
files_allowed: [lib/builtin-permission-extension*, lib/permission-gate*, lib/permission-policy*, e2e/permission-gate*.mjs]
files_shared: [lib/rpc-manager*, lib/extension-ui-queue*, hooks/useAgentSession*, lib/agent-event-stream*, lib/agent-event-wire*, lib/types.ts, lib/session-reader*, lib/i18n/messages/*.ts, components/ChatWindow.tsx, package.json, package-lock.json, next.config.ts, scripts/prepare-desktop.mjs, scripts/stage-package*, scripts/web-package-layout.test.mjs, scripts/release-workflows.test.mjs, THIRD_PARTY_NOTICES.md, scripts/fork-ownership.json, docs/pilaude-pi-extensions.md]
acceptance_sha: d45dc5cf7fcd
waivers: []
---

## 目标

普通 coding 会话里，所有工具调用在执行前都经过 `@gotgenes/pi-permission-system`（固定 41.0.0）这个真实包提供的授权门；未授权、待批、被拒、取消、超时、撤权时，真实副作用与执行计数都为 0，批准后恰好执行一次。对应 [GOALS E4 与 E8](../GOALS.md)。本卡是授权门本体；公开审批服务与入口覆盖清单（PIL-0188、PIL-0193、PIL-0179 需要）在 PIL-0203，子代理与 child 会话在 PIL-0202。

## 背景与现状

审计日期 2026-10-22，对象为主线 `fusion/pi-claude-desktop` 与备份 `wip/pre-relay-2026-10-19`（2332945）。

- 主线上**没有**授权门：`package.json` 没有该依赖，`node_modules/@gotgenes` 不存在，`lib/` 里没有 `builtin-permission-extension*`、`subagent-lifecycle*`，`lib/rpc-manager.ts` 的普通 coding 会话扩展列表（约第 2796 行起）只有 `createReadOnlyMcpPolicyExtension()` 等；只读 MCP 策略仅阻断缺少 `readOnlyHint:true` 的 MCP 工具，不是统一授权。工具预设（read-only/default/full）只控制暴露，不控制调用。
- 备份里已有、旧会话评审过的实现（均为 WIP 未提交，可信度见下）：`lib/builtin-permission-extension.ts`（76 行）与 `.test.mjs`（168 行）：显式 `agentDir`、同一 Jiti 模块图先 await 官方 parser 再初始化完整官方 factory、宿主自己的 `tool_call` 守卫先注册且在 factory 失败后仍保留（失败即阻断所有工具并显示“Tool permissions unavailable”）、最后注册 `session_start` 用实际 sessionId 的 service 可用性决定状态；`lib/rpc-manager.ts` 中普通 coding 会话唯一注册行 `createBuiltinPermissionExtension({ agentDir })`（排在只读 MCP 策略之后，child／chatOnly／exact-profile 不默认加载）。字节级快照与逐文件哈希在 `D:/pilaude/relay-evidence/PIL-0001/recovery-permissions/`（`manifest.json`、`source/`、`handoff.md`）。
- 备份 rpc-manager 的 hunk 与主线有冲突（`git merge-file` 试合并：`lib/rpc-manager.ts` 2 处、`lib/rpc-manager.test.mjs` 1 处，`lib/subagent-runtime.ts` 0 处），备份 rpc-manager 里还混有 Web、Plan、Powerline、Background tasks 的 import 与注册（属 PIL-0071～0074），以及 child 生命周期 hunk（属 PIL-0202）。本卡只迁入 permission 的 import 和这一行注册及对应测试，其余全部不碰。
- 旧历史证据的真实含义（均为旧基线、夹具或局部，不可当作本卡通过）：官方 factory 6 项组合、nested `ctx.executeTool` 同一官方 gate、磁盘 allow→deny 撤权、malformed config 回退 ask、截断 WASM 时生产 loader 拒绝（计数 0）、initial-health RED→GREEN；这些都用临时 agentDir、faux provider 与生成文件，不是通过产品公开入口创建会话后的真实写入、删除、越界、shell 验证。所以“完整验收”从零开始，历史只指明哪些路径可行。
- 包的已知语义（固定提交 fe5474250a6f，npm integrity 见历史文档）：规则是 `allow | ask | deny`，单 pattern map 为 last-match-wins；Bash 经 tree-sitter 分解；`mcp__server__tool` 有专用类型；弹窗通过 RPC `select`/`input`，Yes 只对当前调用一次，“Yes for this session”是不落盘的会话 grant；默认不设超时，设了超时则超时拒绝；`yoloMode` 把 ask 改成 allow；`getPermissionsService(sessionId)` 的 `checkPermission` 只查询、不替调用者发起询问或消费批准；完整 extension 注册 `tool_call` 与 skill input，**不**注册 `user_bash`，也不拦截扩展内部直接进程或网络。运行依赖 zod、web-tree-sitter、tree-sitter-bash（后者带 `node-gyp-build` 安装钩子，必须 `--ignore-scripts`，本包只读其 WASM）。
- 每个新会话由 `lib/rpc-manager.ts` 的 wrapper 创建；定时任务经 `lib/scheduled-tasks/runtime.ts` 调 `startRpcSession("__scheduled__…")`，走的就是普通 coding 路径；子代理（child）会话走 `lib/subagent-runtime.ts` 的另一条创建路径，不加载 builtins。
- **产品默认策略（本卡落地；2026-10-22 用户确认此表，并确认官方包 `yoloMode: true` 首版视为不可用并阻断，待 Auto 模式规划后再放开）**：GOALS 已确认“按项目授权：工作区内常规操作自动执行，删除、越界访问、对外提交需确认”。落成表格如下，数据放在 `lib/permission-policy*`，作为随产品内置的默认值，不写用户全局配置：

| 操作 | 授权项目（cwd 在已授权根内） | 未授权 cwd |
| --- | --- | --- |
| 读／写／编辑项目内文件 | allow | ask |
| 删除文件（含 `rm`、`del`、`Remove-Item`） | ask | ask |
| 读写项目外路径 | ask | ask |
| shell：官方 Bash 分析认定为只读的常见命令（如 `git status`、`ls`、`cat`） | allow | ask |
| 其余或无法分类的 shell、PowerShell | ask | ask |
| MCP 与扩展工具 | ask | ask |

  “授权项目”指用户已在 Pilaude 里选为项目并进入文件访问允许根（`lib/file-access.ts`）的文件夹；无人值守（没有 UI 订阅者）时 ask 一律按拒绝处理，不挂起。官方包默认不设超时，产品默认有效配置设 ask 超时 15 分钟（与 PIL-0193、PIL-0203 一致），超时按拒绝处理。

## 验收标准

- [ ] A1 普通 coding 会话的真实授权门：依赖固定为 `@gotgenes/pi-permission-system` 41.0.0；通过 `startRpcSession` 创建会话（与产品入口同路径，faux provider 驱动真实工具调用，不 mock 被测的 gate），按上表逐行验证。未授权 cwd 与授权项目中应为 ask 的行：写入、编辑、删除、项目外读写、任意 shell 命令、PowerShell（Windows）、扩展工具——以文件系统标记（文件是否出现／哈希是否变化／shell 命令写出的标记文件是否存在）和对计数型扩展工具的调用计数为执行 spy，计数均为 0，界面（现有扩展对话框与状态行）显示待批或已拒绝；授权项目中应为 allow 的行：项目内读写与只读 shell 无需询问并成功执行。gate 不可用（factory／parser／service 初始化失败、service 丢失）时所有工具被阻断，状态行显示 `Tool permissions unavailable`，计数 0。验证：`node --experimental-strip-types --test lib/builtin-permission-extension.test.mjs lib/permission-gate.integration.test.mjs`（新增，经 startRpcSession 的集成测试）全部通过，并附报告 JSON；层级标注“真实 SDK + faux provider”。
- [ ] A2 批准恰好一次与拒绝矩阵：对一次待批调用，Yes（仅本次）后真实副作用／计数恰好为 1；No、Cancel、Stop 中止、超时（测试里用短超时配置，另断言默认有效配置为 15 分钟）、撤权（待批期间把磁盘策略改为 deny，之后回复 Yes）、重放（同一 `toolCallId` 与参数的调用在被批准消费后再次出现必须重新询问，同一审批回复送达两次第二次被忽略）均不执行，计数保持不变，并各自给出可区分的原因文本。会话授权（官方包的“Yes for this session”，不落盘）保留但受撤权约束：选择会话授权后，分别把磁盘策略改为 deny、调用本卡在 `lib/permission-gate*` 内定义的会话授权清除入口（`clearSessionGrants(sessionId)`，PIL-0203 的 `revoke` 之后封装它）、执行 Stop，下一次同类调用都必须重新判定且计数为 0，各有独立用例。验证：`node --experimental-strip-types --test lib/permission-gate.integration.test.mjs` 对每个分支有独立用例（红绿记录写入日志：先看到去掉对应保护时失败，再看到通过）。
- [ ] A3 MCP 与定时任务同门：用本地 stdio MCP 夹具服务器（服务器端以标记文件计数真实调用，参照 `lib/mcp-read-only-policy.integration.test.mjs` 的做法）验证：MCP 直接调用与经 codemode `ctx.executeTool` 的嵌套调用在 ask 状态下服务器端调用数均为 0，批准后恰好 1；以 `lib/scheduled-tasks/runtime.ts` 同样的调用形状通过 `startRpcSession("__scheduled__…")` 启动的会话，在没有 UI 订阅者时，需要批准的工具不执行、该次运行呈现已有的“需要关注”状态且计数为 0，只读默认工具集不受影响。证据标注“夹具”。子代理与 child 会话不在本卡（PIL-0202）。验证：`node --experimental-strip-types --test lib/permission-gate.integration.test.mjs` 对应用例通过。
- [ ] A4 不扩大范围与不改开发环境：chatOnly、chat-workspace、exact-system-prompt profile 与 child 会话的加载与行为不因本卡改变（`lib/rpc-manager*.test.mjs`、`lib/chat-workspace-policy.test.mjs`、`lib/session-policy.test.mjs` 保持通过，并新增断言证明这些分支没有被默认加载 permission 扩展）；创建与运行授权门时，在临时 HOME／agentDir 下除指定 agentDir 与项目内策略文件外不读写其他位置（对比运行前后文件列表），不读取真实用户 `~/.pi/agent` 的 permission 配置，不更改当前开发会话或系统权限；若有效配置里 `yoloMode` 为 true，产品行为必须明确（2026-10-22 用户已决定：视为不可用并阻断，状态显示原因，待 Auto 模式规划后再放开），行为与理由写入 `docs/pilaude-pi-extensions.md` 并有测试。验证：`node --experimental-strip-types --test lib/rpc-manager*.test.mjs lib/builtin-permission-extension.test.mjs` 等相关测试通过。
- [ ] A5 依赖、打包与许可：`package.json` 精确固定 41.0.0，`package-lock.json` 解出的 `web-tree-sitter`、`tree-sitter-bash`、`zod` 版本记录在日志（旧会话为 0.26.13、0.25.1、4.6.7）；安装全程 `--ignore-scripts`，`tree-sitter-bash` 的 `node-gyp-build` 钩子未被执行；桌面 staging 清单包含官方两个 WASM 与各自 LICENSE，`THIRD_PARTY_NOTICES.md` 含该包及运行依赖的真实 MIT 文本与版权行（只写安装包里实际存在的文字，缺失处如实标注，不凭 manifest 编造）。验证：`node --test scripts/stage-package.test.mjs scripts/web-package-layout.test.mjs scripts/release-workflows.test.mjs scripts/fork-ownership.test.mjs` 通过且新增了对应断言；不运行 `next build`。
- [ ] A6 收尾：A1–A5 涉及的测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0030` 通过，guard 无未豁免阻断项；备份分支里与本卡无关的 hunk（Web、Plan、Powerline、Background tasks、child 生命周期）没有进入本分支；`lib/rpc-manager*.test.mjs` 用例数不少于迁入前。

## 范围外

公开审批服务、入口覆盖清单、`!bash` 与 PowerShell 路由和设置页说明（PIL-0203）；子代理、child 会话的授权上限与父子传播（PIL-0202）；定时任务的授权设置与隐藏窗口审批流程（PIL-0060，本卡只保证无人值守时不执行也不挂起）；决定卡与提问卡的视觉复刻（PIL-0120）；计划审阅的批准不授予工具权限（PIL-0073）；Auto 与 Bypass 模式；扩展内部直接进程或网络（信任边界，不由本门拦截）。

## 实现提示

- 先读 AGENTS.md 的 Hard rules、`docs/agents/tools.md`、`docs/agents/mcp-runtime.md`、`docs/agents/fork-tools-subagents.md` 与 `D:/pilaude/relay-evidence/PIL-0001/recovery-permissions/handoff.md`。
- 迁移：`lib/builtin-permission-extension.ts`/`.test.mjs` 取 `source/` 下字节（与 working 快照一致，新文件无需合并）；rpc-manager 与其测试按差异手工迁入 permission 相关的 import 与一行注册，保持排在只读 MCP 策略之后。
- 必须复用官方包（用户已定的产品落地规则：真实接入，不用相似能力代替）。对接方式在实现者日志里先写明：普通会话以官方 `tool_call` 门为准；不得复制或改写规则引擎，不得改包源码。
- 依赖安装：任务改了 `package.json` 时先删 worktree 里的 `node_modules` junction，再在 worktree 里 `npm ci`（安装时 `--ignore-scripts`）。本卡的 package/lock 改动与其他扩展卡共享，合入冲突由后合入者解。
- 冲突风险：`lib/rpc-manager.ts` 是高风险共享文件，本卡改动保持在 import 与注册各一处。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
- 2026-10-19T14:21Z · codex:gpt:coord · 做了：恢复原权限owner上下文并收只读迁移材料，D:/pilaude/relay-evidence/PIL-0001/recovery-permissions/handoff.md及manifest.json含六条原字节/source映射，均与working23329458一致，共享RPC两条与既有Plan owner快照一致；本轮无源码或index改动。状态：最后initial-health单hunk确有独立CLEAN，普通coding permission唯一注册已接，位于read-only MCP policy后，因此本卡背景未接线说明已过时；这不是本卡实际执行前授权验收通过。下一步：暂停，PIL-0001完成且用户恢复工作后再按任务worktree迁入精确权限hunks，优先真实normal操作计数及未覆盖入口默认拒绝，再独立验证。风险：!bash直executeBash、PowerShell原生AST、child权限上限/parent absent、真实MCP和scheduled同门、审批重放仍未覆盖；不把旧6/9/定向证据拼成完整AC通过。
- 2026-10-22T00:00Z · claude:sonnet-high:planner · 做了：核对主线（无授权门、无依赖）与备份，重写验收为授权门本体 A1–A6；拆出 PIL-0202（child）与 PIL-0203（公开审批服务与覆盖清单）；写入默认策略表。状态：未冻结（acceptance_sha 已清空，原冻结文本作废，需协调者重新 freeze，范围收窄与默认策略表需用户确认）。下一步：协调者审阅后 freeze；PIL-0188/0193/0179/0182/0120 依赖 PIL-0203，PIL-0050 依赖 PIL-0202。风险：官方包默认 ask 与默认策略表的衔接方式（包配置或宿主层）需实现者先在日志写明。
- 2026-10-22T03:35Z · planner · 冻结验收标准 d45dc5cf7fcd
- 2026-10-22T09:54Z · codex-plus:sol-xhigh:impl · 领取，租约至 2026-10-22T12:54Z
