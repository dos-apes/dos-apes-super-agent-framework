# Codex Review Config (`.dos-apes/codex-review-config.json`)

L8 (Codex external review) is opt-in. This file controls how the
`/apes-codex-review` command invokes the Codex CLI. The defaults are
conservative — disabled, structured-output-friendly model, capped iterations,
high-severity-only loop gating.

Flip `enabled` to `true` (or run `/apes-codex-review --enable`) once
`node scripts/codex-check.js` reports `{ "ok": true }`.

## Fields

### `enabled` *(boolean, default `false`)*
Master switch. When `false`, every entry point into L8 is a no-op. Toggle
through `/apes-codex-review --enable` so the command can re-run the
prerequisite check before flipping the flag.

### `model` *(string, default `"gpt-6.1-sol"`)*
The Codex model the reviewer invokes. **Do not configure `gpt-5-codex`** —
that slug has a known issue where `--output-schema` is silently dropped, which
breaks the structured findings parser the loop depends on. The prerequisite
check (`scripts/codex-check.js`) verifies structured-output capability against
the live CLI by running an actual round-trip; future Codex models that honor
`--output-schema` will work without code changes.

The default is an explicit model ID, never a floating "latest" alias, so every
review record stays attributable to a known model. Changing the shipped default
affects new installations only: the installer never overwrites an existing
`.dos-apes/codex-review-config.json`, so a project that already names a model
keeps it until you edit the file.

### `reasoning_effort` *(`"low" | "medium" | "high"`, default `"high"`)*
Codex CLI reasoning depth. Defaults to `high` for code review even though the
Codex CLI default is `medium` — review quality justifies the additional token
cost. Drop to `medium` if you need faster iteration or lower spend.

### `sandbox` *(string, default `"read-only"`)*
Codex sandbox policy for review runs. **Always `read-only`** — the reviewer
must never modify files. The framework's review-fix loop hands findings back
to Claude Code, which performs the edits under the existing hook stack.

### `max_iterations` *(integer, default `3`)*
Cap on the review → fix → review loop. Even if `loop_on_severity` keeps
matching, the loop terminates after this many Codex passes. Prevents runaway
spend on a finding Claude cannot satisfy.

### `loop_on_severity` *(array of strings, default `["high", "critical"]`)*
Severity levels that trigger another fix iteration. Findings at lower
severities are reported in the final summary but do not extend the loop.
Valid values: `"low"`, `"medium"`, `"high"`, `"critical"`.

### `diff_base` *(string, default `"main"`)*
Git ref the reviewer diffs against. Override per-branch when working off a
release branch (e.g. `"release/2026-q2"`).

### `timeout_seconds` *(integer, default `300`)*
Per-Codex-invocation timeout in seconds. Each iteration of the loop spawns a
new Codex process bounded by this value. The prerequisite check uses its own
shorter internal timeouts.

### `skip_paths` *(array of glob strings)*
Glob patterns excluded from review. Defaults exclude common build outputs and
worktree scratch space. Add language-specific generated directories (e.g.
`"target/**"`, `".next/**"`, `"__pycache__/**"`) as needed.

## Capability cache

`scripts/codex-check.js` writes `.dos-apes/codex-capabilities.json` with the
verified model, structured-output support, and timestamp. Subsequent runs
within 24 hours skip the capability round-trip for the same model. Delete the
cache file to force a re-verify, or change `model` (which invalidates the
cache automatically).

## Exit codes (`scripts/codex-check.js`)

| Code | Meaning                                                     |
|------|-------------------------------------------------------------|
| 0    | Ready                                                       |
| 1    | Codex CLI missing from PATH                                 |
| 2    | Codex not authenticated (`codex exec` rejected the request) |
| 3    | Configured model does not honor `--output-schema`           |
| 4    | Network/timeout failure during verification                 |
