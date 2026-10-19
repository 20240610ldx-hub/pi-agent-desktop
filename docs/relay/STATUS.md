# Pilaude 当前状态

页首由协调者手写，只写最重要的事；任务板由 `node scripts/relay.mjs status` 生成。

更新：2026-10-19，接力治理初始化。

## 当前里程碑：M0 仓库可接力

先完成 PIL-0001（治理落地、在途 WIP 快照与归属、主 checkout 恢复干净），再做 PIL-0002（Windows 测试基线）。依赖 PIL-0001 的扩展和窗口卡片在此之前不能领取。PIL-0014（复刻基准拆卡）和 PIL-0011 与之无冲突，可以并行。

最新已发布检查点是集成分支上的 `2254561`（Todo 与 subagent alias），不是 installer 发行。

## 需要用户决定

- PIL-0001 A4：同意后才把主 checkout 恢复干净（WIP 已先保存到快照分支）。
- 迁移时按旧验收出口冻结了 11 张卡（任务板"验收已冻结 = 是"），请抽查。
- PIL-0072：`pi-powerline-footer` 的 LICENSE 正文缺口，是否允许进入安装包。
- PIL-0075：可用于真实额度测试的 provider 账户。
- PIL-0112：代码签名证书与更新密钥。

## 任务板（自动生成，勿手改）

<!-- relay:board:start -->
共 25 张任务卡：todo 23 · in_progress 1 · verify 0 · review 0 · done 0 · blocked 0 · parked 1

### 进行中 / 待验证 / 待评审

| ID | 优先级 | 状态 | 标题 | 持有者 | 租约到期 (UTC) | 分支 |
| --- | --- | --- | --- | --- | --- | --- |
| PIL-0001 | P0 | in_progress | 接力治理落地与工作树分流 | claude:sonnet-high:impl | 2026-10-19T17:07Z | task/PIL-0001-relay-bootstrap |

### 阻塞

（无）

### 待办（按优先级；未冻结验收的卡需先由规划者冻结）

| ID | 优先级 | Epic | 标题 | 验收已冻结 | 依赖 |
| --- | --- | --- | --- | --- | --- |
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
