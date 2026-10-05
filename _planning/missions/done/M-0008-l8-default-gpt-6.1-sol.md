---
id: M-0008
title: "L8 default reviewer for new installations: gpt-6.1-sol at high reasoning"
priority: 2
labels:
  - l8
  - defaults
depends_on: []
state: done
created: 2026-10-05
updated: 2026-10-05
codex:
  required: true
  last_verdict: accepted
  unresolved_findings: 0
  last_run_at: 2026-10-05T16:21:21.742Z
verification:
  required_levels:
    - L2
    - L8
schema_version: 2
---

## Problem

The shipped L8 reviewer default is `gpt-5.5`. The maintainer has directed that
new installations default to `gpt-6.1-sol` with `reasoning_effort: high`.

The default is stated in several places that nothing pins together:
`codex-review.js` `DEFAULT_CONFIG`, `codex-check.js` `DEFAULT_MODEL` (and its
unsupported-model hint), the installed `codex-review-config.json` template, the
template README, `/apes-codex-review`, and the README. Moving one without the
others would leave the capability check verifying a different model from the
one the review runs.

## Scope

**In:** every shipped default, document, test and fixture that encodes
`gpt-5.5` as the *current* default; regression tests that pin the defaults to
one another and prove the installer leaves existing configs alone.

**Out:**

- Historical records. The 3.2.0 rows in `ARCHITECTURE.md` and `CHANGELOG.md`,
  and the M-0001/M-0002 mission records, describe what was true then and stay.
- Existing projects' `.dos-apes/codex-review-config.json`. No migration, no
  rewrite, no prompt.
- Dos Apes Coding Troop governance. The cross-product decision is recorded
  there separately by the owner; this mission does not touch that repository.

## Acceptance

- [x] AC-1 — `codex-review.js` `DEFAULT_CONFIG` is `model: "gpt-6.1-sol"`,
      `reasoning_effort: "high"`, `sandbox: "read-only"`, with no `enabled` key.
- [x] AC-2 — `codex-check.js` `DEFAULT_MODEL` equals that model, and its
      unsupported-model hint names it.
- [x] AC-3 — the installed template is `enabled: false`, `gpt-6.1-sol`,
      `high`, `read-only`; its README and `/apes-codex-review` and the README
      agree, and state that the ID is explicit and that existing configs are
      not rewritten.
- [x] AC-4 — the default is an explicit model ID; no floating alias.
- [x] AC-5 — L8 stays opt-in, read-only, fail-open, configurable and
      capability-gated. No behaviour change beyond the default values.
- [x] AC-6 — an existing config selecting another model is byte-identical
      after a reinstall (automated test, with a mutation control).
- [x] AC-7 — every `gpt-5.5` reference in the repository is reconciled:
      updated, or preserved as historical with a stated reason.
- [x] AC-8 — `npm test` green; `codex-check` succeeds for `gpt-6.1-sol`
      structured output; one real L8 review runs with `gpt-6.1-sol`/`high`.

## Workpad

All evidence below was produced on 2026-10-05 against implementation commit
`bbbff18` (mission filed at `a80f53c`, base `main` = `b769a71`), on Windows 11,
Node v24.19.0, codex-cli 0.160.0.

### `gpt-5.5` reconciliation (AC-7)

| Location | Disposition |
| --- | --- |
| `framework/scripts/codex-review.js` `DEFAULT_CONFIG` | updated |
| `framework/scripts/codex-check.js` `DEFAULT_MODEL` + 2 hints | updated |
| `framework/templates/codex-review-config.json` | updated |
| `framework/templates/codex-review-config.README.md` | updated, plus explicit-ID / no-rewrite note |
| `framework/commands/apes-codex-review.md` (2) | updated (example timestamp refreshed) |
| `README.md:64`, `README.md:345` | updated |
| `framework/scripts/codex-review-cwd-equivalence.test.js` (2) | updated — config and cache must name the same model for the fast path |
| `framework/scripts/fixtures/codex-config/missing-enabled-key.json` | updated — model value incidental to the test |
| `ARCHITECTURE.md:546` | **preserved** — 3.2.0 version-history row |
| `CHANGELOG.md` 3.2.0 entry (3) | **preserved** — release record |
| `_planning/M-0001-pr-description.md:66` | **preserved** — historical review provenance |
| `_planning/missions/done/M-0001-…md:559` | **preserved** — historical review provenance |
| `_planning/missions/done/M-0002-…md:276` | **preserved** — historical review provenance |
| `bin/cli.test.js` (new M-0008 test) | **intentional** — fixture for an existing project still pinned to the previous default |

After the change, `npm pack --dry-run` ships 91 files; none contains `gpt-5.5`.
The only remaining occurrences are the seven historical lines above plus this
mission's own record, its CHANGELOG entry, and the new preservation test's
fixture, all of which name the old default on purpose.

### Verification (AC-1 – AC-6, AC-8)

- `npm test` — exit 0, every suite green (31, 80, 20, 30, 4, 20, 54, 10, 108,
  27 passed; 0 failed). Six new tests in `codex-review.test.js`, two in
  `cli.test.js`.
- **Mutation controls.** `codex-check.js` `DEFAULT_MODEL` set back to `gpt-5.5`
  → exactly "codex-check.js capability-checks the same default model" fails.
  Installer L8 copy guard `!fs.existsSync(dest)` removed → exactly "an existing
  config selecting another model is left byte-identical" fails. Both restored;
  `bin/cli.js` hash re-verified equal to `HEAD`.
- **Installer, manual.** Fresh project: installed config is the template
  (`enabled:false`, `gpt-6.1-sol`, `high`, `read-only`). Project with an existing
  config selecting `gpt-5.5`/`medium`: SHA-256 `79a45391…62ef4e` before and after.
- **Live capability check.** In a fresh install with no capability cache,
  `node scripts/codex-check.js` →
  `{"ok":true,"code":0,"message":"codex ready","model":"gpt-6.1-sol"}`, exit 0,
  18 s; the cache it wrote records `supports_output_schema: true`.
- **Real L8 review.** `node scripts/codex-review.js --base main` over
  `main...bbbff18` (12 files, +217/−14), exit 0, 86 s. Codex session
  `01a10cdd-ba3e-7103-bf43-a55b996fe316`: `model gpt-6.1-sol`, `effort high`,
  `sandbox_policy read-only`, prompt carried all 12 file diffs. Raw verdict
  `accept`, confidence 0.95, 0 findings. The reviewer stated that it could not
  run the full test suites in its read-only workspace; they were run above.
  Record: `.dos-apes/codex-reviews/2026-10-05T16-21-21-742Z.json` (SHA-256 `d67baa9d…5dbc45`, local,
  gitignored).
- **A real existing project.** Dos Apes Coding Troop's local
  `.dos-apes/codex-review-config.json` selects `gpt-6-astra`; it was not
  touched (mtime 2026-09-18, model unchanged).

### Environment note

The session ran with the Coding Troop's Claude Code hooks loaded. Its
format-and-stage hook reformatted `codex-review-config.README.md` on an editor
write; that change was discarded and the file rebuilt from `HEAD` with only
the intended edits. All other Framework edits were made outside the hook.

### Closeout (2026-10-05)

- **Delivery.** PR #25 squash-merged by maintainer approval as `930dc766`
  (2026-10-05T16:38:09Z), pinned with `--match-head-commit 03a42f9`. Before the
  merge: head still `03a42f9`, the same three commits, CodeQL and
  "Analyze (javascript-typescript)" both SUCCESS, 0 reviews, 0 comments, 0 open
  code-scanning alerts on the PR ref, merge state `CLEAN`. Branch retained on
  origin per the branch-retention policy.
- **Merged content, by tree.** `930dc766^{tree}` equals `03a42f9^{tree}`, the
  reviewed head. On `main`: `codex-review.js` `DEFAULT_CONFIG`
  `gpt-6.1-sol`/`high`/`read-only`, `codex-check.js` `DEFAULT_MODEL`
  `gpt-6.1-sol`, template `enabled:false`/`gpt-6.1-sol`/`high`/`read-only`.
- **Post-merge verification.** `npm test` on the merged code: exit 0, 0 failed.
- **Record repair at closeout.** The tracker refused to touch this record as
  filed. It lacked the schema-required `state`, `created` and `updated`. Worse,
  `required: true # …` parsed as the *string* `"true # …"`: the mission
  parser keeps inline comments inside scalar values. As merged, the record
  therefore never opted into the `codex.required` completion gate. Fixed here
  by adding the missing fields and moving the comment off the value line.
  After the fix the gate refused `review → done` at verdict `none` and allowed
  it at `accepted`.
- **L8 verdict recorded through `MissionTracker.setCodexState`.** Raw reviewer
  verdict `accept` maps to `last_verdict: accepted` via
  `VERDICT_TO_LAST_VERDICT`, with 0 unresolved findings and `last_run_at` taken
  from the review record's timestamp. No `last_review_path`: the record is
  local and gitignored (as for M-0001). No `human_adjudication` was needed or
  written.
- **Lifecycle.** `todo → doing → review → done` was walked in this closeout
  through `moveMissionState`. The file had stayed in `todo/` while the work was
  done, so these transitions record states already passed, not new work.
- **Follow-up candidates, not addressed here.**
  1. No PR-triggered workflow runs `npm test`. CodeQL is the only PR check, so
     test evidence on a PR is local-only.
  2. Inline `#` comments in mission frontmatter scalars are kept as part of the
     value, which silently disables `codex.required: true` (fail-open on a
     governance gate). `M-0001` (`required: true  # …`) and `M-0007`
     (`required: false # …`) carry the same pattern.
  3. The gate's refusal message prints `undefined:` where the mission ID
     belongs.
