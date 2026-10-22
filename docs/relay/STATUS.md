# Pilaude 当前状态

页首由协调者手写，只写最重要的事；任务板由 `node scripts/relay.mjs status` 生成。

更新：2026-10-19。用户要求当前这批 agent 完成后，由协调者保存交接并暂停，不再启动后续任务。

## 当前里程碑：M0 仓库可接力

治理入口已单独提交到本地集成分支；旧产品改动尚未合入。主 checkout 的暂存区与工作树分别保存在本地分支 `wip/pre-relay-2026-10-19-index`、`wip/pre-relay-2026-10-19`，逐路径 blob 清单及保存前后比对位于 `D:/pilaude/relay-evidence/PIL-0001/preservation-2026-10-19T14-07-00-781Z/`。31 个原产品暂存路径保持原样，未清理主 checkout。Relay 工具独立预检 15 项通过，详见同任务 `bootstrap-precheck/`；这不是 PIL-0001 整卡验收通过。

本批任务租约已交还，任务分支与证据保留。PIL-0001 完成归属表和真实 hook 阻断演示，但 157 条路径中仍有 9 条历史文档未归属，A4 未授权、未执行。PIL-0014 的 54 项组件索引保存在 `task/PIL-0014-parity-index` 的 `f178fa6`，54 份建卡建议尚未成为实际卡片，未独立验收或合入。PIL-0011 的独立 Chromium 夹具支持下载路由缺口解释，两个对照均保存 53 字节且哈希一致；完整产品和 Tauri 下载尚未验收。依赖 PIL-0001 的产品任务均未领取，后续按用户指示再继续。

恢复的独立窗口原 owner 已确认没有其自建进程或调试连接残留；最后 Windows 原生检查停在初始导航隔离，真实开窗 IPC、移动与关闭保持主草稿均未到达。恢复材料放在 `D:/pilaude/relay-evidence/PIL-0001/recovery-*/`，与此前有限测试层级分开，不作为任务卡通过证据。

最新已发布产品检查点仍为 `2254561`（Todo 与 subagent alias）；本轮治理提交及 WIP 快照没有推送，不是 installer 发行。

## 需要用户决定

- PIL-0001 A4：同意后才把主 checkout 恢复干净（WIP 已先保存到快照分支）。
- 迁移时按旧验收出口冻结了 11 张卡（任务板"验收已冻结 = 是"），请抽查。
- PIL-0072：`pi-powerline-footer` 的 LICENSE 正文缺口，是否允许进入安装包。
- PIL-0075：可用于真实额度测试的 provider 账户。
- PIL-0112：代码签名证书与更新密钥。

## 任务板（自动生成，勿手改）

<!-- relay:board:start -->
共 123 张任务卡：todo 92 · in_progress 4 · verify 3 · review 0 · done 17 · blocked 2 · parked 5

### 进行中 / 待验证 / 待评审

| ID | 优先级 | 状态 | 标题 | 持有者 | 租约到期 (UTC) | 分支 |
| --- | --- | --- | --- | --- | --- | --- |
| PIL-0002 | P0 | verify | 建立可信的测试基线并逐项登记已知失败 | codex-plus:luna-medium:impl | 2026-10-22T12:04Z | task/PIL-0002-test-baseline |
| PIL-0010 | P1 | in_progress | Changes 面板在独立窗口打开（功能迁入与浏览器层验证） | codex-plus:sol-high:impl | 2026-10-22T12:54Z | task/PIL-0010-changes-popout-window |
| PIL-0030 | P1 | in_progress | 统一执行前授权并接入 pi-permission-system（普通 coding 会话授权门） | codex-plus:sol-xhigh:impl | 2026-10-22T12:54Z | task/PIL-0030-permission-gate |
| PIL-0130 | P1 | in_progress | 复刻验收：C16 工具步骤、参数结果与紧凑命令 | codex-plus:luna-high:impl | 2026-10-22T10:57Z | task/PIL-0130-parity-c16 |
| PIL-0137 | P1 | verify | 复刻验收：C23 长会话滚动跟随与历史恢复 | codex-plus:luna-high:impl | 2026-10-22T12:04Z | task/PIL-0137-parity-c23 |
| PIL-0143 | P1 | verify | 复刻验收：C29 Artifact 卡片、预览与 iframe 桥接 | codex-plus:sol-high:impl | 2026-10-22T12:04Z | task/PIL-0143-parity-c29 |
| PIL-0011 | P2 | in_progress | 查清并修复 FileViewer 窄 pane 下载被取消 | codex-plus:sol-high:impl | 2026-10-22T12:35Z | task/PIL-0011-fileviewer-download |

### 阻塞

- **PIL-0117** 复刻验收：C03 分段选择控件 — 2026-10-22T07:23Z · claude-cli:sonnet-high:impl · in_progress → blocked：缺 3.1623 参考与真实 consumer
- **PIL-0128** 复刻验收：C14 思考摘要与展开正文 — 2026-10-22T09:30Z · codex-plus:luna-high:impl · in_progress → blocked：缺 C14 3.1623 同态参考

### 待办（按优先级；未冻结验收的卡需先由规划者冻结）

| ID | 优先级 | Epic | 标题 | 验收已冻结 | 依赖 |
| --- | --- | --- | --- | --- | --- |
| PIL-0040 | P1 | E5 | 受控浏览器 | 否 | PIL-0030 |
| PIL-0050 | P1 | E6 | 多代理完整流程与 pi-subagents 适配 | 否 | PIL-0030, PIL-0202 |
| PIL-0071 | P1 | E8 | pi-web-access 接入普通会话 | 是 | PIL-0001 |
| PIL-0072 | P1 | E8 | pi-powerline-footer 状态行接入并修复短窗叠字 | 是 | PIL-0001 |
| PIL-0073 | P1 | E8 | Plannotator 计划审阅接入 | 是 | PIL-0001 |
| PIL-0074 | P1 | E8 | pi-background-tasks 接入界面与普通会话 | 是 | PIL-0001 |
| PIL-0100 | P1 | E10 | 首次使用引导：不开终端完成第一个真实任务 | 否 | — |
| PIL-0114 | P1 | E0 | 修复 THIRD_PARTY_NOTICES 许可声明测试（CRLF 与 rpiv-todo From 块） | 否 | PIL-0113 |
| PIL-0144 | P1 | E2 | 复刻验收：C30 产物分屏、多 pane 布局与拖动分隔 | 是 | PIL-0014, PIL-0169, PIL-0010 |
| PIL-0146 | P1 | E2 | 复刻验收：C32 Windows 窗口、顶栏与独立会话窗口 | 是 | PIL-0014, PIL-0010, PIL-0111, PIL-0200 |
| PIL-0150 | P1 | E2 | 复刻验收：C36 窄容器工具栏与 roving 焦点 | 是 | PIL-0014, PIL-0010 |
| PIL-0169 | P1 | E2 | 复刻验收：C55 会话侧栏卡片编排与 Show 菜单 | 是 | PIL-0014, PIL-0010 |
| PIL-0170 | P1 | E2 | 复刻验收：C56 Side chat 面板与回复输入 | 是 | PIL-0014, PIL-0179, PIL-0144 |
| PIL-0172 | P1 | E2 | 复刻验收：C58 环境选择菜单与多级子菜单 | 是 | PIL-0014, PIL-0181, PIL-0182, PIL-0183, PIL-0184 |
| PIL-0173 | P1 | E2 | 复刻验收：C59 New environment 的 Local／SSH 对话框 | 是 | PIL-0014, PIL-0172, PIL-0181, PIL-0183 |
| PIL-0179 | P1 | E6 | Side chat 独立会话服务与权限隔离 | 是 | PIL-0030, PIL-0203 |
| PIL-0181 | P1 | E3 | 环境配置、Folders 与变量作用域持久化 | 是 | PIL-0030 |
| PIL-0182 | P1 | E4 | 环境执行契约与本机真实运行路由 | 是 | PIL-0181, PIL-0030, PIL-0203 |
| PIL-0183 | P1 | E4 | SSH 环境真实执行、取消与连接恢复 | 是 | PIL-0182 |
| PIL-0184 | P1 | E4 | WSL 环境发现、执行与路径隔离 | 是 | PIL-0182 |
| PIL-0188 | P1 | E4 | 提问能力：模型向用户提问与答案回传（AskUserQuestion） | 是 | PIL-0030, PIL-0203 |
| PIL-0191 | P1 | E5 | 受控浏览器引擎与 pane 内核（含 spike） | 否 | PIL-0001 |
| PIL-0192 | P1 | E5 | 受控浏览器会话核心与智能体工具注册 | 否 | PIL-0191 |
| PIL-0193 | P1 | E5 | 受控浏览器提交/上传/导航审批门 | 否 | PIL-0192, PIL-0030, PIL-0203 |
| PIL-0194 | P1 | E5 | 受控浏览器标签页与下载 | 否 | PIL-0192, PIL-0193 |
| PIL-0195 | P1 | E5 | 受控浏览器人工接管、取消与恢复 | 否 | PIL-0192, PIL-0193 |
| PIL-0200 | P1 | E2 | Changes 独立窗口的 Windows 原生实测 | 是 | PIL-0010, PIL-0111 |
| PIL-0202 | P1 | E4 | 子代理与 child 会话的授权上限与撤权 | 是 | PIL-0030, PIL-0203 |
| PIL-0203 | P1 | E4 | 公开审批服务、入口覆盖清单与未覆盖入口默认拒绝 | 是 | PIL-0030 |
| PIL-0003 | P2 | E1 | 产品与更新身份收尾核验 | 否 | — |
| PIL-0020 | P2 | E3 | 本地数据隔离与凭据加密验收 | 否 | — |
| PIL-0060 | P2 | E7 | 定时任务接入授权与浏览器 | 否 | PIL-0030 |
| PIL-0070 | P2 | E8 | Todo 扩展收尾：GUI 全链与干净安装 | 是 | PIL-0001 |
| PIL-0075 | P2 | E8 | pi-usage 真实账户额度验证 | 否 | — |
| PIL-0076 | P2 | E8 | 扩展安装、启停、卸载与回退 | 否 | — |
| PIL-0090 | P2 | E9 | 生命周期与崩溃恢复 | 否 | — |
| PIL-0110 | P2 | E11 | 发布检查器与 Windows 安装包流水线 | 否 | — |
| PIL-0118 | P2 | E2 | 复刻验收：C04 运行、加载与骨架指示 | 是 | PIL-0014 |
| PIL-0119 | P2 | E2 | 复刻验收：C05 确认与扩展对话框 | 是 | PIL-0014, PIL-0072 |
| PIL-0120 | P2 | E2 | 复刻验收：C06 工具权限决定卡与 AskUserQuestion 提问卡 | 是 | PIL-0014, PIL-0030, PIL-0188, PIL-0203 |
| PIL-0121 | P2 | E2 | 复刻验收：C07 文件附件卡与普通文件标签 | 是 | PIL-0014, PIL-0122 |
| PIL-0123 | P2 | E2 | 复刻验收：C09 输入底栏、排队与忙碌操作 | 是 | PIL-0014, PIL-0122 |
| PIL-0124 | P2 | E2 | 复刻验收：C10 提及、路径与斜杠建议 | 是 | PIL-0014, PIL-0122 |
| PIL-0125 | P2 | E2 | 复刻验收：C11 用户长消息气泡与展开 | 是 | PIL-0014, PIL-0126 |
| PIL-0129 | P2 | E2 | 复刻验收：C15 执行记录组与摘要 | 是 | PIL-0014, PIL-0137 |
| PIL-0131 | P2 | E2 | 复刻验收：C17 流式正文／公式／Artifact 光标 | 是 | PIL-0014, PIL-0127, PIL-0143 |
| PIL-0132 | P2 | E2 | 复刻验收：C18 单处微光、新步骤及有限状态动效 | 是 | PIL-0014, PIL-0128, PIL-0130 |
| PIL-0134 | P2 | E2 | 复刻验收：C20 推理强度选择 | 是 | PIL-0014, PIL-0122 |
| PIL-0135 | P2 | E2 | 复刻验收：C21 当前上下文圆环与用量浮层 | 是 | PIL-0014 |
| PIL-0136 | P2 | E2 | 复刻验收：C22 DOM 菜单进入与弹簧曲线 | 是 | PIL-0014 |
| PIL-0138 | P2 | E2 | 复刻验收：C24 列表边缘渐隐 | 是 | PIL-0014 |
| PIL-0139 | P2 | E2 | 复刻验收：C25 完成音与音频设置 | 是 | PIL-0014 |
| PIL-0141 | P2 | E2 | 复刻验收：C27 多图片缩略图与上传排列 | 是 | PIL-0014, PIL-0122, PIL-0126 |
| PIL-0142 | P2 | E2 | 复刻验收：C28 图片灯箱、缩放与共享转场 | 是 | PIL-0014 |
| PIL-0145 | P2 | E2 | 复刻验收：C31 Changes／diff／反馈编辑器 | 是 | PIL-0014, PIL-0010 |
| PIL-0148 | P2 | E2 | 复刻验收：C34 模型章节导航轨与目录 | 是 | PIL-0014, PIL-0137 |
| PIL-0149 | P2 | E2 | 复刻验收：C35 多代理任务面板与真实任务状态 | 是 | PIL-0014, PIL-0050, PIL-0074, PIL-0144 |
| PIL-0151 | P2 | E2 | 复刻验收：C37 限流、重试与错误提示 | 是 | PIL-0014, PIL-0122, PIL-0137 |
| PIL-0152 | P2 | E2 | 复刻验收：C38 New 首页与固定字符光照 | 是 | PIL-0014 |
| PIL-0153 | P2 | E2 | 复刻验收：C39 FileViewer、Source／Preview／Diff 与下载 | 是 | PIL-0014, PIL-0011 |
| PIL-0154 | P2 | E2 | 复刻验收：C40 Context／Environment／Connectors 卡片 | 是 | PIL-0014, PIL-0181 |
| PIL-0155 | P2 | E2 | 复刻验收：C41 标题菜单、Transcript modes 与输出风格 | 是 | PIL-0014, PIL-0169 |
| PIL-0156 | P2 | E2 | 复刻验收：C42 Terminal 标签、工具栏与偏好 | 是 | PIL-0014 |
| PIL-0157 | P2 | E2 | 复刻验收：C43 General 设置与共享设置控件 | 是 | PIL-0014, PIL-0115, PIL-0116, PIL-0117 |
| PIL-0158 | P2 | E2 | 复刻验收：C44 模型配置与提供商凭据界面 | 是 | PIL-0014, PIL-0020 |
| PIL-0159 | P2 | E2 | 复刻验收：C45 MCP 配置、信任与登录 | 是 | PIL-0014 |
| PIL-0160 | P2 | E2 | 复刻验收：C46 Skills 列表、搜索与安装 | 是 | PIL-0014, PIL-0076 |
| PIL-0161 | P2 | E2 | 复刻验收：C47 Plugins／扩展目录与安装控制 | 是 | PIL-0014, PIL-0076 |
| PIL-0162 | P2 | E2 | 复刻验收：C48 子代理配置与 profile 编辑器 | 是 | PIL-0014, PIL-0050 |
| PIL-0163 | P2 | E2 | 复刻验收：C49 定时任务列表、编辑器与历史 | 是 | PIL-0014, PIL-0060 |
| PIL-0164 | P2 | E2 | 复刻验收：C50 数据预览、导入与恢复界面 | 是 | PIL-0014, PIL-0020, PIL-0090 |
| PIL-0165 | P2 | E2 | 复刻验收：C51 受控 Browser pane 与控制条 | 是 | PIL-0014, PIL-0144, PIL-0196 |
| PIL-0166 | P2 | E2 | 复刻验收：C52 托盘、系统通知与关窗状态 | 是 | PIL-0014, PIL-0090, PIL-0111 |
| PIL-0167 | P2 | E2 | 复刻验收：C53 原生文件选择、保存与路径入口 | 是 | PIL-0014, PIL-0011, PIL-0111, PIL-0146 |
| PIL-0168 | P2 | E2 | 复刻验收：C54a 版本入口与更新日志 | 是 | PIL-0014 |
| PIL-0171 | P2 | E2 | 复刻验收：C57 主工具栏溢出菜单 | 是 | PIL-0014, PIL-0180, PIL-0179, PIL-0150, PIL-0169, PIL-0170, PIL-0074 |
| PIL-0174 | P2 | E2 | 复刻验收：C60 Folders 添加与选择弹层 | 是 | PIL-0014, PIL-0173, PIL-0181 |
| PIL-0175 | P2 | E2 | 复刻验收：C61 Run in 运行目标选择 | 是 | PIL-0014, PIL-0173, PIL-0182, PIL-0184 |
| PIL-0176 | P2 | E2 | 复刻验收：C62 环境变量编辑子页 | 是 | PIL-0014, PIL-0173, PIL-0181, PIL-0182 |
| PIL-0190 | P2 | E2 | 复刻验收：C54b 下载、安装、失败与重启界面 | 是 | PIL-0014, PIL-0003, PIL-0110, PIL-0112 |
| PIL-0196 | P2 | E5 | 受控浏览器 pane 桥接契约 | 否 | PIL-0191, PIL-0195 |
| PIL-0198 | P2 | E2 | 复刻验收补采：C02 按钮其余尺寸、变体与交互状态 | 是 | PIL-0116 |
| PIL-0199 | P2 | E2 | 复刻验收补采：C01 主题切换、字体回退、图标与窄窗等状态 | 是 | PIL-0115 |
| PIL-0201 | P2 | E11 | Windows 原生互操作检查：剪贴板、外部编辑器、托盘菜单驱动 | 是 | PIL-0111 |
| PIL-0204 | P2 | E2 | C19 模型菜单补采与原生验收 | 是 | PIL-0133 |
| PIL-0205 | P2 | E2 | C33 侧栏补采与原生验收 | 是 | PIL-0147 |
| PIL-0206 | P2 | E2 | C13 代码块补采与原生验收 | 是 | PIL-0127 |
| PIL-0208 | P2 | E2 | C12 助手正文与操作条补采与原生验收 | 是 | PIL-0014, PIL-0126 |
| PIL-0209 | P2 | E2 | C08 输入器补采与原生验收 | 是 | PIL-0122 |
| PIL-0210 | P2 | E2 | C29 Artifact 预览补采、重试保滚动与原生验收 | 否 | — |
| PIL-0012 | P3 | E2 | 公式流式光标的特殊情形 | 否 | — |
| PIL-0207 | P3 | E2 | C08 分叉发送入口（待用户开启） | 是 | PIL-0122, PIL-0189 |

### 已完成（17）

PIL-0001 接力治理落地与工作树分流；PIL-0113 合入上游 abcwyc main 2026-10-20（desktop 0.7.5）；PIL-0014 把组件复刻基准拆成逐组件任务卡；PIL-0111 Windows 原生验收基线（启动接入、窗口探针、DPI、进程卫生）；PIL-0115 复刻验收：C01 主题、文字与图标；PIL-0116 复刻验收：C02 按钮尺寸与交互状态；PIL-0122 复刻验收：C08 输入器主框与提交控件；PIL-0126 复刻验收：C12 助手正文与消息操作条；PIL-0127 复刻验收：C13 代码块、Mermaid source 与复制反馈；PIL-0180 Windows 保持唤醒能力与退出释放；PIL-0186 修复 relay set done 校验把 depends_on 误报为 unknown；PIL-0187 视觉复刻基准迁移到 Windows Claude Desktop 3.1623.0.0（用户决定）；PIL-0189 在分叉会话中发送（fork-send）；PIL-0197 Windows 托盘 Quit 只隐藏窗口不结束进程；PIL-0133 复刻验收：C19 模型切换菜单；PIL-0147 复刻验收：C33 侧栏项目／会话、搜索、状态及重排；PIL-0177 删除无消费者的 recent-sessions 并把菜单文档改为全走 DOM（用户决定）
<!-- relay:board:end -->
