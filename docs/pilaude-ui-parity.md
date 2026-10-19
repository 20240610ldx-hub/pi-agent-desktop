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

## 中性悬停文字规则（2026-10-19）

用户追加深浅色工具活动摘要参考，并明确普通文字悬停不使用橙色：暗色变白，浅色变灰。该最新选择适用于摘要、消息操作、菜单、链接等普通交互文字；增删数字、失败／危险、选中及真实运行状态仍按各自语义，不把颜色状态误算作 hover。实现加入 `--text-hover`：暗色 `#f5f5f5`、浅色 `#525252`，工具预览／元数据／箭头用明确 class hooks，避免按深层 DOM 位置覆盖状态标签。实际 `hover-colors/results.json` 深浅两轮通过 computed color 与截图核对：过程／思考摘要暗色 `#b4b3a8→#f5f5f5`、浅色 `#8a8a8a→#525252`；工具预览和消息复制暗色 `#898781→#f5f5f5`、浅色 `#8a8a8a→#525252`；文件编辑摘要／行及箭头也按中性色变化。成功与增行保持暗色 `#30d158`／浅色 `#248a3d`，减行保持 `#ff6961`／`#d92d20`。API 写入、外部请求与页面错误为空；文件树／设置 Add 有规则检查，未逐项截图。早期浅色摘要静止／悬停同为 `#525252` 的检查只作中间证据，已补静止灰度与最终变化。用户这组截图没有独立版本／DPI 元数据，不能作为所有控件的像素一致性证据。

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
| 消息、操作条、代码 | `ChatMessageBubbles`、`CodeBlock` | ChatMessageBubbles 的测高／渐隐／展开机制已由 useMeasuredOverflow→CollapsibleUserText 局部消费；字体／宽度观察与隐藏恢复为产品扩展。CodeBlock 的 2.5 秒复制／衰减由 CodeCopyButton 局部适配并经真实普通 fence／Mermaid source 消费，失败重试、重复计时和陈旧结果检查已有证据；现有 Prism 与 streaming 保留。完整消息布局、编辑和 Windows 同状态视觉仍待对照 |
| 思考展开和氛围 | `ThinkingAccordion`、`ReasoningAmbientGlow` | ThinkingAccordion 的受控 Grid 开合已由真实 ThinkingBlock 消费并通过加载／重试／偏好／中断清理／减少动效检查；活跃指示缺逐 block wire 标志，氛围层未采用。Windows 同状态参考仍待补 |
| 模型选择、用量、推理强度 | `ModelSwitcherWithTokenGauge`、`ModelSelectorEffort` | 资源可用；使用真实 Pi 模型能力/未知值，不能移植演示额度 |
| 动效参数与级联 | `ClaudeMotionPresets`、`CdsMotionEngine` | 前者的求解器／SNAPPY 经 cds-motion→DomContextMenuHost 消费到 opacity 进入；实际 CSS 曲线、静态命中区域、reduced-motion 与菜单交互已有目标检查，其他 springs／variants 未采用。后者仍未采用且含演示展示 |
| 滚动跟随和渐隐 | `useClaudeScrollPinning`、`ScrollFadeContainer` | 前者仅 `cds-scroll.ts`→`useAgentSession` 的 150ms 输入锁；后者由 ChangesPane 的 FadedScroll 局部适配 2px 边缘判定，补容器／内容 ResizeObserver。其余阈值、alpha stops 和双轴行为不记采用 |
| 声音与麦克风 | `ClaudeAudioPlayer`、`LiveMicActivityBars` | 仅有合成方案；不等于原版声音；实际支持能力和许可仍需核实 |
| 图片灯箱和共享转场 | `MediaLightboxViewer`、`useClaudeSharedElementTransition` | MediaLightboxViewer 自然尺寸／contain 由 native-theme.css→ChatInput／MessageView 消费；新增 image-view-transform→ImagePreview 适配光标 zoom／pan／wheel，保留原生 dialog，定向单测通过、实际页面分轮记录。SharedElementTransition 未采用；最终缩略图 gap 已校准至 9 原像素目标，原始内容比例与绝对 bbox 仍待补证 |
| 产物分屏与桥接 | `ArtifactsSplitPaneResizer`、`EpitaxyIframeBridge` | 资源可用；保留 Pi 产物真实内容、安全边界与保存流程 |
| Diff | `StreamingDiffViewer` | Changes 的 tabular-nums／增删背景保留源组件的局部样式适配；当前通用 parser、unified／split 表格、替换行配对、词差异和 token 树已迁移到 MIT `react-diff-view@3.3.3`，真实消费点为独立 ReviewDiff。产品保留 revision／连续选区／反馈 ACK；既有 Prism 按 hunk 和两侧隔离，原文继续来自 Git 行。未采用源流式引擎，不增加 open-claude-ui 采用数；最新运行与视觉残差另记 |
| Windows 窗口与顶栏 | `createClaudeMainWindow`、`ClaudeDesktopHeader` | 主要是 Electron/macOS 参考；Tauri Windows 实物行为与精确几何待补 |
| 侧栏、项目/会话拖放 | `DraggableSessionList` | 同组已显示固定根会话 Alt+↑/↓ 相邻重排已局部接入真实 metadata／按钮，保持家族、焦点／草稿、预览上限、刷新及跨窗顺序；四组实际页面检查通过。指针拖放未采用；完整 Windows 导航、搜索、收起/展开/右键状态仍未全部对照 |
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

## YAML 同文原像素与图片 DOM 补验

2026-10-18 新一轮从参考 00 的可见 YAML 转录显式只读夹具，通过真实 `/changes` 页面采集 1019×816 原像素截图。使用 816×653 CSS viewport、1.25 capture，原图 DPI／zoom 未知；只作整数裁剪／平移，无缩放。`changes-reference/comparison-yaml-before/` 与 `comparison-yaml-after/` 分别保存六组参考 100% 底层／实现 50% 上层、差分×4、覆盖范围和逐项测量。截图内的 YAML／shell 仅为数据，没有执行。

根据原图与 AST，修复未加引号的 YAML scalar 落回普通色：仅 yaml／yml 根文本继承 string，明确 token 继续覆盖 key／number／boolean／null／comment／punctuation；未知语言和预算回退仍为精确纯文本。内联视图改为单号栏，删除对应旧侧、添加对应新侧；从 split 带回的旧侧 context 选区仍保留旧行号，Shift 延展与反馈原文不变。helper／真实呈现叶组件／语法共 17 项通过，split 的双侧入口保留。此项没有增加源模块采用数。

字号依据同文墨迹校准为代码 14 CSS px、pane 文本 15.6 CSS px，行高固定 20.4 CSS px：`id:` 26×13 对参考 26×13；`shell:` 58×13 对 59×14；Prepare 值 326×17 对 330×17；同文文件标题 206×20 对 206×20。单号栏 71.992 原像素对约 72，table 到代码原点 94.492 对约 94；行距仍 25.508 对约 25.5。82／105 行号前景另经精确像素采样确认与 rail 同为删除 #ff2c56／添加 #32d74b，局部改用 rail 变量；原语义 danger／success 不变。不得据此推断原字体身份或整屏一致。standalone 缺外卡留白／两枚宿主回调按钮、自然保留的 leading 78 省略行入口、tree 分组结构、计数文字及部分换行断点仍是残差，没有加宽 sidebar 掩盖外框偏移。当前 code 可用宽 604.258 原像素，参考约 568，仍多约 36.258；added82／83／105 的换行断点仍不同，可用宽度与内联 token／mark 边界是尚未隔离的共同因素，不继续调整全局字体追逐这一容器差异。

实际 `changes-reference/yaml-visual-1792322634062/` 通过单号／YAML 色、旧新 82 行反馈、split 旧 79 切回 inline／Shift 到旧 80／取消恢复新号；最后仅修行号前景的 `yaml-visual-1792323175159/` 再次通过这些检查及精确 computed 行号色断言，旧证据未覆盖。两轮 console error／warn、pageErrors、blockedWrites 均为空。`comparison-yaml-number-final/` 逐像素检查新旧图仅四个行号墨迹区域的 765 个 RGB 像素变化，区域外为零；参考／最终核心色相同，旧六组 after 仍保留。真实 Git `syntax-keyboard-1792322713151/` 再次通过五组原文／mark、inline／split、键盘／IME／编辑器及 390px 已加载表格／finder，无根横向溢出；该专项捕获 pageerror，不将它写成 console 检查。

另在图片 Markdown 入口真实复现 `<p>` 内 div／dialog 的四条 React console error；旧 `image-preview-zoom/run-1792319488145/` 仅捕 pageerror，未覆盖这些警告。现将原 src-keyed native dialog portal 到 `document.body`，保留加载／焦点／缩放生命周期；16 项图片定向测试通过，`run-1792322241886/` 七组实际检查通过，含 body 挂载、无 Markdown 祖先、原生 modal／Tab／背景 inert／Escape 焦点恢复。console error／warn、pageErrors、writes 严格为空；RED `run-1792321866405` 原报告保留。最终本批 UI／语法／几何／ownership／提取与 CSS 基线组合 93 项通过，项目 TypeScript 与完整 lint 退出 0，保留既有 TerminalPanel aria 警告。完整 npm／terminal E2E、Windows 原生窗口／DPI／IME 实物仍待验。

## 用户补充 Changes 展开态与复用要求

2026-10-18 新图原件 2288×1535（聊天显示 2000×1342）已按原字节归档至工作区私有 `references/changes-expanded-dark/2026-10-18/00-user-provided-changes-expanded.png`，SHA-256 为 `c9511da8b8018b3d39fb4a37bbfce3c168e6f989b270e31dd327a64cc6497b73`。角色为用户提供的展开态参考，宿主应用、版本、DPI／zoom 与聊天 payload 精确字节身份未核验；可见 Pilaude 源码不证明宿主身份。原件不进入公开仓库。

用户明确要求通用 diff／彩色代码块复用成熟开源渲染库，后续避免重复实现。本轮已固定采用 MIT `react-diff-view@3.3.3`，通过真实 ReviewDiff 消费库 parser／表格／替换行配对／词差异／token 树，并删除原 Changes 自写表格、词差异与 review-syntax 适配器；FileViewer 仍消费原上游 patch helper。选库与迁移边界见[采用账本](pilaude-component-adoption.md)。新库接入仍须逐项验证视觉与真实反馈、原文、键盘及性能，不把默认库外观当作一致性通过。

## New 入口与内联选择边界补验

`new-welcome/run-1792330694586/` 通过七组真实界面检查：New 显示现有首页／隐藏 Context，返回会话保留未发草稿，首页刷新保留会话与空会话 draft，项目／模型入口、reduced-motion 和 390px 无横溢出。History API 只处理本地 home 切换，真实换会话仍用既有导航。project roots 的稳定有序路径 key 修复重复通知循环。API 均为显式内存夹具，未运行模型或写真实用户设置；pageErrors、markup／update-depth 警告及 blockedWrites 为空，console 保留 canvas readback 性能提示。此轮只证明导航和状态，不证明最新流光视觉通过。

Changes 内联 context 起点保留两侧坐标，Shift 到明确删除／添加端点转换到对应 revision，split 仍保显式侧；无映射起点重新开始。新增叶组件／父 callback 与 display 共 17 项通过。`changes-reference/boundaries-1792326160929/` 通过实际跨侧选择和桌面／390px 五位行号无越列，gutter 按数字位数计算；console error／warn、pageErrors、writes 为空。移动 split 截图中的树 overlay 仍开，不把数字边界检查写成整屏视觉通过。prototype-shaped 文件后缀另有语法回退回归，继续复用既有 refractor，未新增 parser。

## 首页静置／点击两态重新实现

用户后续提供清晰静置／点击两态参考，原字节保留于本机私有 `references/claude-desktop/home-code-ripple/2026-10-18/04-home-idle-light-reference.png`（851×532）与 `05-home-click-light-reference.png`（867×548）。用户否决此前规则圆环、过小短促扩散、过大范围、字面形变及控件触发波纹；这些旧版不能因功能检查而写成视觉通过。

原像素测量显示字符节距约 6.0±0.1×12.0±0.3px，静置为近灰弱字，点击后的净区明显偏蓝，局部可分离亮带半高宽约 19–24px、估计不确定度 ±6px。参考的 DPI／应用缩放／字体身份及动态时序仍未知。实现现重新采用固定字符网格上的连续不规则照明纹理；用户随后指出仅扩大受光区域丢失水纹传播，现从点击点向外推进一道完整的不规则窄亮纹，保留细亮边与柔尾；只有连续点击时才叠加来自独立起点、寿命与随机种子的波纹。局部纹理只改变照明传播路径，字符格点保持固定。静置中速局部换字，点击照亮处较快换字；背景点击才入队，项目／模型控件及 SVG 后代不触发。前轮实际 `ripple-motion/run-1792334850698/` 五组通过：固定格点的静置照明／换字、控件及 SVG 后代排除、点击传播与亮区换字、reduced-motion、浅色派生状态；pageErrors、console、blockedWrites 为空。`presentation-1792334257081/` 保存 86 个实际 compositor 帧及原时序 GIF，874×560，画布 615×515，无缩放，未写设置或调用模型。145 项受影响回归、类型及 lint 通过，保留既有 TerminalPanel aria 警告。原像素 `reference-comparison-final/` 为参考 100%／actual 50% 整数裁剪叠图：字符节距 actual 约 5.994×11.933 对参考 6.045×12.038，背景 #151515 对 #171717；指定 actual 帧为点击后约 3.046 秒退场，右下蓝光明显弱于未知阶段的参考，不能据此证明峰值相同或完整视觉通过。构图、亮度与原始动态时序仍待校准，不将历史 100px 小圆环检查外推到新版。

单击曾人为生成三道波前，导致一次点击也出现类似多次碰撞的样式。针对公开 `rippleLightEnergy` 空间输出先 RED 复现两个独立亮峰，再最小删除追加波前，保留原有不规则路径、亮边／柔尾、范围／时长与静置 6Hz／点击 24Hz 换字。最终 helper 共 7 项测试、定向 lint 和 diff 检查通过。真实 `ripple-motion/single-double-1792336146500/single.gif` 保存单次点击 38 帧，该单次分组通过；同 run 后续双次的 observer 亮度阈值断言失败，整体状态仍为 failed，不覆盖或改称整轮通过。补充 `ripple-motion/single-double-1792336369255/double.gif` 与 `results.json` 通过两次独立背景点击，实际间隔约 679ms，38 帧保留两起点扩散；另验项目／模型控件及 SVG 后代不触发、reduced-motion 静态。单次／双次记录的格点位移均为 0，绘制约 30Hz，亮区多位置持续换字；最终双次补验的 pageErrors、console 和 API 写入为空。两组实际关键帧已人工读取核对，单次不再人为复制三道波前；这些行为及记录不代表与参考完整视觉一致。

## 成熟 diff 渲染库迁移验收

`ChangesPane → ReviewDiff → react-diff-view@3.3.3` 为当前真实路径；库负责 patch 解析、统一／并排表格、替换行配对、词差异及 token 树，产品保留比较身份、原文选区和反馈 ACK。旧 Changes 手写 table／词差异与 review-syntax 路径已删除。分 hunk 重基后再调用 tokenizer，避免高绝对行号形成大量空白源码；空行薄适配避免库回退插入一个视觉空格。文件末尾无换行提示已提供三语言文案并标明受影响版本，完整新增／删除的 split 标题只显示真实存在的一侧；浅色 gutter 保留语义色回退。跨后缀 rename 按旧／新路径分别着色，前导空行只从库的词差异发现输入中省略、原始 token／反馈文本保留；已验证两侧空行数量不同时的真实行号、内部空行、Tab／尾空格和不修改 hunk。最终一次受影响组合回归共 171 项通过、0 失败／跳过，包含真实 Git／API、源文本与渲染、空行／预算、EOF、选区、水纹、ownership／上游提取／CSS 基线及许可／分发契约；项目类型检查通过，完整 lint 退出 0，保留既有 TerminalPanel aria 警告。完整 npm test／terminal E2E 与 Windows 原生验收未据此追认通过。主库 MIT 与依赖中 Apache-2.0 等许可原文另见 THIRD_PARTY_NOTICES，并加入 npm 文件清单和桌面 server resource 复制；尚未运行发行打包。

最终显式内存夹具 `diff-library/run-1792338085844/` 八组实际检查通过：Unicode／Tab／源码样 HTML／空行、词差异开关、跨侧选区、IME／Escape、原文与 comparison 身份经现有反馈通道确认、split→inline 旧侧身份与语法、连续替换行配对、单侧 context 选中且仅一个编辑器、桌面／390px 长行号和浅色轨道。反馈接收页是同源合成 ACK fixture，不当作实际 ChatWindow 或模型提交；页面 errors／console／writes 为空。初轮字面转义 Tab 断言错误、开发 HMR 重载与随后接收页监听丢失、浅色检查误选零宽空 gutter 的 failed 报告均保留；最终接收页改为显式静态 fixture，未延长产品超时、自动重放或修改反馈生命周期。

独立复查随后复现并修复四个边界：旧／新版本无最终 LF 的呈现不再完全相同，完整新增／删除的 split 标题与库单侧布局一致，跨后缀 rename 保留旧侧语法，前导空行不再把后续数字词差异错位。最终 `diff-library/run-1792339340071/` 九组实际检查全部通过，包含这四项及前述原文／选区／ACK／主题／390px 目标，errors／console／writes 为空；两轮扩展 checker 曾未展开第九／第十文件而失败，已保留，最终通过真实文件 toggle 展开，不修改产品八文件默认展开上限。

真实 Git 工作区 `changes-reference/syntax-keyboard-1792338708381/` 五组通过：实际 API patch 与统一／并排 DOM 精确一致、语法／词差异开关、finder 和菜单键盘／IME、反馈编辑器按键，以及 390px 真实加载／关闭焦点；errors、console error／warn、blockedWrites 为空。首轮 `syntax-keyboard-1792338590581/` 在窗口切换后仍按 5 秒等待 table 而失败，保留原报告；最终增加 per-file network 记录及 30 秒测试等待，文件请求成功，没有改产品超时。另 `changes-focus-1792338623869.json` 对同一真实 Git fixture 通过三组菜单／禁用项／焦点检查。以上均未发送模型。

同文 YAML `changes-reference/library-yaml-visual-1792337932938/` 实际呈现及选区检查通过，console error／warn、pageErrors、blockedWrites 为空；DPR 1.25、816×653 CSS，截图整数裁剪为 1019×816 原像素。新 comparison 目录按参考 100% 底层／actual 50% 上层，只整数裁剪和平移，缺覆盖透明，不拉伸或重采样。原像素行距 25.5078 对 25.5、号栏 71.9922 对 72、table 到文本原点 94.4922 对 94。standalone 的 code 内容宽仍为 604.2578 对参考 568，多 36.2578；首行 y 多 28.5078，提交分隔线 y 多 26.0781；外卡、leading context、换行及部分语法颜色继续登记差异。runtime custom CSS 使用既有本地字体别名，这不是公开默认字体或 Windows 原生 DPI 验收。成熟库采用已实现，完整视觉一致性尚未通过。

实际 workspace 补验 `changes-reference/library-yaml-workspace-1792338305434/` 先通过真实 Git API 预检，再仅替换展示 GET，使用真实顶栏和 resize 控件将 pane 调到 790 CSS px（目标 789.6，差 +0.4）；990 原像素整数裁剪包含真实 1px border／10px radius 卡片。代码内容宽变为 571.7578 对参考 568，差约 +3.7578 原像素；参考 padding 未知，该内容宽为近似比较。参考另有约 15 原像素右滚动条带，当前 table 则延伸到卡片内缘；行距、gutter 和 table 内文本偏移保持。DOM Range 实测删除／添加 82、两侧 105 和 107 的换行与参考接近或吻合，83 的 `echo` 仍在 `>>` 之后而非之前换行，部分字形／标点与外层 canvas 留白仍有差异。只有两次既有只读 cwd validate POST，console error／warn、pageErrors、blockedWrites 为空。此补验说明 standalone 容器状态解释了大部分宽度残差，不改字体追逐不同容器。

## ThinkingAccordion 受控呈现适配

2026-10-19 新增 `MessageView.ThinkingBlock → ThinkingDisclosure` 实际消费链，局部适配 open-claude-ui `ThinkingAccordion.tsx` 的 Grid `0fr ↔ 1fr`、200ms／`cubic-bezier(.19,1,.22,1)` 展开机制。Pi 原控制器继续拥有 `pi-thinking-expanded` 默认偏好、设置广播、deferred history 按原始 blockIndex 获取、进行中 Promise 去重与失败重试；折叠不发起获取。新增真实 button、ARIA 关联／inert、关闭时正文暂留直到动画结束，以及 reduced-motion 静态回退。

源组件的强制 live 展开、复制回调／计时和三点状态不随本次移植：当前 wire 没有独立思考 block 活动态，不能用整条 message streaming 伪装。首次 MessageView／呈现／偏好共 39 项通过，随后与扩展 IME、事件流、键盘及上游边界组合 126 项通过；类型及完整 lint 通过，保留既有 TerminalPanel aria 警告。实际 `thinking-disclosure/run-1792340616360/` 前五组通过原始 blockIndex、pending／cached 去重、失败重试、Enter／Space、正常开合中间高度与结束清理，但快速 Settings true→false 时没有启动的 CSS 过渡不发 transitionend，四个闭合区虽为零高且 inert／aria-hidden，正文仍留在 DOM，整轮保留 failed。已改为关闭阶段观察实际 Grid 高度，归零、隐藏或 reduced-motion 时清理；最终 `thinking-disclosure/run-1792341152373/` 九组实际检查通过，思考 GET 恰为原始 index [1,3,4,4]，无重复；设置快速反向开关、关闭时启用 reduced-motion 或 New 隐藏原 chat 都使 height／正文长度归零、inert／aria-hidden 保持。普通开合实际记录多个中间高度，展开到 265.438 CSS px，深浅 390px 长文均无根／正文横向溢出；non-read／external 请求、console warning／error、pageErrors 与 HMR 为空。后续热编译／reload 丢入口、主题选择器错误和先前受拦截 lease 的 failed 报告保留，最终使用实际 Settings 主题控件，未修改产品超时。当前没有专门 Windows 思考区逐状态原图，不将来源 macOS 取证或功能通过当作像素一致性证明。

## 扩展对话框输入法按键归属

2026-10-19 定向复查修复 select option 的 IME Enter／Space 误提交，以及 composing Escape 从 dialog 冒泡到全局 Stop。option 沿用现有 `isImeComposing`（含 229）过滤；dialog 只对 Escape 先 stopPropagation，合成中保留默认候选窗行为，普通 Escape 仍只回复一次取消。没有改扩展请求 ID、队列、后端 promise、权限策略或工具执行。

相关 16 项定向检查与本批组合 126 项通过；实际 `extension-ime-20261019-002103-852/run.json` 使用六个显式合成队列请求，通过 composing／229 Enter／Space／Escape 不误回复／不取消／不 abort、方向键／Home／End、普通确认／取消、清空 dialog 后全局 Escape 正控制。API 全部本地拦截，不运行真实模型或扩展；本轮 response 与 abort 只是被记录的 fixture 请求。console warning／error 与页面错误为空，实际截图已读取核对。首轮 get_tools 夹具错误和此前未捕获 warnings 的范围明确保留；Windows 原生 IME 不据此标记通过。

## 代码块复制生命周期（2026-10-19）

源 `CodeBlock.tsx` 的 2500ms 反馈与现有 vendor `saved-check-decay` 已由真实 `MarkdownBody → CodeBlock → CodeCopyButton` 消费；Prism／行号、流式纯文本、Mermaid source／header actions、首尾空行／Tab／Unicode／HTML 原文继续保留。三轮 RED→GREEN 分别复现 1500ms 提前消失、重复成功被旧 timer 清空、失败没有反馈／未处理 rejection；组件现等待既有桌面／浏览器回退链，错误可重试，每次成功重置 timer／动画，源码变化或卸载使旧结果失效。额外 SSR RED 复现空 fence 显示 `undefined`，以 `children ?? ""` 保空串；实际空块又复现错误浮层被裁掉 5.594px，改为 header 内正常流第二行。

最终 `code-copy/run-1792373651369/` 七组实际检查通过成功／pending／重复／失败／乱序、真实拦截 SSE 源码变化保原按钮焦点、卸载后结果隔离、精确空串、深浅 390px、Mermaid source 与主题背景回归。真实空块错误提示完整可见；减少动态效果静态，正常动态在全新、从未安装 mock clock 的 context 测得 2466.519ms 时 opacity 0.794868。此前 mock clock resume／reload 仍保留时钟，CSS compositor 与 JS timer 偏移使短暂衰减采样失败；原报告保留，不据此改 source 曲线或追认早期配置断言为可见动效通过。页面／console 错误、external 请求和非读取动作为空；唯一 agent POST 为被拦截的 `get_tools` 读取命令，不运行模型。通用复制 checker 已接 `e2e/run.mjs`。本批最终受影响组件／翻译／侧栏与上游提取／ownership／CSS 基线组合 198 项通过，项目类型和完整 lint 退出 0，保留既有 TerminalPanel ARIA 警告；完整 runner／terminal E2E 与 Windows 原生剪贴板未据此标为通过。

## 固定会话顺序与键盘重排（2026-10-19）

RED 先复现 `[a,b,c]` 配合持久 pin `[b,a]` 仍显示 `[a,b,c]`，再补 pin rank 消费；相邻移动 helper、真实选择按钮和非按钮自身事件保护也分别观察失败后修复。算法适配 `DraggableSessionList` 的当前／相邻索引、边界检查与复制数组 splice，仅对同一项目／自定义组内已显示固定持久化根会话启用 Alt+↑/↓。重排映回完整 pin 数组的原 slots，后代保持在原家族 wrapper，其他组、项目、归档和 pin 资格不变。普通方向键、其他修饰键、IME／229、子元素事件、筛选／内容搜索、最近重复项、临时／子／未固定／归档项及预览外条目不获得该能力；无指针拖放实现。

39 项定向测试、类型及局部 lint 通过。额外审查复现了选中第六根会话替换预览第五位后，第四根下移会离开五行预览并丢失焦点；RED `sidebar-pin-order/run-1792373461695/` 保留。成功重排现在与 metadata 更新同一个事件批次展开该项目预览，保留原 keyed 按钮，边界 no-op 不展开；相邻移动仍只消费事件前已显示的同组 pin slots。实际可独立执行的 `e2e/sidebar-pin-order.mjs` 在最终 `sidebar-pin-order/run-1792373545120/` 五组检查通过顺序、原按钮焦点／草稿、家族和无关 slots 保留、预览／分组边界及所有排除项、刷新和真实跨 tab storage 同步；全部 API／SSE 为预先安装的生成夹具，non-read／external 请求、页面／console 错误为空。此轮只记录 Chromium 的功能通过，不证明 Windows 原生快捷键或整侧栏视觉一致。

## Windows Changes 原生边界补验（2026-10-19）

本机 `x86_64-pc-windows-msvc`／Rust 1.94.1 离线锁文件定向运行 `changes_window::tests::`：4 项通过、7 项无关测试过滤；前端窗口 IPC／能力配置合同 5 项通过。覆盖 cwd／反馈目标编码、清除原 token query／fragment、非法输入、只允许精确 server origin 的 `/changes` 导航，以及专用开关窗口命令与最小 capability 声明。使用仓库 Windows bundle 配置只为测试编译，未构建安装包或启动应用。

原始输出在本机 `test-results/changes-window-native-20261019-retry.log` 与 `test-results/changes-window-contracts-20261019.log`。首次 native 运行只有 compilation 行并以 4 退出，缺测试结果和诊断，原日志保留；相同命令重试实际 4 项通过。该轮不证明 live WebView 权限执行、原生开窗、DPI、贴靠或 IME 行为，不将单元／源码合同测试计作这些实物检查。

## 活动摘要与单处微光（2026-10-19）

真实链为 indexed thinking／text delta 和 tool execution IDs → useAgentSession → ChatWindow process group／MessageView。partial output 不等于终态；Stop／错误清活动但保留输出，当前 turn 未执行项仍 pending，历史缺终态不伪造成功。定时 reconciliation 只保留同 timestamp／provider／model、无后继／终态的相同或增长尾块已有活动证明；mount／reconnect／未知快照不推导。过程与流式消息共用 key tracker，保手动折叠、错误首次展开／后续手动关闭、最终答案组外和 exact-once；apply_patch 详情中的失败也进入摘要失败数。

组合 134 项定向测试通过。完整 `activity-disclosure/run-1792375885811/` 六组通过 live／history、deferred 原始索引、真实状态交接、光标结束、IME／草稿、错误展开不抢历史滚动，以及原零标题命中内容搜索后的思考定位。新结构实测本机私有 Sans alias loadedFaces=1、13px、border 0、透明；命令／输出保等宽。ShimmerText 局部消费来源 250% 背景与非对称关键帧，用户选择周期 1.8s；native frames 283.334ms 时位置从 83.333% 移到 83.2092%，reduced-motion 静态。先前 2rAF 停顿区采样和 transient search marker 检查失败保留；最终用跨停顿段实际位置和可见 highlight／滚动几何验收。

该 run 原 430px 截图被侧栏／Context 遮挡，只证明无根横溢出。补充 `activity-disclosure/mobile-supplement-1792376302856/` 经真实按钮关闭二者，深浅 430px 收起／展开截图均无遮挡；summary x64.797／w187.203／h28，tool x77.797／w323.203／h28，native center hit 均命中，输出上限 400px，root scrollWidth=clientWidth=430。触控 44px 的 coarse-pointer 样式尚需独立实际验收，不能以 430px 鼠标 viewport 推定通过。父级已读取两轮截图；无页面／console／external 错误，lease 等请求均由 fixture 拦截，无模型调用。

工具组／步骤目前仍是即时 hidden，200ms 高度、新步骤进入／错开、状态图标及摘要有限过渡尚待落实；复杂 Markdown 末尾光标也不追认全结构通过。清单逐项见 [Agent 输出实施记录](pilaude-agent-output-ui.md)。

## 左上导航轨与内容搜索（2026-10-19）

实际 `conversation-navigator-layout/run-1792375287625/` 通过深浅、0／50／100% 历史滚动、侧栏／Files 切换、2200×1000／900×600／390×812／390×340、点击／方向键／IME／Escape 焦点、draft reload／resize 和目录不抢正文滚动。轨道相对聊天栏 left=12／top=24 CSS px，正文最小间隙 24px；仅有真实 navigator 时预留 gutter。390px 正文宽 309.2px；390×340 下 track／directory bottom=174，低于输入器 top214.5，短窗不会压输入器。18 项定向测试、类型及 lint 通过；无写入／外部／页面错误。

原像素比较 `conversation-navigator-layout/comparison-1792374705856/` 用 1625×1125 actual 整数裁剪 [300,0,541,616]，参考 100%／actual 50%，无缩放。reference rail [47,103,68,214]，actual [43,86,65,198]；active 右端差 −3 原像素，正文边界差 +2.746，ink-to-body gap 差 +5.746。首刻度 top 差 −17，但参考 crop 原点／系统 DPI／zoom 未知，不据此改固定 top24 或声称像素一致。

内容搜索另修标题过滤零结果时不挂载搜索组件的问题，保原查询和搜索语义。32 项侧栏测试与 `sidebar-content-search/run-1792375755599/` 通过 title no-match → Enter 内容 GET／结果／excerpt → Escape／重输回 title mode → 清空恢复；actual query 为生成的 content-only-quartz-needle。无真实写入／external／页面错误，思考命中另在活动完整 run 中确认原块高亮可见。

## 会话标题下拉菜单（2026-10-19）

顶部 chevron 现挂载真实主／子菜单：Open in、Rename、Fork、Transcript view、Output style、Archive／Restore、Delete。复用共享 DOM host，保分隔、提示键、hover／键盘子菜单、IME、Escape 焦点返回和390px三语边界。真实动作接浏览器同源新窗口／Explorer、PATCH rename、当前 leaf fork_branch、现有侧栏家族 archive writer、确认后 DELETE；失败保原选择并显示错误。原生 New window、VS Code、Transcript modes 与 Output styles 缺对应 consumer／后端，显示明确不可用原因，无假选中／假成功；它们仍是待实现能力。

实际 `title-conversation-menu/run-1792376414932/report.json` 六组通过根顺序／键盘／取消与三语390px、archive family／fork／delete，以及延迟动作跨会话的回归。RED 先复现重复点 opener 重开、旧 DELETE 成功清空 B、旧 fork 在 A→B→A 后跳走；分别以 opener pointerdown exclusion、删除 current-ID 检查与 fork generation 校验修复。重命名迟到失败也按代际隔离。所有修改／删除请求为生成的本地 fixture 拦截，不操作用户真实会话。

DPR1.25 原像素抓取的 panel 为161.594×244.578 CSS px，整数 crop203×306原像素，参考202×306；横向取整占1原像素。row35.996对参考36，separator偏移48.496／134.238／219.980对48／134／220。reference100%／actual50%叠图无缩放，父级已读取；glyph／chevron仍有重影，参考DPI未知，不称像素一致。最终本批18文件组合267项通过，完整类型及lint退出0，保留既有TerminalPanel ARIA warning；ownership baseline6fcd7d4和30／250阈值不变。完整npm／terminal E2E与原生Windows GUI仍未据此通过。

## 共享折叠高度、真实任务与菜单能力补齐（2026-10-19）

`DisclosureBody` 提取现有 ThinkingAccordion Grid 机制供思考、工具详情和过程组消费，保持200ms／cubic-bezier(.19,1,.22,1)。过程组首次打开前不挂子树，随后持久保留；思考／工具只保留至归零。关闭立即 aria-hidden／inert，仅当前焦点在被收起的后代时向 trigger preventScroll 返回；隐藏聊天不抢焦点。最新展开 ref、ResizeObserver、media change 与 filtered transitionend 处理反向／未启动／隐藏／reduced-motion，不依赖延时器；收起期间子微光立即停止。

`disclosure-motion/run-1792378208269/` 六组实际通过三类中间高度、焦点／inert、嵌套状态／deferred cache、快速及同批反向、隐藏和中途 reduced-motion、历史滚动与收起单微光。工具 RED opening [0,529.5,529.5]／closing [529.5,0,0]，GREEN opening [0,0,217.28,368.05,446.53,…529.5]／closing [529.5,529.5,312.83,161.80,82.80,…0]。既有活动完整回归 `activity-disclosure/run-1792378225066/` 通过。该run截图中部分chrome正处有限过渡；稳定补拍 `disclosure-motion/run-1792378495618/` 经真实控件关闭遮挡、等待有限过渡结束，1300／430深浅trigger及body远端hit全部通过，mobile body x64.797..414，根scrollWidth=clientWidth=430。父级读取稳定暗色手机图；会话返回空白另经缓存修复独立验收，不用该活动通过替代。新步骤进入／错开、状态／摘要有限切换仍待实施。

真实 Tasks pane 的 `AgentSessionPanel` 改为 native select button 与 sibling Stop／Steer，修复按键冒泡选择和IME误触；queued／starting为空心、running实心、completed勾、failed叉、aborted／interrupted方块，未知不再默认success。并行任务不各自持续旋转。8项组件测试和 `task-activity/run-1792377606134/` 九组实际检查通过原生键盘、IME、单次拦截控制、filter／empty／long／family、并行SSE单项结束、Stop失败保真实状态、深浅／reduced和真实touch tap；Stop／Steer实测44×44且中心命中。父级已读dark／touch截图。它只接现有真实家族任务，不冒充Plan/Todo列表。

Output style 后端新增版本化session custom entry和定义store；普通会话通过隐藏 before_agent_start extension 将真实指令加入Pi system prompt sections，Default删除该section。精确提示词、chat-only和subagent保原合同，明确不可用。cold session GET／PUT metadata不启动运行时或模型；live owner与现有锁／stale wrapper边界共享。49项定向与邻接测试通过，含真实SDK＋进程内faux provider逐风格检查，未调用真实网络／模型。定义有80字符名称、16000字符指令、100项／1MiB上限、regular-file／atomic writer与origin校验。

前端只在ACK后切换勾选；generation隔离A→B→A旧结果，重复提交用ref挡住，损坏响应可重试；自定义创建后应用失败保draft和saved ID，重试不重复创建。7项实际DOM／API tests与 `output-style-menu/run-1792378213108/` 通过主AppShell、503应用失败／同ID重试、精确prompt不可用及1300／430深浅编辑器尺寸和native hit。唯一console503为显式失败夹具，报告保留，不说console全空；无其他console／page／external错误。父级已读手机编辑器和ACK菜单；编辑器无对应官方参考，不称像素一致。初始反向Tab实测逃出editor，最小修复为保存outer focus归属后聚焦form；最终 `output-style-menu/run-1792378489375/` 重验初始Shift+Tab→Cancel／Tab→Name及原全部流程通过，取代前轮此UI版本证据。

原生 New window 新增startup-origin-pinned Tauri command，只携带encoded session ID、theme bootstrap和独立OS controls，关闭不退出主应用；副窗口不覆盖主workspace／last-open、通知／音效或几何。VS Code明确为打开项目文件夹，直接可执行路径＋argv，不转移Pi会话。缺安装或启动失败显示原因。Windows20项Rust、28项Node与 `native-conversation-destinations/run-1792378155118/` 五组主AppShell＋mock IPC通过；更新菜单 `title-conversation-menu/run-1792378173460/` 六组通过，无page／console错误。早期mock缺Tauri event registry的unregisterListener已修fixture，未屏蔽产品错误。原生WebView实际开关／theme／DPI和真实Code.exe启动、macOS／Linux编译尚未实测。

预览本身修复了已确认的隔离缺陷：Next16.3.8 custom server prepare未把conf.distDir传给dev router，原30142实际共享.next/dev并绕过CLI监督进程，约8GiB后exit134。现在开发条件 `PI_WEB_UI_VERIFICATION=1` 从真实next.config选择ignored preview-cache，经next dev CLI启动；实读preview-cache/dev/lock确认30142独立。该改动恢复Next内置阈值重启路径，不表示底层HMR内存增长已根治；正常dev和desktop build目录优先级保留，没有next build。

输出风格存储错误另有隐私RED→GREEN：Node24 JSON.parse可在错误里带出损坏文件片段，原API直接转发message会暴露自定义指令。store read/write与定义／session API未知500现返回通用错误，保安全validation400；仅使用合成marker临时文件复现，12项相关store／API检查通过，无原始私人文件读取／日志。

## Transcript modes 与会话缓存往返修复（2026-10-19）

视图按session ID独立保存并由external-store同步；Thinking展开真实过程／思考，Verbose再展开工具参数／结果，Normal回既有默认。受控Context不重挂composer，mode变化只重新选择展开默认，用户随后手动开关仍有效，搜索／错误、原始deferred index与缓存继续消费；不显示provider system messages。偏好存储失败给出错误，无模型请求。

SSR真实controller与preference接口先RED后GREEN。实际 `transcript-view/run-1792378478848/` 四组通过Thinking原index2只取一次、Verbose原文详情、手动开关／草稿保留、A→B→A会话隔离、刷新与Normal默认恢复。父级已读Verbose实际截图；无页面／console／external错误或模型／mutation请求。

前两轮返回A出现空白的failed报告保留，调查证明与不同会话相同revision无关：cache按session ID隔离，即使fixture使用不同revision仍复现。StrictMode重复mount loads在第一次setMessages尚未commit时取滞后的空messagesRef，覆盖合法cached window；实际初始UI3条但cache0条／3IDs，返回即空白。`useAgentSession` 现只在当前session refs覆盖cached entry IDs时优先保live window，否则用canonical cached window并明确恢复state。public returned-hook RED→GREEN还保新pending user及messages数组identity；实际修后A cache3／3、B2／2、返回A3／3与正文可见。没有重置历史、修改timeout或放宽夹具结果。此批最终组合227项UI／session／翻译／ownership回归、19项输出风格store／API／真实SDK-faux检查、7项渲染DOM风格编辑器检查分别通过；Windows Rust20项已通过。项目完整类型、lint退出0，lint保留既有TerminalPanel ARIA一条warning。分组数字不相加冒充完整npm／terminal E2E。

## 有限步骤入场与快照来源（2026-10-19）

`useAgentSession → activity-entry-ledger → toolEntryState／consumeToolEntries → ChatWindow → useActivityStepMotion` 是新的真实消费链。只有 enriched toolcall_start 的稳定 ID 获得一次性有序 grant；execution replay 不获得，历史／分页／轮询只 seed seen IDs。message_end／终态保留尚未消费 grant，首次 DOM 提交即消费（隐藏／reduced 也消费），scope 隔离会话与显式分支导航，普通 leaf 推进不重置。稳定 ChatWindow owner 位于 answered/unanswered group key 之上，重开／重挂不补播。WAAPI 入场180ms／6px，错开40ms、最大120ms；图标160ms、摘要150ms只响应实际语义变化，不延迟可访问状态或因参数 delta 重启。

独立复查以真实 Agent／AssistantMessageEventStream／wire 复现一个初版缺陷：工具执行期间 isStreaming 仍为 true，但没有 streamingMessage／bootstrap；随后同一 run 的真正 message_start 已共享新工具内容，会被错误基线化而漏掉入场。服务端现在明确发送 `connected.hasStreamingSnapshot`，与实际 bootstrap message_start 使用同一非空谓词；false 允许后续真实事件，true 保护回放，缺字段保守。producer／ledger／public hook 各观察 RED→GREEN，最终相关组合123项通过；独立复查确认原序列修复。父级另外126项UI／ownership／CSS基线通过，项目完整类型和lint通过，lint保留TerminalPanel既有ARIA一条warning。这些分组不合并冒充完整npm test。

最终 `activity-step-motion/run-1792380217575/results.json` 七组实际检查通过：五工具同批入场和单次错开、图标／摘要真实中间opacity、group reopen／不变摘要delta／有快照bootstrap／answered key remount不重播、无快照重连后同一run的新步骤仍入场、隐藏／reduced首次消费、中途收起或改变偏好清理，以及outside focus／手动历史滚动不变。1300／430深浅四张截图已读取；它们只证明有限动效结束后静止与可读性，合成事件排列不用于最终答案布局或官方视觉一致性。初轮 `run-1792380155998` 只到Loading shell，无session fixture请求，保留failed；一次fresh retry通过，page／console／external errors为空，API／SSE均被生成夹具拦截，没有模型执行。

边界最终 `agent-output-boundaries/run-1792380213903/report.json` 十组实际检查通过48个终态步骤exact-once／静态、input／result／codemode三次精确复制（CRLF／Tab／尾空格／字面HTML）、空输出、MCP HTML不执行／不生成image请求、完整超长输出400px双轴滚动、超长工具名保原文并ellipsis、三类hover真命中、parallel＋queued＋partial各自结束和唯一真实持续动画、有快照重连静态，以及430px coarse-pointer三类44px button／native hit／tap。长名初版row right989／name1969.8为真实缺陷，最小改为min-width0／flex-shrink1／ellipsis；最终row／trigger／chevron right1335，name1294.297、metadata1319、chevron宽10，正文无横溢出。hover浅色rgb82、暗色rgb245，均匹配token与:hover实际命中。父级读取touch-details，六图由验收owner读取；无page／console／external错误，只有被fixture拦截的lease写入。初轮HMR／错误工具名partial fixture／离屏关闭按钮与冷hydrate失败保留，不当最终产品失败或丢弃记录；真实长耗时、复杂Markdown光标、原生剪贴板仍未据此通过。

原图额外复查位于本机 `activity-reference-evidence/raw-1792378495618/`：2136×845原件，整数crop／translation，参考100%底层、现状50%上层，无重采样。高置信差异是参考平铺活动行／共享分隔线和单个紧凑命令pill，现状仍有多层卡片及两条Copy栏。参考同图summary/body ink约1.05、tool/body约1.00，当前浅色二者约0.87；ink不是CSS字号，DPI未知，不据此直接放大。源库没有可直接替换的compact shell组件，后续用生成的相同工具／短结果形状收敛，不公开私人参考命令或文字。可选Todo扩展的既有ANSI文本consumer不等于原生结构化Plan/Todo，后者仍未完成。

## 紧凑命令与发送确认的限定适配（2026-10-19）

原图2136×845的命令详情先通过生成numstat形状复现JSON卡片差异：`activity-command-layout/run-1792380386297/` 为有效RED，已保存1300／430深浅baseline。`ToolCallBlock` 现仅对完整已结束、exact bash／powershell、唯一自有command字符串字段、无diff／图片／subagent等rich view的调用使用一条命令pill和普通结果。timeout／扩展字段、生成中参数、运行／部分结果、MCP和codemode保现有完整呈现；通用input复制合同不变，compact复制原始command／result，不trim或改CRLF。过程容器内去掉shell详情额外边框／背景，只给相邻compact行共享分隔，不声称所有活动扁平化。

首次GREEN `activity-command-layout/run-1792381266198/` 三组真实页面通过command／PowerShell／原文复制、CRLF／metacharacters／长行430px、额外参数回退、MCP／codemode、错误复制反馈和键盘／ARIA／inert／focus；四图与原像素overlay已读取，page／console／API writes／external为空。桌面详情高164.5→71.75 CSS px，pill33.75px、1px边框、8px圆角、6×10px padding；参考pill39原像素，DPI未知，不改字体追数字。结果保原文与复制但无第二卡片。补coarse Copy目标规则后，fresh最终 `activity-command-layout/run-1792381855078/` 三组再次通过，1300／430深浅四图和同版本reference overlay已读取，无page／console／API writes／external错误。该430px窗口本身为鼠标条件，真实coarse目标由独立手机检查证明，不能互相替代。

独立手机 `command-copy-failure/run-1792381251294/` 三组通过失败状态可读、exact原文、native hit／focus与重试，确认提示不裁切；同时测得Copy约43.6×19.75px，不满足44px触控目标，已加compact-only coarse规则；最终 `command-copy-failure/run-1792381849013/` 三组通过input／output Copy44×44 native hit、成功反馈64.17×44、提示与source保留、focus／重试／无overflow，两个截图已读取。原始失败尺寸保留，不把可点等同于触控尺寸通过。比较目录采用reference100%／actual50%、整数crop／translation，无重采样；命令路径的语法色、不同生成文本、字形／scale、其他generic／thinking层级仍有差异。

发送确认新增专用isSending，自optimistic submission起覆盖session／SSE准备和POST preflight ACK；ACK只代表接收，不结束整轮。更具体的思考／正文／工具／compaction活动优先；waiting_model或rpcPromptPendingRef不改名冒充Sending。代际／run／attempt隔离旧ACK和拒绝；Stop在POST前立即本地清忙碌／phase、移除optimistic bubble并恢复未发送内容一次，晚到的准备失败不再重复恢复；POST后已接收或结果不明的请求不重放，真实新会话ACK仍可正常promote。公开hook先后RED复现A→B→A迟到拒绝恢复旧草稿、取消前置准备后忙碌不清及迟到准备失败重复恢复，均最小修正；本轮hook／lifecycle／i18n97项通过（含10项发送案例）并经独立有界复查。实际 `sending-state/run-1792381844888/` 四组通过延迟POST确认、agent_start不冒充ACK、真实thinking优先、ACK后草稿／焦点和run保留、409恢复一次、Stop／晚ACK及A→B→A隔离；两图已读取，无page／external错误，console仅显式409和被处理的Generated admission rejection，不称全空。

预览30142在34分钟后以3221225477退出，实际caret／command运行只得到ERR_CONNECTION_REFUSED，均保留failed，根因未知，不能改称OOM或产品功能缺陷。通过preview_start重启为9c51ccac-c4aa-4617-a1f1-5df5e67231cc，没有next build或绕过拒绝的shell kill。后续有限验收应固定源码、fresh context并单独保留HMR污染记录。

## Markdown末尾光标位置补验（2026-10-19）

`streaming-caret-boundaries/run-1792381256609/` 实际截图确认列表／表格／fence／blockquote后的root pseudo落在额外空白行，段落／标题原实现正常；nested list／open fence初图被composer遮挡，原估算不单独当确认。修正复用现有react-markdown／rehype语法树，在raw／sanitize／KaTeX后追加可信呈现plugin，选择最后非空text的最近p／heading／li／cell／code容器并只加一个marker。MessageView仅传真实activeText，CodeBlock／Mermaid／Html source只转发optional呈现标志，source／copy不加字符；Artifact路由与preview／autostart策略保留。公式、terminal Artifact和超大SafeMarkdown raw fallback仍未验证。

公开实际MarkdownBody渲染八项先RED后GREEN；既有MessageView／markdown相关85项和父级117项UI／CSS基线分别通过，类型和完整lint退出0，保留TerminalPanel既有ARIA warning。最终 `streaming-caret-boundaries/run-1792381811843/results.json` 通过九种结尾、index0→1真实handoff、text_end先于message_end清光标、native opacity周期、reduced无running caret animation、supplemental DOMhidden、真实New／同会话返回，以及实际Stop／error立即清除。九图全部读取，父级复核list／table／fence末字同行；旧fence root间距约29.64px已消除，新的code marker与末字同y区间。动画查询用getAnimations({subtree:true})包含pseudo，旧普通getAnimations空结果不作为隐藏停止证据。无page／console／external错误，只有被fixture拦截的abort／lease，无模型或真实命令执行。

## 紧凑命令复用Prism语法色（2026-10-19）

`MessageView → CompactCommandText → 既有lib/syntax-highlighting PrismLight` 现在实际消费已注册bash／powershell grammar。adapter只在≤4096字符时输出span token，超过预算完整plain fallback；原pre／字体／wrap／命令pill和原文Copy不变，不新增lexer／依赖，也不增加open-claude-ui来源计数。字符串使用既有success绿色，其他token继承中性色／字形，未导入完整代码主题。

四项新公开renderer测试先RED后GREEN，相关MessageView合计52项；父级syntax／MessageView／ownership／CSS基线67项、完整类型和lint通过，保留TerminalPanel既有warning。最终 `activity-command-layout/run-1792382399196/` 四组实际页面通过quoted路径着色、字体／字重／斜体继承、单pre、Bash和PowerShell grammar、HTML字面文本、CRLF／Tab／尾空格／精确复制、4096以上完整plain fallback和原全部窄窗／错误／格式回退。1300／430深浅四图已读取；浅色string rgb36,138,61、其余rgb82，暗色string rgb48,209,88，字体仍12px Mono400 normal。page／console／API writes／external为空。原图quotedpath主体候选约rgb30,158,60，颜色仍有残差；DPI／生成文本不同，raw overlay只整数crop／translation，不称像素完全一致。

## 用户长消息的响应式展开（2026-10-19）

原实现只随文本变化测高；实际 `user-message-overflow/run-1792382339554/` 在同一 Markdown 节点／相同文本下，窗口 1500→430、自然内容 224→537px，却没有 Expand，构成有效 RED。署名 `useMeasuredOverflow → CollapsibleUserText` 现在局部消费 open-claude-ui `ChatMessageBubbles` 的测高／渐隐／展开机制，source 的 effect 没有响应式 observer；产品补 wrapper＋自然 Markdown ResizeObserver、rAF 合并、字体生命周期、隐藏无布局保原判定及卸载失效。手动 expanded 独立保留，原 220px＋60px slack、48px fade、外层 300px 滚动上限与复制原文不变，新增原生按钮 type／ARIA 关联。

公开 hook 六项及独立有界复查通过。实际 `run-1792382907493/` 五组通过同文本缩窄、手动展开／外层上限、往返保手动选择、拉宽去 mask／按钮、精确复制；窄窗 body 高220／natural537，拉宽恢复223.906px且不再裁切。三个截图已读取，正文中心无遮挡；API／SSE／clipboard 为生成夹具拦截，无模型执行。中间 `run-1792382743042/` 因侧栏离屏点击失败保留，不能当测量功能失败或被绿结果覆盖。最终 `run-1792383262052/` 十二组通过：真实字体设置在同宽 615.59px 下令自然高度 224↔282px、New 隐藏后改宽再返回同一 DOM、Enter／Space 焦点／ARIA、手动选择保留、精确复制和 native tap。触控前一轮 `run-1792383105530/` 49.39×21.05px 为真实目标尺寸 RED；新增按钮 class 和 coarse-only min44 后最终 49.39×44px，center hit 为真。展开后保留外层 300px 滚动，Collapse 通过原生滚动可见，没有自动抢滚动。七图已读取；desktop＋touch 的 page／console／external 均为空，仅拦截 lease。父级 117 项相关回归、最终 ownership／CSS 15 项、完整类型和 lint 通过，保留 TerminalPanel 既有一条 warning；不冒充完整 npm／terminal E2E。模块计数更新为 1 直接／12 局部／20 未确认，本项只计 ChatMessageBubbles 局部采用，不表示完整组件或 Windows 原生视觉通过。

## 上游更新规则

两个 fork main 的 GitHub Actions 定时同步仍保留；2026-10-18 Pi 遇到 GITHUB_TOKEN 工作流权限限制，已由本地授权同步。Codex「Pilaude 上游同步」每 6 小时运行工作区 sync.ps1（本机与 Codex 可用时），保留融合分支和未提交修改，只在失败时通知。开始工作及采纳资产前 fetch origin/upstream，确认作者侧落后提交数；融合分支保存当前改动后合并已同步的 Pi main，处理冲突、依赖和语义变化，运行相关验证。不能只刷新 remote ref 就说融合分支已更新。

`vendor/open-claude-ui` 是受控集成边界：参考 checkout 更新后，比较实际采用的 CSS/组件、记录新来源 SHA 和变更，再测试后接入；不能仅修改 README 的 SHA，也不能将整个库入口的 Electron 依赖带入 renderer。新资产没有通过运行验证时保持“已发现、未接入”，不能混作已完成。
