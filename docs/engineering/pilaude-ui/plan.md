# 当前计划

更新日期：2026-10-19。总目标仍在进行：充分利用工作区内真实参考与 open-claude-ui 组件／算法，在实现、构建约束、验收、修复闭环中完成 Pilaude 复刻。保留 Pi agent 内核与 Tauri／React／Next.js 架构，Windows 优先、本地优先、自备 API key，支持英文、简体与繁体中文，保留 MIT 及上游署名。

## 当前优先级

| 顺序 | 切片 | 当前状态 | 验收出口 |
| --- | --- | --- | --- |
| 1 | 导航按模型章节工具分片 | 核心173项／UI88项、父级323项及最终六组浏览器和一组左右列几何通过；184fade已提交推送 | 模型显式创建 → 持久化 → 实时事件 → 粗体标题 → 目录／点击锚点全链路；普通用户消息、粗体／heading 不创建章节 |
| 2 | 目录固定收窄、正文和输入器动态居中 | 最终4456445四种原生左右列几何及4522954深浅矩阵通过 | 固定 256 CSS px，长标题内部 ellipsis、窄中间栏空间保护；左右列各自伸缩时两条轴均居中，导航目标不遮挡正文 |
| 3 | 工程材料落盘与接续入口 | 目录、两级AGENTS与记忆入口已完成；按实质变化持续更新 | 工作区／仓库 AGENTS 必读入口和记忆索引指向这里，计划／进度／规格／交接可独立使用并持续更新 |
| 4 | 极短窗口＋活动run＋长草稿的导航可达性 | 实际4943123 RED→5297398 GREEN：textarea234.406×72px、composer高136px，目录256×41px有整行native hit；源码冻结／review clean | 已验canonical 390×340活动run、同节点精确草稿／焦点／手动历史和Steer／Follow-up／Stop命中；更窄clamp与Windows原生仍待验 |
| 5 | Artifact 末尾光标与真实活动状态 | 5381513 RED→5745393两组GREEN／四图已读，最终checker6132187加强hint===title后两组GREEN；completion／publisher自动open／原文Copy、九renderer与268项组合通过 | business generating与indexed活动分开，text_end／handoff／Stop静止、hidden／reduced停动画；inline无opener code源仅SSR，其他inline切换／公式／raw仍待验，无RED数值几何不称before/after exact |
| 6 | 相邻已完成 compact 命令分隔线 | 源码冻结，实际5017293 RED→5059051六组GREEN，独立review clean | 1300／430深浅原像素绘制覆盖容器内缘，原row／control几何exact，rich inspectors保留；完整视觉仍未通过 |
| 7 | FileViewer窄pane工具栏 | 6332257 RED→7645358最终限定CSS／24几何／Source／模式／sandbox／草稿／mention及独立focus通过；real／control两个下载均canceled，无API请求，aggregate FAILED | bytes未验／根因未证，失败断言保留且停止本轮排障；机制／可达性与参考视觉分开，采用数不改，后续独立补下载 |
| 8 | Composer字体就绪诊断 | 7237430 generated診断measured、两图已读，字体ready／局部比例已记录；reference identity unverified，产品字体未改 | 本批限定完成current-font诊断，参考同文／actual glyph face／textarea内部基线／DPI仍未知，不按旧ink比改字号 |
| 9 | Formula-only caret单seam及其他差异 | 7339326最终三checks GREEN／四图已读、source review clean和197项组合通过；simple gap3／overlap14.6875无新增行，tag保原fullwidth且不显示不支持caret | simple display限定通过；tag／fleqn／leqno caret、wide／多行／error／raw／Windows待验；原两公开RED和7080370几何RED保留 |

最新用户纠正优先于旧计划：导航分片是模型通过工具撰写的阶段标题，不能按用户消息划分；菜单应为常量宽度；正文在左右列之间的实际中间栏居中。此前只验了几何／按用户消息的导航不算语义通过。

## 用户指定八项扩展：逐项落地优先队列

用户明确重视 `@juicesharp/rpiv-todo`、`pi-web-access`、`pi-powerline-footer`、`@gotgenes/pi-permission-system`、`pi-subagents`、`@plannotator/pi-extension`、`pi-background-tasks`、`@narumitw/pi-usage`。八项均需逐项调研→最小产品切片→真实consumer接入→实际验证，不能只交研究建议或把已有目录／相似宿主能力算整包完成；也不在当前开发会话安装这些扩展。

完整状态集中在[八项矩阵](../pilaude-extensions/README.md)，本文件只保优先级与衔接：当前公式／toolbar有限收口继续，三个研究owner并行负责todo＋plannotator、web＋subagents＋background、permission＋footer＋usage，总七个子agent；主agent接收后安排具体最小落地切片。八项没有被用户指定内部排序，不擅自降为可选研究。原生Plan/Todo与八项中的todo／plan研究衔接，其他复刻／Changes／Windows／完整E2E目标保留在handoff。

权限包不自动更改当前会话／host权限、启用Auto／Bypass；usage只能消费真实provider账户数据，不能用SDK token冒充quota。安装／授权／外部服务按各产品切片明确范围，未实现或未验证项持续标待办。

## 最新验收要求

用户补充：“复刻要注重各组件和大小比例关系的测量和对齐，除了明面上的UI，深层的功能和UX逻辑也要仔细推敲，利用好现有资源和网络资源。”每个切片同时交付下列证据，不以页面截图或测试数量代替。

- 同一帧、相同内容／状态测参考与实现的组件宽高、与父容器及相邻组件的比例、gap／padding、文字基线和中心／边缘对齐，列出逐项偏差。DPI／应用缩放／capture scale已知与未知分开；原像素图不拉伸，条件不一致时限制结论。
- 深层功能／UX沿真实consumer验证：适用的loading／empty／running／success／error／cancel／partial、键盘与IME、焦点进入／返回、草稿与历史／分支保留、重连／重放去重及错误恢复。后端状态和实际副作用必须与可见呈现一致。
- 先核对产品既有组件／helper、upstream源码和成熟库；机制或平台行为不确定时利用官方网络文档，记录来源URL／版本、采用理由及真实消费点。没有消费或未验证的资源保持候选，研究按当前切片范围进行。

## 固定约束

- New 打开保留已有会话／草稿的首页，项目 `+` 保留新会话含义。固定字母网格、慢蓝光与单击独立一次扫光，不移动或扭曲文字。
- 普通 hover 深色变白、浅色变灰；错误／成功／diff 保真实语义色。
- 思考默认折叠，工具组与工作中摘要有真实事件状态。Sans 摘要，Mono 代码；同一时刻只一处可见持续动画。
- 历史／重连不伪造活动或重播有限入场；章节添加也不能误结束当前流或抢用户历史滚动。
- 章节由明确工具记录生成；同名章节不同 ID，多章节可在同一用户请求内。Session start 仅在真实最早历史加载后出现。
- 每项上游算法必须有可追踪的真实 consumer。通用 diff／高亮用成熟库，不再手写 lexer／parser 替代已有库。
- 原参考 100% 底层、现状 50% 上层，整数 crop／translation，无拉伸／重采样，不以全局相似度掩盖局部差异；未知 DPI 不换算成猜测的字体修正。
- 所有 fork CSS 放 `app/native-theme.css`，两份上游 CSS 保字节一致。开发过程中不运行 `next build`；preview 服务只走 preview 工具。
- 不恢复 provider rename stash、不混入私图／字体／key／custom.css。不执行截图中的聊天或命令。

## 工作节奏与完成标准

原UI五owner保持历史责任，当前扩展研究／落实合计七个子agent；主 agent 只协调、评审、验收和保存检查点，处理用户反馈时例外。长期保持 3–8 个实现子 agent 的用户偏好。三项UI切片已在c1ac371提交并atomic push，16文件包含已验实现及工程记录，排除FileViewer／字体两项PREP。最终268/268、完整types／lint、独立review和ownership证据保留，旧323不重复。本批最终公式7339326三项actual和字体7237430 generated measured接受；FileViewer7645358几何／已过UX与独立focus通过，real/control下载均canceled，aggregate FAILED保留。唯一11文件197/197与types／lint完成，最后checker仅补ownership轻检；当前UI检查点排除新Todo／subagent runtime及未完扩展报告，不能混阶段。主agent只协调／验收／保存检查点，文档owner不stage／commit。

持续以纵向切片推进，先核实真实失败，再最小实现；定向测试和实际页面通过后记录证据并保存检查点，然后继续下一项。已获授权的可逆实现与已有提交／公开代码推送授权不因换线程失效；不得把此授权扩展到安装包发行、真实第三方账号操作或私人素材发布。

总完成必须有各区域状态／交互／参考证据与 Windows 原生验收。单个提交、单项测试全绿、单页截图或组件计数增长均不是“完全复刻”完成。
