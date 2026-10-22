# Windows test baseline (PIL-0002)

Captured 2026-10-22 in the PIL-0002 worktree on Windows PowerShell. This is a
record of the current baseline, not a claim that the suite is green. No test or
product code was changed for this capture.

## Commands and results

| Check | Command | Result | Full output |
| --- | --- | --- | --- |
| Dependency consistency | `npm run check:deps` | exit 0 (1.8s) | `D:/pilaude/relay-evidence/PIL-0002/impl/check-deps.log` |
| TypeScript | `node_modules/.bin/tsc --noEmit` | exit 0 (14.3s) | `D:/pilaude/relay-evidence/PIL-0002/impl/tsc.log` |
| Lint | `npm run lint` | exit 0; 0 errors, 2 warnings (35.8s) | `D:/pilaude/relay-evidence/PIL-0002/impl/lint.log` |
| Full suite (A1 capture) | `npm test` (foreground; `NPM_CONFIG_CACHE` points to evidence directory) | exit 1; 3641 tests, 3608 pass, 14 fail, 19 skipped; elapsed 10m 57.7s. The 14 "fail" = the 12 baseline names + the intermittent MermaidBlock timeout (below, not baseline) + 1 file-level count | `D:/pilaude/relay-evidence/PIL-0002/impl/npm-test.log` |
| Full suite (A2 bounded capture) | `npm test -- --test-timeout=1800000` (foreground; external `NPM_CONFIG_CACHE`) | exit 1; 3641 tests including nested subtests, 3610 pass, 12 fail, 19 skipped; elapsed 5m 3.5s; all 12 failures match the baseline list | `D:/pilaude/relay-evidence/PIL-0002/impl/npm-test-bounded-cache.log` |
| Bounded run without external npm cache | `npm test -- --test-timeout=1800000` | exit 1; 13 failures, including one additional npm log/cache permissions failure; do not use as the baseline | `D:/pilaude/relay-evidence/PIL-0002/impl/npm-test-bounded.log` |
| Mermaid browser fixture follow-up | `node --test components/MermaidBlock.test.mjs` | exit 0; 21/21 pass | `D:/pilaude/relay-evidence/PIL-0002/impl/mermaid-targeted.log` |

Lint warnings: `components/TerminalPanel.tsx:217` (`aria-description` on an
implicit region) and `lib/fork-send.test.mjs:4` (unused `mkdir` import).

## Known full-suite failures

12 failures were recorded on 2026-10-22. **PIL-0137 has since fixed the
branch-summary-guard fixture (row 8; re-run in this worktree on current fusion:
4/4 pass), so the current baseline is 11 failures.** Each row appears in both
full-suite runs with a usable npm cache and in the PIL-0133 verify baseline's
12-name list. Reproduction is `node --test <file>` from the repository root.

Categories: **环境** (depends on machine, OS or checkout), **既有缺陷** (test or
product defect not caused by a fork change; includes fork-only tests that
drifted from the implementation), **fork 回归** (passes on upstream/main, fails
on this fork). "Log first line" is the first assertion line in
`impl/npm-test-bounded-cache.log`.

| # | Test | File | Category | Log first line | upstream/main | Fix card | Reproduction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | every CSS variable read without a fallback is defined somewhere | `app/css-variables.test.mjs` | fork 回归 | `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal` (actual `['--shadow-md','--shadow-sm']`, expected `[]`) | passes | PIL-0213 | `node --test app/css-variables.test.mjs` |
| 2 | desktop-only workspace and health behavior is gated before use | `components/AppShell-session-reset.test.mjs` | fork 回归 | `The input did not match the regular expression /desktopMode \? getPrefJson<PersistedWorkspace>/` | passes | PIL-0214 | `node --test components/AppShell-session-reset.test.mjs` |
| 3 | workspace visibility restores independently of file or terminal tabs | `components/AppShell.terminal.test.mjs` | 既有缺陷 (fork-only test drifted from implementation) | `The input did not match the regular expression /if \(workspacePanesRestored\) setPrefJson\(APP_PREF_KEYS\.workspacePaneVisibility, rightPanelOpen\)/` | 上游无此测试 (file exists upstream with 2 other cases, which pass) | PIL-0214 | `node --test components/AppShell.terminal.test.mjs` |
| 4 | desktop catalogue shows eight reviewed packages and offers only four optional source choices | `components/RecommendedPiExtensions.test.mjs` | 既有缺陷 (fork-only test) | `Expected values to be strictly equal: 3 !== 4` | 上游无此测试 (file absent) | PIL-0215 | `node --test components/RecommendedPiExtensions.test.mjs` |
| 5 | uses the child-session robot glyph for the sub-agents tab | `components/SettingsPanel.test.mjs` | fork 回归 | `The input did not match the regular expression /<rect x="5" y="7" width="14" height="11" rx="2" \/>…/` | passes | PIL-0215 | `node --test components/SettingsPanel.test.mjs` |
| 6 | session rows keep the action menu reachable on touch devices | `components/sidebar-and-message-updates.test.mjs` | fork 回归 | `The input did not match the regular expression /hovered \|\| treeFocused \|\| touchMode \|\| menuOpen \?/` | passes (both tests) | PIL-0216 | `node --test components/sidebar-and-message-updates.test.mjs` |
| 7 | interrupted tool calls render a cancelled marker instead of success styling | `components/sidebar-and-message-updates.test.mjs` | fork 回归 | `The input did not match the regular expression /aborted=\{!isStreaming && !result\}/` | passes (both tests) | PIL-0216 | same file as row 6 |
| 8 | a summary still running for the previous session does not lock branch switches in the next | `hooks/useAgentSession.branch-summary-guard.test.mjs` | 既有缺陷 (fixture); **已由 PIL-0137 修复** | `ReferenceError: todoBranchSelectionRef is not defined` | passes | none needed (PIL-0137; PIL-0217 parked) | `node --test hooks/useAgentSession.branch-summary-guard.test.mjs` |
| 9 | direct bash updates the platform PATH key | `lib/project-command-env.test.mjs` | 既有缺陷 + 环境 (Windows PATH separator) | `Expected values to be strictly deep-equal` (`PATH` joined with `:`, expected `;`) | fails identically | PIL-0218 | `node --test lib/project-command-env.test.mjs` |
| 10 | the fresh check also counts links to nothing, which existsSync skips | `lib/project-trust.test.mjs` | 既有缺陷 + 环境 (reads the real `~/.agents/skills`) | `the user's own ~/.agents/skills` (`true !== false`) | fails identically (both tests) | PIL-0218 | `node --test lib/project-trust.test.mjs` |
| 11 | a fresh folder that holds a project with no decision is never trusted by the step | `lib/project-trust.test.mjs` | 既有缺陷 + 环境 (same cause as row 10) | `the folder itself needs no trust` (`true !== false`) | fails identically (both tests) | PIL-0218 | same file as row 10 |
| 12 | the diff renderer notice retains exact installed licenses and its Apache source header | `scripts/release-workflows.test.mjs` | 环境 + 既有缺陷 | `Every recorded dependency license and the Apache attribution header must be reproduced once` (actual `[]`) | 上游无此测试 (notice test absent) | PIL-0114 | `node --test scripts/release-workflows.test.mjs` |

Row 12 cause, from PIL-0114: with `core.autocrlf=true` `THIRD_PARTY_NOTICES.md`
is checked out as CRLF, so the test regex gets 0 hits; after normalizing to LF
the rpiv-todo entry still lacks its From block.

## Baseline comparison and limits

PIL-0133 `verify/VERIFY-2.md` reports 3620 total, 3589 pass, 12 fail, and 19
skipped. Its `f1.txt`/`f2.txt` contain the same 12 failing test names listed
above. This run adds no persistent full-suite failure to that list. The
baseline reference files are under `D:/pilaude/relay-evidence/PIL-0133/verify/`;
this task's full logs and the name-by-name comparison are under
`D:/pilaude/relay-evidence/PIL-0002/impl/`.

**Not part of the baseline: MermaidBlock timeout.** In the A1 full run the
browser-fixture case “light: keyboard focus reveals every toolbar in only the
focused message and clears on exit” hit its 3-second navigation timeout
(`components/MermaidBlock.test.mjs:257`, 3285 ms) and is counted among the 14
failures in `npm-test.log`. It passed in the A2 bounded run (12 fail, none of
them Mermaid) and in the targeted rerun (21/21, 26.3 s, `mermaid-targeted.log`),
so it is an intermittent fixture timeout under load, not a repeatable failure.
Reproduce with `node --test components/MermaidBlock.test.mjs`.

The repo has `.github/workflows/ci.yml` with an `ubuntu-latest` checks job, but
no Linux result was collected: triggering it requires publishing/pushing this
worktree, which was outside the authorized actions for this implementation.

## Acceptance coverage and follow-up

- A1: Windows commands, full outputs, exit codes, and elapsed times are
  recorded above and in the evidence directory. `npm test` exits nonzero with
  the documented baseline failures plus the one intermittent MermaidBlock timeout.
- A2: `npm test -- --test-timeout=1800000` completed in 5m 3.5s; no test was
  terminated by the 30-minute per-test timeout. The explicit npm cache path was
  needed because the default Windows user cache is not writable in this shell.
- A3: all 12 failures have file, test name, category, log first line,
  repeatability, reproduction command and upstream comparison above.
  Upstream comparison: `git archive upstream/main` (d414e9db) exported outside
  the repo, `node_modules` junctioned read-only, the 10 files run with
  `node --test` (logs: `D:/pilaude/relay-evidence/PIL-0002/upstream-*.log`).
  Result: rows 1, 2, 5, 6, 7, 8 pass upstream; rows 3 and 4 have no upstream
  case (fork-only tests); rows 9, 10, 11 fail upstream too; row 12 has no
  upstream test. Caveat: the export has no `.git`, so in
  `scripts/release-workflows.test.mjs` upstream the case “no test file is left
  out of npm test” also fails (it needs `git ls-files`). That is an export
  artifact and is not part of any comparison conclusion.
- A4: fix cards created from this baseline (all epic E0, P2, unfrozen):
  PIL-0213 (row 1), PIL-0214 (rows 2, 3), PIL-0215 (rows 4, 5), PIL-0216
  (rows 6, 7), PIL-0218 (rows 9, 10, 11). Row 12 stays with PIL-0114; row 8 was
  fixed by PIL-0137 (PIL-0217 was created by mistake and is parked).
- A5: not complete; the Linux workflow exists, but no Linux runner result was
  available without a remote workflow run.
