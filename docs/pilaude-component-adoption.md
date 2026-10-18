# open-claude-ui 组件与算法采用账本

审计日期：2026-10-18。范围是 `code-examples/` 中的 **33 个 TS/TSX 源模块**；不把 `src/index.ts`、类型声明、主题 CSS 或 Storybook 算作组件模块。参考 checkout 为 `7490e105e418adf2b94c55ff716bb0973d44fb85`，包含作者提交 `638800b8a4cee4513c8763c3df0ecf8a77b32379`。模块源码统一以[该作者提交的 code-examples](https://github.com/Caho1/open-claude-ui/tree/638800b8a4cee4513c8763c3df0ecf8a77b32379/code-examples)为依据；MIT 来源见 [vendor 记录](../vendor/open-claude-ui/README.md)。

本账本回答“哪些源码或算法已被产品实际消费”，不证明 Windows 视觉一致性。逐像素和交互验收仍按[复刻基准](pilaude-ui-parity.md)执行。2026-10-18 的图片批次已完成定向测试和实际页面检查；Changes 已能指出局部算法 consumer，后端定向验证、核心页面和独立窗口目标交接均有证据；原生窗口、完整单轮回归及像素残差仍待完成。局部适配只覆盖明确列出的算法，不扩展为整个源组件已经采用。

## 状态与证据规则

- **直接采用**：产品运行路径导入受控 vendor 组件，并能指出实际渲染点。
- **局部适配**：提取了来源算法，有署名 adapter 和实际调用点；不把未搬入的其余行为算作已采用。
- **仅 vendor**：文件已复制，但没有产品运行时消费者。源码存在或导出不代表功能生效。
- **未采用／独立实现**：产品已有同类能力，但没有来源适配证据。下表中的产品文件是现有实现或候选接点，不是采用证明。
- **正在适配、未验**：新批进行中；不提前统计为直接采用或功能、视觉通过。

截至本次审计，33 个模块中：1 项 `CdsButton` 直接采用；5 项有明确局部适配：`useClaudeScrollPinning` 的 150ms 锁、`MediaLightboxViewer` 的自然尺寸／contain、`ScrollFadeContainer` 的边缘判定、`useClaudeRovingFocus` 的索引与单 tabstop，以及 `StreamingDiffViewer` 的表格／gutter 呈现。后三项所在的 Changes 核心流程及独立窗口目标交接已有分轮实际证据；整轮 ACK 失败和定向通过分别保留，未标为完整 E2E 一次全绿。`ClaudeMotionPresets` 仅 vendor、无消费者；其余 26 项未确认采用。主题 CSS 另已由 [app/layout.tsx](../app/layout.tsx) 导入，不计入这 33 项，也不将所有使用同类 CSS 的控件算作源模块采用。

目前的直接消费链：

1. [PilaudeDataSection.tsx](../components/PilaudeDataSection.tsx) 导入 `CdsButton`，用于 `pilaude.data.preview` 和 `pilaude.data.import` 两个动作；[SettingsPanel.tsx](../components/SettingsPanel.tsx) 挂载该区域。
2. [lib/cds-scroll.ts](../lib/cds-scroll.ts) 明确署名适配 `useClaudeScrollPinning`，导出 `canFollowStream(lastUserInputAt, now)`；[useAgentSession.ts](../hooks/useAgentSession.ts) 的流式滚动跟随和重新贴底路径调用它。
3. [native-theme.css](../app/native-theme.css) 的图片样式明确署名 `MediaLightboxViewer` 自然尺寸／contain 几何，经 `.composer-attachment-image` 与 `.message-user-image` 消费到 [ChatInput.tsx](../components/ChatInput.tsx) 和 [MessageView.tsx](../components/MessageView.tsx)。实现没有新增 TypeScript 几何 adapter，也没有 lightbox zoom／pan 或共享元素转场 consumer。
4. [ChangesPane.tsx](../components/ChangesPane.tsx) 的 `rove` 与 `FadedScroll` 分别适配 roving 索引／Home/End／单 tabstop 和 2px 边缘判定；`ReviewDiff` 的 HTML table／tabular-nums gutter 与增删背景借鉴 `StreamingDiffViewer`。既有 [patch.ts](../lib/patch.ts) 的解析／配对继续复用，不能算成该源 parser 的采用。
5. [PilaudeWelcome.tsx](../components/PilaudeWelcome.tsx) 当前为 quiet 首页，使用自有 `PilaudeCodeRipple` 与普通按钮，不导入 `CdsButton`、`SPRING_SNAPPY` 或其他 motion presets。[vendored ClaudeMotionPresets.ts](../vendor/open-claude-ui/ClaudeMotionPresets.ts) 中的求解器、springs 和 variants 均未找到运行时 consumer。以前欢迎页消费它们的记录只属于历史实现。

## 33 个模块逐项记录

“未采用”行仍列出产品消费证据的缺口和可落地的候选点；相似的独立实现不能用来填“已采用”。源文件内的注释与实际代码不符时，以下限制以实际代码为准。

| # | 源模块 | 关键算法／交互 | 当前采用状态与实际 consumer 证据 | 可适配方向、依赖及未实施部分 |
| --- | --- | --- | --- | --- |
| 01 | `ArtifactsSplitPaneResizer.tsx` | 比例 min/max clamp、右侧折叠、pointer capture、Escape 回滚、双击 50/50 | **未采用／独立实现**。[useResizablePanel.ts](../hooks/useResizablePanel.ts)、[WorkspacePaneDock.tsx](../components/WorkspacePaneDock.tsx) 已有产品 resize／多列逻辑，无该模块导入。 | 可抽比例约束与回滚案例，保留产品多列布局与持久化。源码没有注释所说的 4px 死区、左侧折叠或 spring；其 shield 为 `pointer-events:none`，不能据此声称防 iframe 吞事件已解决。 |
| 02 | `AttachmentCard.tsx` | `truncateFileName` 保留最后扩展名、前缀截断、扩展名 badge、tile/chip | **未采用**。现附件由 [ChatInput.tsx](../components/ChatInput.tsx) 管理，未消费该函数／组件；image 新批不等于本附件卡已采用。 | 优先抽文件名算法，补多后缀、超长扩展名、Unicode grapheme。卡片依赖 CDS/Tailwind 类；上传状态为外部 props，不能假造进度。 |
| 03 | `CdsButton.tsx` | 外定位／内 paint 分层，尺寸／variant，加载禁用，CSS spring 按压 | **直接采用**。[PilaudeDataSection.tsx](../components/PilaudeDataSection.tsx) 的 preview/import 动作消费；[SettingsPanel.tsx](../components/SettingsPanel.tsx) 挂载。当前欢迎页不是 consumer。 | 已有默认 `type="button"`、显式 variant/size 类和 Tailwind 4 样式适配。继续统一按钮时逐个登记使用点与状态证据，不把 vendor 存在算全站采用。 |
| 04 | `CdsMotionEngine.tsx` | 200ms 按压、30ms chip 级联、105° skeleton sweep | **未采用**，无产品 consumer。 | 这是演示画布而非通用引擎。提取时序或 CSS，去掉固定 chips、演示色值、定时器和依赖外部动画类的展示逻辑。 |
| 05 | `ChatComposer.tsx` | IME／229 Enter 保护、field-sizing、外点关菜单、附件局部状态 | **未采用／独立实现**。[ChatInput.tsx](../components/ChatInput.tsx) 有真实 Pi 输入器、草稿、队列和提交锁，无该组件导入。 | 可借布局／菜单样式，保留产品单次提交、延迟引用、拒绝恢复及会话切换保护。固定旧模型、模拟附件与发送后无条件清空不可移植。20px／Clay focus 也不能覆盖用户最新紧凑中性输入框选择。 |
| 06 | `ChatComposerChin.tsx` | 36px 触控／28px 下颌行变量、失败队列横幅 | **未采用**。[ChatInput.tsx](../components/ChatInput.tsx) 的 `QueuedMessageRow` 与真实 queuedMessages 是独立实现。 | 可抽受控行与横幅。源码没有 localStorage 队列，Attach／发送按钮也未接行为；不能直接显示“已保存在本地”或给不明确结果的请求自动 Retry。 |
| 07 | `ChatMessageBubbles.tsx` | 高度测溢出／Read more、hover 操作、复制衰减、思考／artifact 外壳 | **未采用／独立实现**。[MessageView.tsx](../components/MessageView.tsx) 的 user／assistant 渲染有自身 block 和工具语义。 | 借测溢出和操作显隐，保留 Pi 工具嵌套、分叉、错误、延迟思考及真实统计；不要用示例 Claude 标识和固定内容替换。 |
| 08 | `ClaudeAudioPlayer.ts` | 单例 AudioContext、gain ramp、四种合成音、sinkId 和 BYO fallback | **未采用／独立实现**。[hooks/useAudio.ts](../hooks/useAudio.ts) 有自有双音 completion；[AppShell.tsx](../components/AppShell.tsx) 消费。 | 可抽 envelope 与输出设备支持，接用户音效偏好及生命周期。合成音不等于官方声效；需处理用户激活、context suspend／close、sinkId 支持情况。 |
| 09 | `ClaudeDesktopHeader.tsx` | macOS 74px 避让、`74/min(zoom,1)` 补偿、45px drag band | **未采用**。产品顶栏使用 Tauri，未导入该模块。 | 仅 macOS host 几何参考；依赖 `window.electronAPI`、WebkitAppRegion，不能直接搬进 Windows Tauri renderer。 |
| 10 | `ClaudeMotionPresets.ts` | `calcDampedHarmonicOscillator` 欠／临界／过阻尼解析解；四 springs、CSS easing、message/popover/modal/grapheme variants | **仅 vendor**。[受控文件](../vendor/open-claude-ui/ClaudeMotionPresets.ts) 完整存在，但产品未找到任何运行时导入／调用；当前欢迎页不消费。 | 高价值纯算法待用：动画时序校验、CSS `linear()` 采样、逐控件 spring。求解器应补参数域／近临界数值测试；source 数值与 AGENTS 文案冲突，不能混用。 |
| 11 | `CodeBlock.tsx` | 行号表格／tabular-nums、复制 2.5s 衰减、语言与文件头 | **未采用／独立实现**。[MarkdownBody.tsx](../components/MarkdownBody.tsx) 消费 [MermaidBlock.tsx](../components/MermaidBlock.tsx) 中自有 CodeBlock。 | 借几何与反馈，不丢语法高亮／streaming；示例无高亮，行号路径 `code.trim()` 会改变首尾空行，clipboard 错误和 timer 清理需补。 |
| 12 | `ConfirmationDialog.tsx` | 400/520/720px 阶梯、遮罩、Escape、进入／退出 | **未采用／独立实现**。[ChatWindow.tsx](../components/ChatWindow.tsx) 等处有真实扩展对话框；无该组件导入。 | 必须接现有 dialog／Escape 栈、焦点进入和恢复；源码没有注释宣称的 focus trap。依赖 Framer Motion、CdsButton 与主题类。 |
| 13 | `ContainerResponsiveBar.tsx` | 命名 container query、576/480/384px 逐级隐藏与压缩 | **未采用**。[native-theme.css](../app/native-theme.css) 有局部附件容器查询，不等于采用该 toolbar。 | 可抽窄 pane toolbar 的分级规则；将固定模型、Settings／Run 演示内容换为真实 slots。确认 Tailwind 4 命名 container 类产出和最低宽度，不照抄注释未实现的能力。 |
| 14 | `CoworkAgentCanvas.tsx` | Agent／artifact 列表、选择与状态卡片 | **未采用／独立实现**。[AppShell.tsx](../components/AppShell.tsx) 的 Tasks pane 挂载真实 `AgentSessionPanel`／session family。 | 仅借受控呈现，接 Pi 父子任务、真实产物与 SSE。源码为固定 DEFAULT_AGENTS／DEFAULT_ARTIFACTS，未实现 BroadcastChannel、任务委派或拓扑状态机，按钮也不是执行能力。 |
| 15 | `DraggableSessionList.tsx` | before/after 中点命中、移除后索引补偿、跨 pinned 分区、Alt 上下重排 | **未采用**。[SessionSidebar.tsx](../components/SessionSidebar.tsx) 与 [sidebar-session-metadata.ts](../lib/sidebar-session-metadata.ts) 的真实 pinned 顺序不是该 demo 的消费。 | 可抽纯 reorder 与键盘规则，接现有 metadata 持久化；源码只改本地 sessions state，无服务端同步、真正拓扑排序或完整拖拽事务。 |
| 16 | `EpitaxyIframeBridge.tsx` | frame source 校验、null-origin／allowlist、channel／error 分流 | **未采用／独立实现**。[useHtmlPreviewFrame.ts](../hooks/useHtmlPreviewFrame.ts)、[html-preview.ts](../lib/html-preview.ts) 已有 source、协议与 sandbox 限制。 | 可借消息 schema／错误分流，保留现安全边界。`hasBeenActive` 是历史激活，不能作单次操作授权；声明七种 MIME 不等于实现七个 renderer／包解析器。 |
| 17 | `LiveMicActivityBars.tsx` | FFT512 六频段、0.08 noise gate、`energy^0.7` gamma、频段权重、连接波形 | **未采用**，无真实语音输入 consumer。 | 等实际 MediaStream 链就绪再抽算法；固定 bins 对应的 Hz 依赖采样率，应按 sampleRate/fftSize 计算。补 reduced motion、隐藏页暂停、AudioContext 清理及 hooks 规则适配。 |
| 18 | `McpToolDecisionCard.tsx` | 入参展开、Allow once／Always／Deny、pending/running/terminal 显示 | **未采用**。真实阻塞 UI 在 [rpc-manager.ts](../lib/rpc-manager.ts) 与 [ChatWindow.tsx](../components/ChatWindow.tsx)，不是该 demo 的 consumer。 | 只能先抽受控展示层。源码批准后 `setTimeout(1200)` 假成功，没有白名单／执行 gate；不允许把 UI 状态当权限或自动执行策略。 |
| 19 | `MediaLightboxViewer.tsx` | 自然尺寸／contain、光标锚定仿射 zoom、平移 clamp、拖拽阈值、wheel／媒体切换 | **局部适配**，只取自然尺寸／contain。[native-theme.css](../app/native-theme.css) 署名并由 ChatInput 的 `.composer-attachment-image`、MessageView 的 `.message-user-image` 实际消费。104 项定向测试与十二图实际页面检查通过，见下方证据。 | zoom／pan／wheel／媒体切换算法均未搬入；现有 ImagePreview 的焦点／Escape 通过只证明产品行为，不扩充来源采用范围。gap 已另有最终校准证据；原图内容比例／crop、绝对 bbox 和 DPI 仍不确定。 |
| 20 | `ModelSelectorEffort.tsx` | 可配置 effort 列表、推荐档、max 提示 | **未采用／独立实现**。[ChatInput.tsx](../components/ChatInput.tsx) 已按 Pi 实际 availableThinkingLevels 过滤。 | 借受控菜单排版；源码 `modes`／`disallowThinkingDisabled` 只是接口字段，未实施约束。保留 Pi off/minimal/auto、模型能力与当前未知值，不套固定推荐。 |
| 21 | `ModelSwitcherWithTokenGauge.tsx` | 圆周／dashoffset、占比 clamp、80% 警示、cache 分项 | **未采用／独立实现**。[ModelSelector.tsx](../components/ModelSelector.tsx)、[ContextUsageRing.tsx](../components/ContextUsageRing.tsx) 消费真实模型／context 数据。 | 可借圆环几何／菜单结构；固定旧模型、200k 与默认 token 是演示值。累计 usage 不能充当当前 context；保持未知状态及 Pi 成本口径。 |
| 22 | `ReasoningAmbientGlow.tsx` | 三相 pulse、非对称 shimmer、扫光、正弦移动 radial gradient | **未采用**。现 [ChatWindow.tsx](../components/ChatWindow.tsx)／[MessageView.tsx](../components/MessageView.tsx) 有真实 reasoning 状态，但未消费该光效。 | 可抽状态绑定的装饰；canvas 每帧重设尺寸，需补 DPR、暂停、reduce-motion。固定“深度推理”文案和演示活动状态不可直接使用。 |
| 23 | `RichComposerWithMentions.tsx` | IME/229＋WebKit 500ms guard、尾标点剥离、1024路径／256引用上限、建议键盘导航 | **未采用／独立实现**。[ChatInput.tsx](../components/ChatInput.tsx) 有 100ms composition guard、真实 slash／@／# 建议及草稿保护；无该组件导入。 | 优先抽 tokenizer／路径和引用边界案例；替换固定 suggestions，不能用字符乘0.75估计当精确 token。保留单次发送与不明确结果不重放的产品约束。 |
| 24 | `ScrollFadeContainer.tsx` | 2px 触边阈值、0/28px 羽化、非线性 alpha stops、双轴边缘传感 | **局部适配**。[ChangesPane.tsx](../components/ChangesPane.tsx) 的 `FadedScroll` 使用 2px 上／下边缘判定，消费于文件树、提交和 finder 列表；使用 ResizeObserver 观察容器及首个内容子元素，并随 children 改变重算。树与提交列表已随核心实际页面验证，精确动态边界／RTL 仍待专项。 | 产品采用 16px 羽化，未搬源非线性 alpha stops 或双轴 `both`；未使用 MutationObserver。源 `both` 返回空 mask 的缺口不能写成产品已采用的能力；RTL／实物仍待检验。 |
| 25 | `SegmentedControl.tsx` | 等分指示器公式、controlled/uncontrolled、CSS／layoutId 双模式 | **未采用**，无该组件 consumer；现设置／工具菜单各自实现。 | 可统一受控原子；固定 layoutId 多实例会串，缺 roving 键盘与空 tabs／无匹配值防御。依赖 CDS theme／Framer Motion，CSS 模式可单独采用。 |
| 26 | `StatusIndicators.tsx` | status dot、三点 phase、105° skeleton、数据到样式映射 | **未采用模块**。[SessionSidebar.tsx](../components/SessionSidebar.tsx) 的 needs-input/running/unread/idle 由真实状态驱动，不是该组件导入。 | 借 loading／skeleton，不覆盖用户明确的黄／蓝／hollow 状态。动画需 reduce-motion 和实际状态生命周期；不能把主题 keyframes 可用视为 status component 已采用。 |
| 27 | `StreamingDiffViewer.tsx` | `parseGitDiff`、行号对齐、unified/split、流式滚动／复制衰减 | **局部适配**。[ChangesPane.tsx](../components/ChangesPane.tsx) 的 `ReviewDiff` 与 [native-theme.css](../app/native-theme.css) 消费 HTML table 的共享行高、tabular-nums gutter 与语义增删背景；UI helper／toolbar 23 项通过；核心实际页面已检查 inline／split、context、word mark，见下方分轮证据。 | 既有 `parseUnifiedPatch`／split 替换配对继续来自产品 `patch.ts`，不是源 parser／占位 split 算法的采用。无 streaming／worker／增量引擎采用证据；当前纯文本加词差异 mark，语法高亮未实现。 |
| 28 | `ThinkingAccordion.tsx` | live-or-user-open 互斥、Grid 0fr↔1fr、引用复制、计时 | **未采用／独立实现**。[MessageView.tsx](../components/MessageView.tsx) 的 `ThinkingBlock` 有自身偏好与延迟加载。 | 借稳定高度展开，保留 deferred fetch／用户偏好／真实 streaming；无 Framer 依赖的 Grid 部分可单独采用，补键盘与 clipboard 错误。 |
| 29 | `createClaudeMainWindow.ts` | Electron host/view 分层、主题底色、状态圆角、traffic-light zoom 补偿 | **未采用**。产品 host 为 [src-tauri](../src-tauri)，无 Electron factory consumer。 | 仅作为 native 几何／白闪控制参考；依赖 Electron、preload 和 `__dirname`，不能从 renderer 总入口导入。Windows 窗口状态以 Tauri 与实物为准。 |
| 30 | `useClaudeRovingFocus.ts` | 方向／RTL／Home/End、循环索引、单 tabindex、preventScroll | **局部适配**。[ChangesPane.tsx](../components/ChangesPane.tsx) 的 `rove` 明确署名，菜单／文件树／提交列表消费索引移动、Home/End、单 tabstop 与 preventScroll；过滤 disabled、空列表、非当前子项及 IME／229；核心菜单与文件查找已有实际证据，完整键盘边界仍待专项。其他菜单／目录仍为独立实现。 | 产品采用边界 clamp，未搬源循环／RTL／水平模式；避开源 `-1` 哨兵导致首项 Up/Left 不回绕的缺口。无需声称采用二维 grid；动态焦点、窄窗仍应实际验证。 |
| 31 | `useClaudeScrollPinning.ts` | 150ms 意图锁、40px 贴底、120px 跳转阈值、程序滚动区分 | **局部适配**。[cds-scroll.ts](../lib/cds-scroll.ts) 的 `canFollowStream` 被 [useAgentSession.ts](../hooks/useAgentSession.ts) 的流式跟随／重新贴底路径实际调用。 | 已采用只限 150ms latch。保留产品分页、历史恢复与 prompt anchor，不用整 hook 覆盖；源码注释的 35vh buffer 不是该 hook 的已实施功能，其他阈值也不能记为已采用。 |
| 32 | `useClaudeSharedElementTransition.ts` | 圆角祖先追溯、object-fit contain inset、ViewTransition old/new 配对、reduce-motion fallback | **未采用**。没有该 hook 或其 TypeScript inset／圆角追溯 adapter 的产品 consumer。图片新批采用的是 MediaLightboxViewer 的自然尺寸／contain CSS，不能重复计入本模块。 | 圆角／inset 算法仍有局部抽取价值；完整共享转场须另补并发清理、浏览器兼容、减少动态效果及焦点恢复证据。现有预览／主题转场不证明采用该 hook。 |
| 33 | `useRateLimitBackoff.ts` | 5s 基数、指数增长、10min 封顶、±15% jitter、3次自动后转手动、倒计时 | **未采用**。[ChatInput.tsx](../components/ChatInput.tsx) 显示 SDK retryInfo，[useSessionAutomation.ts](../hooks/useSessionAutomation.ts) 控制 SDK retry，不消费此 hook。 | 可借纯 delay／countdown，先定义幂等边界。源码不识别 HTTP 429/503，也不是 full jitter／完整 circuit breaker；不得另起已接受 prompt 或外部操作的自动重放。 |

## 尚未使用的高价值算法优先项

1. **弹簧解析解与曲线采样**：从已 vendor 的 `calcDampedHarmonicOscillator` 开始，先增加纯算法 consumer，例如既有控件动效的时间序列校验／CSS 曲线生成；随后逐控件采用，分别记录 spring、交互状态、reduce-motion 和实物残差。文件存在不算启用。
2. **小算法的剩余采用面**：文件名保后缀截断仍未采用；roving 索引与 ScrollFade 边缘判定已局部接入 Changes，其他菜单／selector／tabs 仍是候选。先修相应边界，再逐个登记新 consumer，不把一个面板的适配外推到全站。
3. **拖放重排**：抽 before/after 命中与移除索引补偿，接已有 pinned/group metadata；键盘与指针共享同一排序事务。不要搬演示 sessions，也不把数组 splice 称为拓扑算法。
4. **受控呈现组件**：Segmented、Thinking、Status、MCP card 值得逐个适配，但 pending／运行／完成／权限／token 必须保留后端真值；先拆 demo timers 与静态数据。
5. **有依赖后再采用**：FFT 等真实音频链、host 工厂仅宿主参考、backoff 先落实幂等约束；diff 的解析／增量引擎、image 的 zoom／转场尚未采用。采用更多模块不是绕过这些边界的理由。

## 演示与平台限制

- [源包总入口](https://github.com/Caho1/open-claude-ui/blob/638800b8a4cee4513c8763c3df0ecf8a77b32379/src/index.ts) 重导出 Electron factory。renderer 不整包引入；按受控 adapter／模块导入，避免带入 Electron／Node 宿主依赖。
- 多个 TSX 依赖源主题、Tailwind 语义类、CSS keyframes 或 Framer Motion。将文件复制到 vendor 后仍须核对实际 CSS 产出、客户端边界和产品消费链。
- `ConfirmationDialog` 的 focus trap、Cowork 的 BroadcastChannel／委派、SplitPane 的死区／spring，以及 backoff 的 full jitter 等注释并非本版本实际实现。账本以源码和验证为准，不把注释承诺变为产品能力。
- 合成音、系统字体与库内 macOS 取证不构成 Windows 官方素材／逐像素一致性的证据；用户新参考与明确选择继续优先。

## 本轮验证与尚存差异

- 图片批次的 104 项定向测试通过；实际页面 `test-results/pilaude/image-wrap-reference/run-1792314555476/` 通过 1504／972 CSS 宽下十二图 3×4、390／320 窄窗与短窗口、末图删除真实命中、预览焦点／Escape、12→11 顺序及刷新恢复。会话 GET 是显式生成 PNG 夹具，composer 使用真实文件输入；`pageErrors`、`blockedWrites` 均为空，零模型请求。首轮 `run-1792314194925` 的按钮宽 345.59px、图片宽 288px 是真实命中范围缺陷，已修 max-width 并保留原失败。
- 最终 gap 校准 `test-results/pilaude/image-wrap-reference/run-1792315159076/` 的 18 项实际检查通过：7.2 CSS px 在 1.25 capture 下对应 9 原像素，DOM 测得 7.1875–7.203125 CSS px，按 0.1px 容差验收；sent／composer 在 972 CSS 宽下均为四行三列，并重验自然比例／边界、预览、390／320 窄窗、600px 短窗、末图删除及刷新。旧 8px 运行相对参考的 +1 原像素间距差已校准，但原始内容比例、crop／letterbox、绝对 bbox、DPI 与聊天 payload 身份仍未核实，不称完整像素一致。首次精校 `run-1792315052370` 因 Context 开启令容器从 884 缩到 538 CSS px、checker 仍断言三列而 failed，保留原记录；最终通过仅调整 checker 的真实关闭条件，无模型／API 写入／页面错误。
- 图片离开整组灰色 bubble 的最后修正由 `test-results/pilaude/image-wrap-reference/run-1792316235152/` 的 16 项实际断言验证：透明画布、无空 bubble，图片后短文字／SDK compact command 为独立单个灰色 bubble，长文展开后保留 300px 滚动上限；十二图、7.2px 间距、预览和 390／320 窄屏继续通过。MessageView／ImagePreview 39 项通过。旧 `run-1792315159076` 仅继续证明未改动的 composer／删除／刷新路径，旧带灰底的 sent 图不作为最终外观。
- Changes 后端真实 Git fixture／API 共 19 项，UI helper／toolbar 共 23 项（19＋4），Rust 窗口 4 项、前端命令 5 项、页面 route 5 项与 token 2 项分别通过；父级另有 39 项集成与类型检查通过。copy 目标混源 patch 的真实缺陷已复现并通过 `--diff-filter=C` 修正，新增 copy／rename／context3 组合 3 项通过；后端现 20 个用例，不把前轮 19 与重跑 3 相加。延迟 storage event 的 current request ID 校验另有 3 项 helper 通过；核心实际页面 `run-1792315635019` 前七组通过，整轮因 popout ACK 保留 failed；独立定向 `followup-1792316406830` 通过真实浏览器开窗与草稿 ACK、浅色重载及 820px 窄窗表格加载。此前 `followup-1792316105640` 无 ACK 仍为 partial，原因未证；不将这些分组相加冒充完整 E2E 一次全绿。最终类型和全树 ESLint 退出 0；保留既有 TerminalPanel `aria-description` 一条警告。

## 更新条件

每次采用后更新对应行：来源 SHA／函数 → adapter 或 vendor → 真实 consumer → 边界测试 → 实际页面／交互证据 → 尚存差异。纯算法也必须给出调用者；只加导出、复制文件、相似独立实现或通过库自身 build 都不足以升级采用状态。本次文档审计只读取已保存代码与其他实施批次的原始证据，未自行启动应用、模型或浏览器；尚未完成的工作继续保留待验。
