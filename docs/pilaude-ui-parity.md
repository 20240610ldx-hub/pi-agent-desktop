# Pilaude 与 Claude Desktop 的逐组件复刻基准

首次审计：2026-10-17；实现及同步证据更新：2026-10-18。用户明确要求每个组件实现后的视觉和交互与 Claude Desktop 一模一样；已选择 **Windows 当前稳定版**。本文件记录证据、缺口和验收方法，不声明已经复刻完成。

## 参考优先级（2026-10-18 用户纠正）

以先前提供的较新官方参考为主要视觉与交互基准。用户明确说明最近提供的部分菜单、Context 和输入栏截图来自 3p 模式，且不是最新版本；这些只用于补充缺失状态。若尺寸或行为冲突，通常优先较新官方证据，分别记录差异，不能混成同一版本。用户随后明确选择 3p 输入栏更紧凑的高度、细边线和较小圆角，这三个项目以最新用户选择为准：单行 48 CSS px（本组 1.25 capture scale 下为 60 原像素）、半径 14.4 CSS px（最新原图测得 18±1 原像素）。此前官方主界面的约 68 原像素只保留为不同版本记录；capture scale 是实现采样条件，不能反推官方 DPI。

界面模式必须对应 Pi 的真实执行能力：现有工具 preset、推理强度与模型选择不得仅重命名为官方权限模式。Auto 需要执行前策略、独立审查、明确阻断/转人工和审计测试后才能出现在可用模式中；截图中的 Auto、Bypass、模型名称不构成功能或权限授权。

## 固定参考版本

| 项目 | 已核实证据 |
| --- | --- |
| 官方 Windows x64 稳定入口 | [MSIX latest](https://claude.ai/api/desktop/win32/x64/msix/latest/redirect)，2026-10-17 实际 GET 返回 307 |
| 官方入口的目标 | `https://downloads.claude.ai/releases/win32/x64/2.42304.0/Claude-e7f60e658f15cfece9efa384a78a39aec3c12845.msix` |
| 当前桌面参考版本 | `@ant/desktop 2.42304.0`；本机 MSIX `Claude_2.42304.0.0_x64__pzs8sxrjxfjjc`，与官方稳定入口一致 |
| 安装包清单 SHA-256 | `93417dbed430d92545db5c12cd0e16211c642388b8002b977e372ef76a86dd1b` |
| 已安装 app.asar SHA-256 | `8f4d3dec5e4f3ddffb150321060b18807d83a40f3a65618fe4f29325379da9db` |
| open-claude-ui 作者 main | `638800b8a4cee4513c8763c3df0ecf8a77b32379` |
| 本地 UI fork main | `7490e105e418adf2b94c55ff716bb0973d44fb85`；2026-10-18 同步检查包含上述作者提交，作者侧落后数为 0 |
| UI 库自身的取证版本 | macOS `/Applications/Claude.app`，`@ant/desktop 2.37337.1`，构建 `2026-10-13T22:16:06Z`；见其 CHANGELOG 与主题文件头 |

官方 EXE latest 的 HEAD/GET 在本次环境返回 403，不能作为版本证据；MSIX GET 已成功核实。只读取了本机安装元数据、ASAR 目录及 package.json；未提取或提交专有字体、图标字体、音频、账号数据或完整应用代码。

“当前稳定版”在每轮复刻开始时检查，然后固定这一轮的版本。稳定版变动时先记录差异、更新参考素材和受影响组件，再重新验收；不能在同一组对比中混用两个版本。客户端版本相同仍可能受服务端功能开关、账号套餐和语言影响，参考记录必须包含这些可观察条件。

## 资产是否足以完全复刻

**结论：不足以单独支撑或证明 Windows 当前稳定版的完全复刻。它是主要复用来源，不能代替实际 Windows 应用的参考和验收。**

- `code-examples/` 实际有 33 个 TS/TSX 模块，另有主题 CSS 与 Tailwind 配置；README 的“30 模块”不是当前文件数。基础控件、输入流、动效、媒体、产物与部分桌面交互已有可复用代码。
- `assets/` 只有资产政策和项目自身的 `images/logo.svg`。没有完整 Windows 图标集合、原版字体、音效、逐状态截图或操作录像。
- 资产政策明确采用系统字体回退和振荡器合成声音。本机参考包目录可见 `AnthropicSans`、`AnthropicSerif` 和 `anthropicons-variable` 字体；Segoe UI、Georgia、Lucide 或合成音不能据此标为同字形、同排版、同声效。公开发行所需的合法字体/图形/音频方案仍是缺口，不能静默降低一致性要求。
- 桌面示例主要实现 macOS 红绿灯、Vibrancy 与 Electron 工厂。Windows 标题栏、系统菜单、最大化、贴靠、焦点和 WebView2 渲染必须以 Windows 实物补证；不能直接导入 Electron 工厂或绘制 macOS 控件。
- Storybook HTML 引用了 Tailwind CDN、unpkg、Google Fonts，并包含模拟回复、上传进度和任务数据。它适合浏览组件，不能当离线交付物或 Claude 官方基准截图。
- 库内仍存在版本冲突：AGENTS 的旧表面/尺寸说明、v2 的 12/14px composer 描述、主题中的 20px composer，以及新按钮组件的整数尺寸与 CHANGELOG 的桌面光学尺寸并不完全一致。发生冲突时记录证据，用当前 Windows 参考裁决，不能挑一个看起来合理的值。
- 首次审计发现原先接入的旧版主题遗漏了完整灰阶、主品牌色与装饰 Clay 分离、按钮绘景层和弹性曲线等上游修正。现已更新 vendored theme、Button 和 motion presets；其中 theme 全局导入、Button 由数据导入区消费，motion presets 后续已经 cds-motion 采样实际用于 DOM 菜单 opacity。欢迎页已改为 quiet 构图，不再消费 Button 或 motion。逐模块与纯算法的 consumer／缺口见[采用账本](pilaude-component-adoption.md)，不能把仓库同步等同于所有实现已经采用。

## 组件与资源覆盖清单

下表按目标行为分组覆盖 33 个 TS/TSX 源模块及主要 Pilaude 页面；逐一名称、关键算法、实际 consumer 与演示限制以[采用账本](pilaude-component-adoption.md)为准。**所有组件的 Windows 2.42304.0 一致性均待实物对照**；“已接入”只描述可追踪的代码采用，不表示视觉或交互通过。产品的同类独立实现、仅 vendor 文件和主题 keyframes 不算模块已采用；图片已局部适配自然尺寸／contain 和 zoom／pan 几何，Changes 的表格、焦点和渐隐算法已有 consumer；新增语法色复用产品既有 Prism。实际页面逐轮核验，完整一致性仍待补证。

| 目标组件 / 行为 | 可复用的 open-claude-ui 源模块 | Pilaude 状态与补证项 |
| --- | --- | --- |
| 主题、文字、图标 | `cds-theme.css`、`tailwind.config.js`、资产政策 | 已更新主题，本机对照实例加载用户字体；Windows 原生度量、图标轮廓和公开素材仍待验收 |
| 按钮及各尺寸/状态 | `CdsButton` | 仅数据预览／导入动作直接消费；当前 quiet 欢迎页使用普通按钮。逐状态实物对照尚未通过 |
| 分段选择 | `SegmentedControl` | 资源可用；实际 Pi 模式/设置状态需适配 |
| 运行、加载、骨架 | `StatusIndicators` | 资源可用；绑定真实运行状态并核对所有节奏 |
| 确认与权限对话框 | `ConfirmationDialog`、`McpToolDecisionCard` | 资源可用；后端审批、焦点陷阱、取消/错误状态待融合 |
| 附件卡与预览 | `AttachmentCard` | 最后扩展名分离／双 span 布局已局部适配到普通文件 TabBar，按宽度省略保完整路径浮签；附件 tile／chip 未采用。长文件名官方状态图缺，窄容器实际检查单独记录 |
| 输入器及底栏 | `ChatComposer`、`RichComposerWithMentions`、`ChatComposerChin` | 保留 Pi 真实输入器，部分 IME/草稿测试已有；几何、排队、菜单、提及/命令状态待对照 |
| 消息、操作条、代码 | `ChatMessageBubbles`、`CodeBlock` | 已有 Pi 渲染器；新结构、排版、悬浮操作、复制/重试/编辑待融合 |
| 思考展开和氛围 | `ThinkingAccordion`、`ReasoningAmbientGlow` | 资源可用；绑定真实流式思考、减少动效与状态切换 |
| 模型选择、用量、推理强度 | `ModelSwitcherWithTokenGauge`、`ModelSelectorEffort` | 资源可用；使用真实 Pi 模型能力/未知值，不能移植演示额度 |
| 动效参数与级联 | `ClaudeMotionPresets`、`CdsMotionEngine` | 前者的求解器／SNAPPY 经 cds-motion→DomContextMenuHost 消费到 opacity 进入；实际 CSS 曲线、静态命中区域、reduced-motion 与菜单交互已有目标检查，其他 springs／variants 未采用。后者仍未采用且含演示展示 |
| 滚动跟随和渐隐 | `useClaudeScrollPinning`、`ScrollFadeContainer` | 前者仅 `cds-scroll.ts`→`useAgentSession` 的 150ms 输入锁；后者由 ChangesPane 的 FadedScroll 局部适配 2px 边缘判定，补容器／内容 ResizeObserver。其余阈值、alpha stops 和双轴行为不记采用 |
| 声音与麦克风 | `ClaudeAudioPlayer`、`LiveMicActivityBars` | 仅有合成方案；不等于原版声音；实际支持能力和许可仍需核实 |
| 图片灯箱和共享转场 | `MediaLightboxViewer`、`useClaudeSharedElementTransition` | MediaLightboxViewer 自然尺寸／contain 由 native-theme.css→ChatInput／MessageView 消费；新增 image-view-transform→ImagePreview 适配光标 zoom／pan／wheel，保留原生 dialog，定向单测通过、实际页面分轮记录。SharedElementTransition 未采用；最终缩略图 gap 已校准至 9 原像素目标，原始内容比例与绝对 bbox 仍待补证 |
| 产物分屏与桥接 | `ArtifactsSplitPaneResizer`、`EpitaxyIframeBridge` | 资源可用；保留 Pi 产物真实内容、安全边界与保存流程 |
| Diff | `StreamingDiffViewer` | ChangesPane 的 ReviewDiff 局部适配 table/gutter、tabular-nums 与增删背景；复用既有 patch parser／split 配对，没有采用源流式引擎。后端与核心页面有分轮证据；新增 Prism 语法色按 hunk／revision 无损产出，与词差异 mark 相交，源码反馈继续来自原始 Git 行。完整键盘／窄窗证据随本批补充 |
| Windows 窗口与顶栏 | `createClaudeMainWindow`、`ClaudeDesktopHeader` | 主要是 Electron/macOS 参考；Tauri Windows 实物行为与精确几何待补 |
| 侧栏、项目/会话拖放 | `DraggableSessionList` | 资源可用；完整 Windows 导航、搜索、收起/展开/右键状态未覆盖 |
| 多代理任务视图 | `CoworkAgentCanvas` | 含演示状态；需接真实 Pi 父子任务、队列、审批、取消和失败状态 |
| 窄容器与键盘焦点 | `ContainerResponsiveBar`、`useClaudeRovingFocus` | ChangesPane 的 rove 局部适配索引／Home/End／单 tabstop，含 IME 过滤；ContainerResponsiveBar 未采用。系统 DPI、WebView2 与实际焦点顺序仍需逐项验收 |
| 限流/重试反馈 | `useRateLimitBackoff` | 资源可用；遵循 Pi 已接受请求不重发和外部操作不重放的约束 |
| 设置、模型凭据、MCP、skills、插件、定时任务、数据恢复 | 无完整逐屏实现 | 复用已有原子控件，逐屏补充 Windows 参考；Pi 独有字段保持同一控件语法、显示真实能力 |
| 托盘、系统通知、文件选择、安装/更新 | 无完整 Windows 参考实现 | 保留 Tauri 系统能力，补系统级参考、生命周期与公开发行验证 |

## 每个组件的完成条件

1. **参考齐全**：记录参考版本、Windows build、WebView2/Chromium、窗口客户区尺寸、OS DPI、应用缩放、主题、语言、字体和相关账号/功能开关。参考侧和 Pilaude 使用相同文本/数据、尺寸与状态。
2. **状态齐全**：逐项列出适用的 default、hover、pressed、focus-visible、disabled、loading、empty、error、长内容/溢出、展开/关闭及菜单状态；动态组件增加进入、稳定、退出、取消、中断/恢复。不适用项写明原因。
3. **采用可追踪**：记录上游路径/SHA、原样复用或适配内容、实际 Pi 消费点与相关测试；数据和执行结果来自 Pi，不使用示例状态凑外观。
4. **视觉逐项对照**：保存参考截图、实现截图和叠加/差异图，检查布局、字形/换行、图标、尺寸、间距、圆角、颜色、阴影、光标和滚动条。固定采样时刻；动态光标/时间等区域只有明确列出原因才可排除。出现可见差异就登记并修正，不能用一个宽松全局相似度抵消局部错误。
5. **交互实测**：验证键盘/IME、Tab/方向键/Escape、焦点进入/退出/恢复、滚动、拖放、窗口缩放/贴靠和动效时间序列。浏览器内 CSS 缩放测试不能代替 Windows 原生 DPI 和 WebView2 实测。
6. **复查后完成**：修正差异并重跑相关用例；证据不齐为“待参考”，有差异为“待修正”，只有视觉和交互均对照通过才为“通过”。当前所有组件均未达到这一完成条件，之前的功能测试不能追溯当作一致性测试。

### 2026-10-17 用户实物截图与测量迭代

用户补充的 Windows 主窗口截图为本轮主参考，尺寸 1911×1294。测量时裁出 `[12,23,1892,1278]` 的 1880×1255 窗口区域；运行截图使用 1504×1004 CSS 像素、1.25 capture scale 得到相同尺寸。该 capture scale 是本组浏览器测量条件，不冒充已完成 OS DPI/WebView2 一致性验证。参考边缘由人工取点，初步不确定度约 1–2 物理像素；不缩放任一图层，不以不同聊天内容计算整屏“相似度”。参考截图含用户私人项目名称，保留在本机验收目录，不提交仓库。

**用户指定的双图层测量法（2026-10-18 再确认）：官方参考原图为 100% 不透明底层，项目当前运行截图为 50% 不透明上层，像 Photoshop 双图层一样按原像素对齐。** 官方图中的位置、宽高、间距和边界逐项测量到像素，明确记录裁剪、DPI、应用缩放与 capture scale；不缩放任一图层凑齐，不以全局相似度掩盖局部偏差。官方原生窗口不可用时使用项目已保存参考图。

`scripts/compare-ui-reference.py` 已使用上述图层顺序，生成 50% 叠图、4 倍增强差分、红色参考/蓝色实现的边界图，以及 x/y/width/height 偏差 JSON。参数包括参考裁剪、DOM 几何输出和参考矩形表，不会自动拉伸图像。依赖 Pillow，仅用于本地验收。运行示例（所有图片/测量数据均为本地文件）：

```powershell
python scripts/compare-ui-reference.py reference.png actual.png --crop 12 23 1892 1278 --geometry actual.json --measurements reference-boxes.json --output comparison
```

本轮 vendored theme、Button 和 motion presets 已更新至作者提交 `638800b8a4cee4513c8763c3df0ecf8a77b32379`，来源见 vendor README；该几何批次当时实际消费为全局 theme 与数据导入区 Button；motion presets 的后续菜单 consumer 见本批最新记录。主框架、搜索、输入器和上下文卡片按参考几何调整；正文默认 16px，保留用户字号/宽度设置。第二轮未缩放的 1880×1255 实测：侧栏宽度比参考大 2 物理像素，搜索框 x/y 偏差 +0.25/−0.25，输入框 x/y 偏差 −1.38/+0.5、高度 67.5（参考约 68）。Environment 卡片少真实 Remote Control 能力而矮 26；这些差异继续保留，不据此标记逐组件通过。

视觉与运行语义分别验收：会话/新建草稿/计划任务导航历史、输入法与多行增高、150ms 用户滚动意图锁、长会话锚点、流式输出、停止与恢复、窄窗口焦点循环/Escape/焦点返回、真实文件/工具/连接器入口、提供商错误持久化与设置入口。调度/工具/API 数据必须来自 Pi；累计输入/输出 token 不能伪装成 Claude 当前上下文的精确分类。Claude 专属的 Remote Control、订阅限额、PR 信息没有对应实现时保留为功能差异，不填假值。

本机 Tauri Windows 开发窗口已编译启动；开发服务器冷编译曾造成 10 秒会话加载超时，单独记录，后续加载/恢复验证不能用放宽产品超时来掩盖。付费模型仍只允许 deepseek-flash；这一轮使用本地提供商夹具经过实际 SDK/事件流，零模型费用。

产品名 Pilaude、自有图标/版本、自带模型、项目与权限数据按用户确认的产品要求替换；这不授权其他任意视觉改动。Pi 独有场景沿用已核实的 Claude 控件与操作模式，并单独记录参考来源；没有对应屏幕时不能宣称整屏像素一致。字体、素材许可或可访问性与参考出现冲突时保留为明确未解决项，不擅自宣称“已完全一致”。

## 当前重新验收清单

- 用户原图共 10 张已逐字节归档并核验 SHA-256，本机路径为 `D:\pilaude\references\claude-desktop\windows-2.42304.0\2026-10-17`。`README.md`、`manifest.json` 索引尺寸和状态。原始 PNG 不随公开代码或安装包发布；派生裁剪与叠图不覆盖原件。
- 新增参考显示：Context 可与 Browser/Git dock 同时存在，也可在 Files 左侧浮出；Background tasks 和 Terminal 可垂直共存。Files 共存已改为测量主区实际宽度：保留至少 420px 聊天宽度后可并列，空间不足时使用非模态浮层；全宽/窄窗口文件覆盖层让 Context 暂时隐藏，保留其显示偏好。实际界面通过并列、浮出后文件键盘焦点、全宽让位、关闭恢复，以及 Context Escape/Settings 关闭后焦点返回。浏览器/Git、双任务列、文件栏外观及逐状态像素一致性仍待完成。
- 新增回复局部图明确区分 rest 与 hover，操作栏在 rest 隐藏；现已改为静止隐藏、hover/focus 显示、触屏可达和相对时间。本机实际界面检查通过静止/悬停/键盘可见性、复制/分叉提示、分叉包含当前回答且源会话内容不变；原始截图、DOM 几何、叠图和结果保存在本机 `test-results/pilaude/ui-reference/`。Pin/朗读尚未实现，字体/图标仍有差异，不能以可点击作为复刻通过。
- 实际 Pi 会话加本地 HTTP 提供商完成了历史前进/后退、独立新任务草稿、Context/文件入口、Connectors 设置入口、受控 401 刷新保留、错误设置按钮、窄窗口遮罩与设置焦点交接检查，页面运行错误为 0。这些为功能证据，测试夹具显式标注且没有模型费用，不冒充正式服务或原生 DPI 验收。
- 跨项目历史检查通过：从第一项目的未发送草稿进入第二项目并打开文件，返回后原草稿保留，第二项目的文件标签不进入第一项目。开发路由预热单独记录，不纳入启动性能结论。

### 用户提供的本地字体（2026-10-18）

用户指定的本地项目中已找到 Sans/Serif 正体和斜体、Mono，以及图标字体，共六个原始 WOFF2。原字节、SHA-256、family/version、字重/光学轴、字形数与垂直度量归档在公开仓库之外。用户说明已有个人用途授权；补充来源 [anthropic-fonts](https://github.com/matthieuhuguet/anthropic-fonts) 的 README 同样只说明个人使用且不主张拥有字体权利。本轮未下载该仓库字体，没有将字体二进制或含字体数据的 CSS 加入 Git/public 资源。

对照实例复用已有 `<agentDir>/desktop/custom.css`，以内嵌字体数据覆盖 UI/展示/代码字体变量，无新增字体 API。浏览器 FontFaceSet 与实际消息 computed font 均确认使用本地 Sans，Serif/Mono 加载通过；第三轮截图和原像素叠图在本机 `test-results/pilaude/ui-reference/comparison-pass-3-fonts/`。这一实例位于隔离测试数据根；公开默认资源、307 码位图谱已在本机生成，图标字形映射、中文回退与 Windows 原生渲染仍未验收，不能据此声称公开包已经携带相同字体。

- 原 Task 2 的四档截图、输入/面板测试仅证明相应功能可操作，缺少同版本 Claude 参考图和差异图，状态改为“功能已测、一致性未验”。
- 欢迎页为 Pilaude 原先自建构图，尚未证明符合 Claude 当前首页；系统字体、Lucide 图标和深色文字的旧 Clay 按钮均待重新对照。
- MCP Sign in 的实际小号主按钮对比度测得 3.12:1；这是现有样式问题，尚未证明参考也如此。OAuth 加密端到端通过不能作为视觉通过；等待参考裁决并修正。
- 2026-10-18 用户追加 9 张深色终端参考，原始字节和哈希清单永久保存于工作区 `references/claude-desktop/terminal/2026-10-18/`。覆盖标题栏/多标签/新建、Cursor style（Block/Bar/Underline）、Blink cursor、Copy on select、Scrollback（1,000/5,000/10,000）、独立窗口、展开快捷键和关闭。光标“一秒闪烁一次”为用户明确确认；浅色允许沿语义令牌转换布局/交互，尚无浅色实物验收。图片版本未独立确认，不混作 2.42304.0 的版本证据。
- 用户同时指出默认窗口偏宽、字号偏大：左右栏固定小字号，只有对话记录可选小/中/大。实施校准值为默认窗口 1200×840、两栏正文 14px/次级数字 12px、对话 13/14/16px 默认中档，输入框独立 14px（移动端 16px 防缩放）。这些数值为本轮校准，必须按双图层法继续测量，不能由用户反馈推导出官方字号已测定；已保存窗口大小及旧字号选择保留，重置字号回到中档。
- 两张新增暗色工作区参考已按原字节保存于 `references/claude-desktop/workspace-dark/2026-10-18/`，完整整屏为 2559×1526。原像素测量、实现截图与双图层位于本机 `test-results/pilaude/dark-calibration/`，未缩放参考图。实现采样为 2047×1221 CSS、capture scale 1.25，不当作官方 DPI 证据；该组设置内容宽度为 922px，仅用于匹配已测 1152px 输入框，不覆盖用户默认 820px。
- 本轮修正暗色侧栏与画布表面、搜索几何、右卡水平位置、宽屏对话/输入框靠右轴线。物理像素 x/y/w/h 偏差：侧栏 0/0/−0.25/+0.25，搜索 0/+0.25/0/−0.25，输入框 +0.25/+0.12/+0.5/+0.25；Environment x/y/w 为 0/+0.25/−0.75，高差 −26.5px（缺真实 Remote Control）。Context 展开内容、Connectors 状态、图标/字体与原生窗口仍有差异，不标为逐组件通过。
- 终端最终采用每窗口共享 SSE，保留每标签输出游标、隐藏标签 lease 和原有 15 秒请求时限；双标签目标检查已验证不同 PID、各自输入/输出及切回首标签 PID 连续。完整 terminal 脚本仅通过首终端/会话切换/刷新/离线恢复/无重复输出和尺寸，后续部分未全部执行，仍保留未通过记录；Next 开发 Manifest 空文件 500 与原始网络证据也保留。
- 终端已接入 Block/Bar/Underline、1 秒 xterm DOM 光标闪烁、选中复制和 1,000/5,000/10,000 行滚屏偏好；偏好更新现有实例，不重建 PTY。Windows 新终端使用系统 PowerShell，同项目多标签按 ID 保存/恢复。一次真实浏览器交互检查通过设置切换、复制、双标签、展开快捷键、刷新 PID/环境变量连续性和单标签终止；随后几何迭代仍需复测。独立原生窗口的创建、单一输入/resize 控制权和窗口关闭交接尚未实现，工具栏缺口继续登记，不以占位按钮代替。
- 用户新增 11 张暗色对话菜单/输入框原图已原字节保存于工作区 `references/claude-desktop/conversation-menus-dark/2026-10-18/`，SHA-256 与本机源图一致。覆盖重命名焦点/选中文字、会话根菜单、Open in/Transcript view/Output style 子菜单、新建输出风格对话框、删除悬停、多图片附件、运行中和新任务输入框。首张原件 256×91，与聊天显示高度差 1px，保留原件。版本/DPI 未独立核验；精确边界与对应实现叠图继续补证，不把截图内模型或权限标签当成本会话设置指令。
- 右扩展区新增原始附件 1135×1455 已原字节归档至工作区 `references/claude-desktop/multi-pane-dark/2026-10-18/`。用户确认默认单列两个面板，第三个起向右开列；面板与内部标签分别管理。open-claude-ui 只有左右双栏基础示例，没有完整多列调度。现已接入 Files、Terminal 和当前会话真实父子任务三个独立 pane、稳定内容 hosts、双轴调整、独立展开/隐藏和布局保存；Artifact 暂归 Files，受控 Browser 仍未实现。研究、边界和验收规则见 `docs/pilaude-workspace-panes.md`，实际终端生命周期及像素检查分别记录。复查已补工作台显隐恢复、Tasks family 本地筛选隔离、筛选非空时保留清空入口，以及并发关闭标签后从现存 ID 解析活动终端。实际 Tasks-only 刷新仍打开、手动隐藏刷新仍关闭，页面错误为 0。
- 2026-10-18 再验 Context 遮挡修复：浮动外容器透明且不截获指针，卡片自身可点；浮层上限跟随 composer 顶部，晚挂载与多行增高均重新测量。实际 1200×840 页面中，五行草稿时卡片底部与 composer 顶部间距 8 CSS px；折叠后整体高 234px，输入框右缘命中和卡片下空白穿透通过，页面错误为 0。证据在本机 `test-results/pilaude/context-floating/`。最终新增 100px 下方扩展状态栏的布局夹具后，卡片上限随输入栏位置重新计算、输入框右缘继续可点；这项夹具明确不作为像素截图。功能通过不代表卡片内容/字形已逐项复刻通过。
- 输入栏按用户最新指示采用 3p 参考的紧凑高度：单行从 53 收到 48 CSS px、圆角从 20 收到 14.4 CSS px（原图拟合半径约 18±1 原像素），发送/停止沿最后一行文字居中；加号位于框下，模型/推理/工具保留 Pi 真实语义。旧 3p 附件状态作为补充，144 CSS px 图片卡在本组 1.25 capture scale 下为 180 原像素；窄容器或短窗口限制附件区高度并可滚动，避免八张图片撑满窗口。用户要求取消橙色聚焦边框，现全状态使用单条中性细线、无外发光；深色静止 #373736、聚焦 #4d4d4c，浅色转换为中性透明灰线。
- 紧凑输入栏最终实际浏览器检查通过桌面/移动端单行 48px、三行增高与末行中心偏差 0；八附件 5+3 排列、窄栏滚动及最后附件删除、短窗口 210px 高度上限、刷新后八图片与文字草稿保留。合成 IME composition/keyCode229/grace 期间不发送，随后 Enter 与按钮各恰好一条请求，受控拒绝后草稿和图片恢复，零真实模型调用、页面错误为 0；不当作 Windows 原生 IME 验收。
- 新增有字参考与实际截图采用相同中文、1010×60 原像素框，100% 参考底层/50% 实际上层、不重采样或改色；外框宽高差为 0，截图起点量化 y −0.125px。文字 ink x/y/w/h 残差 −1/+1/−92/−4px，回车图标 −3/0/−1/−2px；固定 14 CSS 字号仍比此参考小，不标为完整复刻。证据位于本机 `test-results/pilaude/composer-calibration/3p-typed-user-priority/`。
- 最后源码的附件回归再次通过输入框真实命中、末附件删除、短窗口限制和刷新草稿。一次独立 Playwright IPC 的 IME 结束保护断言跨过 100ms 窗口，缺少耗时证据，保留失败记录；合成保护改用同一浏览器 turn 触发并记录耗时后，最终整套输入栏实际页面回归退出 0，保护期阻止 Enter，之后按钮/Enter 各恰一次请求且拒绝恢复草稿；原时序失败仍保留。
- 生命周期复查补充同步提交锁、按提交快照消费草稿与附件、切会话 visit token，以及排队回调的来源 session/generation 绑定；引用加载期间重复触发、A→B→A、等待时新编辑/新附件和立即拒绝恢复均有可控延迟测试，155 项相关回归通过。已接受或传输结果不明的请求仍不自动重放。
- 实际截图独立四角诊断拟合约 18.09–18.25 原像素，支持半径目标，但顶/底直边的抗锯齿色带仍与参考不同；不能只凭 CSS radius 或外框宽高相同就说边线逐像素相等。
- 输入栏细线补图共 4 张已原字节保存至工作区 `references/claude-desktop/composer-border-dark/2026-10-18/`，合计 104922 字节，SHA-256 核验。新增有字单行图 1053×88，框边界 `[25,12,1035,72)`，1010×60；running 框同尺寸，单附件框 1010×270，三者圆角均约 18±1 原像素。聚焦状态未从图片独立确认；橙色 Pilaude 图只归为 actual 候选，原件 525×167 与聊天显示高度不同，未补边伪造。
- 首页字符流按用户否决意见重写为细密字母数字行和连续曲线流带；最终深色 opacity 0.34、浅色 0.20 的真实页面检查通过慢波动、点击随机不对称扩散、主题重绘、减少动态效果保持静态和前景按钮可达，页面错误为 0；离屏/隐藏暂停绘制。深浅截图在本机 `test-results/pilaude/home-ripple/`。首页原图仍待定位，档案保留 `pending_source_file`，完整构图与原版时序不标为通过。
- Auto 官方公开设计、三个 MIT Pi 扩展及 Pi 1.3.0 执行接点研究见 [权限研究](pilaude-auto-permissions-research.md)。未启用 Auto，工具预设不冒充权限模式；后续统一 gate 必须覆盖子代理、codemode 内层和直接 shell，分类失败不放行。
- 本次全量 `npm test` 曾运行但未完成：出现 17 条失败后在 MCP 集成测试挂起，已停止该测试任务。已定位的现基线问题包括 Windows 文件 mode/home/shell 路径假设、cwd fixture 读取真实 allowed roots，以及 HEAD 已存在的 prompt-anchor 属性顺序正则；MCP 其余失败仍需隔离诊断。附件测试因本批新增 class 导致的过严正则已修，相关 47 项定向回归通过。后续将 HEAD 旧 prompt-anchor 属性顺序断言在实际涉及该文件时一并修正；最终受影响功能组合共 264 项全部通过，类型检查通过，标准 lint 退出 0（保留 TerminalPanel `aria-description` 的 1 条警告）。这仍不能写成全量通过。
- 新增左侧定位轨道两张原图已原字节保存至工作区 `references/claude-desktop/conversation-navigation-dark/2026-10-18/`，共 46491 字节，SHA-256 核验；原件 194×273、415×429，聊天显示高度不同，未补边或假称 payload 字节一致。静止普通刻度核心 13×3px、12px 间距，当前刻度 21×3px；展开目录外框 348×297px、约 12px 圆角，第 3 行 336×36px 悬停高亮与第 7 行当前段亮刻度分别实现。原 Q/A 预览已改为常显轨道及完整目录，标签来自实际用户消息首行；只在最早历史页已加载时提供真实 Session start，并有三语言文案。不生成官方章节或冒充有章节摘要能力。已补内部/外部 Escape 归属、IME、稳定 entry key，以及增删目录时保持用户手动滚动位置。最终实际页面检查通过七项轨道/目录、hover 与 active 独立、16px 真实锚点定位、Session start、Home/End/Escape/外部焦点、中文和窄窗可达；页面错误为 0，零真实模型调用。证据在本机 `test-results/pilaude/navigation-reference/run-1792310942661/`。目录宽 348px、高 297.402px，记录 +0.402 原像素高度残差，未强行缩放图层。
- 最新侧栏参考包含名称淡出/全名浮签，以及用户明确替换旧呼吸灯参考的左侧状态圆点图。现已实现按实际溢出检测淡出与 portal 浮签、键盘焦点/Escape/IME、真实运行/未读状态左点、竖菜单和项目 chevron。几何按本地 1.25 capture 归一，固定 chrome 字号与默认侧栏宽保持。500ms 浮签延迟和 1.4s 呼吸周期是工程默认，静图未给原版时序。实际检查通过短名无浮签、溢出名称完整浮签、键盘焦点/Escape、运行点与减少动效、竖菜单。默认 259 CSS px 侧栏使整行比裁图参考宽 36.75 原像素，选中行文字墨迹宽 −10、高 −2；全名浮签框宽 −24.453、高 +0.992，文字墨迹宽 −25、高 −2 原像素。原像素叠图位于本机 `test-results/pilaude/navigation-reference/comparison-final/`，参考 100% 底层、actual 50% 上层，只整数平移不缩放；这些字体、边界残差继续保留。
- 首页与工作会话 placeholder 两图已原字节归档；只归档参考文案，产品快捷键必须与真实 Pi 行为一致，未伪造 Ctrl+Enter 排队能力。
- Windows 回归修复已按差异迁入，当前产品分支定向 191 pass / 0 fail / 1 既有 Windows skip，MCP 进程清理自然退出；类型、依赖、lint 和 branding 通过。完整 npm test 未重新运行，详见 [Windows 验证记录](pilaude-windows-regression.md)。
- 右列已移除重复工作台顶栏和主顶栏第二个新终端入口；单列随外层宽度填充，多列才使用内部保存宽度，常驻图标与浮签按新实测色及几何实现。实际单终端/上下两 pane、300px 最小外宽、伸缩、展开恢复、隐藏重开、第三 pane/窄窗验证通过，PID 与内容节点连续，未新增创建请求，页面错误为 0，详见 [分区记录](pilaude-workspace-panes.md)。用户新增 3p 整屏说明用于整体关系，原文件未定位，单独 pending；两张 actual 和工具栏 reference 三张已原字节归档，不将 actual 当 reference。
- 下一步继续消息菜单、输入器、按钮、设置和模型选择等逐项实物校准，再扩展到统一授权、产物、受控浏览器、代理和计划任务。每个组件均按上述流程验收后更新记录。

## 2026-10-18 本轮会话、首页、图片与 Changes 证据

- 会话动作及状态共 101 项定向检查通过；实际页面 `test-results/pilaude/session-actions/run-1792313864403/` 通过完整菜单及真实可用性、Pin／分组／移出分组持久化、选中会话显式未读、空心 idle、Archive／恢复。实际黄色是显式 running wire 夹具触发，计算值 `#ffd60a`，参考 RGB 仍待测；真实后端 pending 生命周期另由 105 项测试证明，覆盖创建、响应、取消、超时、Stop、shutdown／destroy 与背景会话。不能将通知事件当作 pending 真值。Fork 从保存的 leaf 调用 `fork_branch`，静态语义核查确认复制 root→leaf 路径、无模型调用，但本轮没有 Fork 实际页面证据，后台忙状态拒绝也不能由 UI disabled 外推。
- quiet 首页 5 项定向测试通过；实际首轮 `test-results/pilaude/quiet-home/run-1792313790944/` 通过深／浅／390px 布局与真实项目选择／模型设置入口，显式空会话目录夹具，无模型请求。补充 `run-1792313922371` 保留 failed：开发 chunk 错误及移动设置页仍使用桌面 tabs 选择器；已采集的布局和部分入口成功不能合并宣称补充四状态全通过。当前 ripple opacity 深／浅为 0.14／0.10，先前 0.34／0.20 属历史运行；原始首页完整构图／时序仍待参照。
- 图片 104 项定向测试通过。实际 `test-results/pilaude/image-wrap-reference/run-1792314555476/` 通过十二图的顺序／自然比例、1504／972 CSS 宽下四行三列、390／320 窄窗与短窗口输入区／末图删除、预览焦点／Escape、12→11 与刷新恢复；使用生成 PNG 和显式会话 GET 夹具、真实文件输入，`pageErrors=[]`、`blockedWrites=[]`，零模型调用。首轮 `run-1792314194925` 的按钮 345.59px／图片 288px 真实命中宽度缺陷已修且失败保留。旧运行使用 8 CSS px 间距，相对参考保留 +1 原像素差。最终 `run-1792315159076` 的 18 项实际检查通过 7.2 CSS px 校准（1.25 capture 为 9 原像素，DOM 7.1875–7.203125 CSS px，0.1px 容差），并重验 sent／composer 四行三列、比例／顺序、窄短窗口、预览和删除后刷新，仍无页面错误／模型／API 写入。首次精校 `run-1792315052370` 因 Context 开启使容器从 884px 缩到 538px、仍用三列断言而 failed，保留为 checker 条件问题；最终运行真实关闭 Context 后通过，不改参考图比例或用结果覆盖失败。
- 图片移出整组灰色 bubble 后，最终 `test-results/pilaude/image-wrap-reference/run-1792316235152/` 的 16 项实际断言通过：图片直接在透明画布排列，image-only 不产生空 bubble，后续普通文字与真实 SDK compact command 各保留一个灰色文字 bubble；长文字实际展开后仍有 300px 滚动上限。十二图顺序、四行三列、自然比例、7.2 CSS px 间距、预览焦点／Escape、390／320 窄屏再次通过，无页面错误或 API 写入。对应 MessageView／ImagePreview 39 项测试及定向 lint 通过，未重复计入先前 104 项。旧 `run-1792315159076` 继续证明未改动的 composer／删除／刷新路径；其中的灰色图片包裹外观由新运行替代。
- 该附件批次只采用 `MediaLightboxViewer` 的自然尺寸／contain CSS，经 `ChatInput` 与 `MessageView` 消费；后续已增加 ImagePreview 的光标锚定 zoom／pan 和 wheel adapter，最新证据见下方记录。`useClaudeSharedElementTransition` 仍无 consumer。参考上传图含十二个外框、四行三列与统一右边缘；原始 payload 比例、内容 crop／letterbox、绝对 bbox 与 DPI 未核实，功能检查不作像素一致性通过。
- Changes 已接入独立 pane、只读真实 Git review API、反馈草稿与受限独立窗口。后端真实 Git／API 19 项、UI helper／浮签 23 项（19＋4）、Rust 窗口 4 项、前端命令 5 项、页面 route 5 项与 token 2 项分别通过，父级另有 39 项集成；最终类型与全树 ESLint 退出 0，保留既有 TerminalPanel aria 警告。复查发现的 copy 目标混源 patch 已由真实 Git fixture 复现并用 `--diff-filter=C` 修正，copy／rename／context3 组合 3 项通过；后端现 20 个用例，前轮 19 与本轮重跑 3 不相加计总。延迟 storage event 的 current request ID 校验另有 3 项 helper 通过，拒绝超时取消后的旧事件；实际 `run-1792315635019` 前七组核心流程通过，整轮保留 popout ACK failed；定向 `followup-1792316406830` 已通过浏览器独立页、真实草稿 ACK、浅色重载和 820px 窄窗表格加载，errors／writes 为空。此前 `followup-1792316105640` 无 ACK 的 partial 仍保留，原因未证，不能称间歇问题根治或完整 E2E 一次全绿。该批次结束时为纯文本和词差异 mark；后续 TDD 批次已增加 Prism 语法色，见下方最新记录。Ctrl+P／Ctrl+Shift+Y 仍限定 pane chrome，展开／关闭不展示未绑定快捷键。
- 最新原像素叠图位于本机 `test-results/pilaude/changes-reference/comparison-after-calibrated/`：参考 100% 底层、actual 50% 上层，只整数平移；36×36 原像素按钮框未缩放。五个同状态图标实测 actual/reference：Show files 18×16／18×16、Search 19×19／19×18、Settings 4×15／4×16、New window 21×17／20×17、Close 13×12／12×12。最后一版 Expand 的实际截图处于 Restore 状态，因此未拿 Expand 参考比较。浮签高度 +0.992 原像素，同文四项宽度差约 −9.410 至 −17.805 原像素；Close 没有虚构 Ctrl+反斜杠文案，宽度不作同文比较。顶栏位于窗口上缘时 tooltip 按边界翻到下方，与参考位于 pane 上方的浮签分开记录。会话菜单 root 高 +42 原像素（保留原有元数据），Open in 子菜单高 +105（禁用能力说明），idle 空心点 9×9 和核心色相同，未读边缘仍有 1px 抗锯齿残差。这些不以功能通过抵消。
- 最终图片 `comparison-aftercanvas/` 的框级比较只对几何：整数平移 [−1,+75] 后公共右缘一致、同行底边散布 0，间距 8.984375 原像素对参考 9，差 −0.015625；第三／四行绝对底边仍差约 +60 原像素，生成图比例和内容不同，未用拉伸消除，也不宣称整图一致。
- 开发预览服务 `5e387e42` 在约 90 分钟后自行以 134 退出；最后 GC 日志约 6.8GB heap 并明确 heap out of memory。自然退出后通过 preview_start 恢复同一 30142 配置；不把此开发编译限制写成正式产品内存结论，也没有绕过此前停止服务的拒绝。该批结束时完整 npm／terminal E2E、390px Changes、Windows 原生独立窗口及 DPI／IME 验收未完成；后续 390px 浏览器目标已通过，完整测试及原生实物仍待验。
- 新 Changes 参考 12 个独立状态中已归档 11 个源文件，inline-comment 原件仍 pending；上传 1215×1336 总览的 12 图框另有归档，不代替缺失的 inline 原件。源文件与本地归档原字节／SHA-256 相同，聊天 payload 字节身份与参考版本／DPI 仍未核实，见工作区 `references/claude-desktop/changes-dark/2026-10-18/` 和 `upload-images-dark/2026-10-18/`。详细 pane 范围见[分区记录](pilaude-workspace-panes.md)，33 项来源范围见[采用账本](pilaude-component-adoption.md)。

## 2026-10-18 后续 TDD 实际检查

- 菜单动效已建立 `ClaudeMotionPresets → cds-motion → MenuPanel` 的真实消费链；`cds-motion/run-1792318823633/` 通过普通／reduced-motion 两条件，CSS `linear()` 的 100ms opacity 为 0.612951、500ms 为 1，位置／尺寸固定，子菜单跨缝、键盘焦点、IME／Escape 和滚动关闭有效。仅 opacity 适配，不能称已复刻空间回弹或原生窗口动效。
- 图片 `image-preview-zoom/run-1792319488145/` 六组通过：光标锚定 wheel、键盘／双击／拖动界限、resize fit、原生 modal Tab 循环与背景 inert、换图／IME／焦点恢复／减少动效、加载失败完成状态。生成 PNG／会话 GET 夹具，writes／pageErrors 为空；同触发器慢速 src 替换未做浏览器验证，shared-element 转场仍未采用。前几轮 checker 合同和错误断言失败分别保留。
- `changes-tooltip/comparison-after-type-calibrated/` 的三组原像素叠图以参考 100% 底层、actual 50% 上层，只整数平移。Go／Show／Settings 外宽差 −1.266／−0.160／−0.242 原像素，外高差约 −0.004；Go 字与快捷键墨迹尺寸吻合，Show 各宽 +1 且 gap −2，Settings 字框吻合，文字 y 均 +1。新一轮 Open in new window 同状态图缺；Close 未伪造快捷键，不作同文宽度比较。YAML property／string 根据原图核心色候选 #f47b85／#9be963 校准，原 CSS 色、DPI 和字体身份未证明。
- ACK 新定向证据：`changes-ack-reliability/run-1792319138883/` 连续十次和旧窗口 A→B→A 隔离通过，最后 fresh 遇 document 重载仍保 partial；补剩余 `fresh-only-1792319508195/` 一次新 popup 反馈通过，匹配 ACK／草稿插入各一次，document 代际不变。两轮刷新后旧目标被拒绝的失败如实保留，没有延长超时／自动重放／修改 AppShell；不能把当前诊断当此前所有间歇失败的根因。
- 本批定向组合 42 项、上游边界／CSS 基线 60 项通过；项目 TypeScript 和完整 lint 通过，保留既有 TerminalPanel aria 警告。完整 npm／terminal E2E 和 Windows 原生窗口／DPI 实物仍待验。Changes 的隐藏状态先 focus 竞态已改为布局可见提交后首次聚焦，Tab 退出显式关闭；`focus-diag-1792319835972/` 三次通过。最终 `syntax-keyboard-1792320000380/` 五组实际目标通过，覆盖源码／mark、键盘／IME／编辑器、390px 已加载表格和工具栏／finder、无横溢出与关闭焦点，errors／blockedWrites 为空。断点后 checker 真实重开外层再验收，未修改既有移动显隐语义。

## 普通文件标签后缀保留专项

`AttachmentCard` 的文件名前缀／最后扩展名分离及双 span 收缩已局部适配到 TabBar，不采用固定字符数截断。`file-tab-filename/run-1792321054232/` 九组实际检查通过六类文件名、390px 中文标签、阅读状态恢复与关闭活动标签；.tsx 在移动 label 69.594 CSS px 内仍完整，异常长后缀限制为 label 的 50%。完整路径 title／ARIA 保留，wrap=true／scrollTop=420 切回恢复。PNG、会话与 Files GET 为明确夹具，apiWrites／pageErrors 为空；16 项定向、类型与完整 lint 通过，既有 aria 警告保留。首轮虚拟 cwd 不存在的 checker 失败单独保存。没有对应官方长文件名状态图，功能结果不标为像素一致；Terminal／Artifact 标题与文件路径身份保持原有语义。

## 上下文圆环数值专项

圆环继续消费 SDK 当前 context percent，不套源示例累计 input／output／cache 计算占比。已用真实组件 SSR 先复现 NaN SVG 和非法窗口／统计 tooltip，再限定有限非负值：无效比例按未知、分母必须正数、累计 token／cost 无效则省略。超过 100% 保留真实文字，只限制弧长；90% danger、空 usage 隐藏及统计点击保持。5 项 SSR 与 8 项累计统计用例、类型和完整 lint 通过，既有 aria 警告保留。此项为产品修复，不计新增 open-claude-ui 采用；实际 `context-usage-ring/run-1792321449859/` 九组通过七类状态及正常／未知统计 popover 开关，草稿保留、14×14 SVG 不变，writes／pageErrors 为空。NaN／Infinity 只由 SSR 覆盖，未伪造 JSON 浏览器用例；未作新的像素一致性声明。

## 上游更新规则

两个 fork main 的 GitHub Actions 定时同步仍保留；2026-10-18 Pi 遇到 GITHUB_TOKEN 工作流权限限制，已由本地授权同步。Codex「Pilaude 上游同步」每 6 小时运行工作区 sync.ps1（本机与 Codex 可用时），保留融合分支和未提交修改，只在失败时通知。开始工作及采纳资产前 fetch origin/upstream，确认作者侧落后提交数；融合分支保存当前改动后合并已同步的 Pi main，处理冲突、依赖和语义变化，运行相关验证。不能只刷新 remote ref 就说融合分支已更新。

`vendor/open-claude-ui` 是受控集成边界：参考 checkout 更新后，比较实际采用的 CSS/组件、记录新来源 SHA 和变更，再测试后接入；不能仅修改 README 的 SHA，也不能将整个库入口的 Electron 依赖带入 renderer。新资产没有通过运行验证时保持“已发现、未接入”，不能混作已完成。
