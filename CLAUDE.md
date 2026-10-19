@AGENTS.md

## Claude Code 专用

- 本仓库用子 agent 驱动开发。主会话是**协调者**，推荐 `/model opus` + effort medium；输入 `/relay` 进入协调循环（源文件 `docs/relay/claude/skills/relay/SKILL.md`）。
- 子 agent、`/relay` 技能和权限规则的源文件在 `docs/relay/claude/`。首次使用，或 `relay check` 提示过期时，运行 `node scripts/relay.mjs install-claude` 安装到 `.claude/`（该目录不进 git，远程工具也无法写入，必须在本机运行）：

| 子 agent | 模型 / effort | 用途 |
| --- | --- | --- |
| `pil-planner` | opus / high | 写验收标准、拆分任务、冻结任务卡 |
| `pil-implementer` | sonnet / high | 在任务 worktree 中实现 |
| `pil-debugger` | sonnet / xhigh | 难题、根因不明、失败 3 次以上的任务 |
| `pil-verifier` | sonnet / high | 独立逐条验证，写证据（不改代码） |
| `pil-reviewer` | opus / high | 合入前评审（不改代码） |

- 实现与验证、实现与评审必须是不同的子 agent 调用，不能复用同一个上下文。
- 子 agent 的口头报告不是证据；只认任务卡中的证据行和状态。
