# Pilaude 右扩展区分区规则

2026-10-18 用户补充参考：第一列上方 Background tasks、下方 Browser，第二列 FileViewer。原始附件 1135×1455 已原字节归档到工作区 `references/claude-desktop/multi-pane-dark/2026-10-18/`，SHA-256 `8c88769b4222b9d7e9a44a3bce9663ab7a461f805a314120583900a162b41518`。私人原图不进入公开代码。

## 用户确认与待验证

用户确认默认一列容纳两个面板，第三个起向右开列。面板与面板内标签是两层：多个 Terminal 标签仍属于一个 Terminal 面板；多个文件标签属于 Files 面板。用户手动调整后的列宽与上下比例应保留。

后续默认采用每列两个面板连续分配；第三/第四面板放在第二列，第五/第六面板进入第三列。第三个之后的完整排列、自动补位、窄屏回退和最大化语义是实现选择，仍需更多实物交互验证，不能反称已从截图证明。

Context/环境卡片属于会话旁的附着卡片，完全独立于右扩展区 pane；浮动时容器透明、只有卡片命中，不占满上下矩形，不能遮住输入栏。它们不参与每列两个 pane 的分配。早期附着的更改摘要与本轮完整 Changes 审阅 pane 是不同层级；Changes 已进入 pane 注册与布局，后端和实际页面验收状态见下方本轮记录。

关闭显示面板、关闭标签、终止任务和终止 PTY 是不同操作。面板布局变更不得重建 Shell、重发模型请求或重新执行任务。展开只改变可见布局，恢复回到先前尺寸。

## open-claude-ui 研究

已检查本地 revision `7490e10` 的入口、README/CHANGELOG、v1/v2 文档与 Storybook。最相关源码是 `code-examples/ArtifactsSplitPaneResizer.tsx`；它提供左右双栏及折叠概念，没有统一面板注册表、列数组、上下堆叠、第三面板开列、独立关闭/最大化或布局持久化。

可复用 CDS 表面/边框/圆角与分割条交互规范。不能直接嵌套该示例冒充完整分区系统：它只计算 clientX/width，约束在拖动时生效，折叠会卸载右栏，恢复重设 50/50；纵向尺寸、窗口缩窄重钳制、pointercancel/lostcapture、完整 Escape 回滚及 iframe 命中护盾需由宿主补齐。

产品现有 `useResizablePanel` 已有指针与键盘行为，可以作为双轴交互基础，布局状态应由产品独立模块持有。所有样式写 `app/native-theme.css`，不改上游基础 CSS。

## 验收

1. 打开 1/2/3/4 个真实面板，逐项验证列分配、独立 close/expand、剩余面板与空列整理。
2. 横向列宽和纵向比例能鼠标与键盘调整；Escape 取消；拖过 iframe 不丢控制；窄窗仍能访问所有面板。
3. 标签内容、终端 PID、SSE offset、文件阅读位置、任务执行与模型调用不受布局操作影响。
4. 深浅色共用几何；原参考为 100% 不透明底层，实现为 50% 上层；原像素测量边界、间距、圆角和工具栏，不拉伸，不使用整屏相似度。
5. 参考版本、DPI、缩放未独立核验；证据不齐和可见差异继续保留，不宣称完全复刻。

## 2026-10-18 实测记录

已接入 Files（包含 Artifact）、Terminal、当前会话的 Background tasks 三个独立 pane。多个终端是同一个 pane 内的标签。浏览器检查通过默认 1/2/3 pane 分配、双轴指针/键盘调整、Escape 回滚、展开/恢复与隐藏/重开；第一终端 PID 和 Files 1800px 阅读位置保持。受控 Browser 与全局跨会话任务聚合仍待实现。

复查补充：工作区显隐单独保存，Tasks-only 刷新可恢复外层工作台；Tasks 按 root session ID 划定本地筛选状态，筛选非空时保留可清空的搜索框。多列采用前列像素宽、末列填充剩余空间，避免 fr 比例与指针像素宽混用造成拖动跳变；Context 观察 composer 祖先，以捕获下方扩展状态栏增高造成的位置改变。

## 2026-10-18 用户纠正：工作台重复顶栏与伸缩冲突

用户指出右列和中央割裂、工作台顶栏多余、与原终端入口重复；实际图显示工作台图标栏、Terminal 标题、终端标签叠为三层，单列出现横向滚动条。原因是外层面板宽与内层保存列宽同时约束单列，额外内边距使内容超过可用宽。

修正方向：移除外层工作台工具栏与重复新终端图标，主顶栏保留唯一面板开关，pane 自身标题/操作与终端内部标签继续使用。单列和单 pane 展开填满外层可用宽，多列才应用内部保存列宽；上下堆叠随同一外侧分隔条改变宽度。画布和间距按用户新给的 3p 整屏参考校准，不再包额外外卡片。原生窗口控件须保持窗口右上方可达，内容滚动不把控件带走。

用户另明确暗色常驻图标为深蓝底，浮签说明功能和快捷键；常驻、hover 和 focus 分别表现。只显示实际绑定的快捷键，不复制参考中的 Changes 键位来冒充当前能力。暗色实测采用 active 背景 `#032042`、前景核心 `#6DA7EC`，focus 另用 `#2A78D6`；按钮 31.2 CSS px、间距 4.8 CSS px、浮签最小高 28.8 CSS px，都是本地 1.25 capture 条件下的归一值，不证明参考 DPI。

最终定向组合 144 项通过，类型与 ESLint 通过。实际页面检查覆盖真正单 Terminal、Terminal/Files 上下堆叠、最小外宽、外侧键盘伸缩、纵向调整与 Escape 回滚、pane 展开/恢复、隐藏/重开、第三 pane 开列及 1100px 窄窗；单列 `clientWidth === scrollWidth`，没有多余横滚。终端 PID 31420 在这些操作后保持，未新增创建请求，清理 DELETE 返回 200，页面错误为 0。截图和几何保留在本机 `test-results/pilaude/workspace-integration/run-1792310827421/`。随后补移动标题行唯一控制组：在 390px 实际页面中，Files → Terminal → Tasks、关闭 Files 后控制组转移、关闭工作台均可达，切换不创建 PTY，根页面无横向溢出。桌面保持唯一主顶栏控制组。原 terminal e2e 的旧工作台/项目 title 选择器已迁移到真实响应式入口，原 hide/reopen 和 PID 断言保留，但未重新运行完整脚本。

另一次新增鼠标拖动/xterm fit 的检查在到达拖动前遇开发热重载和终端连接 error，保留失败，不能将此前键盘伸缩成功写成该新增项目通过。测试范围内的布局/生命周期通过；字体、图标、浅色实物及 Windows 原生控件仍待逐项核验，完整 terminal e2e 不据此追认通过。

## 2026-10-18 Changes 审阅 pane 与证据状态

Changes 已作为独立 pane 接入 [WorkspacePaneDock](../components/WorkspacePaneDock.tsx)，由 [ChangesPane](../components/ChangesPane.tsx) 消费只读 `/api/git/review`。Files／Artifact、Terminal、Tasks 与 Changes 保留独立内容 hosts；Context／环境卡片仍在会话旁，不参与 pane 排列。新增 Changes 不使终端布局操作重建 PTY，也不把更改反馈直接发送给模型。

已实现分支比较、未提交／单提交范围、文件树和提交列表、搜索、inline／split、换行、词差异、忽略空白、上下文展开与选行反馈。`ReviewDiff` 仅局部借鉴 open-claude-ui 表格／gutter／增删背景；`rove` 借索引、Home/End 与单 tabstop，过滤 IME；`FadedScroll` 借 2px 边缘判断，用 ResizeObserver 观察容器及首个内容子元素，并在 children 改变时重算，未使用 MutationObserver。新增语法高亮复用产品既有 Prism／refractor 注册表：按 hunk／revision 独立着色，并与词差异 mark 作无损交集，反馈继续读取原始行；源示例 parser、split 占位算法与流式 worker 未采用。

只读 Git 后端有真实临时仓库与 API 的 19 项通过；UI helper／toolbar 浮签共 23 项（19＋4）通过；独立窗口 Rust 单测 4 项、前端命令 5 项、页面 route 5 项与 token 2 项分别通过，另有父级 39 项集成与类型检查通过。最终全树 ESLint 退出 0，保留既有 TerminalPanel aria 警告。这些组不是全量测试总数。复查发现 copy 目标 patch 混入已修改源文件的真实缺陷，已用真实 Git fixture 复现并通过 `--diff-filter=C` 修正；新增 copy 用例与 rename／context3 组合 3 项通过，后端现有 20 个用例，但未把前轮 19 与重跑 3 相加。延迟 storage event 也已要求当前 request ID 仍匹配，拒绝 sender 超时取消后才到达的旧事件，相关 helper 3 项通过。实际页面 `run-1792315635019` 的前七组检查通过：范围／base／commit、finder、inline／split／wrap／word、上下文 3→20→all、真实草稿反馈、忽略空白／分组、binary／large、刷新与单例关闭恢复；整轮在 popout ACK 失败，保留 failed。定向 `followup-1792316406830` 通过同源新窗口、真实反馈到原草稿、浅色偏好重载及 820px 窄窗加载，errors／writes 均为空；request 当毫秒到达、次毫秒确认，popup 12ms 内收到 ACK。此前 `followup-1792316105640` 无 ACK 的 partial 记录保留，未证明具体成因，不声称间歇问题已根治；显式复制回退和原评论保留有效。元数据缓存最多 8 项、30 秒，文件 patch 按需加载并执行体积、路径、ref 和参数边界检查；截断／binary／过大状态明确显示，不把不完整内容当完整 diff。

独立窗口由 Rust 固定可信 origin 的 `/changes` 创建，renderer 只能传 cwd 与反馈目标；专用 capability 限定窗口能力，token 不进入 URL。反馈要求目标与 cwd 匹配、限时确认、单次消费；主会话不可达时提供复制回退，只进入草稿。浏览器回退和草稿交接已有上述实际通过及失败记录；Windows 原生开窗和原生窗口关闭交接仍待实际验证；不能用 Rust／route 单测替代实物。

本轮参考位于工作区 `references/claude-desktop/changes-dark/2026-10-18/`：12 个独立状态已归档 11 个原文件，`02-inline-comment` 仍缺独立原件，上传总览不能代替它。另有 `upload-images-dark/2026-10-18/` 的 1215×1336 原图，包含按上传顺序四行三列的 12 个缩略图框。来源文件与归档原字节／哈希相同，聊天 payload 身份、客户端版本、DPI／缩放与 CSS 字体仍待核实。完整像素和原生行为继续按 [复刻基准](pilaude-ui-parity.md) 验收。

## 后续语法、键盘与反馈专项

语法 adapter 使用现有 Prism 注册表，按连续 hunk 的旧／新侧独立着色；最多 1000 行／64000 字符／单行 4096 字符，超出保留精确纯文本。token 与词差异只是呈现，选行反馈仍使用原始 Git 字符串。浮签文字／快捷键分字号校准后的三组原像素叠图已保存，外高约 36 原像素，残差继续记入复刻基准。

跨窗口只读专项 `changes-ack-reliability/run-1792319138883/` 通过十次连续提交／三轮 popup 周期、每次一个 ACK／一个插入，以及 A→B→A 旧目标隔离；该轮最后 fresh 因主 document 重载而 partial。补剩余 `fresh-only-1792319508195/` 一次新弹窗交接通过，document 代际不变。失败时订阅器与 live ref 相同，开发刷新更换了目标；未修改 AppShell／超时／重放策略，不把新证据外推成历史所有 ACK 问题根治。设置菜单首次焦点的隐藏布局竞态已单独三次复现；改为可见布局提交后首次 focus，Tab 退出显式关闭、不恢复 trigger。`focus-diag-1792319835972/` 三次通过 resize 不夺焦点、Home／End、Tab 和 Escape；最终 `syntax-keyboard-1792320000380/` 五组通过真实源码／语法与 mark、编辑器／IME／disabled、390px 已加载表格／header／finder、无根横溢出及关闭焦点。可提交专项入口为 `e2e/changes-focus.mjs`，通过现有服务和显式 Git 项目运行，不创建会话或发送模型。

## 单列行号与同文校准补验

内联 Changes 现只显示一列真实行号：删除指向 old，添加指向 new，context 默认 new；从并排视图带回的 old 选区继续显示 old context，并可 Shift 延展。并排双侧入口与反馈原文不变，hunk／反馈行同步改为三列 span。helper／呈现叶组件／YAML 17 项通过；`yaml-visual-1792322634062/` 实际验证旧新 82、split old79→inline→Shift old80→取消恢复 new79，console error／warn／pageerror／writes 为空。`syntax-keyboard-1792322713151/` 再次通过真实 Git 原文、mark、键盘／IME 和 390px 五组检查。

同文原像素证明行距约 25.51px 已准，只将代码／pane 文字校准为 14／15.6 CSS px、固定 20.4px 行高；单号区约 71.99 原像素、table 至代码原点约 94.49，分别接近参考 72／94。参考 sidebar 扣除卡片外框后约 309 原像素，与当前 308.75 接近，未用加宽 sidebar 消除 standalone 的卡片缺失。外框、leading 78 省略入口、tree 结构与部分换行仍待校准；两组六项 before／after 叠图及墨迹数值见[复刻基准](pilaude-ui-parity.md)。

## 共享终端事件流与既有验证限制

初版独立终端 SSE 在 Files watcher、会话与调度事件流并存时达到 HTTP/1 每 origin 连接上限，第二终端的 resize 请求在原有 15 秒时限内无法抵达服务端。该失败保留在本机 workspace-panes 证据中，不能以单终端通过代替完整多标签验收；现已改为每个窗口一条终端事件流，按标签 ID 分发并维护各自输出游标；隐藏标签继续持有服务端订阅与 PTY lease。初始化重放分段、保留 UTF-16 游标和完整代理对，慢读者队列有界，退出/缺失单标签不关闭其他终端。13 项 client/stream/真实 manager lease 测试通过。最终实际双标签目标检查通过：首/次标签 PID 分别 44952/19536，第二标签 input POST 明确进入其自己的 ID、返回 200，共享 SSE 与 DOM/辅助树均收到第二标签 marker，切回首标签 PID 不变。完整 terminal 脚本已通过首终端、会话切换、刷新同 PID、离线恢复、创建请求不增加、输出不重复与尺寸；其第二标签等待仍曾失败，后续重启/延迟创建/移动场景未全部执行，完整脚本不标为通过。单独多 pane 脚本另遇 Next 开发编译 Manifest file is empty 的 500，失败原始证据保留。
