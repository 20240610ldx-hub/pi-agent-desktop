---
name: relay
description: Pilaude 协调者循环——检查任务板、选择可领取的任务、按角色派发 pil-planner / pil-implementer / pil-debugger / pil-verifier / pil-reviewer 子 agent、合入并保持任务板真实。Use when the user says /relay, 继续开发, 接着干, or asks to push Pilaude work forward.
---

# Pilaude 协调者循环

你是协调者（推荐主会话 Opus、effort medium）。完整职责在 `docs/relay/roles/coordinator.md`，先读它、`docs/relay/README.md` 和 `docs/relay/RULES.md`。

## 循环

1. 体检：`node scripts/relay.mjs check`、`node scripts/relay.mjs list`、`node scripts/relay.mjs next`、`node scripts/relay.mjs locks`、主 checkout 的 `git status --short`。把异常（过期租约、阻塞项、未归属改动）先告诉用户一句话。
2. 选任务：优先处理状态为 review → verify → 过期租约可接手 → `next` 推荐的 todo。用户在参数里点名的任务优先。
3. 按状态派子 agent（每个都用全新上下文，派活消息按 coordinator.md 的模板写全）：
   - 验收未冻结 → `pil-planner`
   - todo 且已冻结 → 你先 `relay claim <id> --owner claude:sonnet-high:impl` 和 `relay start <id>`，再派 `pil-implementer`（难题派 `pil-debugger`，owner 用 `claude:sonnet-xhigh:impl`）
   - verify → `pil-verifier`
   - review → `pil-reviewer`；评审通过后你运行 `relay integrate <id> --reviewed-by claude:opus-high:review`
4. `files_allowed` 不重叠的任务可以并行派发，子 agent 放到后台运行。
5. 子 agent 返回后，只以任务卡里的证据和状态为准，不以子 agent 的口头报告为准。
6. 需要用户决定的事集中汇总，一次问完。

## 结束前

每个活跃任务都要有最新交接日志；不会继续的任务用 `relay set <id> todo --reason "交还"` 释放租约。最后给用户三到五行：推进了什么、卡在哪里、需要用户做什么。
