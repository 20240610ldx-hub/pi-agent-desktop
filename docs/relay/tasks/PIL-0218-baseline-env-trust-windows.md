---
id: PIL-0218
title: 修复 Windows 下 PATH 键与 project-trust 隔离主目录测试
epic: E0
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0002]
files_allowed: [lib/project-command-env.ts, lib/project-command-env.test.mjs, lib/project-trust.ts, lib/project-trust.test.mjs]
files_shared: []
acceptance_sha:
waivers: []
---

## 目标

让下列 Windows 基线失败用例通过且不引入新失败，使 `npm test` 基线可信（GOALS E11 Windows 基线）。

## 背景与现状

来源：PIL-0002 基线文档 `docs/relay/test-baseline.md`（证据 `D:/pilaude/relay-evidence/PIL-0002/impl/npm-test-bounded-cache.log`）。

- 失败测试：direct bash updates the platform PATH key；the fresh check also counts links to nothing, which existsSync skips；a fresh folder that holds a project with no decision is never trusted by the step
- 测试文件：lib/project-command-env.test.mjs、lib/project-trust.test.mjs
- 原因与归类：project-command-env：`PATH` 分隔符期望 `;` 实得 `:`（实得 `D:\pilaude\wt\PIL-0002\.test-agent\bin:/usr/bin`，日志见 `npm-test-bounded-cache.log`），Windows 平台假设；project-trust：`true !== false`，"the user's own ~/.agents/skills" 与 "the folder itself needs no trust"，测试读到真实 `~/.agents/skills` 而非隔离主目录。三个用例在 upstream 同样失败。归类：既有缺陷（上游同样失败）+ 环境（依赖用户真实主目录）。
- 复现：`node --test <测试文件>`

## 验收标准

- [ ] A1 上列失败测试全部通过。验证：对 lib/project-command-env.test.mjs、lib/project-trust.test.mjs 逐个运行 `node --test <文件>` 退出码 0。
- [ ] A2 `npm test` 相对 PIL-0002 基线无新增失败，且基线中属本卡的用例消失。验证：全量运行并与基线文档对比失败名单。
- [ ] A3 不删除、跳过或放宽任何断言；`npm run lint`、`node_modules/.bin/tsc --noEmit` 通过；`node scripts/relay.mjs guard` 无阻断项。

## 范围外

基线文档列出的其他失败用例；与上述用例无关的重构。

## 实现提示

使 PATH 构造在 Windows 与 POSIX 下均按平台分隔符；使 project-trust 测试使用隔离主目录（经 `userHome()` 注入），不依赖开发机真实 `~/.agents`。不得放宽断言。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T11:19Z · planner · 创建
- 2026-10-22T11:30Z · claude-cli:sonnet-medium:impl · 由 PIL-0002 基线 A4 转出，写入目标、背景与验收（未冻结）
