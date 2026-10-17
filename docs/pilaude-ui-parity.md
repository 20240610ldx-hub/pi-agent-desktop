# Pilaude 与 Claude Desktop 的逐组件复刻基准

审计日期：2026-10-17。用户明确要求每个组件实现后的视觉和交互与 Claude Desktop 一模一样；已选择 **Windows 当前稳定版**。本文件记录证据、缺口和验收方法，不声明已经复刻完成。

## 固定参考版本

| 项目 | 已核实证据 |
| --- | --- |
| 官方 Windows x64 稳定入口 | [MSIX latest](https://claude.ai/api/desktop/win32/x64/msix/latest/redirect)，2026-10-17 实际 GET 返回 307 |
| 官方入口的目标 | `https://downloads.claude.ai/releases/win32/x64/2.42304.0/Claude-e7f60e658f15cfece9efa384a78a39aec3c12845.msix` |
| 当前桌面参考版本 | `@ant/desktop 2.42304.0`；本机 MSIX `Claude_2.42304.0.0_x64__pzs8sxrjxfjjc`，与官方稳定入口一致 |
| 安装包清单 SHA-256 | `93417dbed430d92545db5c12cd0e16211c642388b8002b977e372ef76a86dd1b` |
| 已安装 app.asar SHA-256 | `8f4d3dec5e4f3ddffb150321060b18807d83a40f3a65618fe4f29325379da9db` |
| open-claude-ui 作者 main | `ddf3aea1711db62fd6d24343bbab500a5ae69f64` |
| 本地 UI fork main | `cfc0efedf53e5b9e49502d31b20991b55ee61574`；包含上述作者提交，作者侧落后数为 0 |
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
- 最新作者提交修正了 18 个代码/配置文件，包括完整灰阶、主品牌色与装饰 Clay 分离、按钮绘景层和弹性曲线、消息、思考、模型选择和授权卡片。Pilaude 原先接入的旧版主题不等于已经采用这些修正。

## 组件与资源覆盖清单

下表覆盖全部 33 个现有 TS/TSX 源模块及主要 Pilaude 页面。**所有组件的 Windows 2.42304.0 一致性均待实物对照**；“已接入”只描述代码采用，不表示视觉或交互通过。

| 目标组件 / 行为 | 可复用的 open-claude-ui 源模块 | Pilaude 状态与补证项 |
| --- | --- | --- |
| 主题、文字、图标 | `cds-theme.css`、`tailwind.config.js`、资产政策 | 已接入旧主题；需更新、核对 Windows 字体度量和图标轮廓，补齐授权素材 |
| 按钮及各尺寸/状态 | `CdsButton` | 欢迎页/导入动作已采用旧适配；新绘景层、hover/pressed/focus/loading/disabled 待接入和对照 |
| 分段选择 | `SegmentedControl` | 资源可用；实际 Pi 模式/设置状态需适配 |
| 运行、加载、骨架 | `StatusIndicators` | 资源可用；绑定真实运行状态并核对所有节奏 |
| 确认与权限对话框 | `ConfirmationDialog`、`McpToolDecisionCard` | 资源可用；后端审批、焦点陷阱、取消/错误状态待融合 |
| 附件卡与预览 | `AttachmentCard` | 资源可用；文件拖放、长文件名、上传失败、缩略图待对照 |
| 输入器及底栏 | `ChatComposer`、`RichComposerWithMentions`、`ChatComposerChin` | 保留 Pi 真实输入器，部分 IME/草稿测试已有；几何、排队、菜单、提及/命令状态待对照 |
| 消息、操作条、代码 | `ChatMessageBubbles`、`CodeBlock` | 已有 Pi 渲染器；新结构、排版、悬浮操作、复制/重试/编辑待融合 |
| 思考展开和氛围 | `ThinkingAccordion`、`ReasoningAmbientGlow` | 资源可用；绑定真实流式思考、减少动效与状态切换 |
| 模型选择、用量、推理强度 | `ModelSwitcherWithTokenGauge`、`ModelSelectorEffort` | 资源可用；使用真实 Pi 模型能力/未知值，不能移植演示额度 |
| 动效参数与级联 | `ClaudeMotionPresets`、`CdsMotionEngine` | 已采用弹簧预设；后者含示例展示，需提取行为并实测时间序列 |
| 滚动跟随和渐隐 | `useClaudeScrollPinning`、`ScrollFadeContainer` | 已适配 150ms 输入锁；新滚动渐隐与恢复位置待逐状态对照 |
| 声音与麦克风 | `ClaudeAudioPlayer`、`LiveMicActivityBars` | 仅有合成方案；不等于原版声音；实际支持能力和许可仍需核实 |
| 图片灯箱和共享转场 | `MediaLightboxViewer`、`useClaudeSharedElementTransition` | 资源可用；缩放、拖拽、键盘、关闭恢复焦点待融合 |
| 产物分屏与桥接 | `ArtifactsSplitPaneResizer`、`EpitaxyIframeBridge` | 资源可用；保留 Pi 产物真实内容、安全边界与保存流程 |
| Diff | `StreamingDiffViewer` | 资源可用；Pi 文件/Diff 渲染、长内容、流式增量待融合 |
| Windows 窗口与顶栏 | `createClaudeMainWindow`、`ClaudeDesktopHeader` | 主要是 Electron/macOS 参考；Tauri Windows 实物行为与精确几何待补 |
| 侧栏、项目/会话拖放 | `DraggableSessionList` | 资源可用；完整 Windows 导航、搜索、收起/展开/右键状态未覆盖 |
| 多代理任务视图 | `CoworkAgentCanvas` | 含演示状态；需接真实 Pi 父子任务、队列、审批、取消和失败状态 |
| 窄容器与键盘焦点 | `ContainerResponsiveBar`、`useClaudeRovingFocus` | 资源可用；系统 DPI 与 WebView2、实际焦点顺序待验证 |
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

`scripts/compare-ui-reference.py` 生成 50% 叠图、4 倍增强差分、红色参考/蓝色实现的边界图，以及 x/y/width/height 偏差 JSON。参数包括参考裁剪、DOM 几何输出和参考矩形表，不会自动拉伸图像。依赖 Pillow，仅用于本地验收。运行示例（所有图片/测量数据均为本地文件）：

```powershell
python scripts/compare-ui-reference.py reference.png actual.png --crop 12 23 1892 1278 --geometry actual.json --measurements reference-boxes.json --output comparison
```

本轮已经实际采用最新作者提交 `ddf3aea1711db62fd6d24343bbab500a5ae69f64` 的 theme、Button 和 motion presets。主框架、搜索、输入器和上下文卡片按参考几何调整；正文默认 16px，保留用户字号/宽度设置。第一轮实测输入器从 90 物理像素高修至 67.5（参考约 68），侧栏宽度仍差约 2；坐标微调与最终复测尚在进行，不能据此标记逐组件通过。

视觉与运行语义分别验收：会话/新建草稿/计划任务导航历史、输入法与多行增高、150ms 用户滚动意图锁、长会话锚点、流式输出、停止与恢复、窄窗口焦点循环/Escape/焦点返回、真实文件/工具/连接器入口、提供商错误持久化与设置入口。调度/工具/API 数据必须来自 Pi；累计输入/输出 token 不能伪装成 Claude 当前上下文的精确分类。Claude 专属的 Remote Control、订阅限额、PR 信息没有对应实现时保留为功能差异，不填假值。

本机 Tauri Windows 开发窗口已编译启动；开发服务器冷编译曾造成 10 秒会话加载超时，单独记录，后续加载/恢复验证不能用放宽产品超时来掩盖。付费模型仍只允许 deepseek-flash；这一轮使用本地提供商夹具经过实际 SDK/事件流，零模型费用。

产品名 Pilaude、自有图标/版本、自带模型、项目与权限数据按用户确认的产品要求替换；这不授权其他任意视觉改动。Pi 独有场景沿用已核实的 Claude 控件与操作模式，并单独记录参考来源；没有对应屏幕时不能宣称整屏像素一致。字体、素材许可或可访问性与参考出现冲突时保留为明确未解决项，不擅自宣称“已完全一致”。

## 当前重新验收清单

- 用户原图共 10 张已逐字节归档并核验 SHA-256，本机路径为 `D:\pilaude\references\claude-desktop\windows-2.42304.0\2026-10-17`。`README.md`、`manifest.json` 索引尺寸和状态。原始 PNG 不随公开代码或安装包发布；派生裁剪与叠图不覆盖原件。
- 新增参考显示：Context 可与 Browser/Git dock 同时存在，也可在 Files 左侧浮出；Background tasks 和 Terminal 可垂直共存。当前“文件面板打开便隐藏 Context”的临时实现不满足该参考，须改为明确的面板/浮层布局状态后复测。
- 新增回复局部图明确区分 rest 与 hover，操作栏在 rest 隐藏；现已改为静止隐藏、hover/focus 显示、触屏可达和相对时间；回答分叉接入真实 Pi。复制/分叉截图及实际交互仍须逐状态对照，Pin/朗读尚未实现，不能以可点击作为复刻通过。

- 原 Task 2 的四档截图、输入/面板测试仅证明相应功能可操作，缺少同版本 Claude 参考图和差异图，状态改为“功能已测、一致性未验”。
- 欢迎页为 Pilaude 原先自建构图，尚未证明符合 Claude 当前首页；系统字体、Lucide 图标和深色文字的旧 Clay 按钮均待重新对照。
- MCP Sign in 的实际小号主按钮对比度测得 3.12:1；这是现有样式问题，尚未证明参考也如此。OAuth 加密端到端通过不能作为视觉通过；等待参考裁决并修正。
- 下一步优先补齐 Windows 主窗口/侧栏、输入器、消息、按钮、设置和模型选择的基准，再扩展到授权卡片、产物、浏览器、代理和计划任务。每个组件均按上述流程验收后更新记录。

## 上游更新规则

两个 fork main 的 GitHub Actions 定时同步仍保留；2026-10-18 Pi 遇到 GITHUB_TOKEN 工作流权限限制，已由本地授权同步。Codex「Pilaude 上游同步」每 6 小时运行工作区 sync.ps1（本机与 Codex 可用时），保留融合分支和未提交修改，只在失败时通知。开始工作及采纳资产前 fetch origin/upstream，确认作者侧落后提交数；融合分支保存当前改动后合并已同步的 Pi main，处理冲突、依赖和语义变化，运行相关验证。不能只刷新 remote ref 就说融合分支已更新。

`vendor/open-claude-ui` 是受控集成边界：参考 checkout 更新后，比较实际采用的 CSS/组件、记录新来源 SHA 和变更，再测试后接入；不能仅修改 README 的 SHA，也不能将整个库入口的 Electron 依赖带入 renderer。新资产没有通过运行验证时保持“已发现、未接入”，不能混作已完成。
