---
id: PIL-0203
title: 公开审批服务、入口覆盖清单与未覆盖入口默认拒绝
epic: E4
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0030]
files_allowed: [lib/permission-service*, lib/permission-coverage*, app/api/permissions/**, components/Permission*, e2e/permission-service*.mjs]
files_shared: [lib/rpc-manager*, lib/extension-ui-queue*, lib/project-command-env.ts, lib/i18n/messages/*.ts, components/SettingsPanel.tsx, scripts/fork-ownership.json, app/native-theme.css, docs/pilaude-pi-extensions.md]
acceptance_sha: 61c9439cc0a5
waivers: []
---

## 目标

提供一个公开的“审批服务”，让提问、受控浏览器提交与上传、side chat、环境执行等功能发起的审批都走同一条路径，批准只能被消费一次；并给出入口覆盖清单：每个会执行副作用的入口要么经过授权门，要么默认拒绝，设置页如实显示。对应 [GOALS E4](../GOALS.md)。本卡建立在 PIL-0030 的授权门之上，不替代官方 permission 包的策略判断。

## 背景与现状

审计日期 2026-10-22。主线没有审批服务，也没有覆盖清单。

- 下游卡把本卡当作前置：PIL-0193（受控浏览器审批绑定 task／session／toolCallId、参数摘要与策略版本，批准一次只消费一次，15 分钟未响应过期，“任何一项缺失本卡标 blocked，不自建旁路审批”）、PIL-0188（答案不是授权）、PIL-0179（side chat 继承父授权上限）、PIL-0182（每次工具调用前经 gate，拒绝时进程启动计数为 0）、PIL-0120（决定卡的允许必须对应真实 gate）。
- 官方 permission 包的 `checkPermission(surface, value)` 只查询策略，不发起询问、不消费批准，也不覆盖工具内部动作（例如浏览器表单提交发生在某个浏览器工具内部，外层 `tool_call` 看不到）。所以工具内部审批、`!command` 与环境执行适配器需要宿主侧一个薄的审批服务；策略判断仍调用官方包，不复制规则引擎。
- 已识别的未覆盖入口（旧会话审计，来源 `D:/pilaude/relay-evidence/PIL-0001/recovery-permissions/handoff.md` 与主线代码核对）：
  （2026-10-22 用户确认：`!command` 与 agent 共用同一策略判断，只读命令自动执行，危险命令走审批。）
  1. 用户 `!command`：`lib/rpc-manager.ts` 的 `case "bash"`（约第 1395 行）直接调用 `this.inner.executeBash(...)`，只检查会话是否忙，不走任何 permission gate；官方包也不注册 `user_bash`。
  2. PowerShell：`lib/powershell-settings.ts` 把它当成与 `bash` 互换的 shell 工具名，官方包只把它当通用扩展工具，没有原生 AST 分类。
  3. 扩展内部直接进程、网络（`pi.exec`、Node HTTP）：不会拆成 `tool_call`，属于受信代码边界，不能声称被拦截。
  4. 子代理 child 会话：见 PIL-0202。
- 现有 UI 通道：宿主把扩展的 `select`／`input` 做成 `extension_ui_request`（`lib/rpc-manager.ts`、`lib/extension-ui-queue.ts`），Stop 会拒绝阻塞中的 Promise；决定卡视觉由 PIL-0120 之后接管，本卡复用现有对话框。
- 设置页：`components/SettingsPanel.tsx` 被 PIL-0157 拥有、PIL-0139 共享，本卡只追加一个只读小节（挂载一行）。

## 验收标准

- [ ] A1 服务契约：`lib/permission-service.ts` 导出类型化的公开 API（形状见实现提示），状态放在 `globalThis` 以便热重载存活。`request` 返回批准票据或拒绝原因；`consume` 在票据与实际调用（sessionId、toolCallId、参数摘要、策略版本）全部匹配时原子地消费一次；`guardedExecute(subject, args, run)` 只有在 `consume` 成功后才调用 `run`，否则返回 `executed:false` 与原因，供下游卡使用并充当执行计数点。拒绝原因集合固定为 `denied`、`cancelled`、`timeout`、`revoked`、`replayed`、`mismatch`、`unavailable`、`unknown-entry`。分支到原因码的映射固定为：拒绝 → `denied`；用户取消／Stop 中止／会话关闭 → `cancelled`；超时 → `timeout`；撤权或策略版本变化 → `revoked`；同一票据再次消费 → `replayed`；参数或调用身份不匹配 → `mismatch`；审批通道不可用 → `unavailable`；未登记入口 → `unknown-entry`；迟到回复（票据已因取消或超时结束）忽略并保持原结束原因。测试按此映射逐分支断言原因码。验证：`node --experimental-strip-types --test lib/permission-service.test.mjs`，用例逐个覆盖：批准后 `run` 调用数恰为 1；拒绝、取消（Stop 或 AbortSignal）、超时（可注入时钟，默认 15 分钟另断言）、撤权（`revoke` 作用于待批与已批未消费的票据）、重放（同一票据第二次 `consume`）、参数摘要改变（同一 toolCallId 参数被改）、策略版本改变（待批期间磁盘策略被改）、会话已关闭——每个分支 `run` 调用数均为 0，且返回上述映射规定的原因码（映射到同一码的分支共用该码，不同码的分支必须可区分）；并发两路 `consume` 同一票据恰有一路成功；迟到的批准回复在取消或超时之后被拒绝。
- [ ] A2 无人值守与不可用：没有 UI 订阅者（后台任务、定时任务、隐藏窗口且无通知通道）时，需要批准的请求立即以 `unavailable` 拒绝而不是挂起，并留下“需要关注”可读状态；官方 permission 包或 service 不可用时（A1 的 PIL-0030 fail-closed 条件）`request` 一律 `unavailable`。验证：同上测试文件的无订阅者与不可用用例；`guardedExecute` 在这两种情况下 `run` 调用数为 0。
- [ ] A3 与官方包与真实会话的衔接：审批请求经现有 `extension_ui_request` 通道展示（包含入口 ID、动作类别、已脱敏的参数摘要，不显示页面内容里的指令当批准依据），用户批准、拒绝、取消各自对应服务的一种结果；策略判断（allow／ask／deny）来自官方 `getPermissionsService(sessionId).checkPermission`，deny 时不弹窗直接拒绝。验证：`node --experimental-strip-types --test lib/permission-service.integration.test.mjs`（新增）经 `startRpcSession` 创建会话，用 faux provider 触发一个通过 `guardedExecute` 的计数型扩展工具，覆盖 ask→批准一次、ask→拒绝、policy deny、会话 Stop 四种情形，计数分别为 1、0、0、0。
- [ ] A4 入口覆盖清单与默认拒绝：`lib/permission-coverage.ts` 导出唯一的入口登记表，每项含入口 ID、状态（`gated`、`denied-by-default`、`uncovered`、`trust-boundary`）、说明与对应测试名；至少登记：模型直接工具调用、codemode 嵌套 `ctx.executeTool`、MCP 直接与嵌套、用户 `!command`、PowerShell、定时任务会话、子代理 child 会话（本卡不改 `lib/subagent-runtime.ts`，如实登记为 `uncovered`，说明“由 PIL-0202 接入”，设置页同样如实显示未覆盖，不得声称默认拒绝；PIL-0202 完成后改为 `gated`）、扩展内部直接进程与网络（`trust-boundary`，如实写明不被拦截）。任何通过 `executeUncovered(id, run)` 执行但未登记或状态不是 `gated` 的入口一律拒绝（`unknown-entry`）。`!command` 改为：先按官方策略判断（allow 直接执行，ask 走审批，deny 拒绝），服务不可用则拒绝，不再直接调用 `executeBash`；PowerShell 按通用工具对待，默认 ask，不被 Bash 语法规则自动放行。验证：`node --experimental-strip-types --test lib/permission-coverage.test.mjs` 断言每个登记项的状态与其测试一致，并扫描 `lib/**/*.ts`：除登记过的经服务路由的位置外不存在直接调用 `executeBash(` 或会话级命令执行的新增位置；`!command` 用标记文件做执行 spy：授权项目中的只读命令成功，`rm`、项目外路径、任意脚本在批准前标记文件不出现，拒绝与取消后仍不出现，批准一次后出现一次；Windows 上 PowerShell 工具开启时同样验证。
- [ ] A5 设置页说明：只读接口 `GET /api/permissions/coverage` 返回登记表（不含密钥与路径之外的隐私），设置页新增一个只读小节“执行前授权覆盖范围”，列出每个入口、状态与一句话说明，其中被拒绝的入口和信任边界的入口有明确文案；英文、简体、繁体三语齐全。验证：`node --experimental-strip-types --test app/api/permissions/route.test.mjs components/PermissionCoverageNotice.test.mjs` 通过；浏览器中 1280×800 下英文与简体中文设置页截图各一张并读过，另用窄宽（390 px）截图确认无横向溢出；接口无需桌面 token 之外的新认证面，并沿用现有请求安全。
- [ ] A6 收尾：A1–A5 涉及的测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0203` 通过，guard 无未豁免阻断项；`lib/rpc-manager*.test.mjs` 与 `components/SettingsPanel*.test.mjs` 用例数不少于改动前；服务契约测试以可复用的 `runApprovalContract(adapter)` 导出，供 PIL-0188、PIL-0193、PIL-0179 在各自适配器上复跑。

## 范围外

官方 permission 包的接入与普通会话授权门本体（PIL-0030）；child 与子代理的授权上限（PIL-0202）；浏览器的具体审批卡片、origin 授权与上传（PIL-0193）；决定卡与提问卡的视觉（PIL-0120）；Auto 与 Bypass 模式；定时任务的授权设置界面（PIL-0060）；拦截扩展内部直接进程或网络（只登记为信任边界）；把批准持久化成长期授权（本卡的批准都是一次性的，项目级持久授权由各使用方卡自己定义并存储）。

## 实现提示

- 先读 AGENTS.md Hard rules、`docs/agents/sessions.md` 与 `fork-sessions.md` 中扩展 UI 与 Stop 的部分，以及 PIL-0193 背景中对审批语义的要求（本卡必须满足它列的三项前提）。
- 建议形状（实现者可调整命名，行为不可削弱）：

```ts
type Refusal = "denied" | "cancelled" | "timeout" | "revoked" | "replayed" | "mismatch" | "unavailable" | "unknown-entry";
interface ApprovalSubject { sessionId: string; toolCallId: string; parentToolCallId?: string; entry: string; kind: string; summary: string }
interface ApprovalService {
  request(subject: ApprovalSubject, args: unknown, opts?: { timeoutMs?: number; signal?: AbortSignal }): Promise<{ ok: true; ticket: string; policyVersion: string } | { ok: false; refusal: Refusal }>;
  consume(ticket: string, actual: { sessionId: string; toolCallId: string; args: unknown }): { ok: true } | { ok: false; refusal: Refusal };
  guardedExecute<T>(subject: ApprovalSubject, args: unknown, run: () => Promise<T>, opts?: { timeoutMs?: number; signal?: AbortSignal }): Promise<{ executed: true; value: T } | { executed: false; refusal: Refusal }>;
  revoke(scope: { sessionId?: string; ticket?: string }): number;
  policyVersion(sessionId: string): string;
}
```

  参数摘要由服务对规范化 JSON 计算 SHA-256，不信任调用者给的摘要；展示用 `summary` 须已脱敏；策略版本取有效策略文件与会话授权修订的哈希，策略一变就变。
- `!command` 路由改动在 `lib/rpc-manager.ts` 的 `case "bash"` 与 `lib/project-command-env.ts`（后者仅在需要时），保持 `chatWorkspace` 禁用 shell 的既有行为。
- 仓库内目前没有 `app/api/permissions/**`、`components/Permission*`，新文件按 fork-ownership 登记。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-22T00:00Z · claude:sonnet-high:planner · 做了：由 PIL-0030 的“公开审批服务、未覆盖入口默认拒绝、设置页说明”拆出本卡，约束取自 PIL-0193/0188/0179/0182/0120 对前置的要求。状态：未冻结。下一步：协调者审阅后 freeze；上述下游卡的 depends_on 需加入本卡。风险：官方包如何在不 fork 的情况下与服务衔接（authorizer 链或 UI 桥）需实现者先在日志写明；`!command` 是否沿用“授权项目内只读命令自动执行”需用户确认。
- 2026-10-22T03:35Z · planner · 冻结验收标准 61c9439cc0a5
