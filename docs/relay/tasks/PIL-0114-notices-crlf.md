---
id: PIL-0114
title: 修复 THIRD_PARTY_NOTICES 许可声明测试（CRLF 与 rpiv-todo From 块）
epic: E0
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0113]
files_allowed: [THIRD_PARTY_NOTICES.md, .gitattributes, scripts/generate-third-party-notices*, scripts/release-workflows.test.mjs]
files_shared: []
acceptance_sha:
waivers: []
---

## 目标

`scripts/release-workflows.test.mjs` 中 "the diff renderer notice retains exact installed licenses…" 在 Windows（`core.autocrlf=true`）检出下通过，安装包里的第三方许可声明完整。对应 GOALS「保留 MIT 许可和上游署名」与 E11 Windows 基线。

## 背景与现状

PIL-0113 验证者发现：合并前 `11df970` 与合并后 `8389681` 同样失败。两层原因：`THIRD_PARTY_NOTICES.md` 检出成 CRLF，测试正则 0 命中；归一化为 LF 后，rpiv-todo 的许可条目仍缺 From 块。证据：`D:/pilaude/relay-evidence/PIL-0113/verify/`。

## 验收标准

- [ ] A1 `THIRD_PARTY_NOTICES.md` 的 rpiv-todo 条目包含与已安装包一致的 From 块与许可全文（由生成脚本产出，而非手写；若无生成脚本则说明来源并逐字核对已安装包的 LICENSE）。
- [ ] A2 在 `core.autocrlf=true` 的全新 Windows 检出中，`node --test scripts/release-workflows.test.mjs` 全部通过；修复方式为 `.gitattributes` 固定换行或测试按换行无关方式读取，不得删除或放宽断言内容。
- [ ] A3 `npm test` 相对 PIL-0113 合入后的基线无新增失败；`node scripts/relay.mjs guard` 无阻断项。

## 范围外

其他第三方包许可内容的更新。

## 实现提示

先读仓库根 AGENTS.md 与 `scripts/release-workflows.test.mjs` 中该用例的断言；修改 `.gitattributes` 后需 `git add --renormalize` 相关文件。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-21T05:30Z · planner · 创建
- 2026-10-21T05:31Z · claude:opus-medium:planner · 由 PIL-0113 验证发现的基线失败转出（用户同意修订 PIL-0113 A2 并另开此卡）。
- 2026-10-21T05:25Z · claude:opus-medium:planner · 写入目标、背景与验收（未冻结）
