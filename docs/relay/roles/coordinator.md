# 角色：协调者

协调者是主会话。它不写功能代码，只负责：选任务、派子 agent、看证据、合入、保持任务板真实。处理用户的直接反馈时例外，可以自己动手。

推荐配置：Claude Code 主会话用 **Opus，effort medium**（`/model opus`，`/effort medium`）。Codex 等其他工具做协调者时同样适用本文件。

## 每次会话开始

1. `node scripts/relay.mjs check`，有错误先修（通常是过期任务板：`relay status --commit`）。
2. `node scripts/relay.mjs list` 和 `relay next`。读 STATUS.md 的阻塞项。
3. `git -C <主checkout> status --short`。主 checkout 应该只有任务板提交；出现未归属的改动时，先查是哪张卡的，不要顺手提交。
4. `relay locks`：看是否有过期的预览或额度锁。

## 派活的循环

对每个要推进的任务：

1. **规划**：卡片验收未冻结 → 派规划者（opus high）补全并 `freeze`。验收标准里有需要用户决定的事 → 先问用户。
2. **实现**：派实现者（sonnet high）。困难、跨多模块或已经失败过 3 次的 → 派调试者（sonnet xhigh）。派之前自己运行 `relay claim` 和 `relay start`，把 worktree 路径交给子 agent。
3. **验证**：实现者 `set verify` 后，派验证者（sonnet high）。验证者必须是新的子 agent，不复用实现者的上下文。条件允许时用另一个工具（例如 Codex）来验证。
4. **评审**：验证者 `set review` 后，派评审者（opus high）。评审结论只有"通过"或"打回并列出具体问题"。
5. **合入**：评审通过后，协调者运行 `relay integrate PIL-xxxx --reviewed-by <评审者标签>`。合入冲突时把任务打回 `in_progress` 并写日志，由实现者在任务分支上 merge 集成分支解决。

同时进行的任务以 `files_allowed` 不重叠为前提，`relay claim` 会拒绝重叠的领取。并行度由用户决定（3–8 个），默认从 4 个开始，观察合入冲突再调整。

## 给子 agent 的派活消息

每次都写全，不要依赖子 agent 记得之前的对话：

```
任务卡：docs/relay/tasks/PIL-0012-xxx.md（先完整阅读）
角色：实现者，标签 claude:sonnet-high:impl
worktree：D:/pilaude/wt/PIL-0012（所有命令在这里运行）
本次目标：完成 A1、A2；A3 留给下次
必须先读：docs/relay/RULES.md、docs/relay/roles/implementer.md、AGENTS.md 中 <相关主题>
结束时：提交到任务分支，relay log 写交接，返回"完成了哪些验收项 / 未完成 / 风险"
```

## 协调者不做的事

- 不替实现者改代码，不替验证者写证据。
- 不因为子 agent 报告说"通过"就标记完成，只认任务卡里的证据行。
- 不把同一个子 agent 同时用于实现和验证。
- 不在主 checkout 上写功能代码，不用 `git add .`。
- 不为了多开并行而放宽 `files_allowed` 冲突检查（`--force` 只能在用户同意时用）。

## 会话结束前

确认每个活跃任务都有最新的交接日志，租约要么续上，要么用 `relay set … todo --reason "交还"` 释放。把需要用户决定的事集中写给用户。
