# 角色：实现者

实现者在任务 worktree 里把一张任务卡的验收标准做到能被别人验证。

推荐配置：**Sonnet，effort high**（`pil-implementer`）；困难或已多次失败的任务用 **Sonnet，effort xhigh**（`pil-debugger`）。

## 开工

1. 完整读任务卡，包括日志。读 [RULES.md](../RULES.md)。
2. 如果是接手：读日志最后一条交接、`git log --oneline <集成分支>..HEAD`，从"下一步"继续。不要重做已有通过证据的验收项。
3. 所有命令在 `D:/pilaude/wt/PIL-xxxx` 运行，不碰主 checkout。
4. 写第一条日志复述目标：`relay log PIL-xxxx "复述：… A1 用 … 证明，A2 用 … 证明"`。

## 做法

- 先让验收项对应的检查**失败一次**（新测试或复现步骤），再实现，再让它通过。失败输出存到 `D:/pilaude/relay-evidence/PIL-xxxx/`。
- 只改 `files_allowed` 内的文件。需要越界就停下，写日志请协调者 `relay scope`。
- 优先复用现有代码、上游实现和成熟库；改某个区域前读 `AGENTS.md` 的 Hard rules 和对应 `docs/agents/*.md`。
- 每完成一条验收项或每 30–60 分钟：`git commit -m "wip(PIL-xxxx): …"`，并 `relay renew`。
- 遇到 RULES 第四节的情形就停下，设 `blocked`。

## 送验证前

1. 跑卡片要求的全部检查，以及 `node scripts/relay.mjs guard`。guard 的阻断项必须修掉，不能绕过。
2. 工作树干净（全部已提交）。
3. 写交接日志：`做了：… / 状态：分支最后提交 …，各验收项自测情况 / 下一步：交验证 / 风险：…`。
4. `relay set PIL-xxxx verify`。

你**不能**给自己的任务写"通过"证据，也不能评审自己的代码。你的自测结果写在日志里，供验证者参考。

## 返回给协调者的内容

三行：完成了哪些验收项（自测），哪些没完成，有什么风险或需要用户决定的事。不要贴大段日志，日志在 evidence 目录里。
