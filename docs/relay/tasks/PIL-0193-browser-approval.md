---
id: PIL-0193
title: 受控浏览器提交/上传/导航审批门
epic: E5
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0192, PIL-0030]
files_allowed: [lib/managed-browser-approval*.ts, lib/managed-browser-approval*.test.mjs, lib/managed-browser-origins*.ts, e2e/managed-browser-approval*.mjs, app/api/browser/approval/**]
files_shared: [lib/managed-browser-tools.ts, components/Permission*, lib/i18n/messages/*.ts, lib/types.ts]
acceptance_sha:
waivers: []
---

## 目标

受控浏览器的副作用动作都先取得用户逐次审批：提交表单、上传文件、发起下载、导航到未授权域名；未审批时提交与上传的真实发生数为 0。域名授权为项目级，首次访问某域名需审批。对应 [GOALS](../GOALS.md) E5「未审批的提交和上传计数为 0」。用户 2026-10-21 决定：域名授权项目级、首次访问审批，提交/上传逐次审批。

## 背景与现状

- [Spec 第 9 节](../../superpowers/specs/2026-10-16-pilaude-spec.md)：观察授权不等于上传或提交；审批等待不重复动作；登录与验证码由用户处理，不读密码框。[Spec 第 6 节](../../superpowers/specs/2026-10-16-pilaude-spec.md)：审批绑定 task/session/tool-call、参数摘要和策略版本，批准一次只消费一次，15 分钟无响应标记过期。
- 浏览器副作用的语义（点击会否提交、表单 action、是否文件输入）只有工具在看到目标元素后才知道，所以需要工具内审批，而不只是 `tool_call` 外层拦截；二者并存。
- PIL-0030 必须先提供：①普通 coding 会话授权门真实生效并有执行计数 spy；②供扩展/工具内部发起审批的公开服务（绑定 toolCallId + 参数摘要 + 策略版本，一次性消费，重放/超时/撤权/取消均拒绝）；③未覆盖入口默认拒绝，子代理/MCP/定时任务同门。任何一项缺失，本卡标 blocked，不自建旁路审批。
- 工具与会话由 PIL-0192 提供；本卡只加分类与审批，不改工具表面。

## 验收标准

- [ ] A1 本地测试站点配 POST 计数器：未批准时，点击 submit 按钮、在表单内按 Enter、脚本 `form.submit()` 三条路径，服务端收到请求数均为 0；`<input type=file>` 经工具设置文件，上传字节数为 0。验证：`e2e/managed-browser-approval*.mjs` 输出计数。
- [ ] A2 批准后恰好执行一次；拒绝、取消、15 分钟超时、撤权、重放已消费审批、动作参数改变（表单 action URL、文件路径、目标元素）后复用旧审批，均不执行且计数不变。验证：逐项执行计数测试。
- [ ] A3 域名授权项目级：首次访问新 origin 发起审批，批准后同项目同 origin 不再询问，换项目仍需审批；拒绝后同轮不重复弹窗；撤销授权后下一次访问重新审批。授权记录持久化且不含 cookie 或页面内容。验证：持久化与多项目测试。
- [ ] A4 密码类输入：对 `type=password` 的 type 动作被拒绝且返回「请用户接管登录」，工具读不到其值；快照中该字段值被省略。验证：含登录表单的本地站点测试。
- [ ] A5 子代理与定时任务发起的同类动作经同一审批门，未审批计数为 0；审批卡展示目标 origin、动作类别、元素描述与参数摘要，不展示页面内容里的指令当作批准依据。验证：执行 spy + 界面状态断言。
- [ ] A6 受影响测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint` 通过；`node scripts/relay.mjs guard --task PIL-0193` 无阻断项。

## 范围外

下载落盘审批的路径处理与下载取消（PIL-0194）；接管与恢复（PIL-0195）；绕过网站登录、验证码或付费限制；自动批准、「永远允许」；Cookie 导入。

## 实现提示

- 先读 `docs/agents/tools.md`、PIL-0030 卡与其交接日志，确认可调用的审批服务接口名；不改 PIL-0030 的 files_allowed 文件，需要新接口先找规划者。
- 动作分类放在工具内、页面内查询（按钮 type、所属 form、`formAction`、method），分类不确定时按「会提交」处理，宁可多问。
- 审批卡类型在 `components/Permission*` 中只追加，不改既有卡。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-21T12:28Z · planner · 创建
- 2026-10-21T12:40Z · claude:sonnet-high:planner · 填写目标/验收（由 PIL-0040 拆出）；依赖 PIL-0030 的内部审批服务；未冻结，待规划者评审后 freeze。
