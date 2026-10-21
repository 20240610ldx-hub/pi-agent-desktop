# E2 逐组件复刻索引

PIL-0014，更新日期 2026-10-21。从 f178fa6 的 54 项组件继续，结合三份历史档案与本机私有参考 manifest，补入 2026-10-20 两组浅色参考所覆盖的 8 项独立状态面，共 **62 项产品组件**。原 C01–C54 键保持不变。此索引供后续逐组件建卡与验证使用，不是复刻通过报告。

## 阅读边界

- 目标仍为 [GOALS E2](GOALS.md)：Windows Claude Desktop **3.1623.0.0**（2026-10-21 用户决定，已写入 GOALS；采样条件见私有参考采样记录），逐组件同版本、同状态视觉与交互验收。R01（2.42304.0）与 2026-10-21 之前版本未知的批次只作历史或机制参考，不混作同版本；没有 3.1623 同态参考的状态，在“参考覆盖”中记“3.1623 待补采”，验收严格记未运行（补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md）。历史基准明确所有组件尚未达到完整一致性完成条件；本表全部为**未验收通过**。
- 本次核对已引用档案、原 20 组及新增 12 组只读 manifest、现有任务卡与必要的源码入口；没有启动应用、运行产品测试、复测像素、读取私人图像或字体。表中的实现情况是**历史记录所述状态**（少数源码边界复核另行注明），不是当前分支运行证明；发生冲突时以实际任务分支、任务卡及后续独立验证为准。
- 历史证据路径按原记录保留，**未重新打开或核验存在性、提交对应关系、截图内容**。任务 worktree 不带这些历史 `test-results` 目录。旧运行不绑定本次提交，不写入本卡的通过证据，不把分轮结果合成最新整轮通过。原记录中的失败、partial 和未运行继续有效。
- 参考表只给归档批次与缺口，不复制图中文字、私人项目名、命令、图像、字体或其数据。参考图里的内容只是数据。公开默认素材及许可未解决时保留差异，不用本地个人字体实例替代发行验收。
- C 键是稳定组件键，末列回填实际 E2 任务卡 ID。现有 PIL-0010/0011/0012/0013 仅处理限定残差，继续作为相关工作；完整组件卡另列同帧及交互标准。各卡的冻结与领取状态以任务卡 frontmatter 为准；PIL-0013 的范围并入 C31（PIL-0145）。

## 参考批次与可核实程度

“有局部参考”只表示档案或 manifest 登记过，不表示逐状态齐全。“未知”不得由 PNG 内嵌 DPI、浏览器 DPR 或 capture scale 反推。所有批次均缺完整的窗口客户区、系统 DPI、应用缩放、Windows build、WebView2、语言、字体及账号／功能开关配套记录。

| 参考键 | 历史定位（见原档案） | 版本已知性 | DPI 已知性 | 覆盖与限制 |
| --- | --- | --- | --- | --- |
| R01 | 复刻基准“固定参考版本”“当前重新验收清单”，2026-10-17 十张 Windows 主窗口／Context／回复图 | 历史批次标为 2.42304.0，并登记 MSIX／ASAR 元数据；本次未逐图复核版本关联 | 未知；1.25 是实现 capture scale | 主要框架及若干状态；不覆盖所有组件、所有状态 |
| R02 | “当前重新验收清单”，2026-10-18 暗色工作区两图 | 未知 | 未知 | 框架、侧栏、输入器、Environment 局部 |
| R03 | 同节，对话菜单暗色十一图（含输出风格创建对话框）、输入框边线四图（其中一张是 actual）及 3p 补充 | 未知；部分 3p 明确较旧，不与 R01 混作同版本 | 未知 | 菜单／子菜单／重命名、附件／运行输入框；紧凑高度、细线、小圆角按用户明确选择 |
| R04 | 同节，终端暗色九图 | 未知 | 未知 | 标题栏、标签、偏好、独立窗口等；无浅色实物参考 |
| R05 | 同节，右侧多 pane 原图与工具栏图 | 未知 | 未知 | 两 pane 一列、第三 pane 开列；另有未定位的 3p 整屏，不用 actual 冒充 reference |
| R06 | “本轮会话、首页、图片与 Changes 证据”“用户补充 Changes 展开态” | 未知；展开图宿主身份亦未核验 | 未知 | Changes 十二状态中十一源文件，inline-comment 原件待补；另有展开态及图标／浮签局部 |
| R07 | “本轮会话、首页、图片与 Changes 证据”，上传图片暗色批次 | 未知 | 未知 | 十二图片布局；原始内容比例／crop／绝对 bbox 未核实 |
| R08 | “首页静置／点击两态重新实现” | 未知 | 未知 | 静置／点击静图已登记；时序、字体、完整构图未确定，早期 pending 原图不算已找全 |
| R09 | “左上导航轨与内容搜索”，2026-10-18／19 导航批次 | 未知 | 未知 | 轨道、展开目录；参考裁剪原点不明，不能由旧用户消息目录外推章节语义 |
| R10 | “活动摘要与单处微光”“紧凑命令…”；输出清单“证据登记”，2026-10-19 活动／Sending／hover 图 | 未知 | 未知；原像素与显示预览分开 | 摘要／步骤／命令详情／Sending 的局部静态状态；静图不证明动效周期或全部思考状态 |
| R11 | 2026-10-20，workspace-rail-light 的 11 项 manifest 记录 | 未知；不与 R01 合并为同版本 | 未知 | 浅色会话侧栏／Show、Context／Connectors 展开、背景任务、Side chat、多栏网格、溢出菜单、Terminal 与 Browser 局部；只有静态图 |
| R12 | 2026-10-20，environment-picker-light 的 7 项 manifest 记录 | 未知；不与 R01 合并为同版本 | 未知 | 环境菜单／子菜单、Local／SSH 创建、Folders、Run in、变量子页；缺深色及完整交互状态 |
| R13 | 2026-10-18，composer-details-dark 的 4 项 manifest 记录 | 未知 | 未知 | 推理强度、添加扩展（含 Plugins 子菜单、类别列表、Manage/Browse plugins）、权限模式、模型选择局部；不能据菜单名称移植权限能力 |
| R14 | settings-general-light/2026-10-21 | manifest 标记/用户自报 Windows 3.1623.0.0；不并入 R01 版本 | SAMPLING 记录 150%（AppliedDPI 144）、应用缩放 100%（用户 2026-10-21 确认）；manifest 标注聊天附件（可能重编码/降采样，缩放未知），不由图宽反推 CSS px，数值项待原生补采 | C43；General 上下屏、外观/任务/通知控件；均只登记机制，未做像素验证 |
| R15 | model-picker-light/2026-10-21 | manifest 标记/用户自报 Windows 3.1623.0.0；不并入 R01 版本 | SAMPLING 记录 150%（AppliedDPI 144）、应用缩放 100%（用户 2026-10-21 确认）；manifest 标注聊天附件（可能重编码/降采样，缩放未知），不由图宽反推 CSS px，数值项待原生补采 | C19/C44；模型菜单当前项、默认标记、更多模型；均只登记机制，未做像素验证 |
| R16 | provider-config-3p/2026-10-21 | 未知；macOS，不作 Windows 字形/窗口参考 | 未知（macOS；约 2× Retina 仅为推测，未确认） | C44；macOS 深色提供商配置；仅结构与校验机制，版本/缩放未知；均只登记机制，未做像素验证 |
| R17 | connectors-light/2026-10-21 | manifest 标记/用户自报 Windows 3.1623.0.0；不并入 R01 版本 | SAMPLING 记录 150%（AppliedDPI 144）、应用缩放 100%（用户 2026-10-21 确认）；manifest 标注聊天附件（可能重编码/降采样，缩放未知），不由图宽反推 CSS px，数值项待原生补采 | C45；我的/发现、添加/详情、工具权限及设置表单；均只登记机制，未做像素验证 |
| R18 | skills-light/2026-10-21 | manifest 标记/用户自报 Windows 3.1623.0.0；不并入 R01 版本 | SAMPLING 记录 150%（AppliedDPI 144）、应用缩放 100%（用户 2026-10-21 确认）；manifest 标注聊天附件（可能重编码/降采样，缩放未知），不由图宽反推 CSS px，数值项待原生补采 | C46；列表、添加菜单、详情、编辑/上传入口；均只登记机制，未做像素验证 |
| R19 | scheduled-light/2026-10-21 | manifest 标记/用户自报 Windows 3.1623.0.0；不并入 R01 版本 | SAMPLING 记录 150%（AppliedDPI 144）、应用缩放 100%（用户 2026-10-21 确认）；manifest 标注聊天附件（可能重编码/降采样，缩放未知），不由图宽反推 CSS px，数值项待原生补采 | C49；空态模板与新任务表单；均只登记机制，未做像素验证 |
| R20 | permission-card-light/2026-10-21 | manifest 标记/用户自报 Windows 3.1623.0.0；不并入 R01 版本 | SAMPLING 记录 150%（AppliedDPI 144）、应用缩放 100%（用户 2026-10-21 确认）；manifest 标注聊天附件（可能重编码/降采样，缩放未知），不由图宽反推 CSS px，数值项待原生补采 | C06；权限决定卡、分裂按钮、Auto 引导和切换通知；均只登记机制，未做像素验证 |
| R21 | composer-suggestions-light/2026-10-21 | manifest 标记/用户自报 Windows 3.1623.0.0；不并入 R01 版本 | SAMPLING 记录 150%（AppliedDPI 144）、应用缩放 100%（用户 2026-10-21 确认）；manifest 标注聊天附件（可能重编码/降采样，缩放未知），不由图宽反推 CSS px，数值项待原生补采 | C10；slash 说明 tooltip、@ 会话/文件夹/文件菜单；均只登记机制，未做像素验证 |
| R22 | code-copy-light/2026-10-21 | manifest 标记/用户自报 Windows 3.1623.0.0；不并入 R01 版本 | SAMPLING 记录 150%（AppliedDPI 144）、应用缩放 100%（用户 2026-10-21 确认）；manifest 标注聊天附件（可能重编码/降采样，缩放未知），不由图宽反推 CSS px，数值项待原生补采 | C13；代码 hover 工具栏、复制浮签与对勾；均只登记机制，未做像素验证 |
| R23 | image-lightbox-light/2026-10-21 | manifest 标记/用户自报 Windows 3.1623.0.0；不并入 R01 版本 | SAMPLING 记录 150%（AppliedDPI 144）、应用缩放 100%（用户 2026-10-21 确认）；manifest 标注聊天附件（可能重编码/降采样，缩放未知），不由图宽反推 CSS px，数值项待原生补采 | C28；灯箱、文件名/计数、关闭与前后切换；均只登记机制，未做像素验证 |
| R24 | tray-light/2026-10-21 | manifest 标记/用户自报 Windows 3.1623.0.0；不并入 R01 版本 | SAMPLING 记录 150%（AppliedDPI 144）、应用缩放 100%（用户 2026-10-21 确认）；manifest 标注聊天附件（可能重编码/降采样，缩放未知），不由图宽反推 CSS px，数值项待原生补采 | C52；托盘菜单及等待输入的 Windows 系统 toast；均只登记机制，未做像素验证 |
| R25 | agent-panels-light/2026-10-21 | manifest 标记/用户自报 Windows 3.1623.0.0；不并入 R01 版本 | SAMPLING 记录 150%（AppliedDPI 144）、应用缩放 100%；原生原字节，CSS px = 原像素 ÷ 1.5，可量测 | C06（AskUserQuestion 提问卡，PIL-0120/PIL-0188）；AskUserQuestion 单题及多题分页/末题提交/需要输入胶囊；不作工具授权参考；均只登记机制，未做像素验证 |
| R26 | panyin-bid-intel：base.html、style.css、CHANGELOG.md、tests/test_changelog.py | 用户明确指定更新日志结构/样式机制；不作 Claude 版本参考 | 通过源 CSS 与本应用同视口复现量测 | C54；changelog-toggle/dialog、日期/版本/类别、内联 code 转义及独立滚动 |
| R27 | rate-limit-light/2026-10-21 | manifest 标记 Windows 3.1623.0.0（SAMPLING） | 采样 150%（AppliedDPI 144）、应用缩放 100%；该图是聊天附件并被降采样到 2000px 宽，原生原图未找到，不量 CSS px | C37/C35/C21；会话限额错误卡与重试/重置提示、红色“后台智能体 失败”行与子代理末尾限额文案、底栏红色圆环；只登记机制，未做像素验证 |
| R28 | composer-tooltips-light/2026-10-21 | manifest 标记 Windows 3.1623.0.0（SAMPLING） | 采样 150%（AppliedDPI 144）、应用缩放 100%；原生原字节，CSS px = 原像素 ÷ 1.5，可量测 | C08/C09/C26；发送提示（含“在分叉会话中发送 Ctrl Alt ⏎”）、“添加”提示、麦克风按钮提示（仅登记，首发不做麦克风）；尚未做像素验证 |
| R00 | 三份档案及本次 manifest 核对均未找到可用于该组件的专门 Windows 同状态参考 | 未知 | 未知 | 缺参考；源库示例、macOS 取证、Storybook 或 actual 都不能补作官方 Windows 原图 |

源库固定作者 SHA 为 `638800b8a4cee4513c8763c3df0ecf8a77b32379`，历史参考 checkout 为 `7490e105e418adf2b94c55ff716bb0973d44fb85`；其取证是 **macOS 2.37337.1**，不是本项目 Windows 版本证明。主题导入、vendor 存在、算法局部 consumer、整个源组件采用、产品功能及 Windows 复刻验收分别记账。

## manifest 复核与定位

以下使用本机私有参考库内的“组名／日期／manifest 条目号”定位，不收录原图或图中个人信息。原 20 组 manifest 加 2026-10-21 的 12 组 manifest 已只读核对；“已归档”只说明记录存在，未逐张解码或重做像素测量。参考与 actual 分开，缺原件不以总览或实现截图填充。R01 的版本来自归档目标及历史安装元数据关联，仍需验证者逐图确认；其他组的版本、系统 DPI 与应用缩放均未知。

| 组名／日期 | manifest 记录与边界 | R 键／组件 |
| --- | --- | --- |
| windows-2.42304.0／2026-10-17 | 10 张；含背景任务、侧栏可见性、Browser 与 Context 共存 | R01；C01/C04/C08/C11/C12/C21/C32/C35/C40/C51/C55 |
| workspace-dark／2026-10-18 | 2 张工作区图 | R02；C01/C08/C32/C33/C40 |
| conversation-menus-dark／2026-10-18 | 11 张，06 为输出风格创建对话框，不能继续称该对话框完全缺图 | R03；C07/C08/C09/C27/C41 |
| composer-border-dark／2026-10-18 | 4 条中 3 reference、1 actual；actual 不作参考 | R03；C07/C08/C09/C27 |
| composer-prompts-dark／2026-10-18 | 2 张提示局部，附件对应关系待核 | R03；C08/C09 |
| composer-details-dark／2026-10-18 | 4 张控件菜单，版本与 DPI 未知 | R13；C06/C19/C20/C47（含 Plugins 子菜单、类别列表、Manage/Browse plugins） |
| context-cards-dark／2026-10-18 | 1 张卡片浮层局部 | R03；C40 |
| terminal／2026-10-18 | 9 张暗色原图记录；不代表完整状态覆盖 | R04；C42 |
| multi-pane-dark／2026-10-18 | 1 张双列三 pane | R05；C30/C35/C36/C39 |
| workspace-integration-dark／2026-10-18 | 3 已归档中 2 actual、1 参考工具栏；另 1 个 3p 整屏原件缺失 | R05；C30/C36/C39 |
| changes-dark／2026-10-18 | 12 条中 11 原件，02 inline-comment 缺失 | R06；C24/C31/C36 |
| upload-images-dark／2026-10-18 | 1 张布局总览；附件内容边界与比例待核 | R07；C27 |
| home-code-ripple／2026-10-18 | 6 状态中 4 已归档，00/01 缺原件；04/05 静置／点击静图可定位 | R08；C38 |
| conversation-navigation-dark／2026-10-18 | 2 张导航局部，附件对应关系待核 | R09；C33/C34 |
| conversation-navigation／2026-10-19 | 2 张浅色展开／收起 | R09；C34 |
| session-actions-status-dark／2026-10-18 | 4 张菜单及侧栏状态，时序与版本未知 | R03/R09；C04/C33/C41 |
| session-title-status-dark／2026-10-18 | 3 张标题／状态局部；静图不证明呼吸周期 | R03/R09；C04/C32/C33/C41 |
| agent-activity／2026-10-19 | 6 张活动摘要／任务／发送局部，深浅色；不作动态证据 | R10；C04/C14/C15/C16/C17/C18/C35 |
| workspace-rail-light／2026-10-20 | 11 张浅色；逐条状态与尺寸如下表 | R11；C15/C16/C30/C31/C35/C36/C40/C42/C51/C55/C56/C57 |
| settings-general-light/2026-10-21 | 已读 manifest；General 上下屏、外观/任务/通知控件；原图留私有目录 | R14；C43 |
| model-picker-light/2026-10-21 | 已读 manifest；模型菜单当前项、默认标记、更多模型；原图留私有目录 | R15；C19/C44 |
| provider-config-3p/2026-10-21 | 已读 manifest；macOS 深色提供商配置；仅结构与校验机制，版本/缩放未知；原图留私有目录 | R16；C44 |
| connectors-light/2026-10-21 | 已读 manifest；我的/发现、添加/详情、工具权限及设置表单；原图留私有目录 | R17；C45 |
| skills-light/2026-10-21 | 已读 manifest；列表、添加菜单、详情、编辑/上传入口；原图留私有目录 | R18；C46 |
| scheduled-light/2026-10-21 | 已读 manifest；空态模板与新任务表单；原图留私有目录 | R19；C49 |
| permission-card-light/2026-10-21 | 已读 manifest；权限决定卡、分裂按钮、Auto 引导和切换通知；原图留私有目录 | R20；C06 |
| composer-suggestions-light/2026-10-21 | 已读 manifest；slash 说明 tooltip、@ 会话/文件夹/文件菜单；原图留私有目录 | R21；C10 |
| code-copy-light/2026-10-21 | 已读 manifest；代码 hover 工具栏、复制浮签与对勾；原图留私有目录 | R22；C13 |
| image-lightbox-light/2026-10-21 | 已读 manifest；灯箱、文件名/计数、关闭与前后切换；原图留私有目录 | R23；C28 |
| tray-light/2026-10-21 | 已读 manifest；托盘菜单及等待输入的 Windows 系统 toast；原图留私有目录 | R24；C52 |
| agent-panels-light/2026-10-21 | 已读 manifest；AskUserQuestion 单题及多题分页/末题提交/需要输入胶囊；不作工具授权参考；原图留私有目录 | R25；C06 提问卡 |
| rate-limit-light/2026-10-21 | 已读 manifest；会话限额错误卡、重试按钮、重置提示、红色失败行、子代理末尾限额文案、底栏红色圆环；聊天附件降采样到 2000px，仅登记机制；原图留私有目录 | R27；C37/C35/C21 |
| composer-tooltips-light/2026-10-21 | 已读 manifest；发送提示（含分叉发送键帽）、“添加”提示、麦克风提示；原生原字节；原图留私有目录 | R28；C08/C09/C26 |
| environment-picker-light／2026-10-20 | 7 张浅色；逐条状态与尺寸如下表 | R12；C02/C03/C05/C58/C59/C60/C61/C62 |

两组新参考的尺寸是 manifest 所记**整张原图宽×高（原像素）**，不是组件 bbox 或 CSS 尺寸；本次没有量出组件宽高、间距或基线，不把图像尺寸当作复刻量测结果。每张版本／OS DPI／应用缩放均未知，不能把跨图尺寸相减或从嵌入分辨率反推缩放。

| 参考条目 | 机制／状态 | 原图尺寸 | 组件 |
| --- | --- | --- | --- |
| R11-00 | 侧栏卡片与背景任务详情并列 | 2000×1197 | C35/C40/C55 |
| R11-01 | 运行／已结束任务、展开命令与输出条目 | 2000×1196 | C15/C16/C35 |
| R11-02 | 隐藏侧栏、正文重居中、显示侧栏浮签 | 2000×1194 | C55 |
| R11-03 | 卡片焦点、拖动把手、堆栈滚动 | 633×1508 | C40/C55 |
| R11-04 | Show 勾选菜单与恢复默认 | 529×1279 | C55 |
| R11-05 | Context 工具列表嵌套滚动、Connectors 展开与认证入口 | 459×1418 | C40 |
| R11-06 | 工具栏溢出、任务计数／勾选、保持唤醒开关 | 719×256 | C36/C57 |
| R11-07 | Side chat 空态、回复输入、与任务面板纵向堆叠 | 729×1527 | C30/C56 |
| R11-08 | 双列网格、Terminal 列与任务／Side chat 列 | 1205×1522 | C30/C42/C56 |
| R11-09 | 2×2 网格及无 Git 仓库 Changes 空态 | 1249×1520 | C30/C31 |
| R11-10 | 三列网格、Browser 新标签与 Cookie 导入对话框 | 1485×1527 | C30/C51 |
| R12-00 | 环境主菜单、选择子菜单与快捷键列 | 964×823 | C58 |
| R12-01 | Remote Control 第三级项目列表 | 1088×581 | C58 |
| R12-02 | Local 创建对话框及遮罩 | 1968×1515 | C03/C05/C59 |
| R12-03 | Folders 添加／最近项／选择弹层 | 908×1057 | C60 |
| R12-04 | Run in 单选列表 | 827×815 | C61 |
| R12-05 | 环境变量多行编辑子页与完成操作 | 884×809 | C62 |
| R12-06 | SSH 页签、主机选择、条件禁用添加按钮 | 864×861 | C03/C05/C59 |

## 组件清单

每行的参考结论均为“不齐全”，版本与 DPI 具体按 R 键查上表。H 键定位下节的历史证据，`H00` 表示引用档案未提供该组件专门运行位置。当前实现列不等于当前运行结果。“关联”只表示已有工作，后续卡须明确依赖／避免重叠。

| 组件键 | 组件／状态面 | 参考覆盖（版本／DPI 见 R 表） | 历史记录所述实现状态 | 已有证据位置键 | 已知残差或未验部分 | 完整 E2 任务卡／关联 |
| --- | --- | --- | --- | --- | --- | --- |
| C01 | 主题、文字与图标 | 不齐：R01/R02，字形状态缺 | 主题全局导入；个人字体仅本地对照实例 | H01/H24 | 公开默认字形／中文回退、图标轮廓、原生度量；生成文本诊断不抵消旧 ink 残差 | [PIL-0115](tasks/PIL-0115-parity-c01.md) |
| C02 | 按钮尺寸与交互状态 | 不齐：R12-02/06 仅对话框按钮局部；独立全状态缺 | CdsButton 仅数据预览／导入直接消费 | H00；采用账本“目前的直接消费链” | default／hover／pressed／focus／disabled／loading 的同帧参考及实际量测 | [PIL-0116](tasks/PIL-0116-parity-c02.md) |
| C03 | 分段选择控件 | 不齐：R12-02/06，Local／SSH 分段局部；深色缺 | SegmentedControl 未采用，现有设置／工具独立实现 | H00 | 无真实源 consumer；键盘、空值、指示器与多实例状态待验 | [PIL-0117](tasks/PIL-0117-parity-c03.md) |
| C04 | 运行、加载与骨架指示 | 不齐：R01/R10 仅局部状态 | StatusIndicators 模块未采用；产品有真实状态点 | H02/H12 | 缺全状态形状／时序；不把主题 keyframes 算模块采用 | [PIL-0118](tasks/PIL-0118-parity-c04.md) |
| C05 | 确认与扩展对话框 | 不齐：R12-02/06 创建对话框局部；危险确认全态缺 | 独立对话框；合成 IME 按键归属已有记录 | H10 | Windows IME、焦点进入／循环／恢复、取消／错误几何未齐；来源示例不自带完整 focus trap | [PIL-0119](tasks/PIL-0119-parity-c05.md) |
| C06 | 工具权限决定卡 | 不齐：R13 权限模式及 R20 权限决定卡；R25 AskUserQuestion 提问卡（原生，可量测；答案非授权机制） | McpToolDecisionCard 未采用；真实阻塞 UI 独立；尚无面向模型的提问工具 | H00 | 权限卡失败/取消与 gate 真值；提问卡（分页/其他/跳过/末题提交/需要输入胶囊）接 PIL-0188 真实提问能力，答案不等于授权（用户 2026-10-21 决定实现，不再是邻接） | [PIL-0120](tasks/PIL-0120-parity-c06.md)；关联 PIL-0030、[PIL-0188](tasks/PIL-0188-ask-user-question.md) |
| C07 | 文件附件卡与普通文件标签 | 不齐：R03 局部；长文件名专图缺 | AttachmentCard 仅后缀分离／双 span 接 TabBar；tile／chip 未采用 | H07 | 官方长名／窄标签图、附件全部状态缺；Terminal／Artifact 标签不在该适配内 | [PIL-0121](tasks/PIL-0121-parity-c07.md) |
| C08 | 输入器主框与提交控件 | 不齐：R01/R03，焦点状态未独立确认；R28 发送提示（原生，可量测） | Pi 输入器、紧凑 48px／14.4px 圆角、中性边线；单次提交锁 | H03/H24 | 字体 ink 宽／高、回车图标和边线抗锯齿仍不同；Windows 原生 IME 未验 | [PIL-0122](tasks/PIL-0122-parity-c08.md)；关联 [PIL-0189](tasks/PIL-0189-fork-send.md)（分叉发送） |
| C09 | 输入底栏、排队与忙碌操作 | 不齐：R03；R28“添加”提示（原生，可量测） | ChatComposerChin 未采用；真实 queuedMessages／Steer／Follow-up／Stop | H03/H13 | 更短窄窗组合、拒绝／不明结果、队列全状态及同帧基线缺 | [PIL-0123](tasks/PIL-0123-parity-c09.md) |
| C10 | 提及、路径与斜杠建议 | 不齐：R21，slash 说明浮签与 @ 列表局部 | RichComposerWithMentions 未采用；Pi @／#／slash 独立实现 | H03（仅邻接提交） | 建议列表全部状态、路径边界、IME／229、焦点与滚动专项未齐 | [PIL-0124](tasks/PIL-0124-parity-c10.md) |
| C11 | 用户长消息气泡与展开 | 不齐：R01 局部 | ChatMessageBubbles 仅测溢出／fade／展开机制局部适配 | H22 | 完整气泡样式、编辑、真实字体／DPI；浏览器响应式记录不作 Windows 视觉通过 | [PIL-0125](tasks/PIL-0125-parity-c11.md) |
| C12 | 助手正文与消息操作条 | 不齐：R01 回复 rest／hover | rest 隐藏、hover／focus 与触屏入口；复制／分叉有历史功能记录 | H01 | Pin／朗读缺失；字体／图标不同，完整编辑／操作状态未齐 | [PIL-0126](tasks/PIL-0126-parity-c12.md) |
| C13 | 代码块、Mermaid source 与复制反馈 | 不齐：R22，代码 hover/复制浮签/成功对勾局部 | Prism 保留；CodeBlock 仅 2.5s 复制反馈局部适配 | H11 | 完整同版本逐状态参考仍缺、Windows 原生剪贴板、失败／pending／重复反馈与字形完整对照缺 | [PIL-0127](tasks/PIL-0127-parity-c13.md) |
| C14 | 思考摘要与展开正文 | 不齐：R10 仅局部活动图；专门逐状态图缺 | ThinkingAccordion 仅 Grid；真实 indexed 活动及 deferred fetch／cache／retry | H09/H12/H15 | 全键盘／原生 IME、对应 Windows 状态、字体与层级残差；不能沿用早期“无 indexed 活动”描述 | [PIL-0128](tasks/PIL-0128-parity-c14.md) |
| C15 | 执行记录组与摘要 | 不齐：R10/R11-01；浅色任务命令组仅局部 | 真值驱动组、独立折叠／首次错误展开、最终答案组外 | H12/H15/H17 | 真实长耗时／慢连接、摘要比例／字形、完整扁平层级仍未验 | [PIL-0129](tasks/PIL-0129-parity-c15.md) |
| C16 | 工具步骤、参数结果与紧凑命令 | 不齐：R10/R11-01；任务展开命令与输出局部 | 已结束且仅 command 的 shell 紧凑呈现；其他 rich views 保完整，Prism 字符串色与整宽分隔 | H17/H18/H21 | 参考 pill 39 原像素对当前 33.75 CSS px 条件不同；语法绿色、宽度／文本／DPI及其他行层级差异 | [PIL-0130](tasks/PIL-0130-parity-c16.md) |
| C17 | 流式正文／公式／Artifact 光标 | 不齐：R10 不能覆盖各结尾 | HAST marker；simple display 与 mounted card 有限定记录 | H19/H20 | tag／fleqn／leqno、多行／wide／katex-error／raw 与 inline 切换未齐；特殊布局只保护不等于 caret 支持 | [PIL-0131](tasks/PIL-0131-parity-c17.md)；关联 PIL-0012 |
| C18 | 单处微光、新步骤及有限状态动效 | 不齐：R10 静图；动态原参考缺 | ShimmerText 局部适配 1.8s；步骤180ms／6px／40ms，图标160ms／摘要150ms | H12/H17 | 这些时长是实现选择；官方动态时间序列及 Windows 渲染未验；CdsMotionEngine 未采用 | [PIL-0132](tasks/PIL-0132-parity-c18.md) |
| C19 | 模型切换菜单 | 不齐：R03/R13-03/R15，模型菜单局部 | ModelSwitcherWithTokenGauge 未采用；Pi 模型选择独立实现 | H00 | 能力／未知值／长名／错误菜单、同帧字号与对齐；不使用示例固定模型／窗口值 | [PIL-0133](tasks/PIL-0133-parity-c19.md) |
| C20 | 推理强度选择 | 不齐：R13-00，推理强度浮层暗色局部；全状态缺 | ModelSelectorEffort 未采用；按 Pi availableThinkingLevels 过滤 | H00 | 不同能力和未知档、推荐状态及键盘／IME／菜单全态缺 | [PIL-0134](tasks/PIL-0134-parity-c20.md) |
| C21 | 当前上下文圆环与用量浮层 | 不齐：R01 局部；R27 底栏红色圆环（降采样附件，仅机制），数值状态缺 | 消费 SDK 当前 context percent；无效值保未知 | H08 | NaN／Infinity 仅 SSR；不能用累计账单反推占比，Windows 逐态参考缺 | [PIL-0135](tasks/PIL-0135-parity-c21.md) |
| C22 | DOM 菜单进入与弹簧曲线 | 不齐：R03 静图，原时序缺 | ClaudeMotionPresets 求解器／SNAPPY 仅 opacity consumer | H05 | 不包含空间回弹、退出与其他 variants；Windows 时间序列／reduced-motion 对照缺 | [PIL-0136](tasks/PIL-0136-parity-c22.md) |
| C23 | 长会话滚动跟随与历史恢复 | 不齐：R00 | useClaudeScrollPinning 仅150ms意图锁；保 Pi 分页／锚点 | H01/H13 | 原生滚动、长耗时／重连、历史定位全矩阵；其他源阈值不算采用 | [PIL-0137](tasks/PIL-0137-parity-c23.md) |
| C24 | 列表边缘渐隐 | 不齐：R06 局部 | ScrollFadeContainer 仅 Changes 2px 边缘判定／16px fade | H04/H06 | 动态内容边界、RTL、双轴与精确 alpha 未验／未采用 | [PIL-0138](tasks/PIL-0138-parity-c24.md) |
| C25 | 完成音与音频设置 | 不齐：R00；声音参考缺 | ClaudeAudioPlayer 未采用；产品独立合成双音 | H00 | 不使用官方声效；完成音改用开源许可资源并记录来源与许可（用户 2026-10-21 决定）；设备切换、用户激活、隐藏／退出清理缺 | [PIL-0139](tasks/PIL-0139-parity-c25.md) |
| C26 | 麦克风活动条 | 不齐：R00；R28 麦克风按钮提示仅登记 | LiveMicActivityBars 未采用，无真实语音输入 consumer；首发不做麦克风/语音转文字，输入器隐藏麦克风按钮，PIL-0140/0178 parked（用户 2026-10-21 决定） | H00 | 需先有真实音频链，再核采样率、频段、噪声门／reduced-motion；无功能通过声明 | [PIL-0140](tasks/PIL-0140-parity-c26.md) |
| C27 | 多图片缩略图与上传排列 | 不齐：R03/R07 | 自然尺寸／contain 局部消费；透明画布、7.2 CSS px gap | H04 | payload 比例／crop／letterbox／绝对 bbox 与 DPI 不明；生成 PNG 不替代私人原文 | [PIL-0141](tasks/PIL-0141-parity-c27.md) |
| C28 | 图片灯箱、缩放与共享转场 | 不齐：R23，灯箱文件名/计数/前后导航局部 | MediaLightboxViewer zoom／pan／wheel 局部适配，native dialog portal | H05 | shared-element hook 未采用；慢 src 切换、双指、媒体导航及官方同态图缺 | [PIL-0142](tasks/PIL-0142-parity-c28.md) |
| C29 | Artifact 卡片、预览与 iframe 桥接 | 不齐：R00 | 产品真实 Artifact／安全边界；EpitaxyIframeBridge 未采用 | H20 | 完整 inline 完成切换、保存／失败／版本及 Windows 参考缺；卡片活动不等于整预览验收 | [PIL-0143](tasks/PIL-0143-parity-c29.md) |
| C30 | 产物分屏、多 pane 布局与拖动分隔 | 不齐：R05/R11-07–10，浅色堆叠／双列／2×2／三列 | 多列 dock、稳定 hosts、双轴调整／布局保存；源 resizer 未采用 | H01（分区记录线索） | 浅色静态拓扑已补；旧 3p 整屏仍缺，拖动、比例／最小宽高、焦点／缩放／DPI同帧全矩阵待验 | [PIL-0144](tasks/PIL-0144-parity-c30.md) |
| C31 | Changes／diff／反馈编辑器 | 不齐：R06/R11-09，无仓库浅色空态已补；inline 原件缺 | react-diff-view@3.3.3 真实 consumer；源 StreamingDiffViewer 仅局部呈现借鉴 | H06/H14 | echo 换行、滚动条带、外卡／字形、真实窗口 ACK 与整轮回归；合成 ACK 不是真实 ChatWindow | [PIL-0145](tasks/PIL-0145-parity-c31.md)；关联 PIL-0010；PIL-0013 的范围并入本卡（建议 PIL-0013 parked） |
| C32 | Windows 窗口、顶栏与独立会话窗口 | 不齐：R01/R02/R03，原生状态缺 | Tauri；会话新窗／VS Code 有 Rust／mock IPC 合同；源 Electron／macOS 未采用 | H14/H16 | 真实 OS 开关／移动／贴靠／DPI、Code.exe 启动与窗口状态未验 | [PIL-0146](tasks/PIL-0146-parity-c32.md)；关联 PIL-0010、PIL-0111 |
| C33 | 侧栏项目／会话、搜索、状态及重排 | 不齐：R01/R02/R09 | 固定根会话键盘相邻重排局部适配；真实 metadata／全文搜索 | H02/H11/H13 | 指针拖放未采用；名称／浮签字形与边界残差、原生快捷键及全状态缺 | [PIL-0147](tasks/PIL-0147-parity-c33.md) |
| C34 | 模型章节导航轨与目录 | 不齐：R09 | 只消费 mark_chapter 持久记录；256px目录，正文／输入器共享中轴 | H13 | 旧用户消息分片语义已撤回；刻度／文字残差、更窄 clamp 与 Windows 同态未验 | [PIL-0148](tasks/PIL-0148-parity-c34.md) |
| C35 | 多代理任务面板与真实任务状态 | 不齐：R01/R05/R10/R11-00/01/R27（失败行与限额文案，降采样附件仅机制），浅色运行／已结束及详情 | AgentSessionPanel 接 Pi family；CoworkAgentCanvas 未采用 | H15 | 运行卡／用量、已结束列表与命令展开待逐态对照；队列／审批／取消／失败原生端到端未验；不冒充结构化Plan/Todo | [PIL-0149](tasks/PIL-0149-parity-c35.md)；关联 PIL-0050、PIL-0074 |
| C36 | 窄容器工具栏与 roving 焦点 | 不齐：R05/R06/R11-06，浅色溢出局部；具体菜单另见C57 | Changes rove 局部适配；FileViewer 容器布局独立，ContainerResponsiveBar 未采用 | H06/H23 | 系统 DPI／WebView2、动态焦点／RTL与完整工具栏参考；不外推到其他菜单 | [PIL-0150](tasks/PIL-0150-parity-c36.md) |
| C37 | 限流、重试与错误提示 | 不齐：R27 会话限额错误卡、重试与重置提示（聊天附件降采样，仅登记机制）；429/503 瞬时限流及取消／未知结果缺 | useRateLimitBackoff 未采用；SDK retryInfo／session automation 独立 | H00 | 真实429／503／取消／未知结果状态及倒计时参考；不重放已接受请求或外部操作 | [PIL-0151](tasks/PIL-0151-parity-c37.md) |
| C38 | New 首页与固定字符光照 | 不齐：R08 静态两态 | New 真实 home 导航；历史实现是固定格点不规则照明与单击单波 | H09（首页） | 构图／亮度／时序未齐；原始动态未知，最新蓝色慢扫／固定字符要求仍需独立对照 | [PIL-0152](tasks/PIL-0152-parity-c38.md) |
| C39 | FileViewer、Source／Preview／Diff 与下载 | 不齐：R05 仅不同内容局部 | 窄pane布局／原文／sandbox已有分组记录；下载聚合失败 | H23 | 下载取消根因及字节未证；最终焦点子项已有记录但不覆盖整轮失败，视觉比例不同 | [PIL-0153](tasks/PIL-0153-parity-c39.md)；关联 PIL-0011 |
| C40 | Context／Environment／Connectors 卡片 | 不齐：R01/R02/R03/R11-00/03/05，深浅卡片与嵌套展开 | 共存／浮层让位、焦点与输入器边界有功能记录 | H01 | Context 工具子列表／Connectors 认证入口和嵌套滚动待复刻；Environment 缺真实Remote Control能力，历史矮约26px——Remote Control 首发不含（PIL-0185 parked），不显示 Remote 行；侧栏编排见C55，环境选择见C58–C62 | [PIL-0154](tasks/PIL-0154-parity-c40.md) |
| C41 | 标题菜单、Transcript modes 与输出风格 | 不齐：R03 含06输出风格创建对话框；逐态／同版本仍缺 | 主／子菜单真实动作；会话隔离模式／风格 consumer，原生目标仅合同层 | H16 | chevron／glyph重影、窗口及Code实物；风格编辑器已有暗色局部，完整输入／错误／深浅状态待验；旧“编辑器完全缺图”已按manifest纠正 | [PIL-0155](tasks/PIL-0155-parity-c41.md) |
| C42 | Terminal 标签、工具栏与偏好 | 不齐：R04/R11-08，浅色终端共存已补；浅色偏好／独立窗缺 | xterm偏好与共享SSE／PTY历史功能记录；菜单按 PIL-0177 全走 DOM（NATIVE_POPUP_MENUS_ENABLED=false） | H01（终端） | 完整脚本未跑完；独立窗创建／控制权／关闭交接、浅色偏好、几何回归及原生DPI待验 | [PIL-0156](tasks/PIL-0156-parity-c42.md) |
| C43 | General 设置与共享设置控件 | 不齐：R14，General 外观/任务/通知两屏局部 | SettingsPanel／SettingsUi 实际壳层；desktop controls在General | H00 | 各 tab／长路径／scope／busy／错误、深浅／语言与焦点全态参考缺 | [PIL-0157](tasks/PIL-0157-parity-c43.md) |
| C44 | 模型配置与提供商凭据界面 | 不齐：R15 模型菜单；R16 提供商结构/校验机制（macOS，非 Windows 像素参考） | ModelsConfig、EnabledModels 与真实 Pi 配置／凭据独立实现 | H00 | 启停／未知／错误／重试／脱敏参考、完整键盘及原生度量未齐 | [PIL-0158](tasks/PIL-0158-parity-c44.md)；关联 PIL-0020 |
| C45 | MCP 配置、信任与登录 | 不齐：R17，列表/添加/详情/工具权限/设置表单局部 | 既有配置／信任／登录流程；不能以加密功能结果代视觉 | H01（旧问题登记） | Sign in 小按钮历史对比度3.12:1；等待同态参考裁决，完整同版本逐状态参考仍缺 | [PIL-0159](tasks/PIL-0159-parity-c45.md) |
| C46 | Skills 列表、搜索与安装 | 不齐：R18，列表/添加/详情/编辑上传局部 | 真实 DefaultResourceLoader／npx安装及共享设置块 | H00 | 空／加载／拒绝／部分结果／长路径／scope、键盘焦点与完整同版本逐状态参考仍缺 | [PIL-0160](tasks/PIL-0160-parity-c46.md) |
| C47 | Plugins／扩展目录与安装控制 | 不齐：R13-01 含添加入口、Plugins 子菜单、类别列表、Manage/Browse plugins；安装全态缺 | 真实 DefaultPackageManager；目录限定页面已有记录 | H25 | 目录可见不等于全GUI／网络／卸载回退；同态Windows参考缺 | [PIL-0161](tasks/PIL-0161-parity-c47.md)；关联 PIL-0076 |
| C48 | 子代理配置与 profile 编辑器 | 不齐：R00 | AgentsConfig 与真实 profile 路径；不由 Cowork demo代替 | H00 | 创建／编辑／禁用／错误、作用域与焦点、官方对应控件或Pi独有映射待定 | [PIL-0162](tasks/PIL-0162-parity-c48.md)；关联 PIL-0050 |
| C49 | 定时任务列表、编辑器与历史 | 不齐：R19，空态模板/新任务表单局部 | 既有 scheduled 页面／scheduler；执行能力另由E7处理 | H00 | 调度／权限真值与显示分层；逐屏空／错误／长内容／时区状态参考缺 | [PIL-0163](tasks/PIL-0163-parity-c49.md)；关联 PIL-0060 |
| C50 | 数据预览、导入与恢复界面 | 不齐：R00 | PilaudeDataSection 是 CdsButton 真实 consumer；功能另由E3/E9处理 | H00 | 预览／确认／进度／失败／取消同态、焦点与原生文件路径；无整屏官方参考 | [PIL-0164](tasks/PIL-0164-parity-c50.md)；关联 PIL-0020、PIL-0090 |
| C51 | 受控 Browser pane 与控制条 | 不齐：R01/R11-10，Browser新标签局部（R11-10 的 Cookie 导入对话框仅登记，首发不实现） | BrowserPanel源码复核为地址栏／历史与iframe；不是E5受控浏览器（引擎为内嵌 WebView2 子 webview，首发只验 Windows） | H00 | Browser控制条与新标签待复刻；用户 2026-10-21 决定不导入日常 Cookie，每项目独立 profile、受控浏览器内手动登录；导航／输入／下载／取消／接管与授权真值由PIL-0040及浏览器子卡补齐，不用iframe功能替代受控验收 | [PIL-0165](tasks/PIL-0165-parity-c51.md)；关联 PIL-0040、PIL-0196 |
| C52 | 托盘、系统通知与关窗状态 | 不齐：R24，托盘菜单/等待输入 Windows 原生 toast；只验通知内容/触发/点击，不复刻系统外观 | Tauri系统能力保留；生命周期独立验收任务 | H00 | 完成/等待输入通知权限、前台抑制、去重、点击目标与退出清理须原生实测；系统外观不作 DOM 量测 | [PIL-0166](tasks/PIL-0166-parity-c52.md)；关联 PIL-0090、PIL-0111 |
| C53 | 原生文件选择、保存与路径入口 | 不齐：R00 | desktop-native 系统对话框路径；不用网页伪造OS结果 | H00 | Windows picker／取消／失败／越界、焦点恢复与DPI；源码职责不证明实物通过 | [PIL-0167](tasks/PIL-0167-parity-c53.md)；关联 PIL-0011、PIL-0111 |
| C54 | 安装、更新与版本提示界面 | 用户指定 R26 更新日志结构/样式机制；Windows 安装/更新系统参考仍缺 | 现有 AppUpdatesSection/desktop 设置；更新日志条目源 CHANGELOG.md 及 dialog 为本卡明确新增，更新 busy 保护保留 | H00 | 更新日志条目源与对话框尚不存在；安装／升级／失败／重新启动真实产物和系统参考缺；签名材料由独立任务决定 | [PIL-0168](tasks/PIL-0168-parity-c54.md)（C54a 版本入口与更新日志，不依赖签名）；[PIL-0190](tasks/PIL-0190-parity-c54b-install.md)（C54b 下载/安装/失败/重启，依赖 PIL-0003、PIL-0110、PIL-0112） |
| C55 | 会话侧栏卡片编排与 Show 菜单 | 不齐：R01-03/R11-02/03/04，浅色局部 | 现有Context dock与显示开关；未见Show逐卡显隐／重置和拖动编排consumer | H01；源码入口PilaudeWorkspaceContext/AppShell | 卡片顺序／把手焦点、显隐／默认恢复、侧栏滚动与正文重居中；深色菜单与拖动序列缺 | [PIL-0169](tasks/PIL-0169-parity-c55.md) |
| C56 | Side chat 面板与回复输入 | 不齐：R11-07/08，浅色空态及堆叠 | 当前WorkspacePaneId无Side chat；未见独立Side chat consumer | H00；源码入口WorkspacePaneControls/WorkspacePaneDock | 真实支线会话隔离、回复／忙碌／错误／长消息及IME，面板开关／焦点恢复；深色缺 | [PIL-0170](tasks/PIL-0170-parity-c56.md) |
| C57 | 主工具栏溢出菜单 | 不齐：R11-06，浅色打开态 | AppShell已有topMore DOM 菜单（PIL-0177 全走 DOM）；条目不同，未接Side chat／保持唤醒 | H16（邻接标题菜单，非本菜单证据）；源码入口AppShell | 菜单锚点、分隔／快捷键／任务计数／勾选／唤醒真值、焦点与Escape；禁用能力不能伪成功 | [PIL-0171](tasks/PIL-0171-parity-c57.md) |
| C58 | 环境选择菜单与多级子菜单 | 不齐：R12-00 浅色二级菜单；R12-01 Remote 第三级仅登记、首发不实现 | PilaudeWorkspaceContext展示本机／目录；未见环境选择consumer | H00；源码入口PilaudeWorkspaceContext | 主菜单／选择环境二级避让、选中／快捷键／滚动与焦点；首发不显示 Remote Control 与 Cloud 环境（用户 2026-10-21 决定，PIL-0185 parked；GOALS 不含云账号）；WSL／SSH 能力不能仅改名 | [PIL-0172](tasks/PIL-0172-parity-c58.md) |
| C59 | New environment 的 Local／SSH 对话框 | 不齐：R12-02/06，浅色两页签 | 尚无创建环境对话框；现有项目选择不等同环境创建 | H00；源码入口PilaudeWorkspaceContext | 遮罩／页签／名称／主机选择／添加禁用／取消与校验；真实执行能力需先规划，深色与错误态缺 | [PIL-0173](tasks/PIL-0173-parity-c59.md) |
| C60 | Folders 添加与选择弹层 | 不齐：R12-03，浅色最近项与选择入口 | ProjectPicker及desktop-native有目录入口；无该环境内Folders弹层consumer | H00；源码入口ProjectPicker/desktop-native | 最近项／选择／去重／长名称、列表滚动／锚点避让；原生取消／返回焦点，深色与空错误态缺 | [PIL-0174](tasks/PIL-0174-parity-c60.md) |
| C61 | Run in 运行目标选择 | 不齐：R12-04，浅色打开态 | 暂无环境内运行目标选择consumer；现有cwd不是目标路由 | H00；源码入口PilaudeWorkspaceContext | 选择／当前标记／禁用／未知／目标失联，快捷键与焦点；本机／WSL真实目标不可硬编码 | [PIL-0175](tasks/PIL-0175-parity-c61.md) |
| C62 | 环境变量编辑子页 | 不齐：R12-05，浅色编辑页 | 暂无环境变量子页consumer；不把全局进程变量当会话配置 | H00；源码入口PilaudeWorkspaceContext | 多行输入／保存／取消／校验／遮蔽敏感值、返回保草稿、IME与内部滚动；深色和错误态缺 | [PIL-0176](tasks/PIL-0176-parity-c62.md) |

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

以下只映射组件归属；采用状态仍以[历史采用账本](../pilaude-component-adoption.md)的限定 consumer 为准。历史汇总为 1 直接／12 局部／20 未确认，**不构成当前版本复测或62组件的复刻通过率**。

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

## 后续卡片与独立验收要求

本表的 62 张完整 E2 卡逐项列目标、来源／状态、同帧宽高／比例／间距／基线／对齐量测、适用输入法／焦点／滚动／缩放／深浅色，以及组件专属残差。实际 ID 在组件末列；各卡的冻结、领取与证据以任务卡 frontmatter 和证据表为准，本索引不记录通过证据。

每张卡的 files_allowed 列具体组件／能力实现入口与定向测试；fork CSS 全部列 files_shared，仅在各自带注释分节追加，禁止通配整个目录；没有现存consumer时明确列出拟新增组件文件。这是待规划的最小入口，不授权后续实现者扩到执行后端。缺功能或范围不足须先由规划者拆依赖／调整范围，不能造演示数据交差。共享壳文件在本轮修订卡中由一张主卡持有 files_allowed，其余仅少量接线列 files_shared；其他 files_allowed 重叠通过直接/传递 depends_on 串行，领取仍以当时全板活动卡为准；关联残差卡仍独立保留，不覆盖其冻结标准。

验证者按引用的 R/H 键回到档案／manifest和任务卡，确认来源、当前提交及每层证据；不得把manifest存在、历史报告或本次文档自测当组件复刻通过。缺版本或可比条件时视觉记未运行，保留旧失败与残差。所有新卡需独立验证与评审后才能声称完成。

## 缺参考清单与需用户决定的补采

以下保留尚缺的材料与决定；用户已批准数值容差、能力先行、C54 更新日志机制及 C52 Windows 原生通知，不再列为未决。用户 2026-10-21 另决定：缺 3.1623 同态参考的项严格记未运行并出补采清单；Claude 应用缩放 100%（原生截图 CSS px = 原像素 ÷ 1.5）；麦克风/语音转文字首发不做；Remote Control 首发不含；完成音使用开源许可资源。所有 62 项均缺完整版本关联／系统DPI／应用缩放及逐状态矩阵，均不得称参考齐全。已有静图不重复要求“从无到有”，而按下表补具体状态；Pi独有界面由用户决定参考控件映射，保留真实能力差异。

| 缺口类型 | 组件键 | 需补材料／决定 |
| --- | --- | --- |
| 无专门组件同状态图（邻接不抵同态） | C23、C25、C26、C29、C37、C48、C50、C53 | 完成音使用开源许可资源（C25）；麦克风首发不做（C26）；Pi 独有界面先确认控件映射，再补正常/空/失败/取消状态 |
| 有局部图或指定机制参考但缺组件全状态 | C01、C02、C03、C04、C05、C06、C07、C08、C09、C10、C11、C12、C13、C14、C15、C16、C17、C19、C20、C21、C24、C27、C28、C30、C31、C32、C33、C34、C35、C36、C38、C39、C40、C41、C42、C43、C44、C45、C46、C47、C49、C51、C52、C54、C55、C56、C57、C58、C59、C60、C61、C62 | 已新增 R14–R25、R27–R28 与用户指定 R26；补同版本深色、长内容、焦点、失败/取消/禁用等适用状态。C54 指定机制不证明安装能力，C52 系统 toast 仅验通知行为 |
| manifest明确缺原件 | C30、C31、C38 | workspace-integration-dark 的02（3p整屏）；changes-dark 的02（inline-comment）；home-code-ripple 的00/01。用户决定是否补采；actual及其他总览不能充作缺原件 |
| 专属状态仍缺 | C07、C14、C31、C41、C42、C47、C51 | 长文件名、思考逐状态、同态独立窗浮签、风格编辑错误／保存、Terminal浅色偏好与独立窗、扩展目录／安装全态、Browser导航／下载／人工接管与Cookie导入失败／取消 |
| 新浅色批次缺深色或完整交互矩阵 | C30、C35、C40、C51、C55、C56、C57、C58、C59、C60、C61、C62 | 补与R11/R12相同版本／同状态的深色及长内容／空错误／禁用参考；侧栏拖动与Show重置、任务切换、Side chat回复、菜单层级、环境创建／子页返回操作序列；旧暗图不自动同版本 |
| 动态／音频参考缺失 | C04、C18、C22、C23、C25、C26、C28、C38、C55 | 原生时间序列／录像／可复现步骤：微光与状态周期、弹簧、滚动跟随、灯箱、首页节奏、侧栏拖动反馈与声效。C18/C22独立动态组件无静图可替代 |
| 版本与采样条件不齐 | C01–C62 | R01仅批次版本有关联，需逐图确认；R02–R13版本未知；R14–R24（除 R16）与 R27 的 manifest 标注为聊天附件（可能降采样/重编码），只登记机制；原生可量测的只有 R25、R28（CSS px = 原像素 ÷ 1.5，应用缩放 100%）；Windows 3.1623.0.0 与 R01 的 2.42304.0 不混作同版本，R16 为未知版本的 macOS。补系统DPI、应用缩放、Windows/WebView2、客户区、语言／字体及功能开关，不能从原图宽高或capture scale反推 |
| 公开素材／真实能力差异需裁决 | C01、C06、C25、C26、C40、C48、C49、C50、C51、C54、C56、C57、C58、C59、C60、C61、C62 | 字体／图标／声音许可、Pi权限／独有字段、受控浏览器、支线会话、保持唤醒、WSL／SSH及变量作用域（Cloud 环境与 Remote Control 首发不含）；用户决定可接受差异，不自行降低复刻标准或实现假能力 |

首两行仍覆盖除 C18/C22 外的 60 项，每项恰归属一次；新增局部参考不等于参考齐全或组件验收通过。

## 2026-10-21 冻结前修订说明

本轮补 62 张组件卡及 PIL-0178–0185 八张能力卡。本索引不写实现通过证据。A2 数值容差为盒子宽高/间距/文字基线/图标中心 ≤1 CSS px、宽高比 ±1%、圆角 ≤0.5 CSS px、颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，同一像素采样区取中位色）；字形 ink/抗锯齿另记。3.1623 原生截图 CSS px = 原像素 ÷ 1.5；聊天附件与版本未知批次只登记机制，数值项记未运行，待原生补采。

AskUserQuestion 的 agent-panels-light/2026-10-21/00、06、07 归 C06 提问卡（用户 2026-10-21 决定实际实现，接 PIL-0188 的真实提问能力），覆盖单题、多题分页、末题提交及需要输入胶囊；答案是对模型的回答，不等于工具授权。tray-light/2026-10-21/01-windows-toast-waiting-for-input.png 是系统绘制的 Windows toast，只验内容、触发与点击行为。参考图均不复制。

能力依赖：C06→PIL-0030/0188（提问能力）；C08→PIL-0189（分叉发送）；C26→PIL-0178（parked，首发不做麦克风）；C56→PIL-0179；C57→PIL-0180/0179；C58–C62 使用 PIL-0181（配置）、0182（执行契约）及 0183/0184（SSH/WSL）；Remote Control（PIL-0185）首发不含，已 parked，UI 卡不依赖它。环境 UI 按 PIL-0172→PIL-0173→PIL-0174/0175/0176 的前置关系实现（箭头表示先完成左侧）。具体优先级、主卡和可冻结建议以本次卡片与交接为准，原有关联卡验收不变。

第 3 轮（2026-10-21）：基准同步为 3.1623.0.0；R14–R24 的“（R16 未知）”复制错误已删除并按各 manifest 订正类型（原生可量测仅 R25、R28；其余为聊天附件降采样/重编码，仅登记机制）；新增 R27（rate-limit-light，归 C37/C35/C21）与 R28（composer-tooltips-light，归 C08/C09/C26）；PIL-0188（提问能力）、PIL-0189（分叉发送）、PIL-0190（C54b）为本轮新卡，PIL-0168 收窄为 C54a。
