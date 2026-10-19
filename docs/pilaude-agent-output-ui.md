# Agent 输出界面：实施与验收清单

2026-10-19 用户提供完整清单，来源标题为「Agent 输出界面：组件命名与状态动效规范」，署名 @Mossvee，日期 2026-10-11；分享链接为 https://claude.ai/artifact/S3VNZWZ9i1hqnLfQdLqw6A#6e8ee73b-05f4 。链接在本轮显示登录门槛，以下需求以用户随后粘贴的正文为准，不声称已读取在线 artifact。它补充现有[逐组件复刻基准](pilaude-ui-parity.md)，不以清单替代真实 Windows 参考图。

## 术语和产品边界

| 术语 | 本项目含义 | 真值／消费边界 |
| --- | --- | --- |
| Tool call group / Collapsed activity summary | 可折叠的执行记录组 | ChatWindow 的真实 turn／process entries，不使用演示步骤 |
| Summary header / Disclosure trigger | 低于正文权重的摘要行 | 折叠／展开、状态、实际消息／工具数量；尾部 chevron |
| Step item / Action row / Tool call row | 一条真实工具调用 | Pi tool-call ID、参数生成和执行事件、结果与错误 |
| Tool input / Tool result / Command output | 展开后的输入与结果 | 原文等宽／复制／滚动；已完成且仅command字段的bash／powershell使用紧凑命令条＋普通结果，额外参数及其他rich views保完整；MCP继续纯文本 |
| Streaming text / Token streaming | 正在生成的正文 | 当前 message／block，不伪造逐字计时 |
| Caret / Streaming cursor | 当前正文生成指示 | 仅当前文本生成时存在，完成／中断移除；最后的Markdown正文位置由既有解析树选择，不在列表／表格后追加空白行 |
| Shimmer text | 当前正在进行的微光文字 | 只有真实活动状态驱动，同一时刻一处可见持续动画 |
| Thinking block / Reasoning summary | 可折叠思考预览与正文 | 原始 block index、deferred fetch／cache／retry 和偏好继续保留 |
| Task list / Plan / Todo tracker | 真实任务进度列表 | 背景任务接 Pi family；可选 Todo 扩展只提供原样文本 widget，原生结构化 Plan/Todo 尚无 consumer，不能解析任意文本伪造进度 |

摘要、思考和步骤说明使用 `var(--font-ui)`。本机已获个人使用授权的 Anthropic Sans 通过现有私有 custom stylesheet 映射到此变量；代码仓库不包含其二进制或 data font。命令、参数、输出和 diff 保留现有等宽方案。普通 hover 遵循用户最新选择：暗色变白、浅色变灰；增删／失败等状态色保持语义。

## 状态模型

步骤状态与折叠状态分开：`pending → running → success | error`，中断单独保留 `cancelled`；参数尚在生成时可显示 `generating`，不得提前记为执行成功。并行工具由顶层 execution start/update/end 按调用 ID 跟踪，部分输出不等于完成。思考活动以 indexed thinking start/delta/end 为准，不能用整条 message streaming 冒充每个思考块活跃。

摘要随真实状态从 Running… 转为完成态和实际调用数量；部分失败保留失败数量。步骤默认折叠，首次错误展开，用户随后手动收起应继续生效。错误展开不应强制将正在查看历史的用户滚回底部。保留已有 150ms 用户滚动锁、搜索定位与会话／分支代际。

| 区域 | 适用状态及数据来源 | 不适用／限制 |
| --- | --- | --- |
| 过程组 | 真实 turn/tool counts：pending／running／success／error；partial 不计完成 | 无权把缺终态历史当成功；组与步骤折叠独立 |
| 工具步骤 | 参数 generating，实际 execution pending／running、结果 success／error，保留 cancelled | 运行集合与部分输出分离，真实错误自动展开一次 |
| 思考 | 当前 indexed start／delta／end 的 active／static，加 deferred loading／error | 不伪造 duration 或完成比率 |
| 发送确认 | 本地 optimistic submission 至事件连接／POST preflight ACK 的专用 isSending，Stop／会话切换／当前请求结算清除 | 不使用覆盖整轮的 rpcPromptPendingRef，不把工具间 waiting_model 误标 Sending；后续真正活动优先 |
| 流式正文 | indexed text active／static；end／Stop清光标；现有HAST末尾容器负责呈现位置 | 段落／标题／inline code／列表／嵌套列表／表格／代码fence／open fence／quote已验；公式、末尾Artifact及超大raw fallback仍待验 |
| 背景任务 | Pi family/subagent 的 queued／starting／running／completed／failed／aborted／interrupted；未知保持 unknown | 静态形状／颜色与可达控制；不是有序 Plan/Todo 完成率 |

## 动效规格

原清单给出的时间是建议起点。当前实施选择下列值，Windows 时间序列实测通过前均不是官方时长结论。

| 动效 | 本轮目标 | 来源与触发／停止 |
| --- | --- | --- |
| Shimmer | 1.8 秒循环 | 复用 ReasoningAmbientGlow 的 250% 背景和 cds-shimmer-text-shine 非对称关键帧，按用户清单缩短源 3 秒周期，改为中性灰／白；只有当前活动项，完成立即移除 |
| 流式光标 | 1 秒 ease-in-out | 当前正文生成出现；完成／中断消失，与 shimmer 仲裁避免多处持续动画 |
| 折叠展开 | 200ms | ThinkingAccordion Grid 0fr↔1fr、cubic-bezier(.19,1,.22,1) 经共享 DisclosureBody 消费；思考／工具／过程组均有真实中间高度、inert／焦点与中断清理证据 |
| 新步骤 | 180ms／6px；同批错开40ms，上限120ms | 仅真实 toolcall_start 的一次性 grant；最后一项 delay＋duration 不超过300ms。历史／重连／重新展开和已消费 ID 不重播 |
| 状态切换 | 160ms | 实际状态变化后新形状立即可访问，有限 opacity .5→1；并行步骤不持续旋转 |
| 摘要文字更换 | 150ms | 实际摘要值变化后的有限 opacity .5→1；普通参数／正文 delta 不重启，动画不延迟状态更新 |

单次进入／切换不超过 300ms；循环不受这一单次上限约束。减少动态效果下停 shimmer／位移／闪烁，保留静态当前状态与可读文字。隐藏／折叠内容不继续可见活动动画；完成内容回到静止。

入场账本由真实事件负责，呈现 hook 只消费 scope／有序 grants：历史／分页／轮询只 seed seen IDs，message_end／终态交接保留尚未消费的 grant；首次实际 DOM 提交即消费，隐藏／reduced 也消费，重开不补播。会话或显式分支导航 reset scope，普通 leaf 推进保留；旧 scope 的确认无效。服务端 `connected.hasStreamingSnapshot` 与实际 bootstrap message_start 使用同一非空快照条件，不能用覆盖整个运行周期的 `isStreaming` 猜恢复状态。工具执行间隙无快照的重连允许同一 run 后续真实新消息获得 grant；有快照的回放先基线化，旧版本缺该字段时保守处理。

## 验收表

以下条目只有在对应测试、实际页面和参考证据齐备后才能勾选。单项功能通过与 Windows 像素一致性分开记录；本文件不预先将正在实施的条目勾为完成。

### 状态完整性

- [x] 上方状态表逐区域列明真实状态与不适用项；背景任务的未知／等待不再显示成功图标。
- [x] 思考、过程组与工具详情有折叠／展开形态，运行时可手动折叠；实际活动 run 验证 live handoff 与手动开关保留。
- [ ] 空输出／超长输出／48步／并行独立完成和重连已有十组边界检查；真实长耗时／慢连接及更多复杂正文仍需补验，不把生成事件间隔当真实时长。
- [x] 部分输出不造成成功误判；未知活动保持静态。已通过 reducer／hook 与真实活动页面；定时 reconciliation 仅保留同一尾块的既有事件证明。
- [x] Sending专用提交阶段由真实准备／POST确认驱动，具体活动优先；延迟ACK／拒绝／Stop／跨会话和草稿隔离分别通过公开hook及实际页面，取消未发出请求即时清忙碌且只恢复一次。

### 视觉层级

- [x] 摘要／步骤为次级色、小一级字号，最终答案优先；本机实际摘要 13px、无边框透明，最终答案在过程组外。
- [x] 状态图标形状与颜色共同表达，辅助名称有实际状态；成功勾／错误叉／中断方块／运行实心与等待空心各有实际消费。
- [x] 深浅主题的活动摘要／思考／工具hover以真实鼠标、:hover和native hit复验：浅色rgb82、暗色rgb245；已有错误／shimmer状态和稳定截图分别保留，单处真实持续动画／完成停止通过。仍不代表官方颜色／边界像素一致。
- [x] Sans 摘要与等宽详情分别核实实际字体；详情有明确边界。私有 Sans alias loadedFaces=1，手机补拍摘要 13px／命令等宽 12px，输出上限 400px。
- [x] 十组实际边界检查确认input／result／codemode三条复制保CRLF／Tab／尾空格／字面HTML，超长输出完整位于400px双轴滚动区；MCP不生成script／img或外部请求。原生Tauri剪贴板另待实物验收。

### 动效

- [x] 思考、工具详情与过程组的 200ms 高度过渡分别通过真实中间帧、立即 inert／ARIA、条件焦点返回、快速反向／隐藏／reduced-motion 清理；过程首次展开后保留子状态，思考／工具归零释放。
- [x] 事件账本及独立 WAAPI consumer 已由真实页面 native frames 验证180ms／6px／40ms错开、160ms图标／150ms摘要；有／无快照重连、group重开／answered key remount、隐藏／reduced消费与中途取消均不重播。该项是限定功能证据，不由Grid推定或视为Windows视觉一致。
- [x] 同时只有一处可见持续动画；实际 thinking → 收起组 → 当前工具 → 等待提示 → 完成，组和子步骤不双重 shimmer。
- [x] reduced-motion 有静态降级，隐藏内容暂停，完成／中断静止；共享高度和有限入场也已分别验证中途改变偏好／隐藏时清理，恢复后不补播。
- [x] 本批 shimmer 用 native frames 验证渐变位置移动与 1.8s timeline；此证据不替代待补的其他动效实测。

### 交互

- [x] 原生button覆盖整行；coarse-pointer实际summary／thinking／tool均高44px、native center hit和真实tap通过；桌面28px保持紧凑，整体几何继续按用户实图校准。
- [x] 首次错误展开并能定位到具体步骤；之后手动收起有效，实际手动历史滚动未被错误展开抢回。
- [ ] Tab／Enter／Space／Escape／IME 及焦点返回覆盖；ARIA IDs 关联，隐藏区不进入焦点序列。
- [x] 本批实际覆盖流式／错误、目录hover和普通开合不抢手动历史滚动；焦点返回只在收起后代时发生并使用preventScroll。
- [x] 导航轨位于聊天栏 left12／top24 CSS px，正文最小间隙24px；实际390×340、390×812及桌面矩阵通过。原像素残差另记，不据此称完全一致。
- [x] 顶部会话标题菜单及子菜单已挂载，现有真实动作和不可用原因均由六组实际检查验证，无假选择／假成功。
- [x] Transcript modes 与 Output styles 已接真实 consumer／后端，分别通过完整页面及提示词消费检查；unsupported exact/chat-only/subagent 风格保原合同并说明原因。
- [x] 原生会话窗口和 VS Code（项目）已接 Rust／IPC 与 capability 探测，Windows20项Rust和mock IPC页面通过；它们的真实OS窗口／Code.exe启动、DPI和macOS／Linux编译继续待验，不能把合同测试算成实物通过。

## 证据登记

2026-10-19 新参考原字节归档在工作区私有 `references/claude-desktop/agent-activity/2026-10-19/` 与 `conversation-navigation/2026-10-19/`，各有 manifest／SHA256。活动图含 2136×845 原图和 741×104 Sending 局部；导航原图 241×616。PNG 内嵌 DPI 不证明系统 DPI，静态图也不证明 shimmer 时间。原始图、字体和叠图不提交公开仓库；实现／参考双图层始终不重采样。

本批活动完整页面为 `activity-disclosure/run-1792375885811/`，手机可读性补充为 `mobile-supplement-1792376302856/`，导航为 `conversation-navigator-layout/run-1792375287625/`，内容搜索为 `sidebar-content-search/run-1792375755599/`。前者原430px截图有侧栏／Context遮挡，只记录布局／溢出；补拍经真实按钮关闭遮挡后逐目标命中、文字和原图复核通过。后续 `disclosure-motion/run-1792378208269/` 已分别验证三类高度和清理语义。有限步骤动效最终 `activity-step-motion/run-1792380217575/` 独立通过七组 native frames／不重播／隐藏reduced／focus与手动历史滚动检查，并保存1300／430深浅稳定截图；初轮冷启动只到Loading shell、尚无会话fixture请求的失败报告保留。最终 fresh context 无page／console／external错误，没有模型执行；这轮不补认复杂Markdown或Windows原生渲染；后续独立 `streaming-caret-boundaries/run-1792381811843/` 已验证九种正文结尾、indexed handoff、native blink、New／返回和Stop／error清理，公式／Artifact／超大fallback及Windows原生仍保留待验。

可选 `@juicesharp/rpiv-todo@2.13.9` 的已有路径为扩展 `setWidget("rpiv-todos", …)` → RPC widget lines／state → useAgentSession → ChatWindow aboveEditorWidgets → ExtensionWidgets ANSI 文本。浏览器字段只有 key／lines／placement，没有结构化任务 ID、状态或总数；`e2e/rpiv-todo-compat.mjs` 的九项 SDK／持久化兼容检查不证明浏览器或真实 Code mode 消费。包未安装／未捆绑，原生 Plan/Todo 继续未完成。后续仅能原样验收扩展实际给出的标签／计数、更新／重连／清除，不能从任意文本、隐藏完成项或删除 tombstones 推导进度。

原图复查使用 2136×845 原件，而非聊天显示的 2000×791 预览。参考活动详情是共享外框／分隔线和单条紧凑命令，先前现状有嵌套思考／JSON／输出卡片；当前只对已完成且纯command的shell视图移除内层卡片，其他rich inspectors保留。生成的同类numstat形状对照中桌面详情高164.5→71.75 CSS px、命令pill33.75px／1px边框，对应参考39原像素且DPI未知。参考同图summary/body ink约1.05／1.00，先前浅色约0.87／0.87；墨迹不等于CSS字号，不据此直接放大字体或声称视觉一致。命令语法着色、其他活动行层级和参考字形仍有差异。私有叠图只做整数裁剪／平移，reference100%底层、current50%上层，不提交。

运行结果和残差在每一批实际完成后补记于[复刻基准](pilaude-ui-parity.md)；未核实项继续保持未完成。Vercel AI Elements、assistant-ui、shadcn/ui 等为原文的参考建议，本轮未逐一核对或声称已采用。
