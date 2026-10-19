# open-claude-ui 组件与算法采用账本

审计日期：2026-10-19（保留各批原始验证日期）。范围是 `code-examples/` 中的 **33 个 TS/TSX 源模块**；不把 `src/index.ts`、类型声明、主题 CSS 或 Storybook 算作组件模块。参考 checkout 为 `7490e105e418adf2b94c55ff716bb0973d44fb85`，包含作者提交 `638800b8a4cee4513c8763c3df0ecf8a77b32379`。模块源码统一以[该作者提交的 code-examples](https://github.com/Caho1/open-claude-ui/tree/638800b8a4cee4513c8763c3df0ecf8a77b32379/code-examples)为依据；MIT 来源见 [vendor 记录](../vendor/open-claude-ui/README.md)。

本账本回答“哪些源码或算法已被产品实际消费”，不证明 Windows 视觉一致性。逐像素和交互验收仍按[复刻基准](pilaude-ui-parity.md)执行。2026-10-18 的图片批次已完成定向测试和实际页面检查；Changes 已能指出局部算法 consumer，后端定向验证、核心页面和独立窗口目标交接均有证据；原生窗口、完整单轮回归及像素残差仍待完成。局部适配只覆盖明确列出的算法，不扩展为整个源组件已经采用。

## 状态与证据规则

- **直接采用**：产品运行路径导入受控 vendor 组件，并能指出实际渲染点。
- **局部适配**：提取了来源算法，有署名 adapter 和实际调用点；不把未搬入的其余行为算作已采用。
- **仅 vendor**：文件已复制，但没有产品运行时消费者。源码存在或导出不代表功能生效。
- **未采用／独立实现**：产品已有同类能力，但没有来源适配证据。下表中的产品文件是现有实现或候选接点，不是采用证明。
- **正在适配、未验**：新批进行中；不提前统计为直接采用或功能、视觉通过。

截至本次审计，33 个模块中：1 项 `CdsButton` 直接采用；11 项有明确局部适配：`useClaudeScrollPinning` 的 150ms 锁、`MediaLightboxViewer` 的自然尺寸／contain 与图片视图几何、`ScrollFadeContainer` 的边缘判定、`useClaudeRovingFocus` 的索引与单 tabstop、`StreamingDiffViewer` 的表格／gutter 呈现，`ClaudeMotionPresets` 的弹簧求解器／SNAPPY 采样，`AttachmentCard` 的文件名前缀／最后扩展名分离与分段收缩布局、`ThinkingAccordion` 的受控 Grid 展开、`CodeBlock` 的 2.5 秒复制反馈／衰减，`DraggableSessionList` 的固定根会话键盘相邻重排，以及 `ReasoningAmbientGlow` 的 ShimmerText 背景几何／非对称关键帧。新增 consumer 与测试已有证据，实际页面检查按下方分轮记录；不将局部算法采用升级为完整组件或 Windows 一致性通过。其余 21 项未确认采用。主题 CSS 另已由 [app/layout.tsx](../app/layout.tsx) 导入，不计入这 33 项，也不将所有使用同类 CSS 的控件算作源模块采用。

`ThinkingAccordion` 的 Grid 展开部分已通过真实 `MessageView → ThinkingDisclosure` 路径及九组实际页面检查，登记为**局部适配，仅 Grid 部分**。后续代码复制反馈、固定会话键盘重排和活动微光分别新增限定 consumer，当前计数为 1 项直接采用／11 项局部适配／21 项未确认采用；这不代表完整源组件或 Windows 视觉一致性通过。

`react-diff-view@3.3.3` 是另行记录的 npm 运行时库，不属于上面的 open-claude-ui 33 个模块。它接入 Changes 的通用 diff 呈现，本身不改变 open-claude-ui 的采用计数。既有 `StreamingDiffViewer` 记录只保留 table／gutter 的局部呈现借鉴，不能把新库的 parser、split 配对、tokenize 或词差异能力归入该来源。新渲染路径的最终功能／视觉验收仍待完成，见下方独立记录。

目前的直接消费链：

1. [PilaudeDataSection.tsx](../components/PilaudeDataSection.tsx) 导入 `CdsButton`，用于 `pilaude.data.preview` 和 `pilaude.data.import` 两个动作；[SettingsPanel.tsx](../components/SettingsPanel.tsx) 挂载该区域。
2. [lib/cds-scroll.ts](../lib/cds-scroll.ts) 明确署名适配 `useClaudeScrollPinning`，导出 `canFollowStream(lastUserInputAt, now)`；[useAgentSession.ts](../hooks/useAgentSession.ts) 的流式滚动跟随和重新贴底路径调用它。
3. [native-theme.css](../app/native-theme.css) 的图片样式明确署名 `MediaLightboxViewer` 自然尺寸／contain 几何，经 `.composer-attachment-image` 与 `.message-user-image` 消费到 [ChatInput.tsx](../components/ChatInput.tsx) 和 [MessageView.tsx](../components/MessageView.tsx)。新增 [image-view-transform.ts](../lib/image-view-transform.ts) 适配光标锚定 zoom、近 fit 平移约束与 wheel 指数缩放，由 [ImagePreview.tsx](../components/ImagePreview.tsx) 的真实灯箱消费；共享元素 inset／圆角追溯和 ViewTransition 仍未采用。
4. [ChangesPane.tsx](../components/ChangesPane.tsx) 的 `rove` 与 `FadedScroll` 分别适配 roving 索引／Home/End／单 tabstop 和 2px 边缘判定；[ReviewDiff.tsx](../components/ReviewDiff.tsx) 与 [native-theme.css](../app/native-theme.css) 保留 `StreamingDiffViewer` 的 table／tabular-nums gutter 与语义增删背景借鉴。通用表格、unified／split、解析／配对与 token／词差异已由独立的 `react-diff-view` 消费链负责，不计为该源算法采用。既有 [patch.ts](../lib/patch.ts) 仍供 FileViewer／MessageView 的其他路径使用；Changes 不再消费它。
5. [file-name-display.ts](../lib/file-name-display.ts) 与 [TabBar.tsx](../components/TabBar.tsx) 分别消费 `AttachmentCard` 最后扩展名分离与 prefix／extension 双 span 布局，CSS 按宽度省略，无字符硬切；普通文件标签路径／ARIA／开关动作不改。
6. [cds-motion.ts](../lib/cds-motion.ts) 导入 [vendored ClaudeMotionPresets.ts](../vendor/open-claude-ui/ClaudeMotionPresets.ts) 的求解器和实际 `SPRING_SNAPPY`（320／28／1），补参数域、近临界与重阻尼数值边界，以 120Hz 生成 CSS `linear()` 采样；[DomContextMenuHost.tsx](../components/DomContextMenuHost.tsx) 的 `MenuPanel` 放置后实际消费曲线作 opacity 进入。没有搬 scale／y、退出延迟或其他 variants；opacity 会钳制物理超调，不能称为可见回弹。quiet [PilaudeWelcome.tsx](../components/PilaudeWelcome.tsx) 仍不消费这些 presets。
7. **局部适配，仅 Grid 部分**：[MessageView.tsx](../components/MessageView.tsx) 的 `ThinkingBlock` 挂载 [ThinkingDisclosure.tsx](../components/ThinkingDisclosure.tsx)，配合 [native-theme.css](../app/native-theme.css) 消费 `ThinkingAccordion` 的 Grid `0fr↔1fr` 与 200ms `cubic-bezier(.19,1,.22,1)`。产品继续控制展开偏好、延迟历史 fetch／重试和早关闭隔离；后续活动批次用真实 indexed start／delta／end 驱动单个微光，不强制 live 展开。先前九组实际页面已通过加载／重试／缓存、设置／键盘、过渡／中断清理和深浅 390px，仍不等于完整源组件通过，见下方分轮记录。

8. **局部适配，仅复制反馈**：[MarkdownBody.tsx](../components/MarkdownBody.tsx) → [MermaidBlock.tsx](../components/MermaidBlock.tsx) 中 CodeBlock → [CodeCopyButton.tsx](../components/CodeCopyButton.tsx)，配合 native theme 和已导入的 vendor keyframes，消费源 CodeBlock 的 2.5 秒／saved-check-decay。复制原文与成功仍以现有 clipboard 回退链为准。
9. **局部适配，仅键盘重排**：[sidebar-session-metadata.ts](../lib/sidebar-session-metadata.ts) → [SessionSidebar.tsx](../components/SessionSidebar.tsx) 真实固定根会话按钮，消费 DraggableSessionList 的相邻索引／边界／splice；领域适配只更新同组已显示根会话的持久 pin slots，保留家族、草稿、焦点和其他 metadata。
10. **局部适配，仅 ShimmerText**：[native-theme.css](../app/native-theme.css) 的 `.activity-shimmer` 消费 ReasoningAmbientGlow 的 250% 背景与 vendor `cds-shimmer-text-shine` 非对称关键帧；[ChatWindow.tsx](../components/ChatWindow.tsx) 与 [MessageView.tsx](../components/MessageView.tsx) 用实际事件选择收起摘要／当前思考／工具／等待提示的唯一可见 consumer。产品按用户清单使用 1.8 秒中性循环，并在完成／中断／隐藏／reduced-motion 时停止；未采用 glow canvas、pulse 或扫光层。

## 33 个模块逐项记录

“未采用”行仍列出产品消费证据的缺口和可落地的候选点；相似的独立实现不能用来填“已采用”。源文件内的注释与实际代码不符时，以下限制以实际代码为准。

| # | 源模块 | 关键算法／交互 | 当前采用状态与实际 consumer 证据 | 可适配方向、依赖及未实施部分 |
| --- | --- | --- | --- | --- |
| 01 | `ArtifactsSplitPaneResizer.tsx` | 比例 min/max clamp、右侧折叠、pointer capture、Escape 回滚、双击 50/50 | **未采用／独立实现**。[useResizablePanel.ts](../hooks/useResizablePanel.ts)、[WorkspacePaneDock.tsx](../components/WorkspacePaneDock.tsx) 已有产品 resize／多列逻辑，无该模块导入。 | 可抽比例约束与回滚案例，保留产品多列布局与持久化。源码没有注释所说的 4px 死区、左侧折叠或 spring；其 shield 为 `pointer-events:none`，不能据此声称防 iframe 吞事件已解决。 |
| 02 | `AttachmentCard.tsx` | `truncateFileName` 保留最后扩展名、前缀截断、扩展名 badge、tile/chip | **局部适配**。[file-name-display.ts](../lib/file-name-display.ts) 适配最后扩展名分离，[TabBar.tsx](../components/TabBar.tsx) 的普通文件标签消费前缀／扩展名双 span 布局。helper／组件／原标签阅读状态共 16 项定向测试通过，窄容器实际证据另记。 | 不搬固定 14／20 字符阈值，CSS 按实际宽度省略，完整标签／路径／ARIA 不变；异常长后缀上限为标签宽度 50%，保留前缀与关闭入口。dotfile 和尾点不作扩展名，多点只保最后后缀。Terminal／Artifact 仍用原标题；未采用 tile／chip、badge 或演示上传进度，未有此状态官方参考。 |
| 03 | `CdsButton.tsx` | 外定位／内 paint 分层，尺寸／variant，加载禁用，CSS spring 按压 | **直接采用**。[PilaudeDataSection.tsx](../components/PilaudeDataSection.tsx) 的 preview/import 动作消费；[SettingsPanel.tsx](../components/SettingsPanel.tsx) 挂载。当前欢迎页不是 consumer。 | 已有默认 `type="button"`、显式 variant/size 类和 Tailwind 4 样式适配。继续统一按钮时逐个登记使用点与状态证据，不把 vendor 存在算全站采用。 |
| 04 | `CdsMotionEngine.tsx` | 200ms 按压、30ms chip 级联、105° skeleton sweep | **未采用**，无产品 consumer。 | 这是演示画布而非通用引擎。提取时序或 CSS，去掉固定 chips、演示色值、定时器和依赖外部动画类的展示逻辑。 |
| 05 | `ChatComposer.tsx` | IME／229 Enter 保护、field-sizing、外点关菜单、附件局部状态 | **未采用／独立实现**。[ChatInput.tsx](../components/ChatInput.tsx) 有真实 Pi 输入器、草稿、队列和提交锁，无该组件导入。 | 可借布局／菜单样式，保留产品单次提交、延迟引用、拒绝恢复及会话切换保护。固定旧模型、模拟附件与发送后无条件清空不可移植。20px／Clay focus 也不能覆盖用户最新紧凑中性输入框选择。 |
| 06 | `ChatComposerChin.tsx` | 36px 触控／28px 下颌行变量、失败队列横幅 | **未采用**。[ChatInput.tsx](../components/ChatInput.tsx) 的 `QueuedMessageRow` 与真实 queuedMessages 是独立实现。 | 可抽受控行与横幅。源码没有 localStorage 队列，Attach／发送按钮也未接行为；不能直接显示“已保存在本地”或给不明确结果的请求自动 Retry。 |
| 07 | `ChatMessageBubbles.tsx` | 高度测溢出／Read more、hover 操作、复制衰减、思考／artifact 外壳 | **未采用／独立实现**。[MessageView.tsx](../components/MessageView.tsx) 的 user／assistant 渲染有自身 block 和工具语义。 | 借测溢出和操作显隐，保留 Pi 工具嵌套、分叉、错误、延迟思考及真实统计；不要用示例 Claude 标识和固定内容替换。 |
| 08 | `ClaudeAudioPlayer.ts` | 单例 AudioContext、gain ramp、四种合成音、sinkId 和 BYO fallback | **未采用／独立实现**。[hooks/useAudio.ts](../hooks/useAudio.ts) 有自有双音 completion；[AppShell.tsx](../components/AppShell.tsx) 消费。 | 可抽 envelope 与输出设备支持，接用户音效偏好及生命周期。合成音不等于官方声效；需处理用户激活、context suspend／close、sinkId 支持情况。 |
| 09 | `ClaudeDesktopHeader.tsx` | macOS 74px 避让、`74/min(zoom,1)` 补偿、45px drag band | **未采用**。产品顶栏使用 Tauri，未导入该模块。 | 仅 macOS host 几何参考；依赖 `window.electronAPI`、WebkitAppRegion，不能直接搬进 Windows Tauri renderer。 |
| 10 | `ClaudeMotionPresets.ts` | `calcDampedHarmonicOscillator` 欠／临界／过阻尼解析解；四 springs、CSS easing、message/popover/modal/grapheme variants | **局部适配**。[cds-motion.ts](../lib/cds-motion.ts) 导入求解器和 SNAPPY 320／28／1，实际消费于 [DomContextMenuHost.tsx](../components/DomContextMenuHost.tsx) 的 61 点 CSS `linear()` opacity 进入。纯算法及实际 JSX／CSS consumer 测试通过，页面验证分轮记录于下方。 | 参数域及近临界／重阻尼数值边界由 adapter 补偿，vendor 未改。仅 opacity，布局与命中区域保持原位；reduced motion 静态、关闭即时。未采用其他 springs／variants／空间回弹，source 数值与 AGENTS 文案冲突以源码为准。 |
| 11 | `CodeBlock.tsx` | 行号表格／tabular-nums、复制 2.5s 衰减、语言与文件头 | **局部适配，仅复制反馈**。[CodeCopyButton.tsx](../components/CodeCopyButton.tsx) 与 [native-theme.css](../app/native-theme.css) 消费 2500ms 和现有 vendor `saved-check-decay`，由 [MermaidBlock.tsx](../components/MermaidBlock.tsx) 的真实 CodeBlock 挂载，涵盖普通 fence 与 Mermaid source。实际三轮 RED→GREEN 验证成功时序、重复重置与失败重试，后续边界另记。 | 保留产品 Prism／行号、流式纯文本、headerAction 与原文空白；不搬 `code.trim()`、默认 typescript、源几何和未等待 clipboard 的假成功。产品补现有桌面／浏览器回退链、可本地化失败、定时器清理、旧源码／卸载／陈旧结果隔离、重复动画重启与 reduced-motion；无对应 Windows 逐状态参考，不称完整组件一致。 |
| 12 | `ConfirmationDialog.tsx` | 400/520/720px 阶梯、遮罩、Escape、进入／退出 | **未采用／独立实现**。[ChatWindow.tsx](../components/ChatWindow.tsx) 等处有真实扩展对话框；无该组件导入。 | 必须接现有 dialog／Escape 栈、焦点进入和恢复；源码没有注释宣称的 focus trap。依赖 Framer Motion、CdsButton 与主题类。 |
| 13 | `ContainerResponsiveBar.tsx` | 命名 container query、576/480/384px 逐级隐藏与压缩 | **未采用**。[native-theme.css](../app/native-theme.css) 有局部附件容器查询，不等于采用该 toolbar。 | 可抽窄 pane toolbar 的分级规则；将固定模型、Settings／Run 演示内容换为真实 slots。确认 Tailwind 4 命名 container 类产出和最低宽度，不照抄注释未实现的能力。 |
| 14 | `CoworkAgentCanvas.tsx` | Agent／artifact 列表、选择与状态卡片 | **未采用／独立实现**。[AppShell.tsx](../components/AppShell.tsx) 的 Tasks pane 挂载真实 `AgentSessionPanel`／session family。 | 仅借受控呈现，接 Pi 父子任务、真实产物与 SSE。源码为固定 DEFAULT_AGENTS／DEFAULT_ARTIFACTS，未实现 BroadcastChannel、任务委派或拓扑状态机，按钮也不是执行能力。 |
| 15 | `DraggableSessionList.tsx` | before/after 中点命中、移除后索引补偿、跨 pinned 分区、Alt 上下重排 | **局部适配，仅键盘相邻重排**。[sidebar-session-metadata.ts](../lib/sidebar-session-metadata.ts) 的 `moveSidebarPinnedSession` 署名适配相邻索引／边界／splice，[SessionSidebar.tsx](../components/SessionSidebar.tsx) 真实选择按钮消费；固定列表按持久化 pin rank 呈现。39 项定向检查与五组实际页面通过，详见下方。 | 仅同项目／自定义组内已显示的固定持久化根会话，保持后代、其他 pin slots／组／归档数据、原按钮焦点、草稿和跨窗 storage 同步。排除筛选／搜索、最近重复项、子项、临时／归档／未显示条目；不搬演示 sessions、指针死区／中点／drop 或跨区 pinning，不把 splice 称为拓扑引擎或 Windows 完整一致。 |
| 16 | `EpitaxyIframeBridge.tsx` | frame source 校验、null-origin／allowlist、channel／error 分流 | **未采用／独立实现**。[useHtmlPreviewFrame.ts](../hooks/useHtmlPreviewFrame.ts)、[html-preview.ts](../lib/html-preview.ts) 已有 source、协议与 sandbox 限制。 | 可借消息 schema／错误分流，保留现安全边界。`hasBeenActive` 是历史激活，不能作单次操作授权；声明七种 MIME 不等于实现七个 renderer／包解析器。 |
| 17 | `LiveMicActivityBars.tsx` | FFT512 六频段、0.08 noise gate、`energy^0.7` gamma、频段权重、连接波形 | **未采用**，无真实语音输入 consumer。 | 等实际 MediaStream 链就绪再抽算法；固定 bins 对应的 Hz 依赖采样率，应按 sampleRate/fftSize 计算。补 reduced motion、隐藏页暂停、AudioContext 清理及 hooks 规则适配。 |
| 18 | `McpToolDecisionCard.tsx` | 入参展开、Allow once／Always／Deny、pending/running/terminal 显示 | **未采用**。真实阻塞 UI 在 [rpc-manager.ts](../lib/rpc-manager.ts) 与 [ChatWindow.tsx](../components/ChatWindow.tsx)，不是该 demo 的 consumer。 | 只能先抽受控展示层。源码批准后 `setTimeout(1200)` 假成功，没有白名单／执行 gate；不允许把 UI 状态当权限或自动执行策略。 |
| 19 | `MediaLightboxViewer.tsx` | 自然尺寸／contain、光标锚定仿射 zoom、平移 clamp、拖拽阈值、wheel／媒体切换 | **局部适配**。[native-theme.css](../app/native-theme.css) 的自然尺寸由 ChatInput／MessageView 消费；新增 [image-view-transform.ts](../lib/image-view-transform.ts) 的 contain、光标锚定、近 fit 平移和 wheel 指数实际接入 [ImagePreview.tsx](../components/ImagePreview.tsx)，4px 拖拽阈值由事件层消费。十五项定向测试通过，页面证据另记。 | 保留产品原生 dialog 的焦点／Escape，补 resize／src 切换重置、pointercancel 和加载失败状态。未加入双指捏合、灯箱内媒体导航或共享转场；原图内容比例／crop、绝对 bbox 和 DPI 仍不确定。 |
| 20 | `ModelSelectorEffort.tsx` | 可配置 effort 列表、推荐档、max 提示 | **未采用／独立实现**。[ChatInput.tsx](../components/ChatInput.tsx) 已按 Pi 实际 availableThinkingLevels 过滤。 | 借受控菜单排版；源码 `modes`／`disallowThinkingDisabled` 只是接口字段，未实施约束。保留 Pi off/minimal/auto、模型能力与当前未知值，不套固定推荐。 |
| 21 | `ModelSwitcherWithTokenGauge.tsx` | 圆周／dashoffset、占比 clamp、80% 警示、cache 分项 | **未采用／独立实现**。[ModelSelector.tsx](../components/ModelSelector.tsx)、[ContextUsageRing.tsx](../components/ContextUsageRing.tsx) 消费真实模型／context 数据。 | 可借圆环几何／菜单结构；固定旧模型、200k 与默认 token 是演示值。累计 usage 不能充当当前 context；保持未知状态及 Pi 成本口径。 |
| 22 | `ReasoningAmbientGlow.tsx` | 三相 pulse、非对称 shimmer、扫光、正弦移动 radial gradient | **局部适配，仅 ShimmerText**。[native-theme.css](../app/native-theme.css) 的 `.activity-shimmer` 署名消费 250% 背景和已导入 vendor 的非对称 `cds-shimmer-text-shine`；[ChatWindow.tsx](../components/ChatWindow.tsx)／[MessageView.tsx](../components/MessageView.tsx) 按实际活动事件消费，实际 `activity-disclosure/run-1792375885811/` 测到 1.8s timeline 与背景位置移动。 | 按用户选择使用中性色及 1.8 秒周期；折叠摘要／当前思考／工具／等待提示只有一个可见持续动画，完成／中断／隐藏／reduced-motion 停止。未采用 pulse、glow canvas、扫光或演示状态，不能称整个模块采用。 |
| 23 | `RichComposerWithMentions.tsx` | IME/229＋WebKit 500ms guard、尾标点剥离、1024路径／256引用上限、建议键盘导航 | **未采用／独立实现**。[ChatInput.tsx](../components/ChatInput.tsx) 有 100ms composition guard、真实 slash／@／# 建议及草稿保护；无该组件导入。 | 优先抽 tokenizer／路径和引用边界案例；替换固定 suggestions，不能用字符乘0.75估计当精确 token。保留单次发送与不明确结果不重放的产品约束。 |
| 24 | `ScrollFadeContainer.tsx` | 2px 触边阈值、0/28px 羽化、非线性 alpha stops、双轴边缘传感 | **局部适配**。[ChangesPane.tsx](../components/ChangesPane.tsx) 的 `FadedScroll` 使用 2px 上／下边缘判定，消费于文件树、提交和 finder 列表；使用 ResizeObserver 观察容器及首个内容子元素，并随 children 改变重算。树与提交列表已随核心实际页面验证，精确动态边界／RTL 仍待专项。 | 产品采用 16px 羽化，未搬源非线性 alpha stops 或双轴 `both`；未使用 MutationObserver。源 `both` 返回空 mask 的缺口不能写成产品已采用的能力；RTL／实物仍待检验。 |
| 25 | `SegmentedControl.tsx` | 等分指示器公式、controlled/uncontrolled、CSS／layoutId 双模式 | **未采用**，无该组件 consumer；现设置／工具菜单各自实现。 | 可统一受控原子；固定 layoutId 多实例会串，缺 roving 键盘与空 tabs／无匹配值防御。依赖 CDS theme／Framer Motion，CSS 模式可单独采用。 |
| 26 | `StatusIndicators.tsx` | status dot、三点 phase、105° skeleton、数据到样式映射 | **未采用模块**。[SessionSidebar.tsx](../components/SessionSidebar.tsx) 的 needs-input/running/unread/idle 由真实状态驱动，不是该组件导入。 | 借 loading／skeleton，不覆盖用户明确的黄／蓝／hollow 状态。动画需 reduce-motion 和实际状态生命周期；不能把主题 keyframes 可用视为 status component 已采用。 |
| 27 | `StreamingDiffViewer.tsx` | `parseGitDiff`、行号对齐、unified/split、流式滚动／复制衰减 | **局部适配，仅呈现借鉴**。[ReviewDiff.tsx](../components/ReviewDiff.tsx) 与 [native-theme.css](../app/native-theme.css) 保留 HTML table 的共享行高、tabular-nums gutter 与语义增删背景；ChangesPane 挂载该 renderer。下方早期 inline／split、context、word mark 证据对应迁移前实现；新运行路径单独记录，最终验收待补。 | 通用 renderer、parser、split 配对、tokenize 和 markEdits 来自另行采用的 `react-diff-view@3.3.3`；语法仍用产品既有 Prism／refractor 注册表，由 `review-diff-renderer` 薄适配分 hunk／revision 调用库接口。旧 `review-syntax` 已删除，`patch.ts` 仅留在其他 consumer；以上均不是该源 parser／占位 split／lexer 的采用。无 streaming／worker／增量引擎采用证据，不增加本来源计数。 |
| 28 | `ThinkingAccordion.tsx` | live-or-user-open 互斥、Grid 0fr↔1fr、引用复制、计时 | **局部适配，仅 Grid 部分**。来源为作者 `638800b8a4cee4513c8763c3df0ecf8a77b32379`；[ThinkingDisclosure.tsx](../components/ThinkingDisclosure.tsx) 与 [native-theme.css](../app/native-theme.css) 适配 `0fr↔1fr`、200ms `cubic-bezier(.19,1,.22,1)`，由 [MessageView.tsx](../components/MessageView.tsx) 的真实 `ThinkingBlock` 消费。实际 `thinking-disclosure/run-1792341152373/` 九组通过，已按该有限范围计入局部适配。 | 保留产品展开偏好／通知、deferred fetch／重试、早关闭后忽略旧响应和 IME；adapter 补原生 button、ARIA／inert、关闭过渡内容保留与 reduced-motion。后续活动批次以 indexed thinking start／delta／end 证明当前块，微光另记为 ReasoningAmbientGlow 的局部 consumer；不强制 live 展开。未搬源 clipboard、复制成功 timer、elapsed 格式／模拟计时和其他布局，不称整个源组件采用或 Windows 同状态一致。 |
| 29 | `createClaudeMainWindow.ts` | Electron host/view 分层、主题底色、状态圆角、traffic-light zoom 补偿 | **未采用**。产品 host 为 [src-tauri](../src-tauri)，无 Electron factory consumer。 | 仅作为 native 几何／白闪控制参考；依赖 Electron、preload 和 `__dirname`，不能从 renderer 总入口导入。Windows 窗口状态以 Tauri 与实物为准。 |
| 30 | `useClaudeRovingFocus.ts` | 方向／RTL／Home/End、循环索引、单 tabindex、preventScroll | **局部适配**。[ChangesPane.tsx](../components/ChangesPane.tsx) 的 `rove` 明确署名，菜单／文件树／提交列表消费索引移动、Home/End、单 tabstop 与 preventScroll；过滤 disabled、空列表、非当前子项及 IME／229；核心菜单与文件查找已有实际证据，新增键盘意图函数明确区分 pane chrome、编辑器、修饰键和 IME；实际焦点专项及其修复状态见后续记录。其他菜单／目录仍为独立实现。 | 产品采用边界 clamp，未搬源循环／RTL／水平模式；避开源 `-1` 哨兵导致首项 Up/Left 不回绕的缺口。无需声称采用二维 grid；动态焦点、窄窗仍应实际验证。 |
| 31 | `useClaudeScrollPinning.ts` | 150ms 意图锁、40px 贴底、120px 跳转阈值、程序滚动区分 | **局部适配**。[cds-scroll.ts](../lib/cds-scroll.ts) 的 `canFollowStream` 被 [useAgentSession.ts](../hooks/useAgentSession.ts) 的流式跟随／重新贴底路径实际调用。 | 已采用只限 150ms latch。保留产品分页、历史恢复与 prompt anchor，不用整 hook 覆盖；源码注释的 35vh buffer 不是该 hook 的已实施功能，其他阈值也不能记为已采用。 |
| 32 | `useClaudeSharedElementTransition.ts` | 圆角祖先追溯、object-fit contain inset、ViewTransition old/new 配对、reduce-motion fallback | **未采用**。没有该 hook 或其 TypeScript inset／圆角追溯 adapter 的产品 consumer。图片新批采用的是 MediaLightboxViewer 的自然尺寸／contain 与 zoom／pan 适配，不能重复计入本模块。 | 圆角／inset 算法仍有局部抽取价值；完整共享转场须另补并发清理、浏览器兼容、减少动态效果及焦点恢复证据。现有预览／主题转场不证明采用该 hook。 |
| 33 | `useRateLimitBackoff.ts` | 5s 基数、指数增长、10min 封顶、±15% jitter、3次自动后转手动、倒计时 | **未采用**。[ChatInput.tsx](../components/ChatInput.tsx) 显示 SDK retryInfo，[useSessionAutomation.ts](../hooks/useSessionAutomation.ts) 控制 SDK retry，不消费此 hook。 | 可借纯 delay／countdown，先定义幂等边界。源码不识别 HTTP 429/503，也不是 full jitter／完整 circuit breaker；不得另起已接受 prompt 或外部操作的自动重放。 |

## 2026-10-19 代码复制与固定根会话键盘适配

CodeBlock 复制反馈经历三轮实际 RED→GREEN：原 1500ms 时限、重复成功被旧 timeout 提前清空、clipboard／execCommand 均失败时没有可重试反馈。真实新 consumer 保 source 原文／Prism／流式和 Mermaid 操作，接源 2500ms＋saved-check-decay，补成功后计时、旧结果失效和本地化错误。空 fence `undefined` 的 SSR RED 及空块提示裁切也已修复。最终 `code-copy/run-1792373651369/` 七组通过精确原文／空串、异步乱序、源码变化／卸载、重复／失败重试、深浅 390px、主题背景与 Mermaid header。正常动效在无 mock clock 新 context 实测 opacity 0.794868（2466.519ms），reduced motion 静态；早期 clock 采样失败与错误浮层裁切报告保留。checker 已接完整 E2E runner，但该完整 runner 和 Windows 原生 clipboard 尚未据此通过。

DraggableSessionList 只采用键盘相邻索引／边界／splice：持久 pin rank、纯 metadata helper 与真实选择按钮有 RED→GREEN。39 项定向检查通过；额外审查复现选中预览外根会话时重排让焦点行消失，成功重排现同批展开项目预览保 keyed 按钮，边界 no-op 保上限。最终独立 tracked `e2e/sidebar-pin-order.mjs` 在 `sidebar-pin-order/run-1792373545120/` 五组通过同组／项目／cap、家族、原焦点／草稿、排除项、刷新及 storage 同步；没有 API 写入／外部请求／页面错误。指针／drag／跨 pinned 分区未采用。

中性 hover 是用户后续明确选择：深色变白、浅色变灰，状态／diff 红绿保留；它不是新增源模块消费。逐组 computed colors、原始失败与 Windows 限制见[复刻基准](pilaude-ui-parity.md)。

## 尚未使用的高价值算法优先项

1. **弹簧解析解与曲线采样**：菜单 opacity 已通过 adapter 接入 `calcDampedHarmonicOscillator`／SNAPPY；后续逐控件评估其余 springs 和 variants，分别记录 spring、交互状态、reduce-motion 和实物残差。单个菜单 consumer 不扩展为所有动效已采用。
2. **小算法的剩余采用面**：文件名保后缀已局部接入普通文件 tabs；roving 索引与 ScrollFade 边缘判定已局部接入 Changes，其他菜单／selector／tabs 仍是候选。先修相应边界，再逐个登记新 consumer，不把一个面板的适配外推到全站。
3. **拖放重排**：固定根会话的键盘相邻排序已有限接入；剩余 before/after 指针命中与移除索引补偿仍待适配，后续与现有 metadata 事务衔接。不要搬演示 sessions，也不把数组 splice 称为拓扑算法。
4. **受控呈现组件**：Thinking 的 Grid 部分已接真实 consumer 并通过限定实际检查，完整源状态及 Windows 视觉待验；Segmented、Status、MCP card 仍待逐个适配。pending／运行／完成／权限／token 必须保留后端真值，不能从会话正在运行推导某个 Thinking block 活跃；先拆 demo timers 与静态数据。
5. **有依赖后再采用**：FFT 等真实音频链、host 工厂仅宿主参考、backoff 先落实幂等约束；diff 的源解析／增量引擎和 image 共享转场仍未采用，已落地的 zoom／pan 只覆盖上述局部算法。采用更多模块不是绕过这些边界的理由。

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

## 2026-10-18 后续 TDD／领域边界

- 语法适配遵守 `GitReviewSnapshot／Patch → 原始行／revision → 反馈引用` 的既有领域边界，token 只影响呈现。RED→GREEN 覆盖 YAML、CJK／CRLF／空白、HTML 转义、词差异交集、旧新 hunk 状态隔离、语言别名和预算回退；未增加第三套 diff parser 或 lexer。
- 图片的 `ImageViewFit／Transform` 为纯几何，React 事件负责 wheel／pointer／键盘，src-keyed dialog 负责加载和焦点生命周期；不会影响附件摄取、顺序或模型发送。RED→GREEN 还修正了已开始拖动后回到 4px 死区停住的边界，以及加载失败永久 busy 的状态。
- 菜单以物理时间求解／采样作为呈现服务，不参与菜单动作、权限或布局状态。接近临界阻尼的参考数值先失败再由 adapter 修正，vendor 原件保留。实际 `cds-motion/run-1792318823633/` 在普通及 reduced-motion 两条件通过：CSS opacity 100ms 时 0.612951、500ms 为 1，bbox 固定、hover 不重播、子菜单、键盘／IME／Escape／scroll close 有效。前两次 checker 使用旧 fixture 名／错误 class 和 opaque iframe 初始化导致失败，原始报告保留。
- 本批最终组合 42 项定向测试通过，项目 TypeScript 与完整 lint 通过；保留既有 TerminalPanel aria 警告。上游提取／ownership／CSS 基线另有 60 项通过，不将分轮数字相加作为全量 npm 测试结果。
- 图片实际 `image-preview-zoom/run-1792319488145/` 六组目标通过：光标锚定 wheel、键盘／双击／拖动钳制、缩放按钮界限、resize fit、换图／IME／焦点恢复／reduced-motion，以及加载失败完成状态。原生 modal 的 Tab 循环可能经过 BODY／浏览器焦点中立步，`:modal` 保持且背景 trigger 无法取得焦点；未为这个浏览器行为另写焦点陷阱。会话和 PNG 是显式生成夹具，错误路径通过带 alt 的真实 Markdown 图片入口，writes／pageErrors 均为空、模型请求为零。此前 stats 合同缺字段、单步 Tab 断言、横图最大放大后 Y 轴仍会溢出，以及零尺寸损坏附件不可点击等 checker 失败均保留，不改已有附件布局来消除测试错误。
- 浮签原像素证据保存于 `changes-tooltip/comparison-after-type-calibrated/`。三组参考 100%／actual 50% 叠图只整数平移，公共覆盖外透明。Go to file、Show files、Changes settings 的外宽差分别 −1.266／−0.160／−0.242 原像素，外高差约 −0.004；前者 label／kbd 墨迹尺寸吻合，Show 各宽 +1 原像素且 gap −2，Settings 字框吻合，三组文字 y 仍 +1。Open in new window 新同状态图缺，Close 不补未绑定快捷键。YAML 源图观测核心色候选为 #f47b85／#9be963；已据此调整语法 property／string 色，不能将截图候选等同于已知原 CSS。Changes 初始焦点专项在 `focus-diag-1792319504318/` 三次复现 hidden focus 失败；改为布局提交可见后首次聚焦，并在 Tab 离开时关闭而不抢回焦点。`focus-diag-1792319835972/` 三次通过，包括 resize 不抢焦点、Home／End、Tab 退出和 Escape 返回。

- 最终 Changes 页面 `changes-reference/syntax-keyboard-1792320000380/` 五组实际目标通过：真实 API 原文与 inline／split DOM 无损一致、语法色与 mark 叠加／切换、finder 空结果与 Home／End、disabled／IME 边界、反馈编辑器保留 Ctrl+P／文本导航，以及 390px 已加载表格／header／finder 无根横溢出、关闭后焦点不留在 inert host。errors／blockedWrites 为空。移动断点会按既有设计先关外层，checker 通过真实入口重开后验收；此前没有重开导致的 timeout 保留。已保存并实际通过 [e2e/changes-focus.mjs](../e2e/changes-focus.mjs)，使用现有服务和明确允许的大型 Git 夹具，三轮验证初始焦点、Home／End、禁用项、IME、resize 不抢焦点、Tab／Shift+Tab、Escape 和外部聚焦；errors／blockedWrites 为空，不创建会话或发送模型。
- ACK 可靠性另有只读调查：`changes-ack-reliability/run-1792319138883/` 连续十次／三次 popup 周期均匹配 ACK 且草稿各一次；A→B→A 后旧 popup 无 ACK、不插入新草稿、保留评论。该 run 最后一项新 popup 因主 document 重载使 target 失效，整体仍为 partial。仅补剩余 `fresh-only-1792319508195/` 一次提交通过，ACK／插入各一次、document 代际不变，errors／blocked 为空。首轮五次失败及第二轮末项失败均保留；这两轮诊断中的 receiver 与 live ref 一致，开发刷新造成目标更换，不据此反推更早间歇失败根因。没有修改产品超时、自动重放或 AppShell 生命周期。

## 普通文件标签的后缀保留

`AttachmentCard` 的最后扩展名分离及双 span 布局已通过 `file-name-display → TabBar` 实际消费。测试先复现缺少分段标签，再补实现；16 项 helper／静态组件／阅读状态检查、类型及完整 lint 通过，保留既有 TerminalPanel aria 警告。source 中按 UTF-16 固定字符数截断没有搬入；CSS 按宽度省略，完整 Unicode、title、ARIA、路径和选择／关闭回调保留。异常长扩展名的 50% 上限为产品边界，不冒充源规范。

实际 `file-tab-filename/run-1792321054232/` 九组通过：六类文件名（.tsx、.tar.gz→.gz、CJK／emoji、异常长扩展名、dotfile、尾点）、390px 中文标签、阅读状态切回和活动标签关闭。桌面 label 217px 时 .tsx／.gz 分别 22.375／17.297px 完整可见，异常后缀 108.5px 为 50%；390px label 69.594px 时 .tsx 仍完整。wrap=true／scrollTop=420 在切换后恢复。会话和 Files GET 为显式夹具，Markdown 链接实际打开 TabBar／FileViewer，没有创建虚拟路径文件，apiWrites／pageErrors 为空。首轮虚拟 cwd 不存在造成 workspace unavailable 的 checker 失败保留，最终用已有 cwd 后通过；未调整产品生命周期。缺少对应官方长文件名状态参考，不做像素一致性声明。

## 上下文圆环的产品边界修复

核对源 TokenGauge 后没有机械替换：它把 input／output／cache 累加到窗口比例，与产品 SDK `contextUsage.percent` 的当前占用含义不同。会话累计还包含不进入 context 的 cache warming 账单，不能反推圆弧。该项是产品自身修复，不增加源模块采用数。

`ContextUsageRing` 定向测试先复现 NaN 进入 stroke-dasharray、非法窗口／累计费用进入 tooltip 的两组失败；现只接纳有限非负比例，非法值按未知处理，分母必须有限正数，累计 token／cost 必须有限非负且保持原有大于零才展示的门槛。超过 100% 保留文字原值，圆弧限制到 100%，90% danger 和空 usage 隐藏行为保留。5 项真实组件 SSR 加 8 项统计口径回归、项目类型和完整 lint 通过；保留既有 TerminalPanel aria 警告，实际 `context-usage-ring/run-1792321449859/` 七类状态加正常／未知两次统计开关共九组通过：正常、未知、负比例、零窗口与非法累计值、超容量、无效窗口未知、无 usage；圆环保持 14×14 SVG，点击打开现有统计 popover，Escape 后草稿保留可编辑。writes／pageErrors 为空，JSON 无法表示 NaN／Infinity，浏览器覆盖不冒称这些值；它们由 SSR 单测覆盖。没有修改 SDK、统计聚合或自动重放行为。

## YAML 与图片挂载补验

YAML plain scalar 的真实 AST 是根文本，adapter 现只对 yaml／yml 根文本使用 string tone，明确 token 仍优先；没有新增 lexer 或修改原文。内联单号栏由 `inlineReviewLine` 返回真实 revision／line，删除取旧侧、添加取新侧，既有旧侧 context 选区从 split 切回时仍可 Shift 延展。17 项 helper／实际呈现叶组件／语法测试通过。此为已有 `StreamingDiffViewer` 局部呈现适配的修正，不新增采用计数；代码 14px、pane 15.6px 与固定 20.4px 行高来自原像素同文量测，不冒称源 CSS。

`changes-reference/yaml-visual-1792322634062/` 通过实际单号、scalar 色、旧新反馈侧及 split→inline 的旧选区延展，console error／warn／pageerror／writes 为空；最后行号色采样修正的 `yaml-visual-1792323175159/` 同样通过并断言 computed 增删颜色。真实 Git 的 `syntax-keyboard-1792322713151/` 五组原文／mark／键盘／IME／390px 检查也通过。before／after 六组未缩放叠图和明确残差见[复刻基准](pilaude-ui-parity.md)。

图片旧 `run-1792319488145` 只捕获 pageerror，遗漏了 Markdown `<p>` 内 div／dialog 的 React console error。新 RED `run-1792321866405` 已复现四条；最小修复将 src-keyed native dialog portal 到 body，16 项图片定向测试通过。`image-preview-zoom/run-1792322241886/` 七组实际检查保留 zoom／pan／IME／焦点与加载错误，并验证 body 挂载、有效 Markdown DOM；console error／warn、pageErrors、writes 为空。portal 不增加 `useClaudeSharedElementTransition` 或其他模块采用数。最终受影响 UI／算法与 ownership／提取／CSS 基线组合 93 项通过，项目 TypeScript 和完整 lint 退出 0，既有 TerminalPanel aria 警告保留；完整 npm／terminal E2E 和 Windows 原生实物仍待验。

## 通用 diff 渲染的复用约束

2026-10-18 用户补充 Changes 展开态，并明确要求前端 diff／彩色代码块优先使用成熟开源渲染库，后续不重复造轮子。新原图已按原字节归档到工作区私有 `references/changes-expanded-dark/2026-10-18/`（2288×1535）；画面中的 Pilaude 源码不证明宿主应用身份，也不证明使用了哪个库。

迁移前语法着色复用已安装的 Prism／refractor，`ReviewDiff` 表格和 `reviewWordParts` 为产品自写路径；此前的检查只证明这一路径，不能回填为成熟 diff 库的消费证据。本轮已将 Changes 的通用呈现接入 `react-diff-view`，实际调用及待验范围见下方；Git 只读查询、comparison／revision 身份、源文本选区和反馈草稿继续保留产品领域边界。空白／Unicode／CRLF、跨 hunk、旧新侧及选区扩展仍是迁移验收要求，选库、源码接入、定向测试、实际页面和完整功能／视觉通过须分别记账。

迁移前真实 workspace 卡片宽度基线保存在 `changes-reference/yaml-workspace-1792323892533/`：真实主顶栏／外侧拖动把 inner pane 调到 790 CSS px（目标 +0.4），保留真实 1px border／10px radius 卡片；1880×816 device 截图、990×816 整数裁剪均未缩放。真实 cwd 先由未拦截 Git API 预检，再仅替换 review GET 展示夹具；console error／warn、pageErrors、blockedWrites 为空，两个只读 cwd validate POST 明确记录。画布外 inset、leading context、tree compaction 和未见提交内容仍为残差，此记录不表示新的完整视觉通过。

## react-diff-view 运行时库接入（独立记账）

2026-10-18 接入 [otakustay/react-diff-view](https://github.com/otakustay/react-diff-view) 的 npm `3.3.3` 精确版本，`package.json` 与 lockfile 均记录该版本。installed `LICENSE` 为 MIT，原文版权是 `Copyright (c) 2017 Gray Zhang`；作者字段不替代许可中的版权声明。主库及其依赖的实际安装版本、来源、许可和完整原文见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)，其中 `diff-match-patch@1.0.5` 为 Apache-2.0，不能一概写为 MIT。notice 已加入 npm `files` 清单，desktop preparation 明确复制到各平台已有的 `resources/server` 打包目录；这是打包配置证据，尚未声称实际发行产物已验。它不属于 Caho1/open-claude-ui，不增加其 33 模块的采用计数。

实际消费链为 [ChangesPane.tsx](../components/ChangesPane.tsx) → [ReviewDiff.tsx](../components/ReviewDiff.tsx) → 库 `Diff`／`Hunk`／`Decoration`，负责 unified／split 表格和 widget 挂载；[review-diff-renderer.ts](../lib/review-diff-renderer.ts) 调用库 `parseDiff`、行号计算、`tokenize` 与 `markEdits`，split 使用库的 `nearbySequences: "zip"` 配对。产品没有保留并行的 Changes 通用表格／`reviewWordParts` 引擎；旧 `lib/review-syntax.ts` 及其测试已删除。已有 `patch.ts` 的 FileViewer／MessageView 消费不在本次迁移范围内。

薄适配只补 Git 裸头的中性 envelope、旧／新文件路径到既有 Prism／refractor 语法的映射、YAML plain scalar tone、逐 hunk／revision 重基 tokenization、预算回退与空行呈现。库 block 编辑发现会丢前导空行，现只为其编辑发现省略该侧前导空 change，原始 tokenization／坐标／反馈不变；已覆盖两侧空行数不同、内部空行、Tab／尾空格和原 hunk 不变。它保持 Git 返回的文本和 revision／line 坐标；source snippet 从库 change 数据按真实侧取出，缺行或超出范围拒绝生成。`git-review-display.ts` 继续负责产品选区转换、键盘意图、文件分组与反馈格式，`ChangesPane` 保留 comparison／revision 身份、选择和反馈草稿／目标交接。库不拥有这些领域状态，也不因此获得写入仓库或发送模型的行为。

库基础 CSS 由 `app/layout.tsx` 在 `native-theme.css` 前导入，产品颜色、单号 gutter、换行和选择样式在 fork theme 中覆盖。`diff-library/run-1792338085844/` 八组实际检查通过精确原文／空行、词差异开关、跨侧选区与旧 context 语法、IME／Escape、连续替换行配对、只高亮所选侧且一个编辑器、桌面／390px 长行号和浅色轨道。反馈经现有 storage 通道并由同源合成 ACK 页确认，不当作真实 ChatWindow／模型发送；errors／console／writes 为空。最初 raw HTML 整句断言因高亮 span 拆分而失败，后改逐 code cell 原文精确比较，不放宽结果。最终一次受影响组合 171 项通过，包含源文本、渲染／EOF／空行／预算、真实 Git／API、选区、水纹、上游边界和许可／分发契约；项目类型及完整 lint 通过，保留既有 TerminalPanel aria 警告，不冒称完整 npm／terminal E2E 或原生验收通过。

独立复查的四项边界已 RED→GREEN：EOF 提示标明受影响侧，完整增删文件标题对应库实际单侧布局，rename 分别使用旧／新语法，前导空行后词差异保留真实坐标。最终 `diff-library/run-1792339340071/` 九组实际检查通过，errors／console／writes 为空；此前扩展 checker 没有展开第九／第十文件的 failed 报告保留，最终经产品 toggle 展开。

真实 Git 工作区 `changes-reference/syntax-keyboard-1792338708381/` 五组通过 API→两种布局原文、语法／词差异、finder／菜单／编辑器键盘及 390px 加载／焦点，errors／console error／warn／blockedWrites 为空；首轮 per-file 5 秒测试等待失败保留，补网络证据和 30 秒测试等待后通过，未改产品超时。`changes-focus-1792338623869.json` 另通过三组真实菜单焦点检查。

同文参考 `changes-reference/library-yaml-visual-1792337932938/` 与新 comparison 以参考 100% 底层／actual 50% 上层、原像素整数裁剪和平移核对：行距 25.5078 对 25.5、号栏 71.9922 对 72、table 到文本原点 94.4922 对 94。standalone 的可用代码宽多 36.2578 原像素、leading context 和外卡状态仍不同；当前记录只证明该状态。实际 workspace `library-yaml-workspace-1792338305434/` 经真实控件匹配 pane 宽度后，代码内容宽差降为 +3.7578 原像素，多数长行断点吻合，仍有 echo 换行、外层 canvas 和标点差异。运行时允许既有本地字体 CSS，不是公开默认字体或 Windows 原生验收；完整视觉一致性尚未通过，实际 workspace 匹配条件另在[复刻基准](pilaude-ui-parity.md)记录。

## Pi 扩展补充范围

用户要求的八个 Pi 扩展单独记录于[扩展接入现状](pilaude-pi-extensions.md)：四个固定版本可选来源通过现有 Plugins 表单消费，两项已有桌面能力、两项不兼容状态明确展示。Todo 的实际 SDK／持久化／widget 桥有 9 项证据，Permission／Web 的限定组件契约 17 项、Plannotator 的注入 BrowserSession 契约 8 项分别通过；目录实际 `extension-catalogue/run-1792332119485/` 已通过设置入口、八项／四按钮、选择无安装请求、显式内存 409 与错误提示及 390px 无横向溢出；手机截图在表单顶部，不声称八卡同时在视口内。没有因此声称预装、扩展全 GUI／网络／统一权限通过。这些 npm 扩展不计入本账本的 open-claude-ui 33 模块采用数。

## 单号选区与长行号补验

内联 context 起点现保留 old／new 双坐标，Shift 到明确删除端点时转换到旧侧，转回添加端点时可恢复新侧；added 起点没有旧侧映射时仍重新开始，split 保持显式侧选择。10 项真实 ReviewDiff 叶组件／父 callback 测试和 7 项 display 检查通过。`changes-reference/boundaries-1792326160929/` 实际检查通过跨侧选择和桌面／390px 五位行号：按数字位数计算 gutter，保留约 7 CSS px 右留白，console error／warn、pageErrors、writes 为空。该移动截图中树 overlay 未关闭，只证明数字不越列，不作整屏移动视觉通过。语法 adapter 的 prototype-shaped 后缀另由 RED→GREEN 修复，未知语言保持精确原文，未增加 lexer。

## New 首页导航补验

New 改为现有首页入口，项目旁的 + 保持新建会话。首页通过 Next 集成的 History API 更新本地视图，保留后台 ChatWindow 挂载、会话／空会话 draft 身份，隐藏 Context 和会话操作；project roots 通知用稳定有序路径 key 避免 render loop。`new-welcome/run-1792330694586/` 七组真实页面检查通过 New、返回／刷新草稿、项目／模型入口、reduced-motion 和 390px 无横溢出。所有 API 为显式内存夹具，pageErrors、DOM 嵌套／深度警告和 blockedWrites 为空；console 有检查器 canvas readback 性能提示，不称 console 全空。早前冷加载／导航失败保留，不据此宣称所有开发服务问题已根治。首页流光是产品独立实现，不增加 open-claude-ui 模块采用数；最新按用户要求，单次点击只推进一道完整不规则亮纹，多次点击才产生独立起点／寿命／随机种子的波纹。最终 helper 7 项通过；`ripple-motion/single-double-1792336146500/single.gif` 的单次分组通过，整 run 后续 observer 阈值失败仍保留；独立 `single-double-1792336369255/double.gif` 及报告通过双次点击、控件／SVG 排除与 reduced-motion，两组格点位移均为 0、绘制约 30Hz。旧 `run-1792334850698` 和 `presentation-1792334257081` 只证明前轮版本，不当最新单波视觉证据；原像素构图、亮度和完整动态参考仍待校准，见[复刻基准](pilaude-ui-parity.md)。

## ThinkingAccordion 的 Grid 局部适配

2026-10-19 依据 [作者提交中的 ThinkingAccordion.tsx](https://github.com/Caho1/open-claude-ui/blob/638800b8a4cee4513c8763c3df0ecf8a77b32379/code-examples/ThinkingAccordion.tsx)，只提取 Grid `0fr↔1fr`、`min-height:0`／overflow 裁剪与 200ms `cubic-bezier(.19,1,.22,1)` 过渡。来源保持 `Copyright (c) 2026 Caho1`／MIT，见 [vendor 记录](../vendor/open-claude-ui/README.md)与其旁的 LICENSE；未把整个源码组件复制进 vendor 或将它登记为直接采用。

真实链为 [MessageView.tsx](../components/MessageView.tsx) `ThinkingBlock` → [ThinkingDisclosure.tsx](../components/ThinkingDisclosure.tsx) → [native-theme.css](../app/native-theme.css) 的 Grid 规则。`ThinkingBlock` 保留 `isThinkingExpandedByDefault` 与偏好通知、真实 duration 元数据、原文／preview 和 deferred-history fetch／缓存／失败重试；展开取数仍由该 controller 负责，早关闭后的旧响应被取消标志隔离。披露 adapter 只接受受控 `expanded`，用原生 button 的键盘行为、相连 ARIA region、关闭时立即 `inert`／`aria-hidden` 和过渡结束后移除内容；reduced-motion／不可见路径即时清理。未改变 IME、模型请求或偏好写入语义。

当前 wire 没有逐 Thinking block 的 active 标志，不能用会话运行状态替代。因此本批不加活跃点／跳动指示、不强制 live 展开、不搬源 copy-as-quote／复制成功 2 秒 timer、elapsed 字符串或模拟时钟；产品现有 duration 只是已有真实元数据。Grid 片段采用与完整源组件行为分开记账，不声称活动／流式锁、clipboard、源码全部样式或 Windows 同状态视觉已复刻。

最终组合 126 项通过，类型与完整 lint 通过，保留既有 TerminalPanel aria 警告。实际 `thinking-disclosure/run-1792341152373/` 九组通过真实历史 MessageView：折叠不取数、原始 index 1／3／4、pending／cached 去重、畸形结果重试、Enter／Space、设置广播、正常与中断 Grid 清理、reduced-motion、深浅 390px 无溢出。思考请求恰为 [1,3,4,4]；non-read／external 请求、pageErrors、console warning／error 和 HMR 均为空。初轮快速 Settings 反向切换的正文残留已由 ResizeObserver 归零清理修复，RED 报告保留；后续热编译／reload／错误主题选择器造成的 failed 报告也保留，不改产品超时来通过测试。第 28 项现为局部 Grid 适配，33 项计数更新为 1 直接／8 局部／24 未确认。尚缺对应 Windows 官方同状态参考，不做完整视觉一致性结论。

## 2026-10-19 活动摘要、真实状态与 ShimmerText

新批的状态边界是 `Pi indexed delta／execution event → useAgentSession／streamReducer → ChatWindow process group → MessageView`。thinking／text index 仅由对应事件证明；running tool IDs 单独保留并行执行，部分输出不计完成。Stop／错误停止活动但保留已有输出，当前 turn 未执行步骤仍为 pending；历史无终态条目不伪造成功。周期 reconciliation 只为同 timestamp／provider／model、无后继／终态且相同或增长的尾块保留既有证明，mount／reconnect／未知快照仍静态。

过程组实际消费流式消息且只渲染一次，保留手动开关与首次错误展开；最终答案在组外。步骤有真实状态图形／名称、可复制原始参数与输出；摘要和思考走 UI Sans，代码保等宽。局部采用第 22 项仅限 ShimmerText 的背景与关键帧，不是源 glow／canvas，也不扩展 ThinkingAccordion 的采用范围。

组合 134 项定向测试通过。实际 `activity-disclosure/run-1792375885811/` 六组通过历史／live 开关、原始 deferred index、exact-once、单可见微光、光标终止、错误手动收起／不抢历史滚动、原零标题命中的内容搜索定位、IME 与会话草稿。真实 normal frames 从 83.333% 到 83.2092%（283.334ms），跨过源关键帧前 15% 的停顿；timeline 为 1.8s，reduced-motion 静态。本机私有 Sans alias loadedFaces=1、摘要 13px／border 0／透明；没有公开字体资产。首轮 2rAF 落在停顿段的失败及搜索 transient marker 断言失败保留，最终观察可见位置／highlight 而非已由布局控制器清除的临时属性。

该 run 的 430px 截图有侧栏／Context 遮挡，只证明无根横溢出，不能作为活动区可读性通过；`mobile-supplement-1792376302856/` 经真实按钮关闭遮挡后，深浅430px摘要／工具无遮挡且native center hit均命中，Sans13px／Mono12px、输出上限400px；详细几何另记复刻基准。此记录对应当时的即时hidden版本；后续共享Grid高度批次见下节。新步骤进入／错开和状态／摘要有限过渡仍待落实，不据此勾完整动效清单或Windows像素一致性。

## 共享 Grid 的新增 consumer 与后续菜单能力

`ThinkingAccordion` 局部 Grid 采用现扩展至 [DisclosureBody.tsx](../components/DisclosureBody.tsx)，由 ThinkingDisclosure、ChatWindow process group、MessageView tool details 共用；不新增源模块计数。三类分别验证200ms原曲线的中间高度、条件焦点返回、立即inert／ARIA、快速反向／隐藏／reduced-motion清理。过程首次展开后保留子树，思考／工具归零释放；`disclosure-motion/run-1792378208269/` 六组与 `activity-disclosure/run-1792378225066/` 实际通过。源码演示计时／强制live状态继续未采用，步骤进入／错开和状态／摘要有限过渡仍待实施。

Transcript modes、真实输出风格、原生会话窗口／Code项目入口，以及背景任务的键盘／状态修复属于产品领域接入，不因此增加open-claude-ui采用数。普通会话输出风格经真实Pi before_agent_start进入下一次提示词；Default不附加，exact/chat-only/subagent保原合同且明确不可用。背景任务使用既有Pi family，不冒充CoworkCanvas或Plan/Todo。实际结果和限制见[复刻基准](pilaude-ui-parity.md)与[逐项清单](pilaude-agent-output-ui.md)。

## 更新条件

每次采用后更新对应行：来源 SHA／函数 → adapter 或 vendor → 真实 consumer → 边界测试 → 实际页面／交互证据 → 尚存差异。纯算法也必须给出调用者；只加导出、复制文件、相似独立实现或通过库自身 build 都不足以升级采用状态。每轮记录须区分实际测试、页面检查与只读审计；本批模型调用为零。尚未完成的功能、原生实物和视觉状态继续保留待验。
