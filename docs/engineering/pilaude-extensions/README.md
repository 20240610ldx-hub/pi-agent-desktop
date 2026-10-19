# 八项 Pi 扩展的产品接入工作台

更新日期：2026-10-19。用户明确指定以下八项重要，要求逐项调研、产品接入和实际验证。它们是需要推进落地的工作队列，不能只交研究建议，也不是给当前开发会话安装扩展。当前FileViewer／公式收口及Pilaude整体复刻继续，八项工作与这些目标衔接。

## 必读与状态规则

先读[当前UI交接](../pilaude-ui/handoff.md)和[计划](../pilaude-ui/plan.md)，再读[既有扩展来源与兼容账本](../../pilaude-pi-extensions.md)。旧账本记录2026-10-18固定版本和隔离检查，不能作为新版本或完整产品运行通过；各研究报告应复用已核实事实，再调查缺口，不重复全部工作。

这里是八项统一状态入口，研究owner只写各自报告，主agent汇总并安排具体最小实现切片；文档owner维护本矩阵，避免多份“当前完成列表”相互冲突。八项都是用户指定优先工作，未收到相对次序要求，不凭包名推断功能已采用。阶段依次记录：来源／版本与兼容调研 → 明确产品切片 → 真实consumer实现 → 公共SDK／生命周期验证 → 实际页面／必要原生验收。后一个阶段必须有自己的证据，不能由前一阶段推定。

## 八项真实状态矩阵

| 用户指定包 | 既有产品事实（2026-10-18账本） | 本轮研究归属／报告 | 产品落地与实际验证出口 | 本轮状态 |
| --- | --- | --- | --- | --- |
| `@juicesharp/rpiv-todo` | 2.13.9固定可选来源；真实SDK／SessionManager／widget桥9项隔离兼容检查，未安装／打包，原生结构化Todo consumer尚无 | todo＋plannotator owner；报告`todo-plan.md`待交付 | 先核验结构化快照schema与真实分支／重连恢复，再落可见任务consumer；验实际工具／Code mode、任务状态和隐藏／删除／会话隔离，ANSI widget不冒充原生任务 | canonical backend＋hook／panel PREP实施中；另已GO项目级固定包／审查依赖闭包／ignore-scripts exact lock与builtin-todo adapter，使ordinary coding有真工具，尚未完成依赖加载或实际验证，不称已安装／开箱通过 |
| `pi-web-access` | 0.42.0固定可选来源；core／factory有注入provider的契约证据，发布dist、真实网络／凭据与缓存恢复未验 | web＋subagents＋background owner；独立报告待交付 | 明确受控host／provider与secret边界，落真实工具消费和来源呈现；验HTTP／取消／错误／存储隔离，网页内容不成为指令或审批来源 | 已委派新研究；受控产品网络consumer待落地 |
| `pi-powerline-footer` | 0.20.2完整editor／footer需适配，setFooter／setEditorComponent仍no-op；本轮已静态确认RPC主行仍走setWidget(powerline-top,factory)，宿主有factory桥，不能据TUI no-op断言所有显示不可消费；LICENSE正文缺口保留 | permission＋footer＋usage owner；`permissions-status-usage.md`待交付 | 对真实RPC factory做最小widget适配验证；完整editor／footer、输入／队列／cwd／压缩行为另验，不把可消费入口当整包可用 | RPC主行候选已核实，fixed closure真实窄RPC widget验证进行中、尚无最终结果；完整editor／footer未兼容，不能称整包通过 |
| `@gotgenes/pi-permission-system` | 41.0.0固定可选来源；确定性gate／RPC组件隔离证据，完整factory、PowerShell、direct bash、child协议和统一授权未通过 | permission＋footer＋usage owner；独立报告待交付 | 明确Pilaude产品授权入口和覆盖范围，逐项接direct／nested／MCP／子会话／计划任务；以执行计数验证deny／ask取消／超时／撤权／重放，审批必须绑定真实请求 | 已委派新研究；不得自动更改本开发会话或host权限、启用Auto／Bypass或宣称OS sandbox |
| `pi-subagents` | 0.79.1未安装第二执行器；真实产品使用subagent-extension／runtime与Agents／family UI，不能算采用该npm包 | web＋subagents＋background owner；独立报告待交付 | 对照指定包与既有执行器的具体缺口，选最小真实适配而不重复注册；验父子身份、并行、取消、失败、分支／恢复及授权继承 | 已GO最小真实包身份冲突filter＋公开测试，当前实施中／未验；不安装第二执行器，既有能力与包采用分开 |
| `@plannotator/pi-extension` | 0.28.23固定可选来源，8项隔离契约；BrowserSession替身，真实review服务／HTML／parse5／浏览器未验，缺资源自动批准风险未解决 | todo＋plannotator owner；报告`todo-plan.md`待交付 | 落真实计划review入口、会话绑定与决策回流；验修订／拒绝／取消／关闭／重连和迟到结果，缺资源不能伪造用户批准；计划批准不授予工具权限 | 已委派新研究；完整产品review路径尚待接入／实际验证 |
| `pi-background-tasks` | 2.6.10旧peer排除锁定SDK1.3.0，目录列需适配；现有terminal／agent tasks不是该包采用证据 | web＋subagents＋background owner；独立报告待交付 | 核实当前版本／SDK／Windows生命周期，选适配或兼容替代机制并说明原因；验真实后台任务身份、输出、退出／失败、Stop、重连和孤儿清理，避免双执行器 | 已委派新研究；不能忽略peer强装后声称兼容 |
| `@narumitw/pi-usage` | 0.67.0整包未执行；provider-usage署名局部沿用查询格式，ProviderUsageSummary为consumer，非整包采用 | permission＋footer＋usage owner；独立报告待交付 | 核实真实provider查询／凭据／quota字段与缓存，补受支持consumer；验known／unknown／unsupported／错误和刷新，缺值保持未知，账期／账户额度与会话token分开 | 已委派新研究；不得用SDK累计tokens冒充账户quota或订阅限额 |

报告落盘并核实后再把文件名改成可点击链接；“待交付”不是研究已完成。每项实现决策必须指出具体文件／consumer、固定来源和验证出口，不能把“已有相似功能”作为八项完成的共同结论。

## 研究owner的交付合同

三个独立报告组是todo＋plannotator、web＋subagents＋background、permission＋footer＋usage；本轮总七个子agent，由主agent协调，保持用户3–8个的工作方式。研究报告需要写明：实际读到的一手URL／版本／commit或tarball摘要、许可证、SDK／平台合同、产品已有消费与缺口、推荐的最小实现切片及可验证出口。只有执行过的检查写结果，静态调查不能标实际GUI／网络／扩展运行通过。

研究不安装或启用当前开发会话扩展，不更改host权限，不用真实账号／凭据／用户历史做兼容夹具。产品需要的安装、授权、服务或外部调用按具体实现切片明确范围。既有可选来源按钮只填安装表单，不证明已安装、启用、预装、依赖闭包或运行兼容。

## 产品实现与验收要求

- 每项都要有真实消费点和对应的SDK／wire／hook／UI链路；明确复用、局部适配、替代或不适用的原因。第三方包和open-claude-ui模块采用计数是两套账，不能互相增加。
- 保留session／branch／task身份、异步请求所有权、取消／失败／重连和持久恢复；数据来源决定状态，不能由字符串、动画或任意模型文本伪造完成率、审批、额度和成功。
- 每个纵向切片提供失败证据、最小实现、定向回归、实际产品结果与限制；UI仍按同帧尺寸／比例／gap／基线／命中核对，并验键盘／IME／焦点／草稿／历史。
- 权限包只针对Pilaude产品授权模型作实现，不能借插件名改变当前会话或操作系统权限；Plannotator计划审阅和Todo状态不能绕过工具执行gate。
- Usage使用真实provider返回的账户信息，凭据留后端；账户quota、速率／窗口限制、费用、会话context与累计token独立显示，未知保持未知。
- 最终实际验收必须逐包登记。八份研究结论、目录按钮或隔离契约全绿都不能等同八项产品接入完成。

主agent接收研究后安排最小落地顺序；文档owner按报告更新本矩阵并与UI交接对齐。当前整体未完成目标仍见[handoff](../pilaude-ui/handoff.md)，包括Changes残差与真实交接、原生Plan/Todo、Windows实物、完整npm／terminal E2E和逐状态视觉复刻。
