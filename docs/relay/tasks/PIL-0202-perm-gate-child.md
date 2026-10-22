---
id: PIL-0202
title: 子代理与 child 会话的授权上限与撤权
epic: E4
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0030, PIL-0203]
files_allowed: [lib/subagent-lifecycle*, lib/permission-child*, e2e/permission-child-lifecycle-compat.mjs]
files_shared: [lib/subagent-runtime.ts, lib/rpc-manager*, lib/extension-ui-queue*, lib/permission-coverage*, lib/i18n/messages/*.ts, docs/pilaude-pi-extensions.md, scripts/fork-ownership.json]
acceptance_sha: 52aca02d1f23
waivers: []
---

## 目标

子代理（child 会话）发起的每个工具调用都经过与父会话同一个授权门，且权限永远不超过父会话：父会话拒绝的，child 不能做；父会话撤权、停止或不在时，child 的待批与后续调用都不执行。对应 [GOALS E4 与 E6](../GOALS.md) 中“父子之间不能提权”。

## 背景与现状

审计日期 2026-10-22。

- 主线没有 child 生命周期桥，也没有任何 child 授权：`lib/subagent-runtime.ts`（约第 243 行起）用 `createAgentSessionServices` 自己建 child 会话，`resourceLoaderOptions` 里 `noExtensions: !profile.loadExtensions`，只在精确提示词时注入 `exactSystemPromptExtension`，**不加载 builtins，也不加载 permission 扩展**；profile 关掉扩展时 child 工具完全没有授权门。
- 备份 `wip/pre-relay-2026-10-19` 已有生命周期桥：`lib/subagent-lifecycle.ts`（53 行，`created` 在 bind 前同步公告、`bound` 在 bind 成功后、`disposed` 在真实销毁时，只公告、不授予权限）与测试 6 例；`lib/rpc-manager.ts` 中显式创建 SDK `createEventBus()` 传给 resource loader 与 wrapper（`extensionEvents`）、`attachParentLifecycle`、`retireChildLifecycle`（同 ID 替换时旧 disposed 先于新 created）、`registerRpcWrapper` 读取 `pi-web:subagent` metadata 关联仍存活的父 wrapper；`lib/subagent-runtime.ts` 传 wrapper 并在 prompt 前等待 ready；`e2e/permission-child-lifecycle-compat.mjs`（236 行）固定官方包 integrity 后用真实 SDK 事件总线与官方 subscriber／registry／dialog／gate 四组件验证 9 项。逐文件字节与哈希在 `D:/pilaude/relay-evidence/PIL-0001/recovery-permissions/`。`lib/subagent-lifecycle.ts` 与 `lib/subagent-runtime.ts` 相对基线的 hunk 可与主线干净三方合并（试合并 0 冲突），`lib/rpc-manager.ts` 有 2 处冲突，需手工迁入。
- 旧证据的真实含义（旧基线、局部）：生命周期 6/6，child 契约 9/9（含 pending／No／Cancel／Stop 无新增执行、Yes 一次、siblings 不串、父 unsubscribe 后 child 清理 registry），但**不是**完整 factory 的转发 IO、父权限上限或 child 无插件时的强制 gate。旧会话明确未覆盖：child 缺默认强制 gate（`loadExtensions:false`）、父不在内存时 reopen 不公告且无上限、父子上限与撤权传播、profile 身份到官方 `<active_agent>` 标签的适配。
- 官方协议：`subagents:child:session-created/bound/disposed` 公告父 bus 上的事实，安装的包自己关联父节点并转发审批；公告本身不授予权限。该 e2e 运行依赖固定 tarball：脚本要求 `published.tgz` 位于 `--permission-dir` 上两级目录并核对 integrity（`sha512-BJHn…ftA==`），审计时原 tarball 仍在主 checkout 的 `test-results/pilaude/extension-research-wdgn8ksx/pi-permission-system/published.tgz`（被忽略的本机目录，实现者应把它复制到自己 worktree 的 `test-results/` 下使用，不要依赖主 checkout 路径）；若已不存在，从 npm 取回 41.0.0 并核对 integrity，取不到则暂停并请协调者决定。
- 依赖：PIL-0030 的授权门与默认策略；PIL-0203 的审批服务与入口覆盖清单（本卡完成后把“子代理 child 会话”登记为 `gated`）。多代理的并行上限、深度上限与重启中断标记属于 PIL-0050。

## 验收标准

- [ ] A1 child 一律有授权门：无论 profile 的 `loadExtensions` 取值与是否使用精确提示词，通过 `lib/subagent-runtime.ts` 创建的 child 会话在工具调用前都经过官方 permission 门；门不可用（factory／parser／service 失败）时 child 的所有工具被阻断，计数为 0。验证：`node --experimental-strip-types --test lib/permission-child.integration.test.mjs`（新增）经真实父会话创建 child，用文件系统标记与计数型工具做执行 spy，覆盖 `loadExtensions:true`、`false`、精确提示词三种 profile。
- [ ] A2 父会话上限与不能提权：child 的有效决定取自己策略与父会话策略中更严的一方。父会话对某操作为 deny 或 ask 时，child 即使自身策略为 allow 也不能直接执行；child 在会话内选择“Yes for this session”产生的 grant 不扩大父会话的 grant，也不泄漏给兄弟 child；父会话不在 live registry 中（child 被单独 reopen）时，child 的需批准操作被拒绝（`unavailable`），不尝试自动重开父会话。验证：同一测试文件对应用例，计数分别为 0；兄弟隔离用例两个 child 的 grant 互不可见。
- [ ] A3 审批转发、归因与撤权传播：child 发起的待批请求出现在父会话的审批界面，并标明 child 会话 ID 与 profile 名；批准恰好执行一次；父会话 Stop、父会话被销毁、磁盘策略撤权、`revoke` 任一发生时，该父会话下所有 child 的待批请求被取消，迟到的回复被拒绝，计数保持不变，且 `permission-service` 的拒绝原因可区分。验证：`node --experimental-strip-types --test lib/permission-child.integration.test.mjs` 的转发、Stop、撤权、迟到回复四个用例；一个用例同时挂着两个 child 的待批请求，Stop 后两者都未执行。
- [ ] A4 生命周期桥迁入且行为不变：`node --experimental-strip-types --test lib/subagent-lifecycle.test.mjs` 通过且不少于 6 个用例（创建、成功绑定、绑定失败不发 bound、复用与重开、同 ID 世代 fence、父关闭后 child 清理）；`node e2e/permission-child-lifecycle-compat.mjs --permission-dir <固定包目录>` 通过且 9 项检查全部为通过，报告的 `prohibitedAttempts` 为空；`lib/rpc-manager*.test.mjs` 与 `lib/subagent-runtime.test.mjs` 保持通过，其中新增的显式事件总线断言存在。证据注明“夹具＋真实 SDK 总线”，tarball 取回方式与 integrity 核对结果写入日志。
- [ ] A5 登记与收尾：完成后把入口覆盖清单（PIL-0203）里“子代理 child 会话”改为 `gated` 并有对应测试名；本卡不改变并行、深度与重启语义（`lib/subagent*.test.mjs` 保持通过，用例数不少于改动前）。最终执行并记录：上述全部测试、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0202`，guard 无未豁免阻断项。

## 范围外

并行上限、深度上限、父子取消传播的任务调度语义、重启后中断标记（PIL-0050）；side chat 的独立会话授权（PIL-0179，它复用本卡的上限机制）；官方 `<active_agent>` 标签与 profile 专属策略的适配（本卡只要求 profile 名用于归因展示）；官方包的接入与默认策略表（PIL-0030）；审批服务本体（PIL-0203）；扩展内部直接进程或网络。

## 实现提示

- 迁移顺序：先落生命周期桥（`lib/subagent-lifecycle.ts`/测试取 `source/` 下字节，rpc-manager 的事件总线与 wrapper 部分手工迁入），再补 A1–A3 的强制 gate 与上限；A1–A3 都要先看到失败再实现。
- 强制 gate 的思路（可调整）：child 的 `resourceLoaderOptions.extensionFactories` 里始终注入宿主的 permission 守卫，即使 `noExtensions` 为真；上限用父会话的有效策略做上界，不要靠 child 自己的 config。
- 先读 `docs/agents/subagents.md`、`fork-tools-subagents.md`，以及 `handoff.md` 里关于 child 与 parent absent 的缺口说明。
- `lib/rpc-manager.ts` 与 `lib/subagent-runtime.ts` 是共享高风险文件，只做必要 hunk。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-22T00:00Z · claude:sonnet-high:planner · 做了：由 PIL-0030 的 A3（嵌套子代理）与生命周期桥拆出本卡。状态：未冻结。下一步：协调者审阅后 freeze；PIL-0050 的 depends_on 需加入本卡，PIL-0179 评估后可复用本卡的上限机制。风险：固定 tarball 只存在于主 checkout 被忽略的 test-results 目录，丢失后需从 npm 取回并核对 integrity。
- 2026-10-22T03:34Z · planner · 冻结验收标准 52aca02d1f23
