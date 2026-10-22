# Pilaude Pi 扩展：接入现状、兼容证据与边界

核验日期：2026-10-18。基线为锁定的 `@earendil-works/pi-agent-core`、`pi-ai`、`pi-coding-agent`、`pi-tui` **1.3.0**，见 [package-lock.json](../package-lock.json)。本文记录八个指定包的真实来源、产品消费点和验证范围，不表示八个扩展已经全部安装或完成桌面集成。

本轮交付是 **四个固定版本的可选来源入口、两项已有桌面能力的说明、两项不兼容说明，以及三组隔离兼容检查**。没有向真实用户的全局或项目设置安装这些包，没有运行安装脚本、扩展真实 HTTP 服务、外部账号、模型请求或扩展完整 GUI 流程；候选包未加入产品依赖或桌面打包资源。下载的源码先作为数据检查，只在明确审查、固定摘要和受控依赖的测试范围内执行。[目录源码](../lib/recommended-pi-extensions.ts)和[三组证据](#兼容检查与可复现边界)分别说明这些结论。

## 当前产品消费链

[recommended-pi-extensions.ts](../lib/recommended-pi-extensions.ts) 保存八项元数据和分类，仅四个 `extension` 条目具有固定 `npm:<包名>@<版本>` 来源。[RecommendedPiExtensions.tsx](../components/RecommendedPiExtensions.tsx) 的“使用此版本”只调用 `onSelectSource`，由 [PluginsConfig.tsx](../components/PluginsConfig.tsx) 填入现有安装表单。用户另行提交安装时，才经过 `POST /api/plugins`、项目路径／信任检查及 SDK `DefaultPackageManager.installAndPersist()`；选择来源不等于已经安装、启用或加载。

实际目录检查 `extension-catalogue/run-1792332119485/` 已通过真实 Settings → Plugins → Add plugin 入口、八项分类／四个固定版本按钮、选择来源不发安装请求，以及明确内存 409 夹具下的原安装请求与错误提示。390px 检查证明目录 DOM 可达且无横向溢出；截图位于表单顶部，不声称所有卡片同时处于手机视口。pageErrors、blockedWrites 和未知 console 为空，预期 `/api/plugins` 409 错误单独记录。所有接口均为生成夹具，未安装任何扩展。

安装后可复用的宿主链为 Pi resource loader → extension factory → [rpc-manager.ts](../lib/rpc-manager.ts) 的 `bindExtensions({ mode: "rpc", uiContext })`。当前桥支持 `select`、`confirm`、`input`、`editor`、通知、status、widget 字符串／factory，以及 custom UI 的文本渲染和输入；[ChatWindow.tsx](../components/ChatWindow.tsx) 消费 widget／status／阻塞请求，[ExtensionWidgets.tsx](../components/ExtensionWidgets.tsx) 显示 ANSI 文本。`setFooter`、`setHeader`、`setEditorComponent` 仍为 no-op，不能把 TUI 接口存在当成桌面功能可用。

## 八项逐项结论与来源

下列版本来自对应的固定版本 npm 元数据，而非包名推测。peer 范围包含 1.3.0 只证明声明相容，运行证据以随后列出的具体检查为限。许可证“声明”与实际读到的 LICENSE 文本分别列明。

| 包与核验版本 | 一手来源与许可 | 当前分类、实际 consumer 和缺口 |
| --- | --- | --- |
| `@juicesharp/rpiv-todo@2.13.9` | [npm 固定元数据](https://registry.npmjs.org/@juicesharp%2Frpiv-todo/2.13.9)；[官方源码](https://github.com/juicesharp/rpiv-mono/tree/54df50eea935fc9753edc300d5f23c5e28d906d7/packages/rpiv-todo)。实际 MIT LICENSE。SDK peers 为 `*`。 | **可选来源** `npm:@juicesharp/rpiv-todo@2.13.9`。真实 SDK loader、会话持久化和现有桌面 widget／notify 桥已通过 9 项检查。未安装／打包；尚未验证完整 AgentSession、真实 Code mode 调度及浏览器展示。 |
| `pi-web-access@0.42.0` | [npm 固定元数据](https://registry.npmjs.org/pi-web-access/0.42.0)；[官方源码](https://github.com/nicobailon/pi-web-access/tree/18e36f9e0fc2de3c9895a7fda8d39a62ce60f49e)。实际 MIT LICENSE。SDK peers 为 `*`，开发依赖为 1.0.4。 | **可选来源** `npm:pi-web-access@0.42.0`。真实源码 factory／工具 core 在显式注入依赖下有契约证据。发布 `dist`、真实 provider／提取依赖和网络链未运行；受控网络／secret 薄适配尚未接入。 |
| `pi-powerline-footer@0.20.2` | [npm 固定元数据](https://registry.npmjs.org/pi-powerline-footer/0.20.2)；[官方源码](https://github.com/nicobailon/pi-powerline-footer/tree/e06267494593c9006b014f42706a8d9e9259a417)。manifest 声明 MIT，发布包及核查的固定 commit 无 LICENSE 文件；2026-10-22 用户决定随安装包打包，THIRD_PARTY_NOTICES.md 依据 manifest 声明附标准 MIT 文本。SDK peers `>=0.81.0`。 | **不兼容／需桌面适配**，目录没有安装选择按钮。核心 footer／editor hook 为 no-op；整包还包含输入拦截、队列、压缩协调、sticky Bash、切换 cwd 和可选模型行为。已有状态条不是该包的 consumer。 |
| `@gotgenes/pi-permission-system@41.0.0` | [npm 固定元数据](https://registry.npmjs.org/@gotgenes%2Fpi-permission-system/41.0.0)；[官方仓库目录](https://github.com/gotgenes/pi-packages/tree/main/packages/pi-permission-system)。实际 MIT LICENSE，SDK peers `>=1.0.0`。npm 未提供 gitHead，精确审查对象是固定 tarball／integrity，仓库 main 链接不代表发布 revision。 | **可选来源** `npm:@gotgenes/pi-permission-system@41.0.0`。确定性 gate／RPC prompt 组件有隔离证据；完整 factory、配置、parser／WASM 未运行，尚未成为 Pilaude 的统一执行授权层。没有新增 Auto、Bypass 或 OS sandbox。 |
| `pi-subagents@0.79.1` | [npm 固定元数据](https://registry.npmjs.org/pi-subagents/0.79.1)；[官方源码](https://github.com/nicobailon/pi-subagents/tree/95683a4427e1e4af8de03f1a9ca03ec4c2799b73)。元数据声明 MIT；`pi-ai >=0.86.1`，其余 Pi peers 为 `*`。本轮未执行该包。 | **已有桌面能力**。实际执行器是 [subagent-extension.ts](../lib/subagent-extension.ts)、[subagent-runtime.ts](../lib/subagent-runtime.ts) 和 Agents／子会话 UI。未安装第二套执行器；不能因此宣称采用该 npm 包源码或覆盖它的全部工作流。 |
| `@plannotator/pi-extension@0.28.23` | [npm 固定元数据](https://registry.npmjs.org/@plannotator%2Fpi-extension/0.28.23)；[官方仓库目录](https://github.com/backnotprop/plannotator/tree/main/apps/pi-extension)。manifest 声明 `MIT OR Apache-2.0`，SDK peer `>=0.79.1`。精确包摘要见下方证据。 | **可选来源** `npm:@plannotator/pi-extension@0.28.23`。Pi manifest 解析、loader／runner、plan／review 契约和桌面 RPC／shutdown 有 8 项隔离检查。BrowserSession 为测试替身，真实 review HTTP／HTML／浏览器未运行；parse5 和自动批准边界必须保留。 |
| `pi-background-tasks@2.6.10` | [npm 固定元数据](https://registry.npmjs.org/pi-background-tasks/2.6.10)；[官方仓库](https://github.com/ismailsaleekh/pi-background-tasks)。元数据声明 ISC。`pi-coding-agent`／`pi-tui` peers 为 `^0.81.1 \|\| ^0.82.1 \|\| ^0.83.0 \|\| ^0.84.0`，排除 1.3.0。 | **不兼容／需适配**，目录没有安装选择按钮。保留现有终端及 agent 任务能力；这些不是该包已集成的证据。本轮没有执行该包，也没有通过忽略 peer 强装来宣称兼容。 |
| `@narumitw/pi-usage@0.67.0` | [npm 固定元数据](https://registry.npmjs.org/@narumitw%2Fpi-usage/0.67.0)；[官方仓库目录](https://github.com/narumiruna/pi-extensions/tree/main/packages/pi-usage)。元数据声明 MIT，Pi peers 为 `*`。本轮未执行整包。 | **已有桌面能力，局部查询格式适配**。[provider-usage.ts](../lib/provider-usage.ts) 明确署名沿用查询格式且无该扩展运行时依赖；[ProviderUsageSummary.tsx](../components/ProviderUsageSummary.tsx) 是现有 UI consumer。支持范围按 provider 区分，凭据留在后端，未提供计费管理；不是整包采用。 |

## Todo：直接复用的状态与显示接口

固定发布包 `todo.ts` 的 `execute()` 调用纯 reducer，再按 `ctx.sessionManager.getSessionId()` 提交状态；每次实际变更用 `pi.appendEntry("rpiv-todo-state", details)` 写完整快照。`details` 包含 `action`、`params`、`tasks`、`nextId`，任务带 `id`、`subject`、四态 status 及可选描述、依赖、owner、metadata。读取和失败操作不写快照。[官方工具实现](https://github.com/juicesharp/rpiv-mono/blob/54df50eea935fc9753edc300d5f23c5e28d906d7/packages/rpiv-todo/todo.ts)

`state/replay.ts` 遍历当前 `getBranch()`，最后一个有效 custom 快照优先；只有没有 custom 快照时才回退旧 `todo` toolResult。`session_start`、`session_compact`、`session_tree` 重放，shutdown 清理对应 session slot。因此仅从对话 toolResult 读取任务会漏掉 Code mode 等嵌套调用；应保留 custom entry，不另造互相竞争的持久层。当前快照结构检查较浅，若以后增加原生任务面板，需要对历史数据作宿主 schema 校验。[replay](https://github.com/juicesharp/rpiv-mono/blob/54df50eea935fc9753edc300d5f23c5e28d906d7/packages/rpiv-todo/state/replay.ts)、[生命周期](https://github.com/juicesharp/rpiv-mono/blob/54df50eea935fc9753edc300d5f23c5e28d906d7/packages/rpiv-todo/index.ts)

显示使用 `setWidget("rpiv-todos", factory, { placement: "aboveEditor" })`，factory 只需 `render(width)` 和 `tui.requestRender()`，现有桌面桥已经能消费。`/todos` 使用通知显示当前 session 的分组任务。可选 i18n peer 缺失时为英文 fallback；现有桥输出不等同于已经提供原生可编辑任务面板。[overlay](https://github.com/juicesharp/rpiv-mono/blob/54df50eea935fc9753edc300d5f23c5e28d906d7/packages/rpiv-todo/todo-overlay.ts)、[桌面桥](../lib/rpc-manager.ts)、[renderer](../components/ExtensionWidgets.tsx)

## Web：工具可复用，网络与凭据策略尚未接入

包注册 `web_search`、`source_check`、`fetch_content`、`get_search_content`。`web-tool-contract.ts` 定义 content／details／可选 structuredContent，`createWebToolCore(host)` 是可复用接点；当前目录并没有把这些接口接成宿主网络策略。上游用 `web-search-results` custom entries 恢复 session 结果，配合有 TTL 的磁盘／内存缓存；本轮 web 契约测试的 storage 是替身，没有证明真实缓存恢复或跨 session 隔离。[core](https://github.com/nicobailon/pi-web-access/blob/18e36f9e0fc2de3c9895a7fda8d39a62ce60f49e/web-tool-core.ts)、[contract](https://github.com/nicobailon/pi-web-access/blob/18e36f9e0fc2de3c9895a7fda8d39a62ce60f49e/web-tool-contract.ts)、[storage](https://github.com/nicobailon/pi-web-access/blob/18e36f9e0fc2de3c9895a7fda8d39a62ce60f49e/storage.ts)

上游默认阻止私有地址，并对手动跟随的重定向重新检查 URL／DNS；这不是已经验证的连接层 DNS 固定或完整 SSRF 验收。凭据解析支持 `$ENV` 和 `!command`，后者实际执行子进程。另有可选浏览器 cookie、Git／gh clone、本地视频／上传、ffmpeg／yt-dlp、PDF／页面模型处理，以及 curator 本地服务／浏览器。工具调用名不能代表其内部全部操作都是只读。[SSRF](https://github.com/nicobailon/pi-web-access/blob/18e36f9e0fc2de3c9895a7fda8d39a62ce60f49e/ssrf-protection.ts)、[credential-source](https://github.com/nicobailon/pi-web-access/blob/18e36f9e0fc2de3c9895a7fda8d39a62ce60f49e/credential-source.ts)、[配置与行为](https://github.com/nicobailon/pi-web-access/blob/18e36f9e0fc2de3c9895a7fda8d39a62ce60f49e/README.md)

若推进受控 web 集成，具体接点是宿主 `WebToolCoreHost`／配置与统一执行 gate：限制 tools／providers，采用 `workflow: none`，显式约束 clone、cookies、hosted providers、local media、answer／summary 模型、自动开浏览器和凭据命令。`workflow: none` 只跳过 curator／额外摘要流程，不能保证 provider 本身不使用模型；`includeContent` 等路径还可能发送 `triggerTurn: true` 消息。网页内容始终作为不可信数据，不得进入审批授权来源；上游的 untrusted 标签是提示层，不能替代执行限制。上述 host 限制和真实 provider 验证本轮尚未实现。

## Permission：确定性规则与统一执行授权的距离

这是 `allow | ask | deny` 规则系统，含 Bash AST、路径／越界／per-tool 层、MCP 名称分类、fail-closed 边界，以及 `getPermissionsService(sessionId)`、`checkPermission()`、自定义 access extractor／authorizer 接口。RPC 模式走 `select`／`input`；只有 TUI 分支使用包含 `terminal.write` 的 custom 组件。因此可以复用现有 RPC 请求接口，但不能据此推断完整 extension composition 已兼容。[发布包元数据与固定源码入口](https://registry.npmjs.org/@gotgenes%2Fpi-permission-system/41.0.0)、[官方文档](https://github.com/gotgenes/pi-packages/tree/main/packages/pi-permission-system/docs)

已核查的完整入口注册 `tool_call`，没有 `user_bash` handler。锁定 SDK 提供独立的两类事件；[rpc-manager.ts](../lib/rpc-manager.ts) 的直接 `bash` 命令调用 `executeBash()`。扩展内部自行启动的网络／子进程也不会自动拆成受 gate 检查的操作。Bash parser 的存在不证明 PowerShell 语义已被覆盖。`yoloMode` 是 ask→allow 改写，不是模型判断的 Auto，也不能改变宿主或当前开发会话的权限设置。

子代理需显式遵守该包的 `subagents:child:session-created`／`disposed` 协议，前者必须在 bind 前同步发出；[subagent-runtime.ts](../lib/subagent-runtime.ts) 目前没有这条协议，且 profile 可以关闭 extension 加载。父会话安装插件不能证明所有子会话有 gate。Scheduled runner 当前在阻塞 UI 时标记 attention，并由任务总超时中止；这不等于无人值守审批策略已实现。[上游子代理协议](https://github.com/gotgenes/pi-packages/blob/main/packages/pi-permission-system/docs/subagent-integration.md)、[任务 runner](../lib/scheduled-tasks/runner.ts)

Pilaude 的[统一执行授权计划](superpowers/plans/2026-10-16-pilaude.md)要求 project／session／task／tool-call、operation、canonical targets、参数摘要和 policy version，以及 `consumeApproval(id, requestDigest)` 一次性消费。当前没有用此包实现这些 host 接口。下一实现切片应接通真实 direct／nested／MCP／shell 入口、child lifecycle 和 scheduled ask 策略，再用执行 spy 证明 deny／pending／取消／撤权／摘要变更／审批重放时执行计数为零；现有 17 项检查没有证明这些覆盖关系。

## Plannotator：计划审阅不等于工具授权

可复用的发布包入口是 `pi.extensions: ["./"]` → `index.ts`，包括计划提交工具、slash review、事件 request／respond、custom entries 和反馈消息。目录已接可选固定来源，尚未把真实 review 服务、浏览器资源与桌面生命周期接成验收过的运行路径。上游 `followUp` 消息在真实 session 中可能启动或排队后续模型 turn；测试只捕获消息，没有启动模型。[官方源码目录](https://github.com/backnotprop/plannotator/tree/main/apps/pi-extension)、[契约脚本](../e2e/plannotator-compat.mjs)

两个必须明确的上游边界：

- `parse5: ^7.3.0` 是发布包声明依赖。本地检查时没有该依赖，未走到的 todo HTML helper 使用一调用即抛错的替身；因此测试通过不表示安装后可缺少 parse5，完整依赖闭包和打包仍需验证。
- 计划提交在 `!ctx.hasUI || !planBrowserHtmlAvailable()` 时会自动返回批准，并进入执行阶段或 external handoff。该条件已在审查源码确认，未被本轮改变。计划审批不能授予宿主工具权限；无人值守／缺资源时若要求必须人工审阅，需要独立阻断这个 fallback，不能将其显示成用户已批准。

来源为该固定发布包的 `package.json`／`index.ts` 和 [8 项证据](../test-results/pilaude/plannotator-contract-6WQeva/result.json)。tool-plan review 的决策回到原 session、shutdown 抑制迟到结果已有证据；event API review 故意跨 shutdown 保留，review／annotate 在 session replacement 后仍有 process-wide current-session 路由风险。只证明计划决策路由，未证明所有 annotation／review 生命周期。

## 兼容检查与可复现边界

以下 JSON 是本地 ignored 运行产物，不是公开 checkout 自带的测试数据；文档只引用仓库相对路径，不复制机器目录、账号或图像。对应 `e2e` 脚本已跟踪，可显式传入经审查的固定版本源码重跑；脚本不自动安装或下载候选包。三组结果各有不同依赖注入范围，不能合并成“34 项端到端集成测试”。

### Todo：9 项通过

脚本：[e2e/rpiv-todo-compat.mjs](../e2e/rpiv-todo-compat.mjs)。证据：[extension-research-wdgn8ksx/todo-compat.json](../test-results/pilaude/extension-research-wdgn8ksx/todo-compat.json)。

真实部分为 SDK 1.3.0 `loadExtensions`、`SessionManager`、当前 `AgentSessionWrapper` 和 widget／notify 桥。审过的 todo／config 复制到临时目录，用独立 child、Node 文件权限、隔离 HOME／USERPROFILE／XDG／agentDir 和禁用网络入口运行；工具由测试直接调用，没有完整 AgentSession 或模型。结果 `prohibitedAttempts: []`。

1. 真实 loader 注册 `todo`／`todos`，真实桌面 widget factory 产出 `aboveEditor` 文本。
2. `requestRender` 刷新有效；读取和失败变更不追加快照。
3. 模拟嵌套调用形状、没有 toolResult 时仍写 custom entry；真实 compaction entry 后能恢复。未运行真实 Code mode 调度。
4. 两个 fresh loader／session 的 task id、快照和可见 widget 隔离。
5. 磁盘 JSONL 重新打开、重新加载扩展后恢复任务和 widget。
6. 真实 `createBranchedSession` 只复制选定历史；fork 与父任务互不污染；`session_tree` 恢复回退分支。
7. completed 下一 turn 隐藏，重放恢复显示；delete 隐藏 widget 并保留 tombstone。
8. 实际 `/todos` handler 经桌面 notify wire 显示当前会话任务。
9. headless session 保留任务状态且不创建 widget。

### Permission／Web：17 项通过

脚本：[e2e/pi-optional-tools-compat.mjs](../e2e/pi-optional-tools-compat.mjs)。证据：[optional-tools-STF6ou/result.json](../test-results/pilaude/optional-tools-STF6ou/result.json)。

Permission 执行真实 evaluate／applyPermissionGate／prompt／fail-closed 组件，经 fixture factory 连接 SDK 1.3.0 registration／Runner；**完整 `src/index.ts` 只静态检查和校验，没有执行 factory**。Web 执行真实源码 `index.ts` factory 和 core callbacks，provider、提取、storage、p-limit 等依赖显式替换；没有加载发布 `dist`。RPC 使用从当前 wrapper 原样提取的请求／响应方法，不是整个 wrapper、HTTP／SSE、React 或真实 Stop 按钮。结果 `blockedAttempts: []`，真实命令执行为零。

1. Permission allow 增加 fixture counter；deny 不执行且不提问。
2. RPC ask：Yes 返回允许。
3. RPC ask：No 返回拒绝。
4. RPC ask：cancel 返回拒绝。
5. RPC ask：Yes, for this session 返回对应决策范围；未验证 SessionRules 持久化或后续复用。
6. 拒绝理由经 select→input 返回，fixture 不执行。
7. 输入拒绝理由时注入 Stop／abort，也不执行。
8. 注入真实 DenyingAuthorizer 时，headless ask 不创建 UI、不执行；未验证 scheduler 实际 authority 选择。
9. 真实 AnswerWindow 超时拒绝并清理请求；未验证可见倒计时。
10. Stop／abort rejection 经 fail-closed 边界阻断，fixture 执行计数为零。
11. 静态注册面确认 `user_bash` 不在 tool_call 覆盖中。
12. Web 真实源码 factory 经 Pi 1.3.0 注册四个 TypeBox 工具。
13. search execute 返回 fixture 来源链接、structured content 和 journal 数据。
14. fetch execute 保存完整 fixture 内容，并报告输出截断。
15. `source_check` 收集 fixture 引用；不证明语义事实核查正确。
16. 缺失／无效输入及 provider／fetch 错误返回工具错误。
17. 预先 abort 的 search／fetch 不调用 fixture provider 或提取器。

未验证 Permission 完整配置加载、policy manager、zod、tree-sitter／WASM、实际 Bash／PowerShell；未验证 Web 真实 provider、凭据／cookies、SSRF／DNS／HTTP、Git／gh、媒体、curator、摘要／回答模型。存储和 session grant 的真实持久化也不在这组证据内，不能称为开箱即用或统一权限通过。

### Plannotator：8 项通过

脚本：[e2e/plannotator-compat.mjs](../e2e/plannotator-compat.mjs)。证据：[plannotator-contract-6WQeva/result.json](../test-results/pilaude/plannotator-contract-6WQeva/result.json)。

真实部分为 `DefaultPackageManager` 的离线 manifest 解析、in-memory settings／SessionManager、Pi loader／event bus／Runner，以及当前桌面 RPC UI／shutdown。BrowserSession 启动／决策／停止、消息投递 sink 和 model registry 为替身；TS 在内存剥除并通过 allowlist 链接。结果记录模型、网络、服务、浏览器、安装、生命周期脚本和真实账号活动均为零。

1. 既有 Plugins resolver 离线消费上游 `pi.extensions` manifest，识别固定 npm source；没有执行安装。
2. 事件 request／respond 返回 pending reviewId，收到 decision，持久记录 completed 状态。
3. 真实 SDK 注册与 RPC 模式暴露 review 命令和 plan tool。
4. plan tool 返回 pending，修订复用同一个 review，批准消息回到发起 session。
5. 实际 RPC response 只解析原 wrapper 的请求，其他 session 不接收。
6. 拒绝计划产生修订反馈，并保持 planning。
7. local code-review 命令复用上游参数解析并投递反馈；review 服务／界面为替身。
8. shutdown 关闭待定 tool-plan review、移除 registry entry，并抑制迟到 decision。

未运行真实 review HTTP routes、bundled HTML 渲染、浏览器回调、桌面 HTTP／SSE／React、真实 AgentSession 模型循环或插件安装设置持久化。Annotation／last-message starters 注入但未覆盖，parse5 未运行；event API 与 tool-plan 的 shutdown 语义不同。其 plan 批准结果也没有验证宿主执行授权。

## 安装、数据根和后续实现的具体门槛

**安装脚本没有被现有管线自动禁止。** 锁定 SDK `DefaultPackageManager.getNpmInstallArgs()` 的 npm 分支使用 `install … --prefix … --legacy-peer-deps`，没有 `--ignore-scripts`。[Plugins route](../app/api/plugins/route.ts) 没有另加脚本抑制。todo／config 的审查版本没有 install 生命周期脚本，但不能推广到所有传递依赖或未来版本；固定顶层包也不会固定其依赖范围。实际安装前应在受控安装执行层限定脚本和依赖闭包，不能把本轮“未运行 scripts”解释成产品已实现无脚本安装。

**agentDir 不是所有扩展的数据边界。** `rpiv-config@2.13.9` 明确以 `XDG_CONFIG_HOME` 读取配置并在缺失时回退 `~/.config/rpiv-todo/config.json`，不使用 `PI_CODING_AGENT_DIR`；审查包的 todo 依赖是 `^2.13.9`。测试同时隔离 HOME／USERPROFILE／XDG／agentDir，不触真实设置。生产 Pilaude 只隔离 agentDir 的现状不能被写成第三方配置也全部隔离。[配置来源](https://registry.npmjs.org/@juicesharp%2Frpiv-config/2.13.9)、[本地数据设计](pilaude-data.md)

**本轮可交付范围已经落地，剩余门槛具体如下。** 四项可选来源由现有 Plugins 表单消费，三组 opt-in 检查可重跑；没有新增安全包装器、自动全局安装或四包预装。若推进实际安装／发布，需先验证禁脚本安装与依赖解析、XDG／HOME 路径边界及打包闭包，再逐包验证：todo 完整会话／Code mode／可见 widget；web 受控网络／secret 与真实 provider；permission 所有实际执行入口和一次性审批；Plannotator 真实服务／浏览器／parse5、session replacement 及禁止自动批准的产品策略。Footer 需先解决宿主接口与许可文本，background 包需先解决排除 1.3.0 的 peer／API 兼容；这些项目当前仍没有兼容安装入口。

公开报告不附研究源码、私有截图或本机绝对路径。npm／官方仓库是来源，tracked `e2e` 是可复现检查入口，本地 ignored JSON 是本轮运行证据；三者的作用不能互相替代。
