# Pilaude 接力协议

这是所有 agent（Claude Code、Codex 或其他工具，不论用哪个订阅）接手 Pilaude 开发的唯一入口。目标是：**任何 agent 在任何时刻中断，另一个 agent 只读仓库就能接着干，而且干的是同一件事。**

## 五分钟上手

1. 读 [GOALS.md](GOALS.md)：产品要做成什么、首发范围、完成的定义。不读这个就会偏离目标。
2. 读 [RULES.md](RULES.md)：诚信规则与禁止事项。违反任何一条，工作作废。
3. 运行 `node scripts/relay.mjs next` 和 `node scripts/relay.mjs list`，再读 [STATUS.md](STATUS.md)。
4. 按你的角色读 `roles/` 下对应文件（[协调者](roles/coordinator.md)、[规划者](roles/planner.md)、[实现者](roles/implementer.md)、[验证者](roles/verifier.md)、[评审者](roles/reviewer.md)）。
5. 改某个区域的代码前，读仓库根 `AGENTS.md` 的 Topic Notes 和对应 `docs/agents/*.md`。
6. 用 Claude Code 时，本机首次运行 `node scripts/relay.mjs install-claude`，把 `docs/relay/claude/` 中的子 agent、`/relay` 技能和权限规则装进 `.claude/`。

## 三个事实来源，各管一件事

| 来源 | 回答的问题 | 谁写 |
| --- | --- | --- |
| `docs/relay/tasks/PIL-xxxx-*.md` 任务卡 | 这件事要做到什么程度、谁在做、做到哪一步、证据是什么 | 只通过 `scripts/relay.mjs` 修改 |
| 任务分支 `task/PIL-xxxx-*` | 代码现在是什么样子 | 实现者，频繁提交 |
| [GOALS.md](GOALS.md) | 为什么做、做成什么才算完 | 用户确认后由规划者修改 |

聊天记录、子 agent 的报告、临时 agent ID 都**不是**事实来源。换线程、换工具、换订阅时，只信这三样。

`docs/engineering/**`、`docs/pilaude-ui-parity.md`、`docs/superpowers/**` 是 2026-10-19 之前的历史档案。任务卡引用到具体段落时才去查，不要再往里追加状态。

## 任务的一生

```
todo ──(规划者 freeze)──▶ 可领取
  │
  └─ claim ─▶ in_progress ─▶ verify ─▶ review ─▶ done
                 │   ▲          │         │
                 ▼   └──────────┴─────────┘ 打回
              blocked / parked
```

| 步骤 | 命令 | 谁 |
| --- | --- | --- |
| 建卡、写验收标准 | `relay new --title … --epic E4 --priority P1 --slug perm-gate` 后编辑卡片 | 规划者 |
| 冻结验收标准 | `relay freeze PIL-0012` | 规划者（最好经用户过目） |
| 领取，拿到 3 小时租约 | `relay claim PIL-0012 --owner claude:sonnet-high:impl` | 实现者 |
| 建 worktree 和分支 | `relay start PIL-0012` → `D:/pilaude/wt/PIL-0012` | 实现者 |
| 工作中续租、写交接日志 | `relay renew PIL-0012`、`relay log PIL-0012 "…"` | 实现者 |
| 提交验证 | `relay set PIL-0012 verify` | 实现者 |
| 逐条记录证据 | `relay evidence PIL-0012 --ac A1 --result 通过 --how "…" --where … --commit … --owner claude:sonnet-high:verify` | 验证者（不能是实现者） |
| 送评审 | `relay set PIL-0012 review` | 验证者 |
| 合入并完成 | `relay integrate PIL-0012 --reviewed-by claude:opus-high:review` | 协调者，在评审者通过后 |

`relay` 是 `node scripts/relay.mjs` 的简写。所有改任务卡的命令都会自动把卡片和 STATUS.md 提交到集成分支 `fusion/pi-claude-desktop`（只提交这两个文件，不碰其他暂存内容）。在任务 worktree 里运行也会写回主 checkout，所以所有 agent 看到的是同一块任务板。

## 工具、模型与标签

| 角色 | Claude Code | Codex 或其他工具 |
| --- | --- | --- |
| 协调者 | 主会话 Opus · effort medium，输入 `/relay` | 主会话，按 `roles/coordinator.md` 执行 |
| 规划者 | `pil-planner`：Opus · high | 最强推理档 |
| 实现者 | `pil-implementer`：Sonnet · high | 默认编码模型 |
| 调试者 | `pil-debugger`：Sonnet · xhigh | 高推理档 |
| 验证者 | `pil-verifier`：Sonnet · high | 默认编码模型，必须是新会话 |
| 评审者 | `pil-reviewer`：Opus · high | 最强推理档 |

持有者标签格式为 `<工具>[-<订阅>]:<模型档>:<角色>`，例如 `claude-maxA:sonnet-high:impl`、`codex-plus:gpt-high:verify`。标签就是 `relay` 判断"验证者不是实现者"的依据，所以不同订阅、不同角色要用不同标签。多个订阅时，最省心的分工是：一个订阅负责实现，另一个订阅（最好是另一个工具）负责验证和评审。

## 中断与接手（换订阅的关键）

订阅额度随时可能用完，所以**中断是常态**。实现者必须做到：

- 每完成一条验收项或每 30–60 分钟，在任务分支上提交一次，信息以 `wip(PIL-xxxx):` 开头。未提交的改动等于不存在。
- 每次停下前写一条交接日志，固定四段：`做了：… / 状态：分支最后提交 abc1234，A1 通过，A2 未开始 / 下一步：… / 风险：…`。
- 租约默认 3 小时。到期没续租，任何 agent 都可以 `claim --takeover` 接手。
- 一个订阅额度用完、来不及释放时，用户或协调者可以立即交还：`relay set PIL-xxxx todo --reason "额度用完，交还" --owner user`，另一个订阅随即 `claim`。

接手者必须先读完卡片的日志、`git log` 任务分支，再继续最后一条"下一步"。不要重新规划，不要重做已有证据的验收项。

## 并行与共享资源

- 同时进行的任务上限为 8（`relay.config.json` 的 `maxActiveTasks`）。`files_allowed` 有重叠的任务不能同时领取，这是防止互相覆盖的主要手段。
- `files_shared` 列出多个任务都需要做少量追加式修改的共享文件（注册一行、加 i18n 键、打包清单）。它们在 guard 中算作范围内，但不参与重叠检查；合入冲突由后合入的实现者在任务分支上解决。不要把大改动放进 `files_shared`。
- 每个任务一个 worktree（`D:/pilaude/wt/PIL-xxxx`）。不要在主 checkout 里直接写功能代码。
- 共享的浏览器预览、桌面窗口、真实模型额度用锁串行：`relay lock preview --owner … --minutes 30`，用完 `relay unlock preview`。锁存在 `.git/relay/locks/`，本机所有 worktree 共享。
- worktree 默认用 junction 共享主 checkout 的 `node_modules`。任务改了 `package.json` 或 lock 文件时，先删掉 junction，再在 worktree 里 `npm ci`。

## 机械检查

| 检查 | 何时运行 | 作用 |
| --- | --- | --- |
| `relay guard` | 实现者送验证前、评审者评审时、`integrate` 自动运行 | 检测删测试、加 skip/only、越出 `files_allowed`、改受保护文件、篡改验收标准、私有素材和密钥 |
| `relay check` | 每次会话开始、合入前 | 校验所有任务卡格式、验收冻结、租约、done 的证据完整性 |
| `.githooks/pre-commit` | 每次提交（`relay install-hooks` 启用后） | 对暂存内容运行 guard |

规则编号和处理方式见 [RULES.md](RULES.md)。

## 写作规范（任务卡与日志）

- 写给一个完全不了解过程的接手者：完整句子，先结论后细节。
- 不写临时 agent ID、不罗列测试累计数、不追状态文档自身的 SHA。证据只写"哪条验收项、什么命令、什么结果、日志在哪、对应哪个提交"。
- 失败照实写。"未运行"和"失败"是合法结果，"大概通过"不是。
