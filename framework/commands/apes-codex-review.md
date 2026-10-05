---
description: External-model code review (L8) via Codex CLI. Single-shot review or full review-fix-review loop.
allowed-tools: Read, Edit, Grep, Glob, Bash(node scripts/codex-check.js:*), Bash(node scripts/codex-review.js:*), Bash(node scripts/codex-review-loop.js:*)
---

# /apes-codex-review

**Run an external-model review of the current branch. Optionally enter a review-fix-review loop that addresses high/critical findings automatically.**

This is **L8** of the verification pyramid — opt-in, off by default. The reviewer is the Codex CLI; the consumer protocol is documented in `.claude/skills/cross-model-review.md`. **Load that skill before acting on any findings produced by this command.**

## Prerequisites

Before this command can do anything but report a skip:

1. **Codex CLI installed** and on PATH. Verify with `codex --version`.
2. **Authenticated.** Run `codex login` once per machine.
3. **L8 enabled.** `.dos-apes/codex-review-config.json` must have `"enabled": true`. Use `/apes-codex-review --enable` to flip it.
4. **Capability verified.** `node scripts/codex-check.js` must report `{"ok": true}`. The configured model has to honor `--output-schema`. Cached for 24 hours per model.
5. **Inside a git repo** with a `main` (or other configured `diff_base`) branch ahead of which this branch has commits.

If any prerequisite is missing, the underlying scripts fail open with a `skipped` result — they will not crash the session.

## Subcommands

| Form                                           | Behavior                                                                    |
|------------------------------------------------|-----------------------------------------------------------------------------|
| `/apes-codex-review`                           | Single-shot review of the current branch vs `main`. No fixes attempted.     |
| `/apes-codex-review --loop`                    | Full review-fix-review loop, capped by `max_iterations` (default 3).        |
| `/apes-codex-review --mission <id>`            | Review a specific mission's branch and append an L8 entry to its workpad.   |
| `/apes-codex-review --enable`                  | Flip `enabled: true` in `.dos-apes/codex-review-config.json`.               |
| `/apes-codex-review --disable`                 | Flip `enabled: false`.                                                      |
| `/apes-codex-review --status`                  | Print last review result and current config.                                |

`--loop` and `--mission <id>` may be combined: `/apes-codex-review --loop --mission M-0042`.

---

## STEP 1 — Parse arguments

Read `$ARGUMENTS`. Determine which subcommand was invoked using these rules, top-to-bottom (first match wins):

1. Contains `--enable` → handle in STEP 2.
2. Contains `--disable` → handle in STEP 3.
3. Contains `--status` → handle in STEP 4.
4. Contains `--loop` → handle in STEP 6 (loop mode).
5. Otherwise → handle in STEP 5 (single-shot mode).

Extract `--mission <id>` and `--base <ref>` if present and pass them through to the underlying scripts.

---

## STEP 2 — `--enable`

Flip `enabled: true` in `.dos-apes/codex-review-config.json`. If the file doesn't exist yet, the framework installer should have created it from the template; if it's still missing, copy `framework/templates/codex-review-config.json` into place first.

Read `.dos-apes/codex-review-config.json`, then use the Edit tool to change the `"enabled"` value to `true` — touch nothing else in the file. Confirm to the user: `L8 enabled. Run /apes-codex-review --status to verify.`

After flipping, run the prerequisite check so the user knows whether they can actually use it:

```bash
node scripts/codex-check.js
```

Expected on success: `{"ok":true,"code":0,"message":"codex ready","model":"gpt-6.1-sol"}`.

---

## STEP 3 — `--disable`

Read `.dos-apes/codex-review-config.json`, then use the Edit tool to change the `"enabled"` value to `false` — touch nothing else in the file. Confirm to the user: `L8 disabled. /apes-codex-review will now skip.`

---

## STEP 4 — `--status`

Print the current config and the last loop result (if any).

```bash
echo "=== Config ==="
cat .dos-apes/codex-review-config.json 2>/dev/null || echo "(not initialized)"

echo ""
echo "=== Capability cache ==="
cat .dos-apes/codex-capabilities.json 2>/dev/null || echo "(not verified — run scripts/codex-check.js)"

echo ""
echo "=== Last result ==="
cat .dos-apes/codex-reviews/result.json 2>/dev/null || echo "(no review run yet)"
```

---

## STEP 5 — Single-shot mode (default)

Invoke `scripts/codex-review.js` with `--base <ref>` (default `main`). The script handles all the prerequisite logic and emits a JSON result.

```bash
node scripts/codex-review.js --base main
```

Or with a mission:

```bash
node scripts/codex-review.js --base main --mission M-0042
```

After it returns:

- If stdout is `{"skipped": true, "reason": "..."}` → tell the user the reason and stop. No further action.
- Otherwise → load `.claude/skills/cross-model-review.md` and surface the findings to the user using the format documented there. **Do not auto-fix in single-shot mode.**

### Example output (single-shot, clean)

```
$ /apes-codex-review
✓ Codex CLI ready (model: gpt-6.1-sol, cached 2026-10-05T14:02:37Z)
✓ Diff: 7 files, +312/-104 vs main

Verdict: accept (confidence 0.92)
Summary: No high/critical findings. Two low-severity naming suggestions left for human review.

Findings (2):
  · low · src/api/users.ts:47-49 · "id" parameter shadows outer scope; consider userId
  · low · src/api/users.ts:104    · function returns undefined implicitly; add explicit return type

Result saved to .dos-apes/codex-reviews/2026-05-01T16-30-12-345Z.json
```

### Example output (single-shot, findings)

```
$ /apes-codex-review --mission M-0042
✓ Codex CLI ready (cached)
✓ Diff: 3 files, +84/-12 vs main
⚠ 1 high-severity finding

Verdict: revise (confidence 0.81)
Summary: Auth check missing on the new admin route.

Findings (1):
  · high · src/api/admin.ts:23-29 · POST /admin/users/:id/promote has no role check.
            suggested_fix: wrap in requireRole('admin') middleware.

Run /apes-codex-review --loop to address this automatically, or fix manually.
```

---

## STEP 6 — Loop mode (`--loop`)

Invoke `scripts/codex-review-loop.js`. The loop will:

1. Run `codex-review.js` (iteration 1).
2. If verdict is `accept` or there are no findings → terminate `accepted`.
3. If only low/medium findings → terminate `partial-success`.
4. Otherwise write a feedback packet to `.dos-apes/codex-reviews/iteration-N/feedback.json` and spawn Claude Code with the `cross-model-review` skill loaded to address high/critical findings.
5. Re-review. Repeat up to `max_iterations` (default 3).

```bash
node scripts/codex-review-loop.js --base main
```

With overrides:

```bash
node scripts/codex-review-loop.js --base main --mission M-0042 --max-iterations 5
```

Report-only (skip the fix step):

```bash
node scripts/codex-review-loop.js --base main --no-fix
```

After the loop returns, **read `.dos-apes/codex-reviews/result.json`** and surface the terminal state to the user. The six terminal states are documented in `.claude/skills/cross-model-review.md` — refer to that skill for the per-state user-visible signal.

### Example output (loop, accepted on iteration 2)

```
$ /apes-codex-review --loop --mission M-0042
Iteration 1: revise (1 high-severity finding)
  → Spawning Claude Code to address findings…
  ✓ Commit: fix(codex-review): address iteration 1 findings
Iteration 2: accept (clean)

Terminal state: accepted after 2 iteration(s).
Mission workpad updated: M-0042 (in doing/).
Result: .dos-apes/codex-reviews/result.json
```

### Example output (loop, exhausted)

```
$ /apes-codex-review --loop
Iteration 1: revise (2 high-severity findings) → fix
Iteration 2: revise (1 high-severity finding)  → fix
Iteration 3: revise (1 high-severity finding)  → cap reached

Terminal state: exhausted after 3 iteration(s).
Open findings (1):
  · high · src/db/migrations/0042.sql:18-26 · backfill not idempotent; second run would duplicate rows.

Human review required. Result: .dos-apes/codex-reviews/result.json
```

### Example output (loop, no-progress)

```
$ /apes-codex-review --loop
Iteration 1: revise (1 critical finding)
  → Spawning Claude Code to address findings…
  ⚠ No new commits after fix step.

Terminal state: no-progress after 1 iteration(s).
Claude Code could not address the finding automatically. Try fixing manually.
Result: .dos-apes/codex-reviews/result.json
```

---

## What this command does NOT do

- Does not modify code itself in single-shot mode.
- Does not fix `low`-severity findings (intentional — see `cross-model-review.md`).
- Does not run the rest of the verification pyramid. Pair with `/apes-verify`.
- Does not bypass the main-branch protection hook. The fix step's commits go onto whatever branch Claude Code is on.
- Does not push or open PRs.

## See also

- `.claude/skills/cross-model-review.md` — triage/fix protocol, terminal states.
- `.dos-apes/codex-review-config.README.md` — config field reference.
- `scripts/codex-check.js` — prerequisite verifier.
- `scripts/codex-review.js` — single-shot review.
- `scripts/codex-review-loop.js` — review-fix-review loop driver.
