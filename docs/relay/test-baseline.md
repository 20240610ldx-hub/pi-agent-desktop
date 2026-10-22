# Windows test baseline (PIL-0002)

Captured 2026-10-22 in the PIL-0002 worktree on Windows PowerShell. This is a
record of the current baseline, not a claim that the suite is green. No test or
product code was changed for this capture.

## Commands and results

| Check | Command | Result | Full output |
| --- | --- | --- | --- |
| Dependency consistency | `npm run check:deps` | exit 0 | `D:/pilaude/relay-evidence/PIL-0002/impl/check-deps.log` |
| TypeScript | `node_modules/.bin/tsc --noEmit` | exit 0 | `D:/pilaude/relay-evidence/PIL-0002/impl/tsc.log` |
| Lint | `npm run lint` | exit 0; 0 errors, 2 warnings | `D:/pilaude/relay-evidence/PIL-0002/impl/lint.log` |
| Full suite (A1 capture) | `npm test` (foreground; `NPM_CONFIG_CACHE` points to evidence directory) | exit 1; 3620 tests, 3589 pass, 12 fail, 19 skipped; elapsed 10m 57.7s | `D:/pilaude/relay-evidence/PIL-0002/impl/npm-test.log` |
| Full suite (A2 bounded capture) | `npm test -- --test-timeout=1800000` (foreground; external `NPM_CONFIG_CACHE`) | exit 1; 3641 tests including nested subtests, 3610 pass, 12 fail, 19 skipped; elapsed 5m 1.4s; all 12 failures match the baseline list | `D:/pilaude/relay-evidence/PIL-0002/impl/npm-test-bounded-cache.log` |
| Bounded run without external npm cache | `npm test -- --test-timeout=1800000` | exit 1; 13 failures, including one additional npm log/cache permissions failure; do not use as the baseline | `D:/pilaude/relay-evidence/PIL-0002/impl/npm-test-bounded.log` |
| Mermaid browser fixture follow-up | `node --test components/MermaidBlock.test.mjs` | exit 0; 21/21 pass | `D:/pilaude/relay-evidence/PIL-0002/impl/mermaid-targeted.log` |

Lint warnings: `components/TerminalPanel.tsx:217` (`aria-description` on an
implicit region) and `lib/fork-send.test.mjs:4` (unused `mkdir` import).

## Known full-suite failures

Each item below failed in both full-suite runs with a usable npm cache and appears in the PIL-0133 verify
baseline's 12-name list. Reproduction command for each is
`node --test <file>` from the repository root. These are repeatable baseline
failures: the same names were recorded in PIL-0133's prior full-suite run and
again here. The category records what the assertion/output demonstrates; it
does not presume the eventual fix belongs in production code or the test.

| Test | File | Observed reason / category | Repeatable? | upstream/main same? | Reproduction |
| --- | --- | --- | --- | --- | --- |
| every CSS variable read without a fallback is defined somewhere | `app/css-variables.test.mjs` | Missing CSS variable definition (`--shadow-md`); style-token coverage | Yes | No: passes on upstream/main | `node --test app/css-variables.test.mjs` |
| desktop-only workspace and health behavior is gated before use | `components/AppShell-session-reset.test.mjs` | Expected source-pattern contract not found; static test/implementation contract mismatch | Yes | No: passes | `node --test components/AppShell-session-reset.test.mjs` |
| workspace visibility restores independently of file or terminal tabs | `components/AppShell.terminal.test.mjs` | Expected source-pattern contract not found; static test/implementation contract mismatch | Yes | No: passes | `node --test components/AppShell.terminal.test.mjs` |
| desktop catalogue shows eight reviewed packages and offers only four optional source choices | `components/RecommendedPiExtensions.test.mjs` | Expected four choices, observed three; catalogue/content count mismatch | Yes | upstream 无此测试 (file absent) | `node --test components/RecommendedPiExtensions.test.mjs` |
| uses the child-session robot glyph for the sub-agents tab | `components/SettingsPanel.test.mjs` | Expected SVG path not present; icon contract mismatch | Yes | No: passes | `node --test components/SettingsPanel.test.mjs` |
| session rows keep the action menu reachable on touch devices | `components/sidebar-and-message-updates.test.mjs` | Expected touch-mode visibility source pattern not found; static test/implementation contract mismatch | Yes | No: passes (both tests) | `node --test components/sidebar-and-message-updates.test.mjs` |
| interrupted tool calls render a cancelled marker instead of success styling | `components/sidebar-and-message-updates.test.mjs` | Expected aborted-state prop not present; rendering contract mismatch | Yes | No: passes (both tests) | `node --test components/sidebar-and-message-updates.test.mjs` |
| a summary still running for the previous session does not lock branch switches in the next | `hooks/useAgentSession.branch-summary-guard.test.mjs` | Test harness evaluation throws `ReferenceError: todoBranchSelectionRef is not defined`; harness/implementation contract mismatch | Yes | No: passes | `node --test hooks/useAgentSession.branch-summary-guard.test.mjs` |
| direct bash updates the platform PATH key | `lib/project-command-env.test.mjs` | Actual environment object differs from expected PATH key; platform environment contract mismatch | Yes | Yes: fails identically | `node --test lib/project-command-env.test.mjs` |
| the fresh check also counts links to nothing, which existsSync skips | `lib/project-trust.test.mjs` | Expected false, observed true for the user's `~/.agents/skills`; trust-classification behavior mismatch | Yes | Yes: fails identically (both tests) | `node --test lib/project-trust.test.mjs` |
| a fresh folder that holds a project with no decision is never trusted by the step | `lib/project-trust.test.mjs` | Expected fresh folder to need no trust, observed otherwise; trust-classification behavior mismatch | Yes | Yes: fails identically (both tests) | `node --test lib/project-trust.test.mjs` |
| the diff renderer notice retains exact installed licenses and its Apache source header | `scripts/release-workflows.test.mjs` | Expected installed-license manifest entries, observed none; release attribution/manifest mismatch | Yes | upstream 无此测试 (notice test absent) | `node --test scripts/release-workflows.test.mjs` |

## Baseline comparison and limits

PIL-0133 `verify/VERIFY-2.md` reports 3620 total, 3589 pass, 12 fail, and 19
skipped. Its `f1.txt`/`f2.txt` contain the same 12 failing test names listed
above. This run therefore adds no persistent full-suite failure to that list.
The baseline reference files are under
`D:/pilaude/relay-evidence/PIL-0133/verify/`; this task's full logs and the
name-by-name comparison are under `D:/pilaude/relay-evidence/PIL-0002/impl/`.

One browser fixture child test, “light: keyboard focus reveals every toolbar
in only the focused message and clears on exit”, hit its 3-second navigation
timeout during the full run (`components/MermaidBlock.test.mjs:257`). The
immediate targeted rerun passed all 21 tests in 26.3 seconds, so record this as
an observed intermittent fixture/environment timeout, not as a thirteenth
baseline failure. Reproduce with `node --test components/MermaidBlock.test.mjs`.

The repo has `.github/workflows/ci.yml` with an `ubuntu-latest` checks job, but
no Linux result was collected: triggering it requires publishing/pushing this
worktree, which was outside the authorized actions for this implementation.

## Acceptance coverage and follow-up

- A1: Windows commands, full outputs, exit codes, and elapsed times are
  recorded above and in the evidence directory. `npm test` exits nonzero with
  the documented baseline failures.
- A2: `npm test -- --test-timeout=1800000` completed in 5m 1.4s; no test was
  terminated by the 30-minute per-test timeout. The explicit npm cache path was
  needed because the default Windows user cache is not writable in this shell.
- A3: all 12 persistent failures have their file, test name, observed reason,
  repeatability, reproduction command and upstream comparison above. Upstream
  comparison: `git archive upstream/main` (d414e9db) exported outside the repo,
  `node_modules` junctioned read-only, the 10 files run with `node --test`
  (logs: `D:/pilaude/relay-evidence/PIL-0002/upstream-*.log`). Result: 9 of 12
  fail only on this fork (css-variables, AppShell-session-reset,
  AppShell.terminal, SettingsPanel, 2x sidebar-and-message-updates,
  branch-summary-guard all pass upstream); 3 fail on upstream too
  (project-command-env PATH, 2x project-trust); 2 tests do not exist upstream
  (RecommendedPiExtensions, release-workflows diff-renderer notice; the export
  has no `.git`, so an unrelated `git ls-files` test failed there and is ignored).
- A4: suggested fix cards are listed below; the coordinator creates them
  (this card may only edit this document). PIL-0114 already covers the notice failure.
- A5: not complete; the Linux workflow exists, but no Linux runner result was
  available without a remote workflow run.

## Suggested fix cards (A4, for the coordinator to create)

| # | Suggested title | Files | Cause |
| --- | --- | --- | --- |
| 1 | Define `--shadow-md` token | `app/native-theme.css` (`app/css-variables.test.mjs`) | Fork CSS reads `--shadow-md` with no definition; passes upstream. |
| 2 | Realign AppShell source-contract tests | `components/AppShell.tsx`, `components/AppShell-session-reset.test.mjs`, `components/AppShell.terminal.test.mjs` | Static source-pattern checks no longer match fork AppShell (desktop gating, workspace visibility restore). |
| 3 | Sub-agents tab icon + RecommendedPiExtensions count | `components/SettingsPanel.tsx`, `components/RecommendedPiExtensions.test.mjs` | Robot glyph path missing; catalogue shows 3 optional source choices, test expects 4 (fork-only test). |
| 4 | Sidebar touch menu + aborted tool-call marker | `components/SessionSidebar.tsx`, `components/MessageView.tsx`, `components/sidebar-and-message-updates.test.mjs` | Touch-visibility pattern and aborted-state prop absent. |
| 5 | Branch-summary guard harness | `hooks/useAgentSession.ts`, `hooks/useAgentSession.branch-summary-guard.test.mjs` | `todoBranchSelectionRef` not defined in the test harness evaluation. |
| 6 | Windows PATH key + project-trust fresh-folder tests (also fail upstream) | `lib/project-command-env.ts`, `lib/project-trust.ts` and their tests | Platform PATH key casing; trust check sees the real `~/.agents/skills` instead of an isolated home. |
| 7 | Third-party notice licenses | covered by **PIL-0114** | Installed-license manifest entries missing. |
