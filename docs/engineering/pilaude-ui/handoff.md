# 当前交接状态

更新日期：2026-10-19。先核实git／服务与未提交归属，再继续下一步。源码冻结、实际通过、已发布检查点分别记录；不重复已验证检查点，不追逐状态文档自身SHA。

## 当前目标与用户重点

最新已发布产品检查点仍是 `c1ac371`：busy composer、compact分隔和Artifact真实活动／hint。其后本批UI已冻结：simple display公式实际7339326三项通过；字体7237430仅generated current-font measured；FileViewer7645358的24几何／模式／sandbox／draft／mention／独立focus通过，但real/control下载均canceled、bytes未验，aggregate FAILED诚实保留。唯一11文件197/197及完整types／lint完成，最后checker只补11项ownership／target lint轻检通过。

用户新重点是以下八扩展逐项调研→最小产品实现→真实consumer→实际验证，不能停在建议，也不是给当前开发会话安装包：`@juicesharp/rpiv-todo`、`pi-web-access`、`pi-powerline-footer`、`@gotgenes/pi-permission-system`、`pi-subagents`、`@plannotator/pi-extension`、`pi-background-tasks`、`@narumitw/pi-usage`。统一状态在[八项矩阵](../pilaude-extensions/README.md)。Todo canonical backend／hook／panel PREP和真实包subagent冲突filter已经GO，但尚未验收，必须排除当前UI检查点；固定包项目级审查闭包／依赖加载另片已GO，目标ordinary coding开箱真工具，仍未验。权限包不自动改变当前host／session权限，usage不能以SDK tokens冒充account quota。

用户要求同帧测量组件尺寸、比例、gap、基线／对齐并验深层UX。较新官方参考优先，3p补状态，指定composer高度／细线／圆角仅局部覆盖，未知版本／DPI不推定。主agent仅协调、评审、验收和检查点；3–8子agent实施，处理用户反馈时例外。当前七个子agent分工如下；当前UI browsers全部关闭／释放，新产品实际检查仍由主agent串行协调。

## 已发布事实与环境

- 产品 `D:/pilaude/pi-agent-desktop`，分支 `fusion/pi-claude-desktop`；工作区 `D:/pilaude` 非git，参考checkout `D:/pilaude/open-claude-ui`。
- `c1ac371 fix: align compact activity and preserve truthful artifact states` 为16文件、459 additions／80 deletions，主agentatomic push product `HEAD:main`、`HEAD:fusion/pi-claude-desktop`退出0，两ref由e8b9a9f前进至c1ac371。旧184fade／e8b9a9f已发布；本批尚未提交，不预填新SHA。
- Preview `pilaude-ui-verification`、30142、最近server ID `9c51ccac-c4aa-4617-a1f1-5df5e67231cc`；使用前preview_list核实，不启重复服务、不绕过停止拒绝、不运行next build。
- Provider rename stash保持。私有截图／字体／custom.css／datafonts、key及含key历史不提交；文档owner不stage／commit／push。提交footer `Co-Authored-By: Claude Code <noreply@anthropic.com>`。
- 工作区根AGENTS／memory在产品git之外；产品AGENTS工程入口是有意指导，勿随Next生成段落还原。

## 本批冻结与验收范围

| 切片 | 真实最终状态 | 保留限制 |
| --- | --- | --- |
| FileViewer | 6332257原始几何RED→7645358：24种pane／theme／mode几何、Source原文、模式切换、sandbox、draft／mention及独立keyboard focus通过；6878902八图与离线比例已读。CSS named shell／priority机制，520／440／360为产品校准，未改FileViewer JS／DOM | real button与同context／origin／URL／bytes的纯anchor均有正确event／filename而canceled，createReadStream失败且无API请求，aggregate FAILED；仅支持组件外同route seam也失败，不证明根因或业务bytes。旧focus失败／download失败保留，源模块采用数不加；参考只Markdown hierarchy、无同状态HTML六操作／DPI未知 |
| Formula | 公开formula marker0和inline后image/br两个RED→53/53；7080370真实CDP另行／重叠RED→7339326最终三checks GREEN、四图已读。simple pseudo gap3／overlap14.6875、active／end root同高；MathML／TeX／Copy／生命周期保留，tag fullwidth／编号xyWH active/end exact | 7129999为中间源。最终plain定位排tag／fleqn／leqno并max-width100%，特殊pseudo none；其caret、多行／wide／katex-error／raw／Windows明确未支持或未验 |
| 字体诊断 | 7237430 measurements已读、两PNG owner读；872×1000／DPR1.25、generated32 UTF16、fonts ready、composer742.40625×48／input680.40625×21／action28×28、轴差0，21reads无写入／错误／外部 | reference identity unverified／comparison false，Canvas ink／baseline16只是受控probe，不是textarea内部真实ink／baseline；不改产品字体／字号，不抵消旧参考残差 |
| 质量／ownership | 11文件197/197、完整tsc／lint退出0，lint既有TerminalPanel警告及branding3/3；最终file-panel target lint／ownership11项轻检通过，diff clean | 不重复／相加旧57／268／323，不称完整npm／E2E。CSS／helper fork-owned；实际发现两e2e在6fcd7d4存在，chat384/376 high、最终file-panel253/252 high，按原30／250阈值，非虚增产品源码drift |

FileViewer最终实际命令：`E2E_FILE_TOOLBAR_DOWNLOAD_CONTROL=1 node e2e/file-panel.mjs`，exit1保两download failure。公式：`E2E_CARET_FORMULA_ONLY=1 node e2e/streaming-caret-boundaries.mjs`。精确全部命令／日志／失败见progress。Shared TS旧基线与post-baseline Artifact21/17分开，open-claude-ui采用仍1直接／12局部／20未确认。

## 当前七owner与新增runtime排除

| owner（临时会话句柄） | 范围 | 当前归属 |
| --- | --- | --- |
| `a3c3f1f7dc7a90d4d` | FileViewer；新Todo固定包runtime | 旧UI冻结、browser释放；新审查闭包＋项目级ignore-scripts固定依赖／lock和builtin-todo-extension adapter／tests已GO，ordinary coding真工具目标、未验／排除当前检查点；不碰rpc-manager／hook／ChatWindow |
| `a0723798d4d91b0d9` | 公式；新Todo hook／panel | 公式四文件冻结；新`useAgentSession`／test、`SessionTodoPanel`／test／三语PREP，ChatWindow挂载／Todo CSS暂HOLD至本UI检查点保存，未验／排除 |
| `a295f9868b8753074` | 字体诊断；Todo backend＋todo/plan研究 | 字体test-only已measured；新`session-todos`／tests、`lib/types.ts`、session-reader／wire／stream及tests为canonical Todo实施中、未验／排除；报告`todo-plan.md`另写 |
| `a3b3c25672a4edb06` | 独立review／集成 | 197与轻检完成，下一步review新Todo冻结源；不重复本批验证 |
| `a9d171678acd0a837` | web／subagents／background报告；subagent去冲突 | `web-orchestration.md`待交付；`lib/subagent-extension.ts`和test的新真实包身份filter在实施，未验／排除，不装第二执行器 |
| `aece6c830e07fd205` | permission／footer／usage报告 | `permissions-status-usage.md`待交付；permission child协议方案待接收。footer fixed closure窄RPC widget实测中，静态候选已修正，尚无整包或最终factory通过 |
| `a91fc9a84f628e8e2` | 文档／矩阵／ownership | 本批文档冻结、README八项入口可纳，长研究报告未完成排除；新runtime状态只据证据更新，不stage／commit |

句柄不是跨线程依赖，新会话读落盘状态不等失效agent。新代码与当前UI可能同时处于工作树，不能`git add .`；按下一节显式取文件，未验新runtime不混入。

## 当前UI检查点可纳文件与下一步

本批UI／限定诊断／文档入口共16文件可纳，主agent先核实实际diff再显式stage：

- `app/native-theme.css`（仅FileViewer与formula现有冻结分区，Todo CSS仍HOLD）。
- `lib/markdown-streaming-caret.ts`、`components/MarkdownBody.caret.test.mjs`。
- `e2e/activity-disclosure.mjs`、`e2e/chat-appearance.mjs`、`e2e/file-panel.mjs`、`e2e/streaming-caret-boundaries.mjs`。
- `scripts/fork-ownership.json`。
- `docs/engineering/pilaude-ui/README.md`、`plan.md`、`progress.md`、`technical-spec.md`、`handoff.md`。
- `docs/pilaude-agent-output-ui.md`、`docs/pilaude-ui-parity.md`。
- `docs/engineering/pilaude-extensions/README.md`作为用户要求入口纳入，但不算runtime完成。

排除新Todo依赖／package.json／package-lock／builtin adapter、backend／hook／panel／i18n／读写链、subagent filter及tests、三份未完成长报告。若新owner触到上述同文件，先按冻结分区／hunk核实，不用整文件误收。

1. 主agent接收本批限定结果、显式保存／推送UI检查点，保FileViewer下载失败可复现，不删断言或反复新轮阻用户插件任务。完成后同步发布事实，不追逐文档SHA。
2. 接收三份扩展报告并更新八项矩阵；优先真实canonical Todo backend→hook／panel→挂载→实际SDK／页面，依赖加载／整包安装另片；再安排subagent去冲突和permission child协议等最小slice，逐项实施／实际验证。
3. 后续继续整体目标：Changes保已有九组与真实Git证据，补真实窗口反馈／草稿ACK与83行换行／滚动条／外卡／字形等残差及缺inline-comment参考；原生Plan/Todo与八项研究衔接；Windows GUI／WebView／DPI／clipboard／Code.exe／独立窗口实物；最后沿既有失败恢复完整npm／terminal E2E及逐状态视觉。更窄导航clamp、Artifact其他inline、特殊公式caret／raw仍明确待验。

参考100%底层／现状50%上层只整数crop／translation，无拉伸或猜DPI。公共代码推送授权不扩大到installer release、真实第三方账号或私有素材，权限设置由用户决定。
