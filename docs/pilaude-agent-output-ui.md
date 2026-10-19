# Agent 输出界面：实施与验收清单

2026-10-19 用户提供完整清单，来源标题为「Agent 输出界面：组件命名与状态动效规范」，署名 @Mossvee，日期 2026-10-11；分享链接为 https://claude.ai/artifact/S3VNZWZ9i1hqnLfQdLqw6A#6e8ee73b-05f4 。链接在本轮显示登录门槛，以下需求以用户随后粘贴的正文为准，不声称已读取在线 artifact。它补充现有[逐组件复刻基准](pilaude-ui-parity.md)，不以清单替代真实 Windows 参考图。

## 术语和产品边界

| 术语 | 本项目含义 | 真值／消费边界 |
| --- | --- | --- |
| Tool call group / Collapsed activity summary | 可折叠的执行记录组 | ChatWindow 的真实 turn／process entries，不使用演示步骤 |
| Summary header / Disclosure trigger | 低于正文权重的摘要行 | 折叠／展开、状态、实际消息／工具数量；尾部 chevron |
| Step item / Action row / Tool call row | 一条真实工具调用 | Pi tool-call ID、参数生成和执行事件、结果与错误 |
| Tool input / Tool result / Command output | 展开后的输入与结果 | 原文；等宽字体，有边界，可复制和滚动，MCP 结果继续纯文本 |
| Streaming text / Token streaming | 正在生成的正文 | 当前 message／block，不伪造逐字计时 |
| Caret / Streaming cursor | 当前正文生成指示 | 仅当前文本生成时存在，完成／中断移除 |
| Shimmer text | 当前正在进行的微光文字 | 只有真实活动状态驱动，同一时刻一处可见持续动画 |
| Thinking block / Reasoning summary | 可折叠思考预览与正文 | 原始 block index、deferred fetch／cache／retry 和偏好继续保留 |
| Task list / Plan / Todo tracker | 真实任务进度列表 | 必须接真实 task/plan 数据；尚无 consumer 时不能展示示例进度 |

摘要、思考和步骤说明使用 `var(--font-ui)`。本机已获个人使用授权的 Anthropic Sans 通过现有私有 custom stylesheet 映射到此变量；代码仓库不包含其二进制或 data font。命令、参数、输出和 diff 保留现有等宽方案。普通 hover 遵循用户最新选择：暗色变白、浅色变灰；增删／失败等状态色保持语义。

## 状态模型

步骤状态与折叠状态分开：`pending → running → success | error`，中断单独保留 `cancelled`；参数尚在生成时可显示 `generating`，不得提前记为执行成功。并行工具由顶层 execution start/update/end 按调用 ID 跟踪，部分输出不等于完成。思考活动以 indexed thinking start/delta/end 为准，不能用整条 message streaming 冒充每个思考块活跃。

摘要随真实状态从 Running… 转为完成态和实际调用数量；部分失败保留失败数量。步骤默认折叠，首次错误展开，用户随后手动收起应继续生效。错误展开不应强制将正在查看历史的用户滚回底部。保留已有 150ms 用户滚动锁、搜索定位与会话／分支代际。

| 区域 | 适用状态及数据来源 | 不适用／限制 |
| --- | --- | --- |
| 过程组 | 真实 turn/tool counts：pending／running／success／error；partial 不计完成 | 无权把缺终态历史当成功；组与步骤折叠独立 |
| 工具步骤 | 参数 generating，实际 execution pending／running、结果 success／error，保留 cancelled | 运行集合与部分输出分离，真实错误自动展开一次 |
| 思考 | 当前 indexed start／delta／end 的 active／static，加 deferred loading／error | 不伪造 duration 或完成比率 |
| 流式正文 | indexed text active／static；end／Stop 清光标 | 复杂 Markdown 末尾光标排版仍待补验 |
| 背景任务 | Pi family/subagent 的 queued／starting／running／completed／failed／aborted／interrupted；未知保持 unknown | 静态形状／颜色与可达控制；不是有序 Plan/Todo 完成率 |

## 动效规格

原清单给出的时间是建议起点。当前实施选择下列值，Windows 时间序列实测通过前均不是官方时长结论。

| 动效 | 本轮目标 | 来源与触发／停止 |
| --- | --- | --- |
| Shimmer | 1.8 秒循环 | 复用 ReasoningAmbientGlow 的 250% 背景和 cds-shimmer-text-shine 非对称关键帧，按用户清单缩短源 3 秒周期，改为中性灰／白；只有当前活动项，完成立即移除 |
| 流式光标 | 1 秒 ease-in-out | 当前正文生成出现；完成／中断消失，与 shimmer 仲裁避免多处持续动画 |
| 折叠展开 | 200ms | ThinkingAccordion Grid 0fr↔1fr、cubic-bezier(.19,1,.22,1) 经共享 DisclosureBody 消费；思考／工具／过程组均有真实中间高度、inert／焦点与中断清理证据 |
| 新步骤 | 150–250ms，位移 4–8px；多行错开 30–50ms | 尚待真实增量步骤场景验证，不能给历史重载重复播放 |
| 状态切换 | 150–200ms | 形状加颜色；避免所有并行步骤持续旋转 |
| 摘要文字更换 | 150ms | 真实状态变化；不以动画延迟状态更新 |

单次进入／切换不超过 300ms；循环不受这一单次上限约束。减少动态效果下停 shimmer／位移／闪烁，保留静态当前状态与可读文字。隐藏／折叠内容不继续可见活动动画；完成内容回到静止。

## 验收表

以下条目只有在对应测试、实际页面和参考证据齐备后才能勾选。单项功能通过与 Windows 像素一致性分开记录；本文件不预先将正在实施的条目勾为完成。

### 状态完整性

- [x] 上方状态表逐区域列明真实状态与不适用项；背景任务的未知／等待不再显示成功图标。
- [x] 思考、过程组与工具详情有折叠／展开形态，运行时可手动折叠；实际活动 run 验证 live handoff 与手动开关保留。
- [ ] 空输出、超长输出、单步长耗时、几十步、多工具并行与重连覆盖。
- [x] 部分输出不造成成功误判；未知活动保持静态。已通过 reducer／hook 与真实活动页面；定时 reconciliation 仅保留同一尾块的既有事件证明。

### 视觉层级

- [x] 摘要／步骤为次级色、小一级字号，最终答案优先；本机实际摘要 13px、无边框透明，最终答案在过程组外。
- [x] 状态图标形状与颜色共同表达，辅助名称有实际状态；成功勾／错误叉／中断方块／运行实心与等待空心各有实际消费。
- [ ] 深浅主题的 shimmer、边界、错误与 hover 都可辨认。
- [x] Sans 摘要与等宽详情分别核实实际字体；详情有明确边界。私有 Sans alias loadedFaces=1，手机补拍摘要 13px／命令等宽 12px，输出上限 400px。
- [ ] 原文可复制，长行明确换行／横向滚动，MCP 不执行 HTML。

### 动效

- [x] 思考、工具详情与过程组的 200ms 高度过渡分别通过真实中间帧、立即 inert／ARIA、条件焦点返回、快速反向／隐藏／reduced-motion 清理；过程首次展开后保留子状态，思考／工具归零释放。
- [ ] 新步骤进入／错开、状态图标和摘要有限切换仍待真实增量／历史不重播的独立消费与验收，不由已有 Grid 动画推定通过。
- [x] 同时只有一处可见持续动画；实际 thinking → 收起组 → 当前工具 → 等待提示 → 完成，组和子步骤不双重 shimmer。
- [x] reduced-motion 有静态降级，隐藏内容暂停，完成／中断静止；新的高度／进入动效仍需在后续补验。
- [x] 本批 shimmer 用 native frames 验证渐变位置移动与 1.8s timeline；此证据不替代待补的其他动效实测。

### 交互

- [ ] 整行可点；触控最小 44px，高密度桌面按用户实图校准并保留键盘入口。
- [x] 首次错误展开并能定位到具体步骤；之后手动收起有效，实际手动历史滚动未被错误展开抢回。
- [ ] Tab／Enter／Space／Escape／IME 及焦点返回覆盖；ARIA IDs 关联，隐藏区不进入焦点序列。
- [x] 本批实际覆盖流式／错误、目录hover和普通开合不抢手动历史滚动；焦点返回只在收起后代时发生并使用preventScroll。
- [x] 导航轨位于聊天栏 left12／top24 CSS px，正文最小间隙24px；实际390×340、390×812及桌面矩阵通过。原像素残差另记，不据此称完全一致。
- [x] 顶部会话标题菜单及子菜单已挂载，现有真实动作和不可用原因均由六组实际检查验证，无假选择／假成功。
- [x] Transcript modes 与 Output styles 已接真实 consumer／后端，分别通过完整页面及提示词消费检查；unsupported exact/chat-only/subagent 风格保原合同并说明原因。
- [x] 原生会话窗口和 VS Code（项目）已接 Rust／IPC 与 capability 探测，Windows20项Rust和mock IPC页面通过；它们的真实OS窗口／Code.exe启动、DPI和macOS／Linux编译继续待验，不能把合同测试算成实物通过。

## 证据登记

2026-10-19 新参考原字节归档在工作区私有 `references/claude-desktop/agent-activity/2026-10-19/` 与 `conversation-navigation/2026-10-19/`，各有 manifest／SHA256。活动图含 2136×845 原图和 741×104 Sending 局部；导航原图 241×616。PNG 内嵌 DPI 不证明系统 DPI，静态图也不证明 shimmer 时间。原始图、字体和叠图不提交公开仓库；实现／参考双图层始终不重采样。

本批活动完整页面为 `activity-disclosure/run-1792375885811/`，手机可读性补充为 `mobile-supplement-1792376302856/`，导航为 `conversation-navigator-layout/run-1792375287625/`，内容搜索为 `sidebar-content-search/run-1792375755599/`。前者原430px截图有侧栏／Context遮挡，只记录布局／溢出；补拍经真实按钮关闭遮挡后逐目标命中、文字和原图复核通过。后续 `disclosure-motion/run-1792378208269/` 已分别验证三类高度和清理语义；新步骤进入／错开与有限状态／摘要过渡继续未完成，不勾整项动效完成。

运行结果和残差在每一批实际完成后补记于[复刻基准](pilaude-ui-parity.md)；未核实项继续保持未完成。Vercel AI Elements、assistant-ui、shadcn/ui 等为原文的参考建议，本轮未逐一核对或声称已采用。
