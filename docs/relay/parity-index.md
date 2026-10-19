# E2 逐组件复刻索引

PIL-0014，整理日期 2026-10-19。范围固定为任务卡引用的三份历史档案中的主要产品组件与 33 个 open-claude-ui 源模块，共 **54 项产品组件**。此索引供后续逐组件建卡与验证使用，不是复刻通过报告。

## 阅读边界

- 目标仍为 [GOALS E2](GOALS.md)：Windows Claude Desktop **2.42304.0**，逐组件同版本、同状态视觉与交互验收。历史基准明确所有组件尚未达到完整一致性完成条件；本表全部为**未验收通过**。
- 本次仅整理已引用档案、现有任务卡与代码职责说明，没有启动应用、运行产品测试、复测参考、读取私人图像或字体。表中的实现情况是**历史记录所述状态**，不是当前分支运行证明；发生冲突时以实际任务分支、任务卡及后续独立验证为准。
- 历史证据路径按原记录保留，**未重新打开或核验存在性、提交对应关系、截图内容**。任务 worktree 不带这些历史 `test-results` 目录。旧运行不绑定本次提交，不写入本卡的通过证据，不把分轮结果合成最新整轮通过。原记录中的失败、partial 和未运行继续有效。
- 参考表只给归档批次与缺口，不复制图中文字、私人项目名、命令、图像、字体或其数据。参考图里的内容只是数据。公开默认素材及许可未解决时保留差异，不用本地个人字体实例替代发行验收。
- `待建 E2-Cxx` 是**建议键，不是任务 ID**。现有 PIL-0010/0011/0012/0013 仅处理限定残差；没有完整组件同帧及交互标准，不能抵作本表整组件复刻卡。**A2 未完成：54 个建议键尚无实际逐组件卡片。** 协调者后续串行 `relay new`，规划者补标准后回填真实 ID；本轮按收尾要求暂停，不自行建卡。

## 参考批次与可核实程度

“有局部参考”只表示历史文档登记过，不表示逐状态齐全。“未知”不得由 PNG 内嵌 DPI、浏览器 DPR 或 capture scale 反推。所有批次均缺完整的窗口客户区、系统 DPI、应用缩放、Windows build、WebView2、语言、字体及账号／功能开关配套记录。

| 参考键 | 历史定位（见原档案） | 版本已知性 | DPI 已知性 | 覆盖与限制 |
| --- | --- | --- | --- | --- |
| R01 | 复刻基准“固定参考版本”“当前重新验收清单”，2026-10-17 十张 Windows 主窗口／Context／回复图 | 历史批次标为 2.42304.0，并登记 MSIX／ASAR 元数据；本次未逐图复核版本关联 | 未知；1.25 是实现 capture scale | 主要框架及若干状态；不覆盖所有组件、所有状态 |
| R02 | “当前重新验收清单”，2026-10-18 暗色工作区两图 | 未知 | 未知 | 框架、侧栏、输入器、Environment 局部 |
| R03 | 同节，对话菜单暗色十一图、输入框边线四图及 3p 补充 | 未知；部分 3p 明确较旧，不与 R01 混作同版本 | 未知 | 菜单／子菜单／重命名、附件／运行输入框；紧凑高度、细线、小圆角按用户明确选择 |
| R04 | 同节，终端暗色九图 | 未知 | 未知 | 标题栏、标签、偏好、独立窗口等；无浅色实物参考 |
| R05 | 同节，右侧多 pane 原图与工具栏图 | 未知 | 未知 | 两 pane 一列、第三 pane 开列；另有未定位的 3p 整屏，不用 actual 冒充 reference |
| R06 | “本轮会话、首页、图片与 Changes 证据”“用户补充 Changes 展开态” | 未知；展开图宿主身份亦未核验 | 未知 | Changes 十二状态中十一源文件，inline-comment 原件待补；另有展开态及图标／浮签局部 |
| R07 | “本轮会话、首页、图片与 Changes 证据”，上传图片暗色批次 | 未知 | 未知 | 十二图片布局；原始内容比例／crop／绝对 bbox 未核实 |
| R08 | “首页静置／点击两态重新实现” | 未知 | 未知 | 静置／点击静图已登记；时序、字体、完整构图未确定，早期 pending 原图不算已找全 |
| R09 | “左上导航轨与内容搜索”，2026-10-18／19 导航批次 | 未知 | 未知 | 轨道、展开目录；参考裁剪原点不明，不能由旧用户消息目录外推章节语义 |
| R10 | “活动摘要与单处微光”“紧凑命令…”；输出清单“证据登记”，2026-10-19 活动／Sending／hover 图 | 未知 | 未知；原像素与显示预览分开 | 摘要／步骤／命令详情／Sending 的局部静态状态；静图不证明动效周期或全部思考状态 |
| R00 | 三份档案未登记可用于该组件的专门 Windows 同状态参考 | 未知 | 未知 | 缺参考；源库示例、macOS 取证、Storybook 或 actual 都不能补作官方 Windows 原图 |

源库固定作者 SHA 为 `638800b8a4cee4513c8763c3df0ecf8a77b32379`，历史参考 checkout 为 `7490e105e418adf2b94c55ff716bb0973d44fb85`；其取证是 **macOS 2.37337.1**，不是本项目 Windows 版本证明。主题导入、vendor 存在、算法局部 consumer、整个源组件采用、产品功能及 Windows 复刻验收分别记账。

## 组件清单

每行的参考结论均为“不齐全”，版本与 DPI 具体按 R 键查上表。H 键定位下节的历史证据，`H00` 表示引用档案未提供该组件专门运行位置。当前实现列不等于当前运行结果。“关联”只表示已有工作，后续卡须明确依赖／避免重叠。

| 组件键 | 组件／状态面 | 参考覆盖（版本／DPI 见 R 表） | 历史记录所述实现状态 | 已有证据位置键 | 已知残差或未验部分 | 完整 E2 任务卡／关联 |
| --- | --- | --- | --- | --- | --- | --- |
| C01 | 主题、文字与图标 | 不齐：R01/R02，字形状态缺 | 主题全局导入；个人字体仅本地对照实例 | H01/H24 | 公开默认字形／中文回退、图标轮廓、原生度量；生成文本诊断不抵消旧 ink 残差 | 待建 E2-C01 |
| C02 | 按钮尺寸与交互状态 | 不齐：R00 | CdsButton 仅数据预览／导入直接消费 | H00；采用账本“目前的直接消费链” | default／hover／pressed／focus／disabled／loading 的同帧参考及实际量测 | 待建 E2-C02 |
| C03 | 分段选择控件 | 不齐：R00 | SegmentedControl 未采用，现有设置／工具独立实现 | H00 | 无真实源 consumer；键盘、空值、指示器与多实例状态待验 | 待建 E2-C03 |
| C04 | 运行、加载与骨架指示 | 不齐：R01/R10 仅局部状态 | StatusIndicators 模块未采用；产品有真实状态点 | H02/H12 | 缺全状态形状／时序；不把主题 keyframes 算模块采用 | 待建 E2-C04 |
| C05 | 确认与扩展对话框 | 不齐：R00 | 独立对话框；合成 IME 按键归属已有记录 | H10 | Windows IME、焦点进入／循环／恢复、取消／错误几何未齐；来源示例不自带完整 focus trap | 待建 E2-C05 |
| C06 | 工具权限决定卡 | 不齐：R00 | McpToolDecisionCard 未采用；真实阻塞 UI 独立 | H00 | pending／拒绝／取消／失败与统一 gate 真值；演示 timer 不能作成功 | 待建 E2-C06；关联 PIL-0030 |
| C07 | 文件附件卡与普通文件标签 | 不齐：R03 局部；长文件名专图缺 | AttachmentCard 仅后缀分离／双 span 接 TabBar；tile／chip 未采用 | H07 | 官方长名／窄标签图、附件全部状态缺；Terminal／Artifact 标签不在该适配内 | 待建 E2-C07 |
| C08 | 输入器主框与提交控件 | 不齐：R01/R03，焦点状态未独立确认 | Pi 输入器、紧凑 48px／14.4px 圆角、中性边线；单次提交锁 | H03/H24 | 字体 ink 宽／高、回车图标和边线抗锯齿仍不同；Windows 原生 IME 未验 | 待建 E2-C08 |
| C09 | 输入底栏、排队与忙碌操作 | 不齐：R03 | ChatComposerChin 未采用；真实 queuedMessages／Steer／Follow-up／Stop | H03/H13 | 更短窄窗组合、拒绝／不明结果、队列全状态及同帧基线缺 | 待建 E2-C09 |
| C10 | 提及、路径与斜杠建议 | 不齐：R00 | RichComposerWithMentions 未采用；Pi @／#／slash 独立实现 | H03（仅邻接提交） | 建议列表全部状态、路径边界、IME／229、焦点与滚动专项未齐 | 待建 E2-C10 |
| C11 | 用户长消息气泡与展开 | 不齐：R01 局部 | ChatMessageBubbles 仅测溢出／fade／展开机制局部适配 | H22 | 完整气泡样式、编辑、真实字体／DPI；浏览器响应式记录不作 Windows 视觉通过 | 待建 E2-C11 |
| C12 | 助手正文与消息操作条 | 不齐：R01 回复 rest／hover | rest 隐藏、hover／focus 与触屏入口；复制／分叉有历史功能记录 | H01 | Pin／朗读缺失；字体／图标不同，完整编辑／操作状态未齐 | 待建 E2-C12 |
| C13 | 代码块、Mermaid source 与复制反馈 | 不齐：R00 | Prism 保留；CodeBlock 仅 2.5s 复制反馈局部适配 | H11 | 官方逐状态参考、Windows 原生剪贴板、失败／pending／重复反馈与字形完整对照缺 | 待建 E2-C13 |
| C14 | 思考摘要与展开正文 | 不齐：R10 仅局部活动图；专门逐状态图缺 | ThinkingAccordion 仅 Grid；真实 indexed 活动及 deferred fetch／cache／retry | H09/H12/H15 | 全键盘／原生 IME、对应 Windows 状态、字体与层级残差；不能沿用早期“无 indexed 活动”描述 | 待建 E2-C14 |
| C15 | 执行记录组与摘要 | 不齐：R10 | 真值驱动组、独立折叠／首次错误展开、最终答案组外 | H12/H15/H17 | 真实长耗时／慢连接、摘要比例／字形、完整扁平层级仍未验 | 待建 E2-C15 |
| C16 | 工具步骤、参数结果与紧凑命令 | 不齐：R10 | 已结束且仅 command 的 shell 紧凑呈现；其他 rich views 保完整，Prism 字符串色与整宽分隔 | H17/H18/H21 | 参考 pill 39 原像素对当前 33.75 CSS px 条件不同；语法绿色、宽度／文本／DPI及其他行层级差异 | 待建 E2-C16 |
| C17 | 流式正文／公式／Artifact 光标 | 不齐：R10 不能覆盖各结尾 | HAST marker；simple display 与 mounted card 有限定记录 | H19/H20 | tag／fleqn／leqno、多行／wide／katex-error／raw 与 inline 切换未齐；特殊布局只保护不等于 caret 支持 | 待建 E2-C17；关联 PIL-0012 |
| C18 | 单处微光、新步骤及有限状态动效 | 不齐：R10 静图；动态原参考缺 | ShimmerText 局部适配 1.8s；步骤180ms／6px／40ms，图标160ms／摘要150ms | H12/H17 | 这些时长是实现选择；官方动态时间序列及 Windows 渲染未验；CdsMotionEngine 未采用 | 待建 E2-C18 |
| C19 | 模型切换菜单 | 不齐：R03 仅局部；完整模型状态缺 | ModelSwitcherWithTokenGauge 未采用；Pi 模型选择独立实现 | H00 | 能力／未知值／长名／错误菜单、同帧字号与对齐；不使用示例固定模型／窗口值 | 待建 E2-C19 |
| C20 | 推理强度选择 | 不齐：R00 | ModelSelectorEffort 未采用；按 Pi availableThinkingLevels 过滤 | H00 | 不同能力和未知档、推荐状态及键盘／IME／菜单全态缺 | 待建 E2-C20 |
| C21 | 当前上下文圆环与用量浮层 | 不齐：R01 局部，数值状态缺 | 消费 SDK 当前 context percent；无效值保未知 | H08 | NaN／Infinity 仅 SSR；不能用累计账单反推占比，Windows 逐态参考缺 | 待建 E2-C21 |
| C22 | DOM 菜单进入与弹簧曲线 | 不齐：R03 静图，原时序缺 | ClaudeMotionPresets 求解器／SNAPPY 仅 opacity consumer | H05 | 不包含空间回弹、退出与其他 variants；Windows 时间序列／reduced-motion 对照缺 | 待建 E2-C22 |
| C23 | 长会话滚动跟随与历史恢复 | 不齐：R00 | useClaudeScrollPinning 仅150ms意图锁；保 Pi 分页／锚点 | H01/H13 | 原生滚动、长耗时／重连、历史定位全矩阵；其他源阈值不算采用 | 待建 E2-C23 |
| C24 | 列表边缘渐隐 | 不齐：R06 局部 | ScrollFadeContainer 仅 Changes 2px 边缘判定／16px fade | H04/H06 | 动态内容边界、RTL、双轴与精确 alpha 未验／未采用 | 待建 E2-C24 |
| C25 | 完成音与音频设置 | 不齐：R00；声音参考缺 | ClaudeAudioPlayer 未采用；产品独立合成双音 | H00 | 官方声效／许可、设备切换、用户激活、隐藏／退出清理缺 | 待建 E2-C25 |
| C26 | 麦克风活动条 | 不齐：R00 | LiveMicActivityBars 未采用，无真实语音输入 consumer | H00 | 需先有真实音频链，再核采样率、频段、噪声门／reduced-motion；无功能通过声明 | 待建 E2-C26 |
| C27 | 多图片缩略图与上传排列 | 不齐：R03/R07 | 自然尺寸／contain 局部消费；透明画布、7.2 CSS px gap | H04 | payload 比例／crop／letterbox／绝对 bbox 与 DPI 不明；生成 PNG 不替代私人原文 | 待建 E2-C27 |
| C28 | 图片灯箱、缩放与共享转场 | 不齐：R00；R07 不能作灯箱图 | MediaLightboxViewer zoom／pan／wheel 局部适配，native dialog portal | H05 | shared-element hook 未采用；慢 src 切换、双指、媒体导航及官方同态图缺 | 待建 E2-C28 |
| C29 | Artifact 卡片、预览与 iframe 桥接 | 不齐：R00 | 产品真实 Artifact／安全边界；EpitaxyIframeBridge 未采用 | H20 | 完整 inline 完成切换、保存／失败／版本及 Windows 参考缺；卡片活动不等于整预览验收 | 待建 E2-C29 |
| C30 | 产物分屏、多 pane 布局与拖动分隔 | 不齐：R05 | 多列 dock、稳定 hosts、双轴调整／布局保存；源 resizer 未采用 | H01（分区记录线索） | 3p 整屏待定位，拖动／缩放／焦点／DPI 同帧全矩阵；不借源注释宣称死区／spring | 待建 E2-C30 |
| C31 | Changes／diff／反馈编辑器 | 不齐：R06，inline 原件缺 | react-diff-view@3.3.3 真实 consumer；源 StreamingDiffViewer 仅局部呈现借鉴 | H06/H14 | echo 换行、滚动条带、外卡／字形、真实窗口 ACK 与整轮回归；合成 ACK 不是真实 ChatWindow | 待建 E2-C31；关联 PIL-0010、PIL-0013 |
| C32 | Windows 窗口、顶栏与独立会话窗口 | 不齐：R01/R02/R03，原生状态缺 | Tauri；会话新窗／VS Code 有 Rust／mock IPC 合同；源 Electron／macOS 未采用 | H14/H16 | 真实 OS 开关／移动／贴靠／DPI、Code.exe 启动与窗口状态未验 | 待建 E2-C32；关联 PIL-0010、PIL-0111 |
| C33 | 侧栏项目／会话、搜索、状态及重排 | 不齐：R01/R02/R09 | 固定根会话键盘相邻重排局部适配；真实 metadata／全文搜索 | H02/H11/H13 | 指针拖放未采用；名称／浮签字形与边界残差、原生快捷键及全状态缺 | 待建 E2-C33 |
| C34 | 模型章节导航轨与目录 | 不齐：R09 | 只消费 mark_chapter 持久记录；256px目录，正文／输入器共享中轴 | H13 | 旧用户消息分片语义已撤回；刻度／文字残差、更窄 clamp 与 Windows 同态未验 | 待建 E2-C34 |
| C35 | 多代理任务面板与真实任务状态 | 不齐：R05，完整任务卡缺 | AgentSessionPanel 接 Pi family；CoworkAgentCanvas 未采用 | H15 | 完整队列／审批／取消／失败原生端到端；不冒充结构化 Plan/Todo | 待建 E2-C35；关联 PIL-0050、PIL-0074 |
| C36 | 窄容器工具栏与 roving 焦点 | 不齐：R05/R06 局部 | Changes rove 局部适配；FileViewer 容器布局独立，ContainerResponsiveBar 未采用 | H06/H23 | 系统 DPI／WebView2、动态焦点／RTL与完整工具栏参考；不外推到其他菜单 | 待建 E2-C36 |
| C37 | 限流、重试与错误提示 | 不齐：R00 | useRateLimitBackoff 未采用；SDK retryInfo／session automation 独立 | H00 | 真实429／503／取消／未知结果状态及倒计时参考；不重放已接受请求或外部操作 | 待建 E2-C37 |
| C38 | New 首页与固定字符光照 | 不齐：R08 静态两态 | New 真实 home 导航；历史实现是固定格点不规则照明与单击单波 | H09（首页） | 构图／亮度／时序未齐；原始动态未知，最新蓝色慢扫／固定字符要求仍需独立对照 | 待建 E2-C38 |
| C39 | FileViewer、Source／Preview／Diff 与下载 | 不齐：R05 仅不同内容局部 | 窄pane布局／原文／sandbox已有分组记录；下载聚合失败 | H23 | 下载取消根因及字节未证；最终焦点子项已有记录但不覆盖整轮失败，视觉比例不同 | 待建 E2-C39；关联 PIL-0011 |
| C40 | Context／Environment／Connectors 卡片 | 不齐：R01/R02，部分旧3p补充 | 共存／浮层让位、焦点与输入器边界有功能记录 | H01 | Environment 缺 Remote Control 矮约26px；内容／字形不同，Pi 无对应能力不填假值 | 待建 E2-C40 |
| C41 | 标题菜单、Transcript modes 与输出风格 | 不齐：R03；风格编辑器专图缺 | 主／子菜单真实动作；会话隔离模式／风格 consumer，原生目标仅合同层 | H16 | chevron／glyph重影、窗口及Code实物、编辑器同态；旧“不可用”描述仅前轮状态 | 待建 E2-C41 |
| C42 | Terminal 标签、工具栏与偏好 | 不齐：R04，浅色缺 | xterm偏好与共享SSE／PTY历史功能记录；原生弹出未完成记录 | H01（终端） | 完整脚本未跑完；独立窗创建／控制权／关闭交接、几何后续回归及原生DPI | 待建 E2-C42 |
| C43 | General 设置与共享设置控件 | 不齐：R00 | SettingsPanel／SettingsUi 实际壳层；desktop controls在General | H00 | 各 tab／长路径／scope／busy／错误、深浅／语言与焦点全态参考缺 | 待建 E2-C43 |
| C44 | 模型配置与提供商凭据界面 | 不齐：R00 | ModelsConfig、EnabledModels 与真实 Pi 配置／凭据独立实现 | H00 | 启停／未知／错误／重试／脱敏参考、完整键盘及原生度量未齐 | 待建 E2-C44；关联 PIL-0020 |
| C45 | MCP 配置、信任与登录 | 不齐：R00 | 既有配置／信任／登录流程；不能以加密功能结果代视觉 | H01（旧问题登记） | Sign in 小按钮历史对比度3.12:1；等待同态参考裁决，全部子流程参考缺 | 待建 E2-C45 |
| C46 | Skills 列表、搜索与安装 | 不齐：R00 | 真实 DefaultResourceLoader／npx安装及共享设置块 | H00 | 空／加载／拒绝／部分结果／长路径／scope、键盘焦点与Windows参考缺 | 待建 E2-C46 |
| C47 | Plugins／扩展目录与安装控制 | 不齐：R00 | 真实 DefaultPackageManager；目录限定页面已有记录 | H25 | 目录可见不等于全GUI／网络／卸载回退；同态Windows参考缺 | 待建 E2-C47；关联 PIL-0076 |
| C48 | 子代理配置与 profile 编辑器 | 不齐：R00 | AgentsConfig 与真实 profile 路径；不由 Cowork demo代替 | H00 | 创建／编辑／禁用／错误、作用域与焦点、官方对应控件或Pi独有映射待定 | 待建 E2-C48；关联 PIL-0050 |
| C49 | 定时任务列表、编辑器与历史 | 不齐：R00 | 既有 scheduled 页面／scheduler；执行能力另由E7处理 | H00 | 调度／权限真值与显示分层；逐屏空／错误／长内容／时区状态参考缺 | 待建 E2-C49；关联 PIL-0060 |
| C50 | 数据预览、导入与恢复界面 | 不齐：R00 | PilaudeDataSection 是 CdsButton 真实 consumer；功能另由E3/E9处理 | H00 | 预览／确认／进度／失败／取消同态、焦点与原生文件路径；无整屏官方参考 | 待建 E2-C50；关联 PIL-0020、PIL-0090 |
| C51 | 受控 Browser pane 与控制条 | 不齐：R00；R01仅共存关系 | 历史未实现受控 Browser；不能以iframe／研究说明替代 | H00 | 导航／阅读／点击／输入／下载／取消／接管参考与执行consumer均待完成 | 待建 E2-C51；关联 PIL-0040 |
| C52 | 托盘、系统通知与关窗状态 | 不齐：R00 | Tauri系统能力保留；生命周期独立验收任务 | H00 | 菜单、焦点／隐藏／退出及通知全状态原生参考缺 | 待建 E2-C52；关联 PIL-0090、PIL-0111 |
| C53 | 原生文件选择、保存与路径入口 | 不齐：R00 | desktop-native 系统对话框路径；不用网页伪造OS结果 | H00 | Windows picker／取消／失败／越界、焦点恢复与DPI；源码职责不证明实物通过 | 待建 E2-C53；关联 PIL-0011、PIL-0111 |
| C54 | 安装、更新与版本提示界面 | 不齐：R00 | AppUpdatesSection／DesktopAppSection；保持更新busy不可关闭 | H00 | 安装／升级／失败／重新启动真实产物和系统参考缺；签名材料由独立任务决定 | 待建 E2-C54；关联 PIL-0003、PIL-0110、PIL-0112 |

## 历史证据定位

以下路径均相对历史执行 checkout，通常登记在本机 `test-results/pilaude/` 下；**不是本任务新证据目录**。不补造缺少的提交 SHA 或验证者。本次未读取这些报告，精确运行上下文、失败记录、对应源码及实际读取截图范围应回到引用段落核对。`H00` 的缺口不能由邻接组件的通过填补。

| 键 | 档案来源与原有位置／检索线索 | 已知证据层级和限制 |
| --- | --- | --- |
| H00 | 三份引用档案没有该组件专门运行位置 | 未登记；不得写成通过 |
| H01 | [复刻基准](../pilaude-ui-parity.md)“用户实物截图与测量迭代”“当前重新验收清单”；`ui-reference/`、`dark-calibration/`、`context-floating/`；终端／分区只保留该节线索 | 历史浏览器／本地字体实例／局部原像素；终端完整脚本未完成，分区详录未在本次展开 |
| H02 | 同档“本轮会话、首页、图片与 Changes 证据”；`session-actions/run-1792313864403/`、`navigation-reference/comparison-final/` | 合成状态与浏览器；侧栏墨迹／浮签残差保留 |
| H03 | 同档“当前重新验收清单”；`composer-calibration/3p-typed-user-priority/`及该节提交／IME／附件记录 | 浏览器合成IME／布局／局部原像素，不是Windows IME |
| H04 | 同档“本轮…证据”；`image-wrap-reference/run-1792316235152/`、`run-1792315159076/`、`comparison-aftercanvas/` | 生成PNG／浏览器；旧灰底图不作最终外观；比例／bbox未齐 |
| H05 | 同档“后续 TDD 实际检查”“YAML 同文原像素与图片 DOM 补验”；`cds-motion/run-1792318823633/`、`image-preview-zoom/run-1792322241886/` | 菜单曲线／图片dialog浏览器功能；早轮仅捕pageerror，后轮才含console |
| H06 | 同档“成熟 diff 渲染库迁移验收”；`diff-library/run-1792339340071/`、`changes-reference/syntax-keyboard-1792338708381/`、`library-yaml-visual-1792337932938/`、`library-yaml-workspace-1792338305434/` | 生成夹具／真实只读Git／合成ACK分开；原像素局部，完整视觉未过 |
| H07 | 同档“普通文件标签后缀保留专项”；`file-tab-filename/run-1792321054232/` | 显式Files GET夹具／浏览器；官方长文件名参考缺 |
| H08 | 同档“上下文圆环数值专项”；`context-usage-ring/run-1792321449859/` | SSR与浏览器不同覆盖；NaN／Infinity不在JSON页面层 |
| H09 | 同档“ThinkingAccordion 受控呈现适配”“首页静置／点击两态重新实现”；`thinking-disclosure/run-1792341152373/`；首页 `new-welcome/run-1792330694586/`、`ripple-motion/single-double-1792336146500/`与`single-double-1792336369255/` | 思考限定Grid；首页单击分组与整轮failed分开，后续双击补验不覆盖旧失败 |
| H10 | 同档“扩展对话框输入法按键归属”；`extension-ime-20261019-002103-852/run.json` | 六个合成队列请求，不是Windows原生IME／真实扩展 |
| H11 | 同档“代码块复制生命周期”“固定会话顺序与键盘重排”；`code-copy/run-1792373651369/`、`sidebar-pin-order/run-1792373545120/` | 浏览器复制／固定根键盘重排；不作原生剪贴板／指针拖放 |
| H12 | 同档“活动摘要与单处微光”；`activity-disclosure/run-1792375885811/`、`activity-disclosure/mobile-supplement-1792376302856/` | 真实呈现、生成事件；初轮430图遮挡，仅补拍可读性；后续Grid状态见H15 |
| H13 | 同档“左上导航轨与内容搜索”；`conversation-navigator-layout/run-1792384522954/`、`run-1792384456445/`、`run-1792385297398/results.json`、`comparison-1792374705856/`、`sidebar-content-search/run-1792375755599/` | 模型章节语义与旧用户消息目录分开；极短busy仅canonical组合，Windows未验 |
| H14 | 同档“Windows Changes 原生边界补验”；历史 `test-results/changes-window-native-20261019-retry.log`、`test-results/changes-window-contracts-20261019.log` | Rust定向／IPC合同；未启动应用，不证明原生开窗／DPI |
| H15 | 同档“共享折叠高度、真实任务与菜单能力补齐”；`disclosure-motion/run-1792378208269/`、`run-1792378495618/`、`task-activity/run-1792377606134/` | 浏览器三类Grid／Tasks家族；不作结构化Plan/Todo或完整E6 |
| H16 | 同档“会话标题下拉菜单”“共享折叠…”“Transcript modes…”；`title-conversation-menu/run-1792378173460/`、`output-style-menu/run-1792378489375/`、`native-conversation-destinations/run-1792378155118/`、`transcript-view/run-1792378478848/` | 实际DOM／API夹具、SDK-faux和mock IPC；风格故意503与原生未验保留 |
| H17 | 同档“有限步骤入场与快照来源”；`activity-step-motion/run-1792380217575/results.json`、`agent-output-boundaries/run-1792380213903/report.json` | 生成事件／native compositor frames／触控；不作真实长耗时或Windows帧 |
| H18 | 同档“紧凑命令与发送确认…”；`activity-command-layout/run-1792381855078/`、`command-copy-failure/run-1792381849013/`、`sending-state/run-1792381844888/` | 原文复制／触控与发送ACK夹具；ACK不代表整轮完成，故意409保留 |
| H19 | 同档“Markdown末尾光标位置补验”“Simple display公式…”；`streaming-caret-boundaries/run-1792381811843/results.json`、`run-1792387339326/results.json` | 九种末尾／simple display限定范围；tag只保护布局，不支持所有特殊caret |
| H20 | 同档“Artifact实际卡片…”；`streaming-caret-boundaries/run-1792385745393/results.json`、`run-1792386132187/results.json` | mounted card两组；后轮加强hint报告已读但新四图未重读；无opener仅SSR |
| H21 | 同档“紧凑命令复用Prism语法色”“相邻紧凑命令整宽分隔线”；`activity-command-layout/run-1792382399196/`、`run-1792385059051/report.json` | 原文／Prism预算与divider paint限定检查；不扩展为所有行扁平化 |
| H22 | 同档“用户长消息的响应式展开”；`user-message-overflow/run-1792383262052/` | 浏览器同节点／字体设置／触控；局部算法，不是完整消息视觉 |
| H23 | 同档“FileViewer窄pane与生成字体诊断的限定结果”；`file-toolbar-layout/run-1792386332257/`；后续运行在原档案仅列后缀 `6878902`、`7419983`、`7645358`，完整路径待定位 | RED／几何及焦点分组；最终聚合FAILED：按钮与anchor下载均canceled、字节未证 |
| H24 | 同节；`composer-calibration/font-ready-1792387237430/measurements.json` | 生成32 UTF16诊断，referenceTextIdentity unverified／referenceComparison false，不抵消同文残差 |
| H25 | [采用账本](../pilaude-component-adoption.md)“Pi 扩展补充范围”；`extension-catalogue/run-1792332119485/` | 设置目录／显式内存409，不是扩展全GUI／网络／统一授权 |

## 33 个源模块覆盖映射

以下只映射组件归属；采用状态仍以[历史采用账本](../pilaude-component-adoption.md)的限定 consumer 为准。历史汇总为 1 直接／12 局部／20 未确认，**不构成当前版本复测或54组件的复刻通过率**。

| 源模块（省略扩展名） | 对应组件键 |
| --- | --- |
| ArtifactsSplitPaneResizer | C30 |
| AttachmentCard | C07 |
| CdsButton | C02、C50 |
| CdsMotionEngine | C18 |
| ChatComposer | C08 |
| ChatComposerChin | C09 |
| ChatMessageBubbles | C11、C12 |
| ClaudeAudioPlayer | C25 |
| ClaudeDesktopHeader | C32 |
| ClaudeMotionPresets | C22 |
| CodeBlock | C13 |
| ConfirmationDialog | C05 |
| ContainerResponsiveBar | C36 |
| CoworkAgentCanvas | C35 |
| DraggableSessionList | C33 |
| EpitaxyIframeBridge | C29 |
| LiveMicActivityBars | C26 |
| McpToolDecisionCard | C06 |
| MediaLightboxViewer | C27、C28 |
| ModelSelectorEffort | C20 |
| ModelSwitcherWithTokenGauge | C19、C21 |
| ReasoningAmbientGlow | C18 |
| RichComposerWithMentions | C10 |
| ScrollFadeContainer | C24 |
| SegmentedControl | C03 |
| StatusIndicators | C04 |
| StreamingDiffViewer | C31 |
| ThinkingAccordion | C14、C15、C16 |
| createClaudeMainWindow | C32 |
| useClaudeRovingFocus | C36 |
| useClaudeScrollPinning | C23 |
| useClaudeSharedElementTransition | C28 |
| useRateLimitBackoff | C37 |

## 缺参考清单与需用户决定的补采

下表是 A3 的交付；**尚无用户补采决定**。即使补齐静态截图，各组件仍需动态／交互证据与环境元数据。Pi 独有界面没有一一对应官方整屏时，由用户决定采用哪套已核实控件语法；保留功能差异，不宣称整屏像素一致。

| 缺口类型 | 组件键 | 需补材料／决定 |
| --- | --- | --- |
| 没有专门 Windows 同状态参考登记 | C02、C03、C05、C06、C10、C13、C20、C23、C25、C26、C28、C29、C37、C43、C44、C45、C46、C47、C48、C49、C50、C51、C52、C53、C54 | 用户决定能否补采同版本组件全状态；音频需合法参考及设备条件，麦克风／Browser等需先完成真实能力；Pi独有字段需用户确认控件映射 |
| 有局部图但缺组件全状态 | C01、C04、C07、C08、C09、C11、C12、C14、C15、C16、C17、C19、C21、C24、C27、C30、C31、C32、C33、C34、C35、C36、C38、C39、C40、C41、C42 | 补 default／hover／pressed／focus／disabled／loading／empty／error、长内容与展开／关闭；逐项不适用须有理由 |
| 明确缺原件／对应状态 | C07、C14、C30、C31、C41、C42 | 长文件名图、思考逐状态、未定位3p整屏、Changes inline-comment原件／新同态Open-in-new-window浮签、输出风格编辑器、终端浅色；用户决定是否补采。总览／actual不代替原件 |
| 动态／音频参考缺失 | C04、C18、C22、C23、C25、C26、C28、C38 | 需原生时间序列／操作录像或可复现手动步骤；静图不能证明周期、弹簧、滚动跟随、灯箱转场、首页蓝光节奏或声效 |
| 版本或采样条件不齐 | C01–C54 | R01历史批次有版本标注但仍需逐图来源关联；R02–R10版本未知。全体OS DPI／应用缩放／Windows／WebView2等元数据未知或不齐，补采时记录；不由capture scale反推 |
| 公开素材与产品差异需裁决 | C01、C06、C25、C26、C40、C48、C49、C50、C51、C54 | 合法公开字体／图标／音频方案，Pi权限和独有字段，缺Remote Control等实际能力；需用户决定可接受差异，不能由实现者自行降低标准 |

上述首两行对除独立动态组件 C18、C22 外的52项各归属一次；C18、C22由动态参考缺失行覆盖。全体54项均在元数据补采行内，均不得称参考齐全。

## 后续卡片与独立验收要求

仓库外逐卡建议输入为 `D:/pilaude/relay-evidence/PIL-0014/component-card-proposals.json`，稳定键 `E2-C01` 至 `E2-C54` 与本表一一对应。该文件不是任务板、不是通过证据；正式事实需落到真实任务卡与任务分支。协调者串行建卡并安排规划者时，每卡至少需要下列可独立判定标准，不照搬占位“规划者补全”作为完成：

1. 固定该组件的参考来源、版本关联和环境元数据；未知明确写未知，缺图则待参考。列全适用状态及真实 Pi consumer／未实现边界，不把源库演示数据当产品状态。
2. 同帧、同状态、相同测试文本／数据、相同客户区及缩放条件下量测**宽高、比例、间距、文字基线与对齐**，记录原像素／CSS单位、裁剪、误差与已知残差。参考100%底层／实现50%上层，仅整数裁剪和平移，不重采样；私有素材留仓库外。无法获得可比条件时记未运行，不给视觉通过。
3. 对适用的**输入法、键盘／焦点、滚动、缩放及深浅色**逐项核验，并覆盖长内容、取消／错误／恢复等组件状态。Windows 原生 IME／DPI与浏览器合成事件分层；不适用逐项给理由，不能整体略过。
4. 各层证据写验收编号、可复现步骤、实际结果、日志位置、对应提交和独立验证者；旧失败保留。修正残差后复测，视觉与交互均齐备才可称该组件复刻通过。

后续应先确认用户补采决定与建卡范围，再串行创建54张建议对应卡，回填本表实际ID和标准状态，并核查已有残差卡的依赖／范围。**本轮完成索引与缺口交付后暂停；PIL-0014 不进入 verify，A2 留待实际建卡后再判定。**
