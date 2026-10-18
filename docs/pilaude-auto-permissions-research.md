# Pilaude Auto 权限研究：保留 Pi 的 provider-neutral / BYOK 架构

研究日期：**2026-10-18（UTC+08:00）**。本地基线：`D:/pilaude/pi-agent-desktop`，实际安装的 `@earendil-works/pi-coding-agent` 为 **1.3.0**。

范围：研究官方公开设计、当前权限文档、可复用开源实现与产品现有接点。本文是设计建议，不是功能实现或启用记录。研究阶段只新增本文，没有运行模型、安装候选扩展、运行第三方脚本或修改产品权限/UI。报告随本轮已验证代码一并保存；仓库的并行界面改动不属于本研究的实现结论。

## 1. 结论与证据边界

**“Pi 1.3.0 没有内建 Claude Code 式 Auto 权限模式”成立；“Pi 无法实现 Auto”不成立。** Pi 提供执行前的 `tool_call` hook、可阻断结果、嵌套调用覆盖、确认 UI 与 provider-neutral 模型入口。Pilaude 可以保留 Pi，用宿主拥有的统一 gate 实现自己的 Auto；不能把 Claude Code 的模式名、开源示例或当前研究会话的权限设置当作已有能力。

关键判断：

- Anthropic 官方公开的是 **工程技术说明、产品行为/配置文档和可查看的默认自然语言规则**。核查的官方资料没有发布可作为 MIT 组件嵌入的完整 Auto 引擎、分类器模型权重或训练集。公开 GitHub 仓库也不等于核心产品开源。[O1][O2][O3][O4][O6]
- Pi 已有工具拦截基础，但产品目前只有项目资源信任、工具预设、只读 MCP 防误用策略及通用 extension UI 确认通道；没有统一 Auto 决策器。[L1–L8]
- 三个候选 Pi 扩展确实公开了实际 gate 代码且有 MIT 许可证。不过它们的工具覆盖、规则优先级、失败处理和 SDK 适配各不相同，**没有一个经本研究证明可原样安装后满足 Pilaude 的完整权限要求**。[S1–S3]
- 推荐采用“宿主策略层 + Pi hook + 现有确认通道 + 可选 BYOK judge”。先覆盖所有执行路径，再通过评测决定分类器、单阶段/两阶段、预算与阈值。费用、延迟、误放行和误拦截都需要本产品实测。

本文中的“已验证”指阅读指定原文、许可证和实际代码得到的静态证据；不表示运行过候选项目，也不表示做过对抗测试。外部代码使用固定 commit 链接，官方在线文档记录访问日期，本地行号对应研究时的工作区。

## 2. 官方 Auto：公开了什么

### 2.1 技术说明、可查看规则、开源源码与权重应分开

官方工程文章标题为 **How we built Claude Code auto mode: a safer way to skip permissions**，发布日期是 **2026-03-25**，作者 John Hughes。[O1]

| 内容 | 原文可验证的公开状态 | 对 Pilaude 的意义 |
| --- | --- | --- |
| 架构与实验 | 公开说明两层防御、两阶段分类、意图判定、子代理交接和拒绝处理 | 可参考设计和评测方法 |
| 默认策略与配置 | 文档说明 `claude auto-mode defaults/config` 可查看默认/生效规则；提供 environment、hard_deny、soft_deny、allow 配置 | 可理解策略组织；不等于得到完整分类器实现或复制许可 |
| 完整 Auto 执行引擎、完整固定模板 | 文章描述固定模板及其作用，未在文章中发布完整实现；不能从配置列表推断获得整个模板 | 不应宣称“接入官方开源 Auto” |
| 分类器权重、训练集 | 所核查官方资料没有发布权重下载、训练集或可复现训练流程 | 无法在 Pi 中加载一个所谓“官方 Auto 权重” |
| `anthropics/claude-code` 仓库 | README 包含安装、反馈和 plugins 等；根许可证为保留所有权利、受商业条款约束 | GitHub 可见不代表核心引擎为 MIT/Apache 开源；单独插件须逐项看许可 |

没有读取或采用所谓泄露、反编译闭源 Claude Code 核心源码；没有批量复制第三方 classifier prompt 或源码。实现应原创宿主策略与提示词，复用 MIT 代码时保留版权和许可声明。

### 2.2 3 月工程博客的决策链

博客给出两条互补链路：[O1]

1. **输入层**：服务端 prompt-injection probe 检查工具输出；可疑内容附加警告后进入主 agent。它是检测/提示机制，不能等同于输出执行 gate。
2. **输出层**：transcript classifier 在动作执行前判断危险性与用户授权。文章当时使用 **Sonnet 4.6**。先用快速单 token 是/否筛查；被标记的动作再用带推理的第二阶段复核，以减少误拦截。
3. 进入分类器前先做常规放行：内建安全工具和窄用户 allow；项目内写入/编辑；其余 shell、网络、外部集成、项目外操作、子代理启动等进入 classifier。进入 Auto 时暂停已知可授予任意代码执行的宽泛 allow，避免它们绕过分类器。
4. classifier 内部按规则识别真实执行效果，检查阻断规则、例外及用户授权；不能只看命令表面或工具说明。

需要保留的设计细节：

- **意图来源**：博客中的 classifier 看用户消息与工具调用的可执行内容；剥离 assistant prose、工具调用 description 和 tool results。agent 自己说“用户已授权”不是授权证据；网页、文件、命令输出也不是用户指令。
- **来源信息代价**：剥离工具结果后，classifier 不知道某个 job ID 是查出来的还是猜出来的。原文明确接受这一信息损失，换取较强的注入隔离；Pilaude 不应假装同时获得完整来源证据。
- **真实副作用**：写入脚本再执行，应检查脚本 payload；构造命令再执行，应检查最终动作。`&&` 连接的命令要作为整体动作审查，不能用开头的安全命令给后续危险命令放行。
- **授权粒度**：相关于目标不代表用户批准了具体副作用。博客将模糊的清理分支与远程批量删除区分，也将“can we fix this?”保守地视为问题。这是博客当时的分类规则，不是 Pilaude 必须照搬的交互语义；用户已要求可行时构建 Auto，本报告先完成证据核验；后续实现依既有 Task 4 统一权限架构推进，不能把研究结论写成已启用的产品能力。
- **子代理**：派发时检查任务，子代理内部继续使用同样 gate，回传时检查工作历史并在可疑结果前加警告；回传检查主要是告警，不是撤销已经发生的副作用。
- **拒绝并继续**：博客把拒绝原因作为工具结果交还，要求寻找合法替代、不要换形式绕过；连续 3 次或累计 20 次拒绝转人工。博客描述的 `claude -p` 在此阈值下终止。此处是历史设计，见下节当前差异。

### 2.3 实验数据不能移植为本产品安全保证

博客报告：10,000 个内部真实工具调用、52 个真实越权样本、1,000 个合成外传样本。完整两阶段流程在这些集合上的误拦截率为 0.4%，真实越权误放行率为 17%，合成外传误放行率为 5.7%。第一阶段相应为 8.5%、6.6%、1.8%。[O1]

这些是**原文报告的历史实验结果**，不是 Pilaude 的指标、当前 Claude Code 的统一保证或任意 BYOK 模型的表现。第二阶段降低误拦截，同时增加了部分漏检。原文指出主要漏检之一是把真实存在的早先同意错误扩展到当前危险动作。因此不能以“更少弹窗”代替对授权范围的评测。

## 3. 当前官方权限文档：截至研究日

已读权限原文、permission modes、auto 配置与相关错误说明，而非仅用搜索摘要。[O2–O5] 当前文档有版本、provider、服务端 rollout 条件；以下记录研究日行为，不把 3 月博客当作最新产品手册。

### 3.1 必须区分两种优先级

**工具权限系统**先处理显式规则：`deny → ask → allow`；规则更具体不会倒转这个顺序。匹配 deny 会阻断，匹配显式 ask 会要求人工，Auto classifier 不能自动清除此类要求。普通 `PreToolUse` hook 的 allow 也不能越过这些 deny/ask。[O2]

**classifier 内部**另有自然语言策略：`hard_deny` 无条件阻断；`soft_deny` 可被匹配的 allow 例外或精确用户授权清除。它们不是工具权限系统的 `permissions.deny/ask/allow`，更不是确定性匹配器。需要可靠、持久的禁令应放在宿主强制规则中。[O4]

当前文档还有一个应明确限定的例外：受信任 mods 的 `tool.check` 在部分账户/组织策略下能替代某些普通规则或 hook 结果。因此“deny/ask 不被 classifier 越过”不能扩写成“官方所有可扩展机制永远不能替代任何规则”。Pilaude 的最小设计不提供这种策略覆盖入口。[O2，Precedence among rules, hooks, and mods]

### 3.2 当前执行顺序和强制人工边界

概括原文固定顺序：[O3，How the classifier evaluates actions]

1. 先处理权限规则和特殊边界；显式 deny 阻断、ask 提示、有效窄 allow 放行。
2. 常规只读动作与工作目录内编辑可免 classifier；保护路径、符号链接/项目外解析、网络路径、首次项目外读取等有单独处理。
3. 其余动作交 classifier；需要用户交互的 MCP/connector consent 和 critical-path 删除等不按普通候选动作处理。
4. classifier 拒绝时返回拒绝原因；不把拒绝等同于主 agent 必须立即结束。

重要例外：

- 宽泛 `Bash(*)`、`PowerShell(*)`、通配解释器、package-manager run、Agent/Monitor 等 allow 在 Auto 内暂停；窄规则如 `Bash(npm test)`可保留。当前还提供 `autoMode.classifyAllShell`，可让 shell 全部经过分类。[O3][O4]
- **保护路径不是“项目内编辑全免审”**：Auto 下通常转 classifier；经非保护路径的 symlink 指向保护路径时可转人工；restricted 等条件还有额外约束。[O3，Protected paths]
- critical-path `rm/rmdir` 删除默认不交 classifier：终端 Auto 可有超时人工提示；Desktop、Agent SDK、无终端等场景直接拒绝。allow 或普通 hook allow 无法批准它。PowerShell `Remove-Item`另有检查。[O3，Critical paths]
- 显式 ask、MCP `requiresUserInteraction`、组织强制 consent 保留人工边界；分类器不能替用户完成登录/同意。
- 当前 `permissions` 文档静态匹配复合 shell 的各子命令：任一子命令 deny/ask 必须生效，allow 需覆盖每段。它同时承认不同调用形式、解释器及命令文本匹配的限制；需要 OS 层约束时另用 sandbox。[O2，Bash rules / Bash rule limits]

**批量工具的公开证据边界**：博客明确讲复合命令整体审查，当前文档讲逐动作 gate 与子命令匹配；这些没有证明“一个模型回合的多个独立工具调用具有全有或全无的事务性审批”，也没有给出可复制的完整跨工具 batching 算法。Pilaude 必须自己定义并测试，不能把一句“批量审查”当作取消所有兄弟调用的保证。

### 3.3 用户意图与工具输出：当前已有扩展

当前客户端 classifier 文档说它读取用户消息、非纯读取检索类工具调用及加载的 `CLAUDE.md` 内容；工具结果仍被剥离。另有受信任应用通过 `PostToolUse.classifierContext` 提供上下文，服务端 probe 继续检查主 agent 读到的结果。[O3]

这比博客“用户消息 + 工具调用”多了配置/应用上下文，不能笼统说当前 classifier 绝不接收任何额外上下文。Pilaude 推荐把**真正用户授权、宿主事实、agent/外部内容**分开存储；不要把仓库中的自然语言约定或模型生成的 role=user 文本提升为可放宽权限的真实用户授权。

当前会话口头禁令可因 compaction 丢失；官方因此建议 durable deny/ask。用户同意必须对应具体动作和危险参数，一次批准不会自然变成所有相似动作的长期授权。[O3，Boundaries / Approvals you state in conversation]

### 3.4 当前模型、服务端审核与失败行为

- **历史模型与当前默认不同**：3 月博客是 Sonnet 4.6；研究日的 Cost and latency 原文写客户端 classifier 默认 **Claude Sonnet 5**，服务端配置可优先替代，并有会话模型/availableModels 等回退规则。这既不是固定承诺，也不是本研究建议 Pilaude 采用的默认模型。[O1][O3]
- 当前 Claude Code 在符合条件的连接中可把动作检查放入主模型请求的服务端 review；服务器不支持整会话 review 时可回退客户端独立 classifier；若对某个动作没有有效 verdict，则不执行该动作。该产品服务不能视为通用 Pi/BYOK 权限 API。[O3]
- classifier 超时、网络错误、限流、缺少模型访问权、无效 JSON/无法解析等都不等于 allow。超出 classifier context 时可转人工；无人工通道则该动作不执行。[O5]
- 连续 3 次/累计 20 次**动作拒绝**仍会触发交互模式人工回退；当前文档明确：`-p` 且无 permission-prompt-tool 时，达到此类阈值后该动作不运行，agent 可继续，**不再等同于博客里的进程终止**。独立 API safety safeguard 拒绝 classifier 请求还另有不计入该计数的处理。[O3][O5]
- **服务端持续无 verdict**是另一计数：连续 10 个 response 无 verdict 后停止 turn；headless 报执行错误结束。不能与 3/20 动作拒绝混为一谈。[O5]
- 检查中切换模式会丢弃新模式不应使用的旧 verdict，随后人工确认或按新模式拒绝。这是 Pilaude 需要防止过期批准的案例。[O3]

## 4. 三个确实开源的 Pi 候选

选择标准：可访问的 GitHub 仓库、实际 MIT 许可证文本、可定位的 gate 代码。未安装、未运行其测试/服务；以下“可复用”指源码许可和设计可复用性，**不代表二进制即插即用或安全认证**。MIT 允许商业使用/修改/分发，但复制实质代码需保留版权与许可；依赖也须单独审查。

### 4.1 `nilskluewer/pi-auto-permission-gate`：最接近模型 Auto 的参考

固定 commit：`642430ae0fa06d4c78b15d2a64c884824e415323`；包版本 0.8.0；[仓库与 README](https://github.com/nilskluewer/pi-auto-permission-gate/tree/642430ae0fa06d4c78b15d2a64c884824e415323)、[MIT LICENSE](https://github.com/nilskluewer/pi-auto-permission-gate/blob/642430ae0fa06d4c78b15d2a64c884824e415323/LICENSE)、[package.json](https://github.com/nilskluewer/pi-auto-permission-gate/blob/642430ae0fa06d4c78b15d2a64c884824e415323/package.json)。[S1]

已验证代码：

- [`extensions/permission-gate.ts:2638`](https://github.com/nilskluewer/pi-auto-permission-gate/blob/642430ae0fa06d4c78b15d2a64c884824e415323/extensions/permission-gate.ts#L2638)只检查 `toolName === "bash"`。先 hard deny，再用户 disallow，再其他规则/lockdown/模型路径；无风险规则命中则直接通过。
- [第 1090 行](https://github.com/nilskluewer/pi-auto-permission-gate/blob/642430ae0fa06d4c78b15d2a64c884824e415323/extensions/permission-gate.ts#L1090)从 branch 提取用户消息和过去 Bash 调用，剥离 assistant prose 和 tool results；[第 1219 行](https://github.com/nilskluewer/pi-auto-permission-gate/blob/642430ae0fa06d4c78b15d2a64c884824e415323/extensions/permission-gate.ts#L1219)实现快速/深入阶段与失败重试；[第 1059 行](https://github.com/nilskluewer/pi-auto-permission-gate/blob/642430ae0fa06d4c78b15d2a64c884824e415323/extensions/permission-gate.ts#L1059)做 JSON 字段及枚举校验。
- [第 1293 行](https://github.com/nilskluewer/pi-auto-permission-gate/blob/642430ae0fa06d4c78b15d2a64c884824e415323/extensions/permission-gate.ts#L1293)通过 Pi model registry/provider 解析模型、auth、headers/base URL；不绑定 Anthropic SDK。关键风险、模型 deny 或分类失败转人审；无 UI/无人可达则阻断。**模型 deny 不是持久 hard deny**，人仍可单次批准；hard deny 走另一路。
- 有 3/20 后 lockdown、共享本地 approval queue 与历史记录。测试文件确有 malformed/stale model、auth、用户消息筛选、critical 必须人审、两阶段失败等 fixture，但本研究没有运行，不能报告测试通过。

可借鉴：意图输入隔离、严格结果解析、模型选择与失败状态、hard deny 不被模型覆盖、human fallback、批准审计。

缺口/不适配处：只覆盖模型 Bash；不检查 `write/edit/powershell/MCP/Agent`，不覆盖直接 `!`；未匹配命令默认放行；README 明确规则是 pattern checks，非完整 shell parser/沙箱。包默认启用 Auto、特定模型默认值、自动启动本地批准页面及全局配置写入也不适合作为 Pilaude 无提示默认。`>=0.83.0` 的 peer 范围名义包含 1.3.0，但没有经过本产品集成测试。其实现还显式设置 `cacheRetention: "none"`，不能拿官方两阶段 cache-hit 论述替它承诺缓存收益。

### 4.2 `lantisprime/pi-extensions/permission-policy`：覆盖面与模式参考

固定 commit：`f3790dc6e7a6056027022a37c0ac5b8a6611818e`；[目录/README](https://github.com/lantisprime/pi-extensions/tree/f3790dc6e7a6056027022a37c0ac5b8a6611818e/permission-policy)、[目录内 MIT LICENSE](https://github.com/lantisprime/pi-extensions/blob/f3790dc6e7a6056027022a37c0ac5b8a6611818e/permission-policy/LICENSE)。[S2]

已验证代码：

- [`index.ts:156`](https://github.com/lantisprime/pi-extensions/blob/f3790dc6e7a6056027022a37c0ac5b8a6611818e/permission-policy/index.ts#L156)注册 `tool_call`，第 176 行还注册 `user_bash`；第 252 行按 read outside/write/edit/bash/MCP/web 分类。
- [第 1222 行](https://github.com/lantisprime/pi-extensions/blob/f3790dc6e7a6056027022a37c0ac5b8a6611818e/permission-policy/index.ts#L1222)用当前会话模型，通过 Pi API 对命令做 SAFE/UNSAFE 判定，失败返回 undefined；第 1394 行 SAFE 才自动通过，其余进入普通批准流程，无 UI 则拒绝。
- [第 1278 行](https://github.com/lantisprime/pi-extensions/blob/f3790dc6e7a6056027022a37c0ac5b8a6611818e/permission-policy/index.ts#L1278)实际处理模式和 session/project grants；持久策略存项目外的用户目录、按项目路径 hash 区分。seat-auto 实现了较严格的路径、symlink/hardlink 及写后检查。

可借鉴：统一工具类别、项目外持久策略、按次/会话/项目批准、独立 user shell 接点、确定性 seat 模式与对抗 fixture。

缺口/实代码与说明的区别：

- 这里的 LLM Auto主要判断“命令是否只读/非破坏”，输入是目录与命令，**没有完整用户意图 transcript**；不是官方式“有副作用但精确获得授权”的完整模型。
- 当前判定器接受以 SAFE 单词开头的输出，非严格 JSON schema；类别级持久允许会先于 LLM 判定，复用时要重新定义显式 ask/deny 的强度与作用域。
- 实际 `ensurePermission` 第 1287–1304 行将一部分 seat hard-deny 检查限定在有效 seat-auto；README 有“any mode”等更宽表述，不能据 README 宣称所有模式具备相同硬边界。
- [`isReadOnlyGitCommand:442`](https://github.com/lantisprime/pi-extensions/blob/f3790dc6e7a6056027022a37c0ac5b8a6611818e/permission-policy/index.ts#L442)把 branch/remote 等按命令名列入只读，README 自身也承认 `git branch -D`、`--output` 等残留问题。这足以排除原样作为安全只读基线；未在本研究执行利用。
- MCP 名称按 `mcp_`前缀识别，但不能解析 Pilaude 内部每个真实 server/tool 的授权关系；还需适配 Pi 1.3.0 API、PowerShell、未知 extension tools 与现有确认通道。

### 4.3 `MasuRii/pi-permission-system`：确定性 gate 与审计参考

固定 commit：`9affcc9d1b52cd79b8bb7da2bebb761ac7e5b1d8`；版本 0.8.0；[仓库/README](https://github.com/MasuRii/pi-permission-system/tree/9affcc9d1b52cd79b8bb7da2bebb761ac7e5b1d8)、[MIT LICENSE](https://github.com/MasuRii/pi-permission-system/blob/9affcc9d1b52cd79b8bb7da2bebb761ac7e5b1d8/LICENSE)、[package.json](https://github.com/MasuRii/pi-permission-system/blob/9affcc9d1b52cd79b8bb7da2bebb761ac7e5b1d8/package.json)。[S3]

已验证代码：

- [`src/index.ts:1949`](https://github.com/MasuRii/pi-permission-system/blob/9affcc9d1b52cd79b8bb7da2bebb761ac7e5b1d8/src/index.ts#L1949)拦截 tool_call，检查已注册工具，并处理目录/skill/tool 的 deny、ask 和确认。缺失人工通道时不会凭空批准。
- [`src/permission-manager.ts:908`](https://github.com/MasuRii/pi-permission-system/blob/9affcc9d1b52cd79b8bb7da2bebb761ac7e5b1d8/src/permission-manager.ts#L908)实现 tool/bash/MCP/special 等分类，`mcp`代理目标与直接注册的 MCP tool 名字分开。
- [`src/evaluate-permission.ts`](https://github.com/MasuRii/pi-permission-system/blob/9affcc9d1b52cd79b8bb7da2bebb761ac7e5b1d8/src/evaluate-permission.ts)从后往前匹配，采用 **last-match-wins**，默认 ask；不能当作 Anthropic 的 deny-first 系统。
- [`src/yolo-mode.ts`](https://github.com/MasuRii/pi-permission-system/blob/9affcc9d1b52cd79b8bb7da2bebb761ac7e5b1d8/src/yolo-mode.ts)在 yolo 时自动批准 ask。它是确定性权限项目，**不是模型风险分类器**；YOLO 也不等于本研究要的 Auto。

可借鉴：纯决策函数、策略资源匹配、未知工具阻断、批准范围/事件审计、子代理批准转发。

缺口：声明的 peer SDK 为 `^0.74.0 || ^0.75.0 || ^0.78.0 || ^0.79.0 || ^0.80.0`，不包含 1.3.0；依赖与旧 API 需要迁移。上游 `mcp`代理适配不等同于本产品 `mcp__server__tool`包装。若复用其匹配器，必须在外层另建不可覆盖的 deny/ask 顺序，不能保留 last-match-wins 后声称符合本方案。没有经过本产品验证的模型 Auto 层。

### 4.4 选择建议

优先从 S1 借鉴 **judge 输入/结果与失败处理**，从 S2 借鉴 **工具覆盖矩阵与批准范围**，从 S3 借鉴 **纯 gate/审计结构**。最小宿主实现仍应由 Pilaude 自己掌握，避免把三个完整扩展叠加后产生多套配置、互相放行和重复弹窗。

候选中没有可直接证明成熟度的统一基准；star 数、README 安全宣称和有测试文件都不构成安全结论。这里只确认证据与许可，不作“官方开源 Auto”背书。

## 5. Pi 1.3.0 与 Pilaude 现状

### 5.1 没有 Auto，但具备可用的执行前 gate

本地 [SDK package.json](../node_modules/@earendil-works/pi-coding-agent/package.json)第 3 行确认 1.3.0，第 88 行 MIT；产品 [package.json](../package.json)第 65–68 行依赖 Pi 1.3.0 系列。

已读用户指定的 [extensions.md](../node_modules/@earendil-works/pi-coding-agent/docs/extensions.md)：

- 第 98 行：handler 按 extension load/registration 顺序运行。
- 第 106 行：`tool_call`能修改输入或阻断；第 167–178 行直接给出 annotation + `ctx.ui.confirm()` + `{ block: true, reason }`的批准示例。**这是示例配方，不是已启用 Auto。**
- 第 124–126 行：兄弟工具可能并行，不应依赖另一调用结果已存在；嵌套工作使用 `ctx.signal`。
- 第 149 行：`ctx.executeTool()`也经过参数验证和 tool_call/tool_result，并携带 `parentToolCallId`；嵌套调用有独立 ID，但不会逐条自动写进正常 transcript。
- 第 167 行：MCP annotations 是未验证提示，缺失时应保守处理。
- 第 251–254 行：RPC 可转发支持的对话框；JSON/print 无 UI；检查 `ctx.hasUI`。
- 第 263 行：tool_call handler 失败会阻断，不能误写成所有 extension 异常都放行。

运行时代码复核：[ExtensionRunner.emitToolCall](../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js)第 957–971 行按序 await，第一个 block 立即返回，没有 catch-and-continue；[agent-loop.js](../node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js)第 481–538 行将异常变为 error result，不执行工具。[L2][L3]

另一个容易混淆的失败点：**factory 加载错误**会被 resource loader 收集后继续加载。gate 运行时 fail-closed，不代表 gate 根本没加载时也会自动拒绝。启动、reload、resume、child/reopen 都必须验证宿主 gate 已安装。[L7]

### 5.2 现有三个权限相关接点

| 接点 | 当前实际行为 | 不包含的能力 |
| --- | --- | --- |
| Project trust | `projectTrustReloadOptions()`让项目资源在 SDK trust store 同意后才加载；MCP host 同步时重读信任 | 不限制已启用工具的 OS 文件/网络/进程权限，不等于逐工具批准 |
| Read-only MCP policy | 显式 pin 的非空工具选择没有 bash/powershell/edit/write 时，阻断没有 `readOnlyHint:true` 的 MCP 工具；内层 codemode 也覆盖 | 不是未知工具默认拒绝系统；不验证 server 自称只读；不等于完整只读隔离 |
| Extension UI / codemode | `ctx.ui.confirm()`可通过既有 UUID pending request/response 与前端队列等待用户 | 没有独立“codemode 自动审核器”；没有内建按次/会话 allow、统一 deny/ask 或 classifier |

证据：

- [project-trust.ts:132](../lib/project-trust.ts)、[security.md:29](../node_modules/@earendil-works/pi-coding-agent/docs/security.md)、[mcp-host.ts:845](../lib/mcp-host.ts)。SDK `--approve`映射 projectTrustOverride，见 [args.js:229](../node_modules/@earendil-works/pi-coding-agent/dist/cli/args.js)，不是动作审批开关。
- [mcp-read-only-policy.ts:13](../lib/mcp-read-only-policy.ts)及第 42–48 行。[integration test:113](../lib/mcp-read-only-policy.integration.test.mjs)包含 direct/codemode 拦截 fixture，本研究未运行。
- [rpc-manager.ts:1812](../lib/rpc-manager.ts)创建随机 request ID，confirm 绑定在第 1872 行，resolver 在第 1441 行；取消/超时为 false，Stop 拒绝 pending promise。[useAgentSession.ts:1208](../hooks/useAgentSession.ts)、[extension-ui-queue.ts](../lib/extension-ui-queue.ts)处理队列/响应。[ADR 0006:367](adr/0006-mcp-and-code-mode.md)说明并发 script confirms 排队。

产品 `Code mode: automatic`含义是按 MCP 等条件激活 codemode，见 [codemode-settings.ts:13](../lib/codemode-settings.ts)，与权限 Auto 无关。ChatInput 的 read-only/default/full 是工具预设，不能用同一名称暗示已有权限模式。[tool-presets.ts](../lib/tool-presets.ts)

已有非聊天 `classifier`模型用于 Jev 风格的 choice/score/bool 结构化状态问题，也不是现成 action authorization 服务。[fork-models.md:8](agents/fork-models.md)、[pi-ai types:448](../node_modules/@earendil-works/pi-ai/dist/types.d.ts)

### 5.3 覆盖矩阵与必须补的缺口

| 执行路径 | 只加宿主 `tool_call` 是否覆盖 | 实际约束 / 后续接法 |
| --- | --- | --- |
| 模型原生 read/edit/write/bash/powershell 等 | 是 | 公共 AgentSession beforeToolCall；需自己的原生工具规则，不能只依赖 annotations |
| 产品 Bash extension 外层调用 | 是 | 内部直接 native execute 不再额外触发 hook；最终实际命令/环境应保持与审核一致 |
| codemode 内工具调用 | 是 | `ctx.executeTool()`共同管线；必须审核每次内层真实输入，外层脚本批准不能成为通配许可 |
| MCP direct / codemode | 是 | 名称实际是 `mcp__<server>__<tool>`，存在 sanitize、截短/hash；用 source metadata 和注册表，不能仅从名字猜原始服务器/工具 |
| 新建或恢复的子代理 | 不自动继承父策略 | 每个 child 自有 AgentSession，要安装相同宿主 gate、传递权限上限和来源；父 gate 只审外层 Agent 不够 |
| `!command` / 产品 RPC `bash` | 否 | 产品直接调 `executeBash()`，还绕过 SDK RPC 的 user_bash dispatcher；须在宿主该路径显式调用同一 gate |
| extension `pi.exec()` / 直接 `definition.execute()` | 否 | 扩展是宿主进程代码；需代码信任或外层隔离，hook 无法约束任意恶意 extension |
| codemode `models.classify/generateImages` | 不逐次触发 tool_call | 外层 codemode 可审，内部直达 registry；预算和对外数据规则须另设调用包装，或首版关闭不受管路径 |

代码证据：AgentSession [agent-session.js:315](../node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js)及第 385、2841 行；codemode [execute.js:405](../node_modules/@earendil-works/pi-coding-agent/dist/extensions/codemode/execute.js)与第 589 行；MCP [tools.js:40](../node_modules/@earendil-works/pi-coding-agent/dist/extensions/mcp/tools.js)；`pi.exec` [loader.js:326](../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js)；产品直接 Bash [rpc-manager.ts:1268](../lib/rpc-manager.ts)与 SDK [agent-session.js:3129](../node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js)。[L3–L8]

**已确认子代理缺口**：现有 read-only 预设保留非 coding extension tools，可能包括 `Agent`；general-purpose profile 有 bash/edit/write。新 child 用 profile tools，并未与父选择取交集，也未安装产品只读 policy。因此 read-only 父会话不能被视为所有后代严格只读。参见 [rpc-manager.ts:257](../lib/rpc-manager.ts)、[subagents.ts:115](../lib/subagents.ts)、[subagent-runtime.ts:243](../lib/subagent-runtime.ts)。这次记录而不修改。

加载位置适合宿主 gate：[rpc-manager.ts:2551](../lib/rpc-manager.ts)正常分支已有 `extensionFactories`及 read-only MCP policy；新子代理 [subagent-runtime.ts:243](../lib/subagent-runtime.ts)与恢复子代理 [rpc-manager.ts:2532](../lib/rpc-manager.ts)为独立路径，必须一起纳入。可信项目资源是否加载仍由 project trust 决定。[L7]

### 5.4 输入修改、批量调用与停止语义

[types.d.ts:978](../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts)明确：参数在 hook 前验证；`event.input`可原地修改，后续 handler 看得到，**修改后不再自动验证**。最终 gate 应排在受信任输入转换之后，审核最终参数并再次按需验证；加载顺序/后续代码仍能任意修改时，单个 hook 无法构成恶意扩展安全边界。

Pi 1.3.0 [agent-loop.js:366](../node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js)：全局 sequential 或任一 sibling 标记 sequential 会走顺序执行。并行分支第 411–453 行逐次 await preparation/gate，然后并行执行准备好的调用；codemode `Promise.all` 的 nested calls 仍可并发进入 gate。

因此：

- 一个 call 被阻断不会自动取消兄弟调用，不能宣传事务式“一拒全停”。
- hook `terminate:true`只有**每个 finalized tool result 都同意终止**时才阻止自动后续回合；普通抛错也不隐含 terminate。见第 465 行和 [ToolCallEventResult:1089](../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts)。
- 阈值触发后的全会话暂停/abort 必须由宿主调度管理；新任务不再启动，已发生的副作用无法撤回。不能仅在一个 blocked call 返回 terminate 就声称已全局停止。
- 工具 execution_start 可能早于 gate 完成；UI“开始”不应被当作已获准或已执行的审计依据。

## 6. 推荐的最小实现：仅建议，尚未编写

### 6.1 先定义产品语义，再做模式映射

权限模式应与工具暴露、项目资源信任分层。工具是否存在、路径是否获准、某次动作是否获得授权是不同判断。可参考的产品契约如下，都是**拟议语义**：

| UI 语义 | Pi 侧建议契约 |
| --- | --- |
| Manual | 已确认的安全读取可执行；有副作用/未知动作走人工；hard deny 始终阻断 |
| Auto | 同样 hard deny/显式 ask 先执行；窄自动允许后，对其余候选调用 BYOK judge；无法给有效结论转人工或阻断 |
| Accept edits（如需要） | 工作区普通文件编辑可自动；保护配置/源码外路径/命令/外部写入仍审查 |
| Plan / Read-only（如需要） | 对所有后代及嵌套执行施加不写入上限；不能只通过隐藏 write/edit 达成 |
| Bypass（如未来另做） | 单独命名、单独范围与同意；不能用 Auto 包装无审核执行 |

不要求首版实现所有模式。最小首版为现有行为上的 **Manual 与显式选择的 Auto**，不自动给已有用户切模式，不复制某个扩展的默认 on。模式数据由宿主保管，不从仓库 prompt、MCP 内容或 assistant 文本中授权变更。

### 6.2 一套纯决策核心，一套执行入口适配

拟议内部契约：候选动作带 `sessionId / branchId / toolCallId / parentToolCallId / actorOrigin / tool identity / final args / cwd / resource targets / policyVersion / authorityVersion`。决策使用 `allow | ask | deny`，另区分来源 `rule | human | classifier` 与失败状态 `unavailable | invalid | cancelled`；不能把“模型没答出来”存成“用户拒绝”。

顺序建议：

1. 校验注册工具与参数；规范化 Windows drive、大小写、UNC、junction/symlink、项目边界。未知工具/无法确定实际目标时不自动 allow。
2. 强制模式上限、后代上限、项目资源信任和宿主持久 hard deny；禁止 agent 修改批准 store、gate 代码/规则及绕过已拒绝动作。这些不交给模型清除。
3. 显式 ask / consent 直接走现有 confirm。单次批准仅对应该 ID 与参数摘要；不放宽所有相似动作。
4. 有效窄 allow 和已知安全读取/受控工作区编辑通过；不要将所有 `npm test`、项目内脚本、依赖安装或 `readOnlyHint:true`当作无条件安全。它们可执行代码或对外发送数据，需明确产品政策。
5. 其余在 Manual 走人审，在 Auto 进入 judge；明确 allow 且所有硬边界仍成立才执行；deny 返回原因并允许合法替代；unknown/error 转人工，无 UI 则不执行。
6. 在执行前检查会话取消、模式/策略版本、分支、工具实现/配置是否改变。变化后旧判定作废。审计记录脱敏的决定和执行结果，不能把 tool_start 当已执行。

在正常/child/reopened session 的宿主 inline factories 加最后的 gate，并在直接 Bash 路径调用同一纯决策核心。gate 注册失败时禁用副作用能力/停下启动，不能只弹 warning 后继续。现有只读 MCP 阻断继续作为上限，不被 classifier 的 allow 提升。

### 6.3 BYOK judge，不更换 SDK

首选 [ModelRegistry.streamSimple](../node_modules/@earendil-works/pi-coding-agent/dist/core/model-registry.d.ts)第 38–39 行，经过产品现有 [createPilaudeModelRuntime](../lib/pilaude-model-runtime.ts)及其 credential/error redaction。请求时 auth、provider headers、base URL 由 Pi runtime 解析，不手动把 key 注入 prompt，不接 Anthropic 专属 Agent SDK。

- 用户明确选择 classifier 的 provider/model，检查 text/structured-output 等实际能力；无可用模型就 Manual，不暗中更换到其他 provider，不按博客历史默认挑模型。
- judge 不提供工具，不允许写权限配置；传入宿主政策、真实用户授权账本、当前动作和必要的可信事实；不传 raw tool outputs、assistant 辩解或未经信任的 MCP description。
- **授权账本要有来源**：Pi extension 的 `pi.sendUserMessage()`也可制造 user-role 文本，故不能简单把所有 role=user 视为真人同意。真实用户 UI/API 输入、人工审批、父 agent 派发分别标记；child 委派不能扩大父权限。compaction/fork/resume 不丢失仍有效禁令，也不把单次批准扩大成常驻许可。
- 记录已执行工具与宿主验证事实；嵌套动作不能仅靠 transcript 回放，因为 Pi 的嵌套 transcript 有省略和有界记录。脚本执行要知道批准的是哪份内容/hash；内容不能可靠绑定时转人工。
- 输出要求严格结构及枚举，验证 stop reason、截断、JSON 解析和必要字段；reason 是简短说明，不依赖或保存模型内部推理。timeout、取消、限流、provider error、空输出均不允许动作。
- 第一版建议先做单阶段 judge，使故障和测量简单；评测证明两阶段有收益后再加快速筛查。两阶段是可选优化，不是名字叫 Auto 的必要条件，也不是官方精度的来源保证。
- 结果提示/注入扫描可作为后续独立层；首版没有该能力就写明缺口，不把单层 gate 宣称为完整复刻官方两层防御。

### 6.4 并发、批量与防止绕路

- 每个实际工具调用独立决定。复合 Bash/PowerShell 含多个命令/重定向/替换时，审查全部效果；无法解析则 ask，不按第一段 prefix 放行。PowerShell 与 POSIX 的 parser/别名规则必须分别处理。
- codemode 外层可做脚本级检查，但内层 tool 必须重复执行强制权限检查。已有 UI queue 可处理多 confirm；每张批准绑定 call ID，不使用共享“下一个工具允许”布尔值。
- 宿主维护共享的拒绝/不可用计数、取消信号与新动作闸门；并发更新需要原子性。分类器请求失败、用户拒绝和 hard deny 分开计数，阈值待产品定义及测试，不能盲抄官方 3/20 或服务端 10。
- child 创建/恢复带受限 capability，派发任务仅是 agent 来源；回传结果不授予权限。未覆盖子代理前可在受限模式暂停 Agent 工具。
- `!command`是用户主动 shell，但不能自动成为模型绕路入口。首版应明确它是独立人工命令通道，且模型无法通过 extension/API 伪造用户来源；若 UI 承诺“本会话只读”，该通道也必须有一致契约。
- 完全受信任扩展、任意 Node/OS 调用仍可绕过应用 hook；真正约束恶意代码需要 OS sandbox/容器等独立边界。本报告不提出替换 Pi，亦不把分类器等同于 sandbox。

## 7. 测试方案与验收条件（本次未执行）

优先使用真实 Pi 1.3.0 pipeline + 内存/假工具 + 假 judge；不运行真实删除、部署、外传或模型请求。第三方 fixture 只作设计参考，不直接执行下载脚本。

| 测试组 | 输入/场景 | 必须证明 |
| --- | --- | --- |
| 规则优先级 | 同动作命中 deny/ask/allow，classifier 说 allow | deny 始终阻断，ask 必须人工；确认拒绝不会被 judge 覆盖 |
| 强制模式 | Plan/read-only 父调用 general-purpose child、MCP 写工具 | 父的权限上限贯穿 child、新建、恢复和 nested calls |
| 参数与目标 | hook 改输入、后续模式切换、工具注册替换 | gate 审核最终输入；版本变化丢弃旧批准；必要 schema 重验 |
| 文件边界 | `..`、symlink、junction、硬链接、Windows drive/UNC、保护 store | 无词法路径绕过；不能修改权限、批准数据或自身 gate |
| 复合命令 | 安全命令后接危险命令、pipeline、subshell、替换、重定向 | 任一危险段不能继承安全 prefix 的 allow；不懂则 ask |
| PowerShell | alias、`-LiteralPath`、管道、编码/计算参数、Remove-Item | 使用相应语法模型；不能把 Bash regex 当通用命令分析 |
| 意图与来源 | 网页写“用户同意”、assistant 宣称批准、synthetic user 消息 | 均不能创建真人授权；真实限制跨 compaction/resume 保留 |
| 一次批准范围 | 同名工具换路径/参数、另一个 session、fork、child | 旧批准不能漂移到另一个动作或扩大权限 |
| judge 故障 | 超时、429/5xx、无 auth、stale model、空/截断/错误 JSON | 无有效结论不会运行；交互可人审，无 UI 则阻断，取消不晚执行 |
| 加载故障 | gate factory 抛错、reload 丢 gate、child 未安装 | 宿主拒绝启动副作用能力，而非只记录 extension error |
| 批量调用 | 同回合两个工具一拒一允、嵌套 Promise.all | 每个动作只按自己的有效 verdict 执行；全局暂停与已在跑动作有明确定义 |
| UI 审批关联 | 乱序响应、重复/过期 ID、Cancel/Stop/timeout、断线重连 | 仅当前 session 的有效 ID 可批准，队列无串卡/误确认 |
| MCP 元数据 | 缺 hint、自称只读但未知、名称截短/hash、服务器重配 | 不以自报 hint 作唯一安全依据；按真实 identity/config version 决策 |
| 旁路 | RPC bash、pi.exec、direct execute、model globals | 受管路径进入同一 gate；未管路径禁用或明确不在安全承诺中 |
| 防重试绕路 | 被拒 Bash 改用脚本、codemode、child、另一 session | 用户/宿主禁令不因换入口解除；计数/锁定不会并发丢失 |
| 审计与隐私 | key、headers、provider error、命令含敏感文本 | 错误与日志脱敏；不保存 raw token/内部推理；分类用量可单独核算 |

离线评测集需包含本产品真实任务类型：纯只读、本地可恢复编辑、未知脚本、远程写入、外传、凭据、权限修改、批量删除、用户精确同意与模糊请求。标注 allow/ask/deny 及授权范围，按来源和类别报告误放行、误拦截、人工率及 unavailable 率，保留未参与调参的集合。不能只用最终任务是否成功或总体平均分遮蔽危险类别。

上线前验收顺序：纯策略测试 → fake judge + SDK 集成 → 现有 UI 确认集成 → 只观察不自动放行的 shadow 评测 → 明确选定模型/预算后的实测 → 限范围用户主动启用。本研究未运行真实模型或上线。后续短输出验证沿用用户已授权的 DeepSeek Flash；更换 judge、扩大评测费用或默认启用模式需有对应授权。

## 8. 费用、延迟与待测指标

**本次没有模型调用，因此没有 Pilaude 成本或延迟测量值；不猜毫秒、token 数、美元数或节省百分比。**

应记录：每个工具路径的 gate 命中率/免审率、classifier 请求数、实际 provider/model、输入/输出/缓存/推理用量、重试数、限流与失败率；单工具及整任务新增延迟 p50/p95/p99、UI 等待时间、并发队列等待、任务完成率及人工打断率。区分确定性 gate 耗时、模型耗时与人审等待。

计算原则：

- 单阶段请求数量等于实际进入 judge 的调用量；两阶段再加被快筛标记的调用及有限重试。模型调用少不等于任务总成本低，需包括误拦截导致的替代步骤。
- 成本使用所选 BYOK provider 在测试时的计费表与真实 usage 计算：输入、输出、缓存、推理及其他计费项分别核算。无 usage/价格证据就标 unknown，不算成零。
- 两阶段共享前缀可能有缓存收益，但取决于 provider、model、请求形状与缓存策略；不能把官方当年的实现收益推广给所有 Pi provider。
- quote/截图中的官方实验数字、候选 extension timeout/历史窗口默认值都不是产品性能目标。先取得本产品 baseline，再选择模型、阶段数、超时、并发上限和预算。

## 9. 证据索引

### 官方原文（访问日期均为 2026-10-18）

- **O1**：[Anthropic 工程博客，2026-03-25](https://www.anthropic.com/engineering/claude-code-auto-mode)。已读完整正文，含决策层次、输入筛选、两阶段、评测、handoff、deny-and-continue。页面原文通过浏览器 DOM 读取复核。
- **O2**：[Configure permissions](https://code.claude.com/docs/en/permissions)，重点 Manage permissions、Bash rules、symlinks、Extend permissions with hooks。
- **O3**：[Choose a permission mode](https://code.claude.com/docs/en/permission-modes)，重点 [decision order](https://code.claude.com/docs/en/permission-modes#how-the-classifier-evaluates-actions)、[failure fallback](https://code.claude.com/docs/en/permission-modes#when-auto-mode-falls-back)、[server review](https://code.claude.com/docs/en/permission-modes#server-side-classifier-review)、[protected paths](https://code.claude.com/docs/en/permission-modes#protected-paths)、[critical paths](https://code.claude.com/docs/en/permission-modes#critical-paths)。
- **O4**：[Configure auto mode](https://code.claude.com/docs/en/auto-mode-config)，重点权限与 classifier 规则的两层优先级、受信任配置来源、classifyAllShell。
- **O5**：[错误说明：classifier 无结论](https://code.claude.com/docs/en/errors#auto-mode-cannot-determine-the-safety-of-an-action)、[服务端无 safety verdict](https://code.claude.com/docs/en/errors#the-server-returned-no-safety-verdict)。
- **O6**：[官方 Claude Code 仓库 README](https://github.com/anthropics/claude-code/blob/main/README.md)、[根 LICENSE.md](https://github.com/anthropics/claude-code/blob/main/LICENSE.md)。本次核查不将其视为 MIT 的完整核心源代码。

### 开源固定版本

- **S1**：[nilskluewer/pi-auto-permission-gate，642430a](https://github.com/nilskluewer/pi-auto-permission-gate/tree/642430ae0fa06d4c78b15d2a64c884824e415323)：核查 README、LICENSE、package.json、permission-gate.ts、测试命名与相关 fixture。
- **S2**：[lantisprime/pi-extensions，permission-policy，f3790dc](https://github.com/lantisprime/pi-extensions/tree/f3790dc6e7a6056027022a37c0ac5b8a6611818e/permission-policy)：核查目录许可证、README、index.ts 与 seat 测试相关片段。
- **S3**：[MasuRii/pi-permission-system，9affcc9](https://github.com/MasuRii/pi-permission-system/tree/9affcc9d1b52cd79b8bb7da2bebb761ac7e5b1d8)：核查许可证、package.json、README、tool_call 入口、permission-manager、evaluate-permission 和 yolo-mode。

### 本地关键证据

- **L1**：[Pi extensions.md](../node_modules/@earendil-works/pi-coding-agent/docs/extensions.md)、[security.md](../node_modules/@earendil-works/pi-coding-agent/docs/security.md)、[示例 permission-gate.ts](../node_modules/@earendil-works/pi-coding-agent/examples/extensions/permission-gate.ts)。
- **L2**：[ExtensionRunner](../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js)、[事件类型](../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts)。
- **L3**：[agent-loop](../node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js)、[AgentSession](../node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js)。
- **L4**：[project-trust](../lib/project-trust.ts)、[MCP host](../lib/mcp-host.ts)、[read-only MCP policy](../lib/mcp-read-only-policy.ts)。
- **L5**：[codemode execute](../node_modules/@earendil-works/pi-coding-agent/dist/extensions/codemode/execute.js)、[MCP tool wrapper](../node_modules/@earendil-works/pi-coding-agent/dist/extensions/mcp/tools.js)、[ADR 0006](adr/0006-mcp-and-code-mode.md)。
- **L6**：[rpc-manager](../lib/rpc-manager.ts)、[subagent-runtime](../lib/subagent-runtime.ts)、[subagent profiles](../lib/subagents.ts)、[builtin extensions](../lib/builtin-extensions.ts)。
- **L7**：[resource-loader](../node_modules/@earendil-works/pi-coding-agent/dist/core/resource-loader.js)、[agent-session-services](../node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session-services.js)、[extension loader](../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js)。
- **L8**：[ModelRegistry API](../node_modules/@earendil-works/pi-coding-agent/dist/core/model-registry.d.ts)、[product model runtime](../lib/pilaude-model-runtime.ts)、[extension UI queue](../lib/extension-ui-queue.ts)、[UI hook](../hooks/useAgentSession.ts)。

尚未解决、需要后续实现/测量的项目：选用哪个 BYOK judge、各风险类别的授权契约、子代理/直接 shell/模型 globals 的完整覆盖、OS 隔离选择、Windows parser 与路径边界、成本预算、延迟目标、误放行验收线。本文没有替用户作这些启用决定。
