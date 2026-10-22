---
id: PIL-0001
title: 接力治理落地与工作树分流
epic: E0
priority: P0
status: in_progress
owner: claude-cli:haiku:impl
lease_until: 2026-10-22T12:45Z
branch: task/PIL-0001-relay-bootstrap
implementers: [claude:sonnet-high:impl, claude-cli:haiku:impl]
depends_on: []
files_allowed: [AGENTS.md, CLAUDE.md, scripts/relay.mjs, scripts/relay.test.mjs, .githooks/**, docs/relay/GOALS.md, docs/relay/README.md, docs/relay/RULES.md, docs/relay/STATUS.md, docs/relay/claude/agents/pil-debugger.md, docs/relay/claude/agents/pil-implementer.md, docs/relay/claude/agents/pil-planner.md, docs/relay/claude/agents/pil-reviewer.md, docs/relay/claude/agents/pil-verifier.md, docs/relay/claude/settings.json, docs/relay/claude/skills/relay/SKILL.md, docs/relay/relay.config.json, docs/relay/roles/coordinator.md, docs/relay/roles/implementer.md, docs/relay/roles/planner.md, docs/relay/roles/reviewer.md, docs/relay/roles/verifier.md, docs/relay/tasks/PIL-0001-relay-bootstrap.md, docs/relay/tasks/PIL-0002-test-baseline.md, docs/relay/tasks/PIL-0003-identity-finish.md, docs/relay/tasks/PIL-0010-changes-popout-window.md, docs/relay/tasks/PIL-0011-fileviewer-download.md, docs/relay/tasks/PIL-0012-formula-caret-special.md, docs/relay/tasks/PIL-0013-changes-residuals.md, docs/relay/tasks/PIL-0014-parity-index.md, docs/relay/tasks/PIL-0020-data-credentials.md, docs/relay/tasks/PIL-0030-permission-gate.md, docs/relay/tasks/PIL-0040-controlled-browser.md, docs/relay/tasks/PIL-0050-multi-agent.md, docs/relay/tasks/PIL-0060-scheduled-tasks-grants.md, docs/relay/tasks/PIL-0070-todo-finish.md, docs/relay/tasks/PIL-0071-web-access.md, docs/relay/tasks/PIL-0072-powerline-footer.md, docs/relay/tasks/PIL-0073-plannotator.md, docs/relay/tasks/PIL-0074-background-tasks.md, docs/relay/tasks/PIL-0075-usage-real-account.md, docs/relay/tasks/PIL-0076-extension-management.md, docs/relay/tasks/PIL-0090-lifecycle-recovery.md, docs/relay/tasks/PIL-0100-first-run.md, docs/relay/tasks/PIL-0110-release-pipeline.md, docs/relay/tasks/PIL-0111-windows-native-baseline.md, docs/relay/tasks/PIL-0112-signing-material.md, docs/relay/templates/task.md]
files_shared: []
acceptance_sha: 3be9b931892d
waivers: [R6:user-requested-initial-governance-2026-10-19]
---

## 目标

让仓库进入接力协议可用的状态：治理文件进入集成分支，现有未提交工作完整保存并逐项归属到任务卡，主 checkout 恢复干净。对应 GOALS E0。

## 背景与现状

2026-10-19 主 checkout（`fusion/pi-claude-desktop`，HEAD `2254561`）有约 92 项未提交改动，来自此前会话的八个子 agent（最后修改约在 2026-10-19 06:46 UTC）：一部分已精确暂存（Changes 独立窗口检查点，见 PIL-0010），其余是 web / Plan / permission / footer / background 等扩展的 WIP，以及共享文件（`lib/rpc-manager.ts`、`hooks/useAgentSession.ts`、i18n、打包脚本等）的混合改动。暂存区内容与工作树内容不同（`MM` 文件），两者都要保存。治理文件（本卡 files_allowed）由初始化写入，尚未提交。

## 验收标准

- [ ] A1 治理文件只以本卡 `files_allowed` 中的路径提交到集成分支（`git commit --only`，不带入其他暂存内容）；`node --test scripts/relay.test.mjs` 通过；在本机运行 `node scripts/relay.mjs install-claude` 后 `.claude/agents/` 中有五个 `pil-*` 子 agent，`node scripts/relay.mjs check` 无错误、无 CLAUDE 警告。
- [ ] A2 提交前用独立 index 保存现状，不改动主 checkout 的工作树和暂存区：暂存区树保存为分支 `wip/pre-relay-2026-10-19-index`，工作树（含未跟踪、不含忽略文件）保存为分支 `wip/pre-relay-2026-10-19`。保存前后各导出一次逐路径 blob hash 清单，比对一致。验证：清单与比对输出存入 evidence。
- [ ] A3 快照中的每个改动路径都归属到一张任务卡的 `files_allowed` 或 `files_shared`，映射表存为 evidence 中的 `wip-mapping.md`；无法归属的路径单独列出交给用户决定。
- [ ] A4 经用户明确同意后，主 checkout 恢复干净：`git status --short` 输出为空。恢复前再次核对 A2 的快照完整。
- [ ] A5 `node scripts/relay.mjs install-hooks` 已启用；在临时分支上演示一次含 `test.only(` 的提交被 pre-commit 阻断，随后删除该临时分支。

## 范围外

不判断 WIP 代码是否正确，不修改任何产品代码或测试；各切片的继续开发属于各自任务卡。

## 实现提示

独立 index 快照示例（PowerShell 下改写环境变量语法）：
`GIT_INDEX_FILE=<临时文件> git read-tree HEAD` → `GIT_INDEX_FILE=<临时文件> git add -A` → `git write-tree` → `git commit-tree <tree> -p HEAD -m "wip: pre-relay snapshot"` → `git update-ref refs/heads/wip/pre-relay-2026-10-19 <commit>`。暂存区树直接 `git write-tree`（使用真实 index，不修改它）。恢复主 checkout 涉及删除未跟踪文件，必须先得到用户同意。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |
| A1 | relay*.test 18/18、relay check、hooksPath .githooks、.claude/agents 5 个 | 通过 | D:\pilaude\relay-evidence\PIL-0001\verify\VERIFY.md | 6fb90a4 | claude-cli:sonnet-medium:verify |
| A2 | 两个快照分支 tree 与 preservation 清单逐字节一致 | 通过 | D:\pilaude\relay-evidence\PIL-0001\verify\VERIFY.md | 6fb90a4 | claude-cli:sonnet-medium:verify |
| A3 | wip-mapping 未归属 0（148 归属 + 9 用户裁定归档） | 通过 | D:\pilaude\relay-evidence\PIL-0001\verify\VERIFY.md | 6fb90a4 | claude-cli:sonnet-medium:verify |
| A4 | 主 checkout 干净；用户 2026-10-22 书面追认已记卡日志 | 通过 | D:\pilaude\relay-evidence\PIL-0001\verify\VERIFY.md | 6fb90a4 | claude-cli:sonnet-medium:verify |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
- 2026-10-19T14:07Z · claude:sonnet-high:impl · 领取，租约至 2026-10-19T17:07Z
- 2026-10-19T14:09Z · codex:gpt:coord · 做了：协调者在主 checkout 以独立 index 保存 staged 与 working 两份本地快照，随后仅提交48条治理路径为804d2a2，31条产品暂存blob保持一致。状态：任务worktree已建；A2快照证据在preservation-2026-10-19T14-07-00-781Z，尚未由独立验证者确认；A4未获明确清理同意。下一步：实现者完成路径归属、install检查及hook演示，独立验证后再请用户确认清理。风险：产品WIP和旧证据未完成task归属，不得发布或删除。
- 2026-10-19T14:09Z · codex:gpt:coord · 范围 [AGENTS.md, CLAUDE.md, docs/relay/**, scripts/relay.mjs, scripts/relay.test.mjs, .githooks/**] → [AGENTS.md, CLAUDE.md, scripts/relay.mjs, scripts/relay.test.mjs, .githooks/**, docs/relay/GOALS.md, docs/relay/README.md, docs/relay/RULES.md, docs/relay/STATUS.md, docs/relay/claude/agents/pil-debugger.md, docs/relay/claude/agents/pil-implementer.md, docs/relay/claude/agents/pil-planner.md, docs/relay/claude/agents/pil-reviewer.md, docs/relay/claude/agents/pil-verifier.md, docs/relay/claude/settings.json, docs/relay/claude/skills/relay/SKILL.md, docs/relay/relay.config.json, docs/relay/roles/coordinator.md, docs/relay/roles/implementer.md, docs/relay/roles/planner.md, docs/relay/roles/reviewer.md, docs/relay/roles/verifier.md, docs/relay/tasks/PIL-0001-relay-bootstrap.md, docs/relay/tasks/PIL-0002-test-baseline.md, docs/relay/tasks/PIL-0003-identity-finish.md, docs/relay/tasks/PIL-0010-changes-popout-window.md, docs/relay/tasks/PIL-0011-fileviewer-download.md, docs/relay/tasks/PIL-0012-formula-caret-special.md, docs/relay/tasks/PIL-0013-changes-residuals.md, docs/relay/tasks/PIL-0014-parity-index.md, docs/relay/tasks/PIL-0020-data-credentials.md, docs/relay/tasks/PIL-0030-permission-gate.md, docs/relay/tasks/PIL-0040-controlled-browser.md, docs/relay/tasks/PIL-0050-multi-agent.md, docs/relay/tasks/PIL-0060-scheduled-tasks-grants.md, docs/relay/tasks/PIL-0070-todo-finish.md, docs/relay/tasks/PIL-0071-web-access.md, docs/relay/tasks/PIL-0072-powerline-footer.md, docs/relay/tasks/PIL-0073-plannotator.md, docs/relay/tasks/PIL-0074-background-tasks.md, docs/relay/tasks/PIL-0075-usage-real-account.md, docs/relay/tasks/PIL-0076-extension-management.md, docs/relay/tasks/PIL-0090-lifecycle-recovery.md, docs/relay/tasks/PIL-0100-first-run.md, docs/relay/tasks/PIL-0110-release-pipeline.md, docs/relay/tasks/PIL-0111-windows-native-baseline.md, docs/relay/tasks/PIL-0112-signing-material.md, docs/relay/templates/task.md]：治理初始化已按48条明确路径提交；用现有精确路径取代整个docs/relay通配，避免阻挡独立parity-index任务，权限不扩张
- 2026-10-19T14:10Z · claude:sonnet-high:impl · 复述：目标是把治理和现有WIP分流做成可独立复核的本地交接。A1核对804d2a2仅含48条治理路径、install-claude后五个pil agent和check结果，relay.test由独立预检执行并分开引用；A2沿用协调者已保存的index/working快照与前后逐path blob清单，核对引用不重做不覆盖；A3枚举两份快照相对2254561的全部变更路径，逐条匹配最新任务卡files_allowed/shared，未知单列并提供待审阅清理影响；A4用户未明确同意，禁止恢复删除或清理主checkout并保留31条产品暂存；A5安装hook，在我创建的临时worktree/branch真实提交含test.only的改动并记录阻断后仅清理自己的临时材料。自测只写日志，不写通过证据；结束前运行guard，保留A4未完成并交独立验证。
- 2026-10-19T14:13Z · codex:gpt:coord · 做了：已按用户要求恢复联网扩展、独立窗口、权限与状态三位原owner，仅收恢复交接；独立预检relay.test15项通过，完整日志见bootstrap-precheck，非正式整卡验收。状态：原31条产品暂存保留，两份本地快照已保存；A3归属和A5演示收尾中，A4明确同意未取得。下一步：收当前批次交付，主保存交接并交还租约，然后暂停，不启动新任务。风险：历史文档仍有未归属路径，未验证功能和Windows窗口不提前标完成。
- 2026-10-19T14:16Z · claude:sonnet-high:impl · 做了：完成A1治理48路径范围核对、install-claude五个pil文件逐字节一致和check无错误\CLAUDE警告；只读复核协调者A2两对清单一致与两快照ref\tree未变；A3产出D;\pilaude\relay-evidence\PIL-0001\wip-mapping.md和wip-mapping.json（index31、working157、并集157，148命中、9条历史工程文档未归属）；A5安装hooks并在自建临时worktree\branch真实提交test.only，exit1且BLOCK R3，HEAD不变，自建临时worktree\branch已全部移除，原样输出a5-rejected-commit.log和步骤a5-hook-probe.json。 \ 状态：任务分支最后提交804d2a2，工作树干净，本轮只有本机安装和仓库外自测产物无需源码提交；guard --task PIL-0001 --json exit0、files0、findings空（final-guard.json）。A1的relay.test由独立预检执行，bootstrap-precheck\relay-test.metadata.json和stdout显示exit0、15pass、0fail\skip，未冒作本人运行；relay及test源hash一致，hook仅主LF与worktreeCRLF差异，详见preflight-source-identity.json。A1\A2\A5具备可复核自测，未写任何通过证据；A3不足，A4未运行。 \ 下一步：按用户要求收尾暂停，由协调者精确提交本卡和STATUS并交还todo，保留任务分支及本机证据；后续恢复时先读9条未知清单与原owner迁移材料，独立验证，不以本日志代替正式验收。 \ 风险：A4没有用户明确授权，主checkout未恢复删除clean\reset\restore，31条产品暂存blob仍与index快照一致；cleanup-review.json只是按路径列出的待审阅清理影响，若将来授权会替换主树产品暂存\WIP并移除未跟踪副本，执行前须另存14;07后新增内容且不得覆盖旧快照refs，不动忽略文件\其他worktree\stash；共享命中不代表全部hunk独占归属，9条历史docs需用户或协调者决定。
- 2026-10-19T14:16Z · codex:gpt:coord · in_progress → todo：用户要求本批收尾后暂停；快照、预检和hook演示已保存，A3仍有9条历史文档未归属，A4未获清理同意，保留现场与任务分支
- 2026-10-19T14:19Z · codex:gpt:coord · 路径校正：上一条实现者日志中的反斜杠和D;为终端转义结果。实际证据目录为D:/pilaude/relay-evidence/PIL-0001/，包括wip-mapping.md、wip-mapping.json、cleanup-review.json、a5-hook-probe.json和bootstrap-precheck/relay-test.metadata.json。14:07后新增材料应另存，不能覆盖已有快照。原日志保留，本条为可接续的准确路径。
- 2026-10-22T09:42Z · unknown · 2026-10-22 用户决定：9 条 docs/engineering/** 历史文档标为归档、无需任务卡归属（AGENTS.md 已定为历史档案）；用户书面追认 A4：主 checkout 已恢复干净，旧改动以 wip/pre-relay-2026-10-19 与 -index 快照分支为准。审计见 relay-evidence/PIL-0001/audit-2026-10-22.md。
- 2026-10-22T09:45Z · claude-cli:haiku:impl · 领取，租约至 2026-10-22T12:45Z
- 2026-10-22T09:47Z · claude-cli:haiku:impl · 2026-10-22 用户裁定：9 条 docs/engineering/** 历史档案归档、无需任务卡归属；快照映射未归属数 9→0（证据 D:\pilaude\relay-evidence\PIL-0001\wip-mapping.md）。提交守卫因 files_allowed 不含新增文件被阻断，未提交归档文件；待用户批准 scope 豁免后再提交。
- 2026-10-22T09:53Z · claude-cli:sonnet-medium:verify · 证据 A1：通过
- 2026-10-22T09:53Z · claude-cli:sonnet-medium:verify · 证据 A2：通过
- 2026-10-22T09:53Z · claude-cli:sonnet-medium:verify · 证据 A3：通过
- 2026-10-22T09:53Z · claude-cli:sonnet-medium:verify · 证据 A4：通过
