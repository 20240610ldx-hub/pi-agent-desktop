---
id: PIL-0186
title: 修复 relay set done 校验把 depends_on 误报为 unknown
epic: E0
priority: P1
status: review
owner: claude:sonnet-high:impl
lease_until: 2026-10-21T10:25Z
branch: task/PIL-0186-relay-done-deps
implementers: [claude:sonnet-high:impl]
depends_on: []
files_allowed: [scripts/relay.mjs, scripts/relay.test.mjs]
files_shared: []
acceptance_sha: 5ebacb9adefe
waivers: [R6]
---

## 目标

`node scripts/relay.mjs set <id> done` 对写了 `depends_on` 的任务卡能正常标记完成（含 `integrate` 末尾自动调用的 set）。对应 GOALS 中接力协议可用、任务板真实的要求。

## 背景与现状

- `scripts/relay.mjs` 约 780 行，`set` 在 status=done 时调用 `validateCards([单张卡], config)`；`validateCards` 末尾按传入集合构造 `ids` 检查 `depends_on`，单张卡时任何依赖都被报为 `depends_on unknown <id>`。
- 已复现：PIL-0177（depends_on PIL-0113）`integrate` 合并成功（5116910）后 set done 失败，卡片停在 review；`relay check` 全量校验通过。
- 用户 2026-10-21 授权本卡修改受保护文件 `scripts/relay.mjs`／`scripts/relay.test.mjs`（豁免 R6）。

## 验收标准

- [ ] A1 done 前校验在全量卡片集合上进行（被改卡替换为 status=done 版本），只把属于本卡的 error 作为阻断；依赖存在时不再误报，依赖确实不存在时仍报 `depends_on unknown`。验证：`scripts/relay.test.mjs` 新增回归用例覆盖"依赖存在可标 done"与"依赖不存在仍拒绝"，`node --test scripts/relay.test.mjs` 全部通过。
- [ ] A2 done 的其他校验不变：缺通过证据行、验证者是实现者、评审者是实现者仍拒绝。验证：既有相关用例不删不放宽且通过；`git diff` 中不删除任何已有断言。
- [ ] A3 `npm run lint` 通过；`npm test` 相对当前集成基线无新增失败；`node scripts/relay.mjs guard` 除已豁免 R6 外无阻断项。

## 范围外

relay 其他命令的行为调整；PIL-0177 的状态修正（合入后由协调者执行）。

## 实现提示

先读 `docs/relay/RULES.md` 与 `scripts/relay.test.mjs` 中 set/integrate 相关用例的夹具写法；`loadAll(ctx)` 已可加载全部卡片。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |
| A1 | 读 diff：done 前用 loadAll 全量卡片、本卡替换为 done 版，只保留 p.id===本卡 的 error；node --test scripts/relay.test.mjs 17/17 通过；把父提交 6297bf3^ 的 relay.mjs 放进临时副本跑同一测试文件，'依赖存在可标 done' 用例失败(depends_on unknown PIL-0002)，'依赖不存在仍拒绝' 在新旧均通过(回归守卫)。夹具层 | 通过 | D:/pilaude/relay-evidence/PIL-0186/verify/relay-test.txt, D:/pilaude/relay-evidence/PIL-0186/verify/red-on-parent.txt | 6297bf3 | claude:sonnet-high:verify |
| A2 | git diff 6297bf3^ 6297bf3 -- scripts/relay.test.mjs 仅新增 31 行、删除行 0；既有 done 拒绝用例（缺通过证据行/验证者是实现者/评审者是实现者）在 17/17 中全部通过；relay.mjs 中对应校验代码未改。夹具层 | 通过 | D:/pilaude/relay-evidence/PIL-0186/verify/relay-test.txt | 6297bf3 | claude:sonnet-high:verify |
| A3 | npm run lint 退出0；npm test 3576 项 12 失败，失败名全部属于 PIL-0113 基线(A3-fail-baseline.txt)，新增失败 0；node scripts/relay.mjs guard --task PIL-0186 退出0，仅 R6 WAIVED(2 个文件) | 通过 | D:/pilaude/relay-evidence/PIL-0186/verify/lint.txt, D:/pilaude/relay-evidence/PIL-0186/verify/npm-test.txt, D:/pilaude/relay-evidence/PIL-0186/verify/fail-names.txt, D:/pilaude/relay-evidence/PIL-0186/verify/guard.txt | 6297bf3 | claude:sonnet-high:verify |

## 日志
- 2026-10-21T07:25Z · planner · 创建
- 2026-10-21T07:25Z · planner · 冻结验收标准 5ebacb9adefe
- 2026-10-21T07:25Z · claude:opus-medium:planner · 用户 2026-10-21 在对话中选择「开卡修复，豁免 R6」，授权修改 scripts/relay.mjs 与 scripts/relay.test.mjs
- 2026-10-21T07:25Z · claude:sonnet-high:impl · 领取，租约至 2026-10-21T10:25Z
- 2026-10-21T07:32Z · claude:sonnet-high:impl · 做了：set done 改为在 loadAll 全量卡片上校验（本卡替换为 done 版本，仅保留本卡 error），relay.test.mjs 新增 2 个回归用例 / 状态：分支最后提交 6297bf3；A1 自测通过（relay.test 17/17，修复前新增用例红）、A2 既有断言未删改且通过、A3 lint 通过、guard 仅 R6 豁免；npm test 15 失败＝基线 12 同名＋3 个因共享 node_modules 缺 @radix-ui/react-select 的环境失败 / 下一步：验证 / 风险：npm test 的 pretest check:deps 因共享 junction node_modules 与 lock 不符直接失败，我用 --ignore-scripts 跑；那 3 个额外失败与本卡无关，证据在 relay-evidence/PIL-0186/impl/
- 2026-10-21T07:32Z · claude:sonnet-high:impl · in_progress → verify
- 2026-10-21T07:40Z · claude:sonnet-high:verify · 证据 A1：通过
- 2026-10-21T07:40Z · claude:sonnet-high:verify · 证据 A2：通过
- 2026-10-21T07:40Z · claude:sonnet-high:verify · 证据 A3：通过
- 2026-10-21T07:40Z · claude:sonnet-high:verify · verify → review
