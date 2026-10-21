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
共 26 张任务卡：todo 24 · in_progress 1 · verify 0 · review 0 · done 0 · blocked 0 · parked 1

### 进行中 / 待验证 / 待评审

| ID | 优先级 | 状态 | 标题 | 持有者 | 租约到期 (UTC) | 分支 |
| --- | --- | --- | --- | --- | --- | --- |
| PIL-0113 | P0 | in_progress | 合入上游 abcwyc main 2026-10-20（desktop 0.7.5） | claude:sonnet-xhigh:impl | 2026-10-21T07:29Z | task/PIL-0113-upstream-0-7-5 |

### 阻塞

（无）

### 待办（按优先级；未冻结验收的卡需先由规划者冻结）

| ID | 优先级 | Epic | 标题 | 验收已冻结 | 依赖 |
| --- | --- | --- | --- | --- | --- |
| PIL-0001 | P0 | E0 | 接力治理落地与工作树分流 | 是 | — |
| PIL-0002 | P0 | E0 | 建立可信的测试基线并逐项登记已知失败 | 是 | — |
| PIL-0010 | P1 | E2 | Changes 面板在独立 Windows 窗口打开 | 是 | PIL-0001 |
| PIL-0014 | P1 | E2 | 把组件复刻基准拆成逐组件任务卡 | 是 | — |
| PIL-0030 | P1 | E4 | 统一执行前授权并接入 pi-permission-system | 是 | PIL-0001 |
| PIL-0040 | P1 | E5 | 受控浏览器 | 否 | PIL-0030 |
| PIL-0050 | P1 | E6 | 多代理完整流程与 pi-subagents 适配 | 否 | PIL-0030 |
| PIL-0071 | P1 | E8 | pi-web-access 接入普通会话 | 是 | PIL-0001 |
| PIL-0072 | P1 | E8 | pi-powerline-footer 状态行接入并修复短窗叠字 | 是 | PIL-0001 |
| PIL-0073 | P1 | E8 | Plannotator 计划审阅接入 | 是 | PIL-0001 |
| PIL-0074 | P1 | E8 | pi-background-tasks 接入界面与普通会话 | 是 | PIL-0001 |
| PIL-0100 | P1 | E10 | 首次使用引导：不开终端完成第一个真实任务 | 否 | — |
| PIL-0111 | P1 | E11 | Windows 原生验收基线 | 否 | — |
| PIL-0003 | P2 | E1 | 产品与更新身份收尾核验 | 否 | — |
| PIL-0011 | P2 | E2 | 查清并修复 FileViewer 窄 pane 下载被取消 | 是 | — |
| PIL-0013 | P2 | E2 | Changes 面板剩余交互与视觉残差 | 否 | PIL-0010 |
| PIL-0020 | P2 | E3 | 本地数据隔离与凭据加密验收 | 否 | — |
| PIL-0060 | P2 | E7 | 定时任务接入授权与浏览器 | 否 | PIL-0030 |
| PIL-0070 | P2 | E8 | Todo 扩展收尾：GUI 全链与干净安装 | 是 | PIL-0001 |
| PIL-0075 | P2 | E8 | pi-usage 真实账户额度验证 | 否 | — |
| PIL-0076 | P2 | E8 | 扩展安装、启停、卸载与回退 | 否 | — |
| PIL-0090 | P2 | E9 | 生命周期与崩溃恢复 | 否 | — |
| PIL-0110 | P2 | E11 | 发布检查器与 Windows 安装包流水线 | 否 | — |
| PIL-0012 | P3 | E2 | 公式流式光标的特殊情形 | 否 | — |

### 已完成（0）

（无）
<!-- relay:board:end -->
