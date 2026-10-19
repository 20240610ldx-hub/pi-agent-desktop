---
id: PIL-0001
title: 接力治理落地与工作树分流
epic: E0
priority: P0
status: in_progress
owner: claude:sonnet-high:impl
lease_until: 2026-10-19T17:07Z
branch: task/PIL-0001-relay-bootstrap
implementers: [claude:sonnet-high:impl]
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

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
- 2026-10-19T14:07Z · claude:sonnet-high:impl · 领取，租约至 2026-10-19T17:07Z
- 2026-10-19T14:09Z · codex:gpt:coord · 做了：协调者在主 checkout 以独立 index 保存 staged 与 working 两份本地快照，随后仅提交48条治理路径为804d2a2，31条产品暂存blob保持一致。状态：任务worktree已建；A2快照证据在preservation-2026-10-19T14-07-00-781Z，尚未由独立验证者确认；A4未获明确清理同意。下一步：实现者完成路径归属、install检查及hook演示，独立验证后再请用户确认清理。风险：产品WIP和旧证据未完成task归属，不得发布或删除。
- 2026-10-19T14:09Z · codex:gpt:coord · 范围 [AGENTS.md, CLAUDE.md, docs/relay/**, scripts/relay.mjs, scripts/relay.test.mjs, .githooks/**] → [AGENTS.md, CLAUDE.md, scripts/relay.mjs, scripts/relay.test.mjs, .githooks/**, docs/relay/GOALS.md, docs/relay/README.md, docs/relay/RULES.md, docs/relay/STATUS.md, docs/relay/claude/agents/pil-debugger.md, docs/relay/claude/agents/pil-implementer.md, docs/relay/claude/agents/pil-planner.md, docs/relay/claude/agents/pil-reviewer.md, docs/relay/claude/agents/pil-verifier.md, docs/relay/claude/settings.json, docs/relay/claude/skills/relay/SKILL.md, docs/relay/relay.config.json, docs/relay/roles/coordinator.md, docs/relay/roles/implementer.md, docs/relay/roles/planner.md, docs/relay/roles/reviewer.md, docs/relay/roles/verifier.md, docs/relay/tasks/PIL-0001-relay-bootstrap.md, docs/relay/tasks/PIL-0002-test-baseline.md, docs/relay/tasks/PIL-0003-identity-finish.md, docs/relay/tasks/PIL-0010-changes-popout-window.md, docs/relay/tasks/PIL-0011-fileviewer-download.md, docs/relay/tasks/PIL-0012-formula-caret-special.md, docs/relay/tasks/PIL-0013-changes-residuals.md, docs/relay/tasks/PIL-0014-parity-index.md, docs/relay/tasks/PIL-0020-data-credentials.md, docs/relay/tasks/PIL-0030-permission-gate.md, docs/relay/tasks/PIL-0040-controlled-browser.md, docs/relay/tasks/PIL-0050-multi-agent.md, docs/relay/tasks/PIL-0060-scheduled-tasks-grants.md, docs/relay/tasks/PIL-0070-todo-finish.md, docs/relay/tasks/PIL-0071-web-access.md, docs/relay/tasks/PIL-0072-powerline-footer.md, docs/relay/tasks/PIL-0073-plannotator.md, docs/relay/tasks/PIL-0074-background-tasks.md, docs/relay/tasks/PIL-0075-usage-real-account.md, docs/relay/tasks/PIL-0076-extension-management.md, docs/relay/tasks/PIL-0090-lifecycle-recovery.md, docs/relay/tasks/PIL-0100-first-run.md, docs/relay/tasks/PIL-0110-release-pipeline.md, docs/relay/tasks/PIL-0111-windows-native-baseline.md, docs/relay/tasks/PIL-0112-signing-material.md, docs/relay/templates/task.md]：治理初始化已按48条明确路径提交；用现有精确路径取代整个docs/relay通配，避免阻挡独立parity-index任务，权限不扩张
