# Open Claude UI source integration

Source: [Caho1/open-claude-ui](https://github.com/Caho1/open-claude-ui), commit `638800b8a4cee4513c8763c3df0ecf8a77b32379`. Copyright 2026 Caho1; MIT license is preserved beside these files.

The files are copied from `code-examples/`. This directory is a deliberate versioned integration boundary: upstream sync updates the reference checkout, and changes here are reviewed with Pilaude's runtime tests before adoption.

Latest checkout audit (2026-10-18): fork `7490e105e418adf2b94c55ff716bb0973d44fb85` contains author main `638800b8a4cee4513c8763c3df0ecf8a77b32379`. The three files below now adopt that author commit, retaining the documented Button adaptations. The library's macOS 2.37337.1 evidence does not establish parity with the selected Windows stable 2.42304.0. See the [component inventory, missing assets, and parity gates](../../docs/pilaude-ui-parity.md). The supplied Windows screenshot is being compared with running Pilaude captures using an unscaled 50% overlay, difference image and measured element rectangles; full visual/interaction parity has not passed.

| Source | Use in Pilaude | Adaptation |
| --- | --- | --- |
| `cds-theme.css` | Imported before the existing native theme; supplies CDS light/dark surfaces, clay, dual-ring shadows, radii and keyframes | Trailing whitespace / LF normalization only |
| `CdsButton.tsx` | Welcome project/model actions; button size and variant contract | Default `type="button"`; adds explicit variant/size classes, styled in `native-theme.css` for Tailwind 4. Dark ink on clay preserves small-text contrast. |
| `ClaudeMotionPresets.ts` | Welcome entry uses `SPRING_SNAPPY`, with reduced-motion support | Trailing whitespace / LF normalization only; source values take precedence over conflicting prose in the reference AGENTS.md |

System font stacks follow `assets/README.md`; Pilaude loads no font from Google at runtime/build time. The composer maps the 20px radius and dual-ring states; user bubbles use 18px. The 7-stop composer fade is adapted to an opaque bottom band so controls remain readable.

The 150ms input latch from `useClaudeScrollPinning` is adapted in `lib/cds-scroll.ts` and the existing session hook, preserving Pi's history restoration and scroll anchors. Further integrations remain in the plan: `McpToolDecisionCard` for real backend approvals, `CoworkAgentCanvas` for real agent state, and the split-pane/keyboard/extension controls. Their demo state must be replaced with Pi runtime state when adopted. Windows controls continue to use Tauri's native window APIs.

The latest theme references neutral-surface and fast/slow-duration aliases without defining them. `native-theme.css` supplies those aliases from Pilaude surfaces and the upstream token docs (60ms / 450ms). The variable guard recognizes CSS `@property` registrations used by the new scroll-fade engine. These integrations do not establish Windows motion parity.
