# Changelog

All notable changes to the Dos Apes Super Agent Framework are documented in
this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed — M-0008: L8 default reviewer is `gpt-6.1-sol` at `high`

- **New installations now default the L8 reviewer to `gpt-6.1-sol`** with
  `reasoning_effort: "high"`, replacing `gpt-5.5`. The default is an explicit
  model ID, never a floating "latest" alias. It changed together in every place
  that states it: `codex-review.js` `DEFAULT_CONFIG`, `codex-check.js`
  `DEFAULT_MODEL` (and its unsupported-model hint), the installed
  `codex-review-config.json` template and its README, `/apes-codex-review`, and
  the README.
- **Existing projects are not modified.** The installer has always skipped an
  existing `.dos-apes/codex-review-config.json`; a project that already names a
  model keeps it until its owner edits the file. A project whose config omits
  `model` falls back to the code default, so it picks up `gpt-6.1-sol` once its
  installed scripts are updated.
- **Unchanged:** L8 stays opt-in (`enabled: false` in the template, no `enabled`
  key in the code defaults), the sandbox stays `read-only`, every unavailable
  state still fails open to `skipped`, the model stays configurable, and the
  structured-output capability check still gates the run.
- **New regression coverage.** `codex-review.test.js` pins the code defaults,
  the capability-check default, the template, and the template README to one
  another. `cli.test.js` installs into a fresh project and over an existing
  config that selects another model, and requires the latter to stay
  byte-identical. Both suites were run against deliberate mutations to prove
  they fail.
- `codex-check.js` now exports `DEFAULT_MODEL` and runs `main()` only behind
  `require.main === module`, matching `codex-review.js`. CLI behaviour is
  unchanged.

### Fixed — M-0007: `codex.required` completion gate

Discovered by dogfooding in Dos Apes Coding Troop, where it blocked closeout of
an approved mission. Three defects in one area, fixed together.

- **The `review → done` gate was documented but unenforced.** `missions.md` said
  `codex.required: true` blocked `done` without `last_verdict: accepted`;
  nothing in `canTransition()` or `moveMissionState()` consulted the codex block.
  `codex.required: true` therefore carried **no completion guarantee at all** —
  the rule held only for an agent that read it and chose to honour it. Now
  enforced in `canTransition()`, which `moveMissionState()` delegates to, so the
  CLI and programmatic callers cannot diverge.
- **The two skills stated different rules.** `missions.md` described a
  `review → done` gate; `cross-model-review.md` described a `doing → review`
  one. Both are real and they are now stated as such, in one place, with
  `missions.md` authoritative.
- **There was no governed human-adjudication path.** When the review budget is
  exhausted, all critical/high findings are resolved, and only disclosed
  low/medium caveats remain, the honest verdict is `partial-success` — and the
  only routes to `done` were to rewrite the verdict, re-run the review until the
  wording improved, or bypass the transition. All three falsify the record.

### Added

- **`human_adjudication`** — a **top-level** mission frontmatter block (a sibling
  of `codex`, deliberately not a field inside it) recording that a human
  explicitly accepted disclosed residual findings. `review → done` now passes on
  `last_verdict: accepted` **or** a valid adjudication.
- **`MissionTracker.setHumanAdjudication(id, record)`** — the governed writer. It
  refuses to write any reviewer-reported field, refuses a verdict that does not
  match what the reviewer returned, and refuses to adjudicate a review that never
  ran or was already accepted.

**The adjudication never rewrites the reviewer verdict.** `last_verdict` stays
exactly what the reviewer said. The reviewer's conclusion and the human's
disposition are different facts and are recorded separately — which is also why
the block sits outside `codex` rather than inside it.

### Invariants, and where they are enforced

All of them live in `validateFrontmatter`, which runs on every write **and** is
re-run by the `review → done` gate. A hand-edited mission file therefore cannot
bypass them: the governed setter is a convenience, not the enforcement boundary.

- **Only `partial-success` is adjudicable.** That verdict means the review _ran
  to completion_ and left only low/medium findings. Every other non-accepted
  terminal means the review is **unfinished** — `exhausted` hit the budget with
  critical/high still open, `no-progress` stalled, `skipped` never ran,
  `findings-reported` resolved nothing — and unfinished is not the same as
  finished-with-acceptable-residue.
- **Stale adjudication fails closed.** `adjudicated_verdict` must equal the
  current `codex.last_verdict`, and `remaining_findings` must equal the current
  `codex.unresolved_findings`. If the review is re-run and comes back different,
  the existing record stops validating and stops unblocking completion, instead
  of silently outliving the state it was written for. The remedy is to
  re-adjudicate against the current review — never to edit the verdict to match
  the adjudication.
- **A completed review must exist.** `codex.last_run_at` and
  `codex.last_review_path` are both required: adjudication presupposes a review
  that ran, and the findings being accepted must be locatable.
- **The severity distribution is required and must balance.** `remaining_low +
remaining_medium` must equal `remaining_findings`. Because the total is itself
  cross-checked against the reviewer's own count, a critical or high finding
  would leave the distribution unable to balance — which is what makes
  `no_critical_or_high_remaining` mechanical rather than a self-assertion.
- `no_critical_or_high_remaining` must be exactly `true`, and
  `accepted_obligations` must be non-empty. Adjudication accepts **disclosed**
  low/medium residual risk, never unresolved critical or high findings, and
  accepting risk requires naming what is being accepted.

23 regression tests added.

## [3.6.0] — 2026-08-08

The **permission-hardening release**. Four missions ship together: M-0001
(least-privilege permission policy), M-0002 (per-command `allowed-tools`
scoping), M-0003 (command and skill body hygiene), and M-0004 (worktree write
guard and mission-move companion handling).

**Published as beta.** This release goes out under `--tag beta`. The `latest`
dist-tag remains pinned at 3.0.0, so `npx dos-apes-super-agent` continues to
resolve 3.0.0 until `latest` is promoted separately.

**Measured on this release.** Full `npm test`: 352 passed / 0 failed. The L1
`allowed-tools` drift-guard: 108 passed / 0 failed across 33 command and skill
files. Counted from the guard's `KNOWN_PROMPTING` pin table, the pin inventory
stands at 53 entries — 46 `util` and 7 `policy` — and the `node-e`,
`bare-form`, and `env` classes hold zero entries, having been emptied by
M-0003's sweeps.

**In-use verification: analytic, not empirical.** M-0003's AC-9 dry-run did not
meet its strict zero-prompt criterion; 14 denials were observed. Those denials
are attributed to pre-existing defects rather than to M-0003's changes, and
that attribution was established **by analysis, not by a pre-M-0003 re-run** —
no before/after differential was measured. Four candidates were ledgered: three
were absorbed into M-0004 (merged in this release) and one is parked. The
measured results in the paragraph above and this analytic attribution are two
separate claims and should be read as such.

### Security

- **M-0001 — Shipped permission policy was inverted (root cause: commit
  `5fb19a1`, v1-era "comprehensive pre-approved permissions").** The template
  pre-approved `rm *`, `git push *`, `npm *` (including `npm publish`),
  `bash *`, `node *`, and `xargs *` while the framework's own skills prompted
  on every first use. Replaced with a least-privilege deny→ask→allow policy:
  npm registry mutation (`publish`, `version`, `dist-tag`, `unpublish`,
  `deprecate`), force pushes, and remote branch deletion are **denied**
  (human-only per SECURITY.md); `git push`, branch/tag deletion,
  `git reset --hard`, `rm`, and `npm audit fix` **ask**; the allow list
  covers exactly the framework machinery and read-only utilities.
  _Pattern:_ a rule that pre-approves the dangerous case to save one prompt
  is the wrong trade; encode human-only operations as deny + hook, not trust.
- **New PreToolUse guard hook (`scripts/guard-forbidden-commands.sh`)** —
  deterministic backstop scanning the full Bash command string, including
  compound chains, for spellings prefix rules cannot express: flag-last force
  pushes (`git push origin main --force`), `--force-with-lease`, `+refspec`,
  refspec deletion (`git push origin :branch`), recursive-force `rm`
  respellings aimed at `/`, `~`, `..`, and npm registry mutation with flags —
  including separated-value forms (`npm --registry <url> publish`), an L8
  review catch. Blocks with exit 2, plain-text stderr, fail-closed ERR trap.
  54 fixture tests.
- **`Bash(npm run *)` removed from allow (L8 catch)** — package scripts are
  arbitrary code invisible to the permission layer, so a script named
  `publish` running `npm publish` bypassed the whole policy. Only enumerated
  quality-loop script names are allowed; `npm run publish` prompts.
- **Deny rules protect secrets and the policy itself** — `Read(.env)`,
  `Read(.env.*)`, `Edit/Write(.claude/settings.json)`.
- **L8 review-prompt diff fence hardened (L8 self-catch)** — the reviewer
  flagged injection in its own prompt template: a changed markdown file could
  close the 3-backtick diff fence and inject reviewer instructions. Now a
  10-backtick fence with explicit untrusted-data framing.
- **M-0002 — Twelve of fifteen commands granted themselves unrestricted
  shell.** `allowed-tools` frontmatter _grants_ rather than restricts, so a
  bare `Bash` declaration handed a skill unscoped shell for its entire run,
  defeating M-0001's global policy the moment any framework skill activated.
  All 18 commands and 15 skills rescoped: the build family gets branch-create,
  merge, and `npm run`/test (no push, no tags); mission and evidence commands
  get their named `node scripts/*.js` entry points plus `git commit`;
  verification commands get the check-scripts, playwright, audit, and
  log-verification set; the six domain-knowledge skills drop to a
  `Read, Grep, Glob` floor — they are documents, not executors.
  _Pattern:_ a grant is justified only by an invocation in the file's own body.
  Prose that names a script, or names a different executor, is a reference and
  not evidence.
- **New L1 drift-guard (`framework/scripts/allowed-tools-guard.test.js`).**
  Parses every command and skill, replicates Claude Code's matcher semantics
  (including the bare-form quirk, where `Bash(git status *)` covers
  `git status --short` but not bare `git status`), and cross-checks
  declarations against body usage in both directions: a declaration without
  usage fails, and new prompting surface without a cited pin fails. Wired into
  `test:lib`, so it rides L0 on every run.
- **`Bash(agent-browser:*)` granted to the browser-verification skill only** —
  a deliberate, skill-scoped relaxation of M-0001's printed-suggestion stance.
  The global baseline stays clean.

### Added

- **Install-time `Skill(...)` rule generation** in the CLI: allow rules for
  every shipped command (exact + args pair) and domain skill (exact) are
  enumerated from the installed file set — new skills auto-enroll, no
  hand-maintained list. Static rules in the template remain as fallback,
  kept honest by a drift-guard test.
- **`.claude/settings.README.md`** installed beside the policy: allow/ask/deny
  rationale, tag-mutation-as-ask with its paired-promotion precondition, the
  guard's documented quoted-text false positive and rephrase workaround, and
  the `CLAUDE_CODE_GIT_BASH_PATH` note.
- `DOS_APES_VERSION` env is stamped from `package.json` at install time
  (was hardcoded `2.0.0` against package 3.5.1).
- **`EnterWorktree` added to the shipped `settings.json` allow-list** (M-0004),
  with the drift-guard's covering-declaration bookkeeping updated in the same
  commit. Note that the path form of `EnterWorktree` additionally triggers a
  harness-native confirmation that no permission rule can or should silence —
  one click in an interactive install, unanswerable headless.

### Changed

- **M-0003 — Command and skill bodies rewritten to stop colliding with the
  permission policy.** M-0002 scoped the frontmatter; this mission fixed the
  bodies underneath it. Every rewrite that altered an invocation updated the
  guard's pins in the same commit.
  - **One shipped command was broken, not merely noisy.** `/apes-feature`'s
    cleanup step invoked `git push origin --delete`, which M-0001 _denies_ —
    the body instructed an operation the policy refused. Cleanup now deletes
    the local branch only and hands remote deletion to a human;
    `apes-build`'s prose carve-out for the same operation is removed.
  - **18 inline `node -e` pipeline segments replaced by six named helper
    scripts.** An inline `node -e` cannot be matched by any permission rule,
    so each one prompted unconditionally regardless of policy. The helpers
    ship in the tarball and run under scoped allows.
  - **11 `git checkout` sites migrated to `git switch`**, covered by a narrow
    `Bash(git switch main)` ask rule rather than a blanket allow. Deliberate
    working-tree discards (`git checkout .`) still prompt by design.
  - **Bare-form and argument sweeps across 9 sites.** Bare `git status`,
    bare `git stash`, argument-less `check-structure.sh`, and env-prefixed
    invocations (`COVERAGE_THRESHOLD=90 bash …`) were rewritten into forms
    their own rules actually cover, with zero new policy lines. Two shipped
    scripts gained back-compatible interfaces to make this possible:
    `check-coverage.sh` accepts the threshold as a first positional argument
    (the env var remains a fallback), and `check-structure.sh` accepts
    `--all` for an explicit full scan.
  - **L8 skip-cause enumerations completed** in `apes-verify`,
    `cross-model-review`, and `missions`, naming `config-absent`,
    `config-unparseable`, and `config-invalid`. Prose only; no invocation
    change.
  - _Tradeoff recorded:_ `apes-build`'s `trap '…' EXIT` cleanup was replaced
    with explicit per-abort-path instructions. A deterministic EXIT hook was
    traded for a rule-visible instruction — it gains permission coverage and
    relies on flow compliance.

### Fixed

- **All hooks were silently inert in Windows installs (root cause:
  `patchHooksForWindows` targeted a dead execution model).** Claude Code runs
  hook commands through Git Bash natively on Windows; the installer's rewrite
  to a `scripts\run-hook.cmd` cmd-wrapper made bash eat the backslash and
  fail non-blocking — surfaced by this mission's fresh-install smoke test.
  Hooks now ship in their original `bash scripts/*.sh` form on every
  platform; re-running the installer migrates previously-broken settings
  back (`unpatchWindowsHooks`); `run-hook.cmd` is retired.
  _Pattern:_ wrappers that duplicate platform discovery the product already
  does become silent failure points when the product moves.
- **Test files no longer ship in the npm tarball.** Subdirectory `.npmignore`
  files (`*.test.js`) prune even explicitly `files`-listed entries (verified
  against npm docs and empirically); a packaging drift-guard test asserts no
  test files, no `_planning/` content, and all production files present.
- **M-0004 — The main-branch write guard blocked the framework's own worktree
  flow.** `guard-main-branch.sh` resolved the branch from the session's cwd,
  so with the primary checkout sitting on `main`, writes targeting
  `.worktrees/<id>` on a mission branch were refused: the flagship mission
  flow fought its own policy. The hook now resolves state from the _target
  path's_ containing worktree (`git -C <target-dir>`). Direct writes to a
  main-checked-out path remain blocked, and regression tests cover both
  directions.
  _Pattern:_ a hook that interrogates the session's cwd instead of the path
  the tool call names is a defect class, not a one-off bug.
- **M-0004 — `mission-cli move` broke on untracked companion files.** The
  transition used `git mv` for everything, so a mission carrying an untracked
  evidence directory stranded half-moved with "source directory is empty".
  The move now uses `git mv` for tracked files, a plain rename for untracked
  companions, and tolerates a pre-existing destination directory. Verified
  live against the exact shape that broke M-0003's closeout.
- **M-0004 — Six M-0003 helper scripts were missing from the npm `files`
  whitelist**, so shipped command bodies invoked scripts that did not ship.
  Added, along with a _reverse_ packaging assertion in `cli.test.js`: every
  `scripts/*.js|sh` invoked by a shipped command or skill body must itself
  ship. Proven red against the pre-fix whitelist, then green.

## [3.5.1] — 2026-05-19

The **L8 hardening release**. Patch-level bug fixes covering five defects in
the Codex cross-model review (L8) pipeline plus two YAML-author-experience
papercuts surfaced during the same review. No API changes. Every entry leads
with the **root cause** and the **reusable pattern** so the prevention is
discoverable, not just the symptom.

### Fixed

- **L8 #1 (Critical) — OpenAI structured-output schema rejected with HTTP 400.**
  _Root cause:_ OpenAI's structured-output JSON Schema has no notion of
  "optional property" — every key in `properties` must also appear in
  `required`; optionality is expressed by a `["T", "null"]` type union. The
  shipped `findings.items` schema declared `suggested_fix` in `properties`
  but omitted it from `required`, so every `codex exec --output-schema` call
  failed `invalid_json_schema` 400. Blocked 100% of L8 reviews in every
  consuming project.
  _Pattern:_ when writing schemas for OpenAI structured outputs, every leaf
  object's `required` array must be a superset of its `properties` keys.
  Audit the whole schema for this class on every change.
  Fix: `framework/templates/codex-review-schema.json`.

- **L8 #2 (High) — `.dos-apes/` and mission paths resolved against the worktree, not the main checkout.**
  _Root cause:_ `const PROJECT_ROOT = process.cwd()` at the top of
  `codex-review.js` and `codex-review-loop.js`. Run from a git worktree,
  PROJECT_ROOT pointed at the worktree path and read the branch's stale
  copy of `.dos-apes/` — so any fix on `main` (including L8 #1's schema
  fix) was invisible to in-flight missions.
  _Pattern:_ never derive a project root from `process.cwd()` in scripts
  that can run from a git worktree. Resolve via
  `git rev-parse --git-common-dir`; its parent directory is the canonical
  project root from any worktree, the main checkout, or CI.
  Fix: `framework/scripts/codex-review.js`, `framework/scripts/codex-review-loop.js`.

- **L8 #3 (Medium) — Codex failure messages were truncated from the START, missing the real error footer.**
  _Root cause:_ failure handling did `detail.slice(0, 500)` — the **first**
  500 chars. Codex CLI 0.130 prints a ~400-char startup banner and echoes
  the user prompt before any error, so the slice window never reached the
  actual `invalid_request_error / status: 400` footer. Made every other L8
  bug undebuggable (had to land this before #2/#4).
  _Pattern:_ tools that print banners and echo input before failing
  produce diagnostics where the signal lives at the **tail**. Slice from
  the end (`detail.slice(-1000)`) and side-file the full output to
  `os.tmpdir()` so nothing is lost regardless of cap. Wrap the side-file
  write so a write failure can never mask the original error.
  Fix: `framework/scripts/codex-review.js`.

- **L8 #4 (Critical) — Loop emitted `state:"skipped"` exit 0 for in-flight missions with an empty diff.**
  _Root cause:_ `git diff <base>...HEAD`. From the main checkout HEAD == base
  for un-merged missions, so the diff was empty and `codex-review.js`
  emitted a `"no changes"` skip — indistinguishable from "L8 disabled" or
  "Codex unavailable". `/apes-build` treated it as success, advanced the
  mission to `review/`, and never wrote an L8 entry to `verification.jsonl`.
  Silent no-op on every mission run from the wrong directory.
  _Pattern:_ when computing a diff for a mission-scoped review, pin the
  range to the mission's `workspace.branch` from frontmatter, not to HEAD.
  An empty diff for a mission in `doing/` is a misconfiguration, not a
  legitimate skip — hard-fail (exit 2). Regression-lock at the
  **loop-forwarding** layer too, not just the single-shot caller: the
  silent no-op originally lived in how the loop relayed the skip.
  Fix: `framework/scripts/codex-review.js`. Regression test:
  `framework/scripts/codex-review-cwd-equivalence.test.js` (4 cases, both
  layers).

- **L8 #5 (Medium) — `apes-build` step 4.5 specced an undocumented CWD dependency.**
  _Root cause:_ the build spec invoked `codex-review-loop.js` without
  specifying a working directory; the underlying script silently depended
  on one. An agent reading the spec literally would run it from the main
  checkout and trip L8 #4.
  _Pattern:_ specs and the code they invoke must agree on prerequisites —
  a CWD requirement that lives only in oral tradition is a latent bug.
  After fixing the script to be cwd-independent, the spec comment now
  documents that, and explicitly warns against re-introducing a
  `( cd .worktrees/<id> && ... )` wrapper, which would mask future cwd
  regressions instead of surfacing them.
  Comment-only change: `framework/commands/apes-build.md`.

- **YAML parser error (Low-Medium) — flow-style rejection named the rule, not the fix.**
  _Root cause:_ `lib/mission-parser.js#rejectExotic` deliberately rejects
  flow-style sequences/mappings — the hand-rolled parser accepts only a
  YAML subset, and that constraint is intentional. But the error said
  "unsupported YAML feature flow-style sequence" without showing the
  supported form or pointing at the spec, so authors had no actionable
  path forward.
  _Pattern:_ when intentionally rejecting a construct, the error at the
  point of failure should name **what** is rejected and show **what to
  use instead**, with a doc pointer. "It's by design" is not an excuse for
  unactionable diagnostics.
  Fix: `framework/lib/mission-parser.js`.

- **YAML template guidance (Low-Medium) — author-facing surface didn't surface the constraint.**
  _Root cause:_ the mission template (the file authors copy when writing
  missions) had no inline note about the YAML subset. The constraint
  only surfaced at parse time — late, after the author had committed to a
  shape.
  _Pattern:_ parser-scope constraints belong on the author's surface
  (the template), inside the frontmatter fence as YAML comments so the
  parser ignores them. The skill file is deliberately left untouched —
  skills stay domain-generic; tooling constraints live with the tooling.
  Comment block added in `framework/templates/mission-template.md`.

### Added

- **`framework/scripts/codex-review-cwd-equivalence.test.js`** — four-case
  regression test that exercises `codex-review.js` and
  `codex-review-loop.js` from both the main checkout and a worktree with a
  stubbed `codex` binary, asserting identical review content and that the
  loop propagates the doing-guard exit code rather than relaying it as
  `state:"skipped"`. Packed in the tarball so consumers can run it
  (`node scripts/codex-review-cwd-equivalence.test.js`).

## [3.5.0] — 2026-05-08

The **Claude Desktop authoring release**. Closes the loop between Claude
Desktop planning and Claude Code execution by shipping a parent skill +
three workflow sub-guides (PRD, feature, bugfix) that teach Claude
Desktop how to interview a user and produce well-formed inputs for
`/apes-build`. The CLI installer drops the four `.md` files into a
`claude-desktop-skills/` directory at the project root; users copy them
into their Claude Desktop project's project files to enable the full
authoring workflow.

### Added

- **`framework/claude-desktop-skills/dos-apes-authoring.md`** — parent
  router skill. Targets Claude Desktop. Routes greenfield, brownfield-
  feature, and bugfix conversations to the right workflow sub-guide.
  Documents the two-Claude split (Claude Desktop authors; Claude Code
  executes), the canonical artifact formats, and the handoff to
  `/apes-build`.
- **`framework/claude-desktop-skills/authoring-prd-missions.md`** —
  greenfield workflow guide. Seven-question interview, six pushback
  patterns, phase-breakdown opinion, PRD template, mission-stub
  production. Produces `PRD.md` + Phase 1 mission stubs in
  `.planning/missions/todo/`.
- **`framework/claude-desktop-skills/authoring-feature-missions.md`** —
  brownfield-feature workflow guide. Six-question interview, five
  pushback patterns, three anti-patterns. Produces a single mission
  file via `/apes-mission new "<title>"`.
- **`framework/claude-desktop-skills/authoring-bugfix-missions.md`** —
  bugfix workflow guide. Five-question interview (steps → expected →
  actual → reproducible → error output), four pushback patterns,
  bugfix body shape (Steps to reproduce / Expected / Actual / Error
  output / Frequency / Suspected location). Filed via
  `/apes-mission new "<title>" --label bug` per current CLI; forward-
  compatibility note describes the planned `--type bugfix` transition.
- **CLI installer copy step.** `bin/cli.js` copies
  `framework/claude-desktop-skills/` → `claude-desktop-skills/` at the
  project root during `npx dos-apes-super-agent`. Skipped if the
  destination already exists (matches the `.planning/` preservation
  pattern).
- **Post-install Next Steps.** Both greenfield and brownfield Next
  Steps blocks now surface the Claude Desktop step as bullet 4 with
  an "(Optional)" prefix.

### Changed

- **README.md** — new `## Claude Desktop authoring workflow` section
  between Quick Start and How It Works, with the four-file copy
  instruction and a one-paragraph workflow summary.
- **ARCHITECTURE.md** — new `### Two Claude surfaces` paragraph under
  Architecture Overview describing the authoring (Claude Desktop) ↔
  execution (Claude Code) split. `claude-desktop-skills/` added to
  the framework File Inventory tree. `3.5.0` row added to Version
  History.
- **`package.json` `files`** — `framework/claude-desktop-skills/`
  added so the npm tarball includes all four authoring `.md` files.

### Fixed

- **CLI VERSION constant drift.** `bin/cli.js` previously hardcoded
  `const VERSION = "3.1.0"` and had drifted across the 3.2.0, 3.3.0,
  and 3.4.0 releases — `node bin/cli.js --version` would print stale
  values regardless of the actual `package.json` version. VERSION now
  derives from `package.json` via `require("../package.json")`. Six
  call sites (banner, help, --version, summary box, generated
  CLAUDE.md footer, .planning/MEMORY.md initializer) now share a
  single source of truth.

### Migration

None. Existing installs are unaffected. Re-running
`npx dos-apes-super-agent` adds the `claude-desktop-skills/` directory
without disturbing other content; if the directory already exists, it
is preserved as-is.

## [3.4.0] — 2026-05-03

The **mission-native L8 release**. Codex adversarial-review state now
lives where every other mission attribute lives — in mission frontmatter
— rather than being parsed out of loop stdout each time a caller wants
to know what the reviewer concluded. `/apes-status` surfaces the
verdict and unresolved-finding count for every active mission;
`/apes-build` reads the verdict from the mission file rather than
re-parsing the loop's pipe output; `codex.required: true` makes a
`skipped` terminal a hard error so a required L8 review can't be
silently bypassed when Codex happens to be unavailable.

### Added

- **`codex` block in mission frontmatter** (schema v2). Optional one-
  level-nested object with six fields: `required`, `max_rounds`,
  `last_verdict`, `last_review_path`, `unresolved_findings`,
  `last_run_at`. Validated by `mission-schema.js`; the
  `CODEX_VERDICTS` enum (`none`, `accepted`, `partial-success`,
  `findings-reported`, `exhausted`, `no-progress`, `skipped`) is the
  single source of truth for valid verdicts. The block is added
  automatically the first time L8 runs against a mission — clean
  missions without Codex stay clean.
- **Schema migration v1 → v2.** `migrateFrontmatter` now stamps
  `schema_version: 2` and bumps `updated` on read; idempotent on v2
  inputs. Forward-only. No codex block is added by the migration
  itself — only by L8 actually running.
- **Three new MissionTracker helpers**: `getCodexState(id) → object |
null`, `setCodexState(id, partial)` (shallow merge through the
  validation gate), `clearCodexState(id)` (removes the block). All
  route through the existing schema-validate-then-write path.
- **Codex state surfaced on `/apes-status`.** Missions in `doing/` and
  `review/` show `codex: <verdict>, <N> unresolved` when a codex block
  is present; missions without one render exactly as before. The
  Review section also displays the legacy
  `codex_findings_unresolved: true` flag alongside, so reviewers see
  both the new and backward-compat signals together.
- **`codex.required: true` gate.** Setting this on a mission makes the
  loop refuse to terminate with `skipped` — it raises
  `RequiredSkipError`, prints to stderr, and exits non-zero.
  `/apes-build` catches the non-zero exit and refuses to advance the
  mission to `review/`. Missions that genuinely depend on adversarial
  review can now express that dependency mechanically.
- **New skill sections.** `framework/skills/missions.md` "Codex review
  state" with field reference and last-verdict enum table;
  `framework/skills/cross-model-review.md` "Mission state surface"
  covering writers, fields, consumers, and the required gate.
- **44 new tests** across `mission-tracker.test.js` (12),
  `codex-review.test.js` (14, new file), and
  `codex-review-loop.test.js` (30, new file). `npm run test:lib` now
  runs all four suites: 126 tests in 4.6 s.

### Changed

- **`framework/scripts/codex-review.js`** (single-shot) writes Codex
  state to mission frontmatter via
  `MissionTracker.setCodexState(id, ...)` after every successful
  review — `last_verdict` (`accept` → `accepted`, `revise`/`reject`
  → `findings-reported`), `last_review_path` (relative, forward
  slashes), `unresolved_findings` (count of high/critical),
  `last_run_at` (ISO 8601). The two post-review side effects
  (verification log + codex block) are consolidated into one
  best-effort `recordCodexReview` helper; either failing reduces to a
  one-line stderr warning.
- **`framework/scripts/codex-review-loop.js`** maintains the codex
  block across iterations: each iteration bumps `last_run_at` at
  start, and the terminal state is mapped onto the block per the
  M-0005 P3 table. Workpad entries are now selective — written for
  `partial-success`, `exhausted`, `no-progress`; suppressed for
  `accepted`, `findings-reported`, `skipped`. Mission state
  (todo/doing/review/done/canceled) is **never** changed from inside
  the loop — that remains the caller's responsibility.
- **`/apes-build`** reads `codex.last_verdict` from the mission
  frontmatter (via `mission-cli show`) rather than parsing the loop's
  stdout. Hard-stops on any non-zero loop exit so the required-skip
  gate firing actually halts the build. Per-state actions are
  unchanged from M-0004; only the input source moved.
- **`/apes-status`** renders the codex line for missions in `doing/`
  and `review/`. The renderer reads `m.frontmatter.codex` directly
  from the existing `mission-cli list` output — `list`'s contract is
  unchanged, no extra CLI calls.
- **`createMission`** now stamps `schema_version: 2` on freshly
  authored missions so new files don't need the migration on first
  read.
- **`framework/templates/mission-template.md`** updated to
  `schema_version: 2` with a commented codex block example
  documenting that the block is auto-added by L8; explicit
  declaration is only needed for `required: true` or non-default
  `max_rounds`.
- **`package.json`** `files` field now lists framework scripts
  individually instead of including the whole `framework/scripts/`
  directory. This mirrors the existing `framework/lib/` pattern and
  keeps `*.test.js` files out of the npm tarball. Production
  inventory is unchanged (20 scripts ship; 0 test files).

### Migration

- **Existing v1 missions auto-upgrade to v2 on first read.** The
  migration runs in memory inside `MissionTracker.readMission`; the
  disk file stays untouched until the caller performs an actual
  mutation (`updateFrontmatter`, `appendWorkpadEntry`,
  `setCodexState`). This preserves the no-surprise-mutation
  principle from M-0002 — a pure read leaves mtime and bytes
  untouched.
- **No codex block is added by the migration itself.** Missions that
  never engage L8 stay clean — `schema_version: 2` is the only field
  the migration introduces. The codex block appears only when L8
  actually runs against the mission, or when the mission opts in
  explicitly via `required: true` or a custom `max_rounds`.
- **Backward-compatible**: the legacy top-level
  `codex_findings_unresolved: true` flag is still set by `/apes-build`
  for `exhausted`/`no-progress` terminals, so M-0004-era reviewers,
  dashboards, and CI checks that look for it keep working unchanged.
  New tooling should prefer reading `codex.last_verdict` and
  `codex.unresolved_findings` directly from the codex block.
- **No action required for callers**: `MissionTracker.readMission`
  migrates transparently; `mission-cli show` returns the migrated
  frontmatter; `validateFrontmatter` accepts both v1 and v2 shapes
  during the transition.

## [3.3.0] — 2026-05-03

The **library-layer release**. A behavior-preserving refactor that
extracts every piece of mission-touching logic — frontmatter parsing,
state-machine transitions, ID generation, dependency resolution, workpad
appends, active-mission management — into a single tested library at
`framework/lib/`. The five mission-touching scripts and four
mission-touching slash commands now route through the library; inline
`node -e` blocks and ad-hoc regex parsers are gone. No observable
behavior changes ship with this release; the value is consolidation,
schema versioning, and an extension point for future storage backends.

### Added

- **`framework/lib/mission-schema.js`** — Frozen constants and pure
  validation/migration helpers. Exports `CURRENT_SCHEMA_VERSION` (= 1),
  `STATES`, `LEVEL_IDS`, `validateFrontmatter(fm) → { valid, errors }`,
  and `migrateFrontmatter(fm)`. Zero I/O, zero dependencies. Every
  problem is surfaced at once instead of throwing on the first error.
- **`framework/lib/mission-parser.js`** — Frontmatter ↔ body splitting,
  scalar / list / nested-field accessors (`getScalar`, `getList`,
  `getNestedScalar`, `getNestedList`), full `parseMission` composer, plus
  `parseAcceptanceCriteria(body)` (returns `[{ text, checked }]`) and
  `parseWorkpadEntries(body)`.
- **`framework/lib/mission-tracker.js`** — The `MissionTracker` class.
  Identity (`generateNextId`, `isValidId`, `findMissionById`,
  `findMissionByIdInState`), listing (`listMissionsByState`,
  `listAllMissions`), state machine (`canTransition`, `moveMissionState`,
  `validateStateTransition`), mutations (`readMission`, `writeMission`,
  `updateFrontmatter`, `appendWorkpadEntry`), dependencies
  (`getDependencies`, `resolveUnmetDependencies`, `detectCycles`), active
  mission (`getActiveMission`, `setActiveMission`, `clearActiveMission`),
  verification log (`getVerificationLogPath`), and authoring
  (`createMission`). Synchronous throughout. Validates every write before
  touching disk.
- **`framework/lib/mission-parser.test.js`** + **`mission-tracker.test.js`** — 31 + 32 = 63 tests covering every method on the public surface plus
  the parsing edge cases that previously varied script-by-script.
- **`framework/scripts/mission-cli.js`** — Thin shell-friendly wrapper
  around `MissionTracker`. Twelve verbs (`list`, `show`, `next-id`,
  `move`, `workpad`, `update`, `deps`, `active`, `set-active`,
  `clear-active`, `create`, `can-transition`); every verb prints exactly
  one JSON object on stdout. Exit codes: `0` ok, `1` invalid input,
  `2` not found, `3` precondition failed. Slash commands and external
  tooling call this instead of hand-rolling Node snippets.
- **Schema versioning** — Every mission carries an implicit
  `schema_version`. The framework ships at version 1; the migration
  framework (`MIGRATIONS` array, `migrateFrontmatter` walker) is in
  place but has nothing to migrate from yet. Adding a future schema
  version is a matter of bumping `CURRENT_SCHEMA_VERSION` and appending
  a `{ from, to, migrate(fm) }` record — `migrateFrontmatter` walks the
  chain automatically.
- **`npm run test:lib`** — runs the parser and tracker test suites.
- **Library-layer prose** — `ARCHITECTURE.md` "Library Layer" section
  (between Mission Layer and Verification Pyramid) and
  `framework/skills/missions.md` "Programmatic API" section, both
  pointing at the library as the canonical interface.

### Changed

- **All mission-touching scripts now route through `MissionTracker`.**
  No observable behavior change is intended in any of these — same
  inputs, same outputs, same exit codes — but the implementation no
  longer duplicates mission logic five different ways:
  - `framework/scripts/mission-worktree.js` — `parseMissionId`,
    `findMissionFile`, `readMissionMeta` delegate to the library.
    Worktree-specific path validation (`validateWorktreeRel`,
    `resolveInsideRepo`, `validateBranchName`) stays local — it is
    security-critical and not a mission concern.
  - `framework/scripts/evidence-packet.js` — Removed local `STATES`,
    `parseMissionId`, `findMissionFile`, `splitFrontmatter`,
    `getScalar`, `getNestedScalar`, `getList`, `getNestedList`,
    `readMissionMeta`. Replaced with `tracker.findMissionById(id)` and
    `tracker.getVerificationLogPath(id)`. `acceptanceStatus` stays local
    — its substring-match behavior is richer than the library's
    `parseAcceptanceCriteria` and is evidence-packet-specific.
  - `framework/scripts/log-verification.js` — Removed local `STATES`,
    `readActiveMission`, `findMissionState`. Now uses
    `tracker.getActiveMission()` and `tracker.getVerificationLogPath(id)`.
    The graceful-degradation contract is preserved: missing
    active-mission, missing mission file, or write errors all warn to
    stderr and exit 0; argument-validation errors still exit 2. The
    `LEVEL_NAMES` dictionary stays local.
  - `framework/scripts/codex-review.js` — `loadMission` uses
    `tracker.findMissionById(id)` and `parser.parseFrontmatter`. A small
    `findLegacyMissionFile` helper retains the pre-slug filename lookup
    so older mission shapes still resolve.
  - `framework/scripts/codex-review-loop.js` — Removed local
    `findMissionFile` and the inline `appendMissionWorkpad` body. Now
    uses `tracker.findMissionById(id)` and
    `tracker.appendWorkpadEntry(id, note)`.
- **All mission-touching slash commands now invoke `mission-cli.js`
  and the library** instead of inline `node -e` blocks:
  - `framework/commands/apes-mission.md` — `new`, `list`, `show`,
    `move`, `workpad` subcommands all shell out to `mission-cli.js`.
    The FSM table is now a documentation echo of the library's frozen
    `TRANSITIONS` constant.
  - `framework/commands/apes-build.md` — Mission resolution, target
    selection, dependency-unmet checks, state transitions, workpad
    appends, and `codex_findings_unresolved` flag setting all go
    through `mission-cli.js update`.
  - `framework/commands/apes-status.md` — The ~75-line inline node
    script that re-implemented frontmatter parsing has been retired.
    The Missions section now reads `mission-cli.js list` JSON output
    and groups by state in pure shell.
  - `framework/commands/apes-evidence.md` — Active-mission fallback
    reads via `mission-cli.js active`.
- **`framework/settings.json`** permissions list grants
  `Bash(node scripts/mission-cli.js:*)` so the slash commands can
  invoke the wrapper without per-call approval prompts.
- **`bin/cli.js`** — Now copies `framework/lib/` to `<project>/lib/`
  alongside `scripts/`, gated by the same `--no-hooks` flag (the lib
  has no consumers when scripts aren't installed). The install summary
  prints a "Library" line.
- **`package.json` `files` array** lists the three production lib
  modules by name (`framework/lib/mission-parser.js`,
  `mission-schema.js`, `mission-tracker.js`). Listing files
  individually keeps `*.test.js` out of the npm tarball without
  needing `.npmignore`.
- **`package.json` `test` script** now runs `npm run test:lib`
  (the library suite) rather than the never-created
  `node test/test.js`. The previous script was broken from before
  3.3.0; pre-3.3.0 there were no Node tests to run, so the missing
  file was invisible. The library tests are the test suite now.

### Notes — issues encountered during the playbook execution

The refactor surfaced four pieces of context worth recording. None block
the release; each is an honest call-out for the next maintainer.

#### 1. Workpad timestamp format normalized + reader compatibility shim

Pre-3.3.0, `codex-review-loop.js` wrote workpad headings in the format
`### YYYY-MM-DD HH:MM UTC — codex-loop`. The library's canonical format
(matching `apes-mission.md` and `missions.md` prose) is
`### YYYY-MM-DD HH:MM` — no `UTC` literal, no role suffix. The
`codex-loop` attribution moved into the first line of the note body
(`**codex-loop** — L8 cross-model review terminal state: ...`) so
readers still see at a glance which subsystem wrote each entry.

That format change broke an implicit contract with the workpad-timestamp
regex inline in `apes-status.md` line 144. To avoid shipping `main` with
a writer/reader mismatch during P4 (when the library landed but
`apes-status.md` had not yet been migrated), the inline regex was
tightened to accept both shapes:

```js
/^###\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?:\s+—\s+\S.*)?\s*$/gm;
```

Anchored at end-of-line, with an optional non-capturing group for the
legacy role suffix. P5 then rewrote `apes-status.md` to call the
library directly, but the tightened regex stays — it cleanly handles
any legacy missions written before the format change.

**Forward note:** if a new workpad-format change is needed, update
`mission-tracker.appendWorkpadEntry`, `mission-parser.parseWorkpadEntries`,
and the prose in `framework/skills/missions.md` in the same commit. The
library is the single writer now, so format drift is no longer possible
at write time.

#### 2. `defaultBranch` divergence — flagged, deferred

P1's inventory found that `mission-worktree.js` produces
`feat/m-nnnn-<slug-of-title>` for the default branch name, while
`evidence-packet.js` produces `feat/m-nnnn` with no slug. Mission
frontmatter pins the canonical value via `workspace.branch`, so in
practice the difference only matters when frontmatter is missing — but
the helpers should not disagree.

P3 did not promote `defaultBranch` into `MissionTracker` (the API
discussion settled on the slug version, but no callsite needed the
helper at the time). Each script keeps its own variant for now. A future
release can centralize this in `mission-tracker.js` as a one-line
refactor — both call sites are clearly marked with a comment.

#### 3. `mission-schema.js` is a narrower P3 subset of the inventory plan

The inventory (`_planning/M-0002-mission-tracker-inventory.md` § 9) called for thirteen
constants and helpers in `mission-schema.js`. The library that actually
shipped exports five: `CURRENT_SCHEMA_VERSION`, `STATES`, `LEVEL_IDS`,
`validateFrontmatter`, `migrateFrontmatter`. The other constants
(`LEVEL_NAMES`, `TRANSITIONS`, `DEFAULT_BRANCH`, `EVIDENCE_DIR_NAME`,
`WORKPAD_TIMESTAMP_FORMAT`, `WORKPAD_HEADING_REGEX`, `MISSION_ID_REGEX`,
`formatWorkpadTimestamp`, `isValidMissionId`, `isValidState`,
`isValidTransition`) live inside `mission-tracker.js` — sometimes as
private constants, sometimes as instance methods like `tracker.isValidId`.
Functionally equivalent. The choice was driven by call-site needs: every
caller is going through the tracker anyway, so re-exposing the same
constants from `mission-schema.js` would have been duplication for its
own sake.

If a future consumer wants the constants without instantiating a tracker
(say, a static analyzer that reads mission files but does not mutate
them), the right move is to hoist them from `mission-tracker.js` into
`mission-schema.js` rather than re-derive them. They are already frozen
and validated in one place; moving them is a copy-paste, not a redesign.

#### 4. Version-bump correction (2.3.0 → 3.3.0)

The P6 spec called for "Bump package.json to 2.3.0." The codebase had
already shipped 3.0.0 (commit `36fb25b`), 3.1.0 (`010ff3a`), and 3.2.0
(`e3f3777`); bumping to 2.3.0 would have been a downgrade — semver-
confusing (`npm install` would still resolve to 3.2.0 as `latest`,
leaving the library release effectively invisible) and a regression of
the `version` field. Direct precedent in this changelog: the 3.1.0
notes record the same situation when the missions-release playbook was
authored against a v2 baseline, and the 3.2.0 notes (Deviation 2)
record it again for the L8 release.

**Resolution:** Bumped to **3.3.0** — the next minor from the actual
current version. Documented here so a future spec author updating the
playbook from a stale baseline gets a clean diff.

---

## [3.2.0] — 2026-05-02

The **adversarial review release**. Adds L8 to the verification pyramid: a
second model (the OpenAI Codex CLI, default `gpt-5.5`) reviews the diff
produced by the first model (Claude) and emits structured findings against a
JSON schema. A feedback-loop driver addresses high/critical findings
automatically up to a configurable iteration cap. Everything is opt-in,
capability-gated, and fails open — the framework remains fully functional
without Codex installed.

### Added

- **L8 — Adversarial Review.** New top of the verification pyramid.
  Cross-model review of the current branch's diff via the Codex CLI.
  Disabled by default; flip on with `/apes-codex-review --enable`.
- **`scripts/codex-check.js`** — prerequisite verifier. Confirms `codex` is
  on PATH, the user is authenticated, and the configured model honors
  `--output-schema` by running an actual structured-output round-trip (not
  a string-pattern model-name check). Caches the verified capability to
  `.dos-apes/codex-capabilities.json` with a 24-hour TTL keyed on model;
  changing the configured model invalidates the cache automatically.
  Documented exit codes: `0` ready, `1` CLI missing, `2` not authenticated,
  `3` model lacks structured-output support, `4` network/timeout. Zero
  npm dependencies; Node built-ins only.
- **`scripts/codex-review.js`** — single-shot review primitive. Computes
  the diff vs `--base`, substitutes mission/diff into the prompt template,
  invokes Codex with `--output-schema` and `--output-last-message`, parses
  and validates the result against the four required top-level keys
  (`verdict`, `confidence`, `summary`, `findings`), filters findings
  against `skip_paths` globs, and writes the review to disk. Tolerant of
  Codex being unavailable (skips with a JSON envelope rather than
  failing). Optional `--mission <id>` integrates with the mission
  verification log.
- **`scripts/codex-review-loop.js`** — review-fix-review loop driver. Runs
  `codex-review.js`, evaluates findings against `loop_on_severity` (default
  `["high", "critical"]`), writes per-iteration feedback packets to
  `.dos-apes/codex-reviews/iteration-N/`, spawns Claude Code to address
  them, and repeats up to `max_iterations` (default 3). Six terminal
  states, all reachable in code: `accepted`, `partial-success`,
  `findings-reported` (`--no-fix`), `exhausted`, `no-progress`, `skipped`.
  Detects no-progress by comparing `git rev-parse HEAD` before and after
  each fix attempt. Appends a workpad entry to the active mission file
  per the missions-skill convention.
- **`/apes-codex-review` slash command.** Subcommands: default (single-shot
  review), `--loop` (full feedback loop), `--mission <id>`, `--enable`,
  `--disable`, `--status`. Loads `cross-model-review.md` in its preamble.
  Worked example output for clean accept, findings-with-suggestion, loop
  accepted, loop exhausted, and loop no-progress.
- **`framework/skills/cross-model-review.md`** — the consumer protocol.
  Verdict semantics, severity-by-verdict eligibility table, sort order
  (`severity_rank, file, line`), fix protocol with the documented commit
  format `fix(codex-review): address iteration N findings`, anti-pattern
  list, mission-composition rules, and the three loop-termination
  conditions mapped to terminal states.
- **`framework/templates/codex-review-config.json`** — opt-in config
  template (9 fields). Defaults: `enabled:false`, `model:"gpt-5.5"`,
  `reasoning_effort:"high"`, `sandbox:"read-only"`, `max_iterations:3`,
  `loop_on_severity:["high","critical"]`, `diff_base:"main"`,
  `timeout_seconds:300`, conservative `skip_paths`.
- **`framework/templates/codex-review-config.README.md`** — field-by-field
  reference plus exit-code table for `codex-check.js`. Documents the
  `gpt-5-codex` `--output-schema` issue and why the default is `gpt-5.5`.
- **`framework/templates/codex-review-prompt.md`** — reviewer prompt with
  scope rules, citation requirement, severity definitions, and four
  documented placeholders (`{{MISSION_CONTEXT}}`, `{{ACCEPTANCE_CRITERIA}}`,
  `{{DIFF_STATS}}`, `{{DIFF}}`).
- **`framework/templates/codex-review-schema.json`** — JSON Schema (draft
  2020-12) for the structured findings. Locked down with
  `additionalProperties: false` at root, `findings[]`, and `line_range`.
- **Enforcement-tiers section in `testing.md`.** Formalizes the existing
  groupings (Deterministic / Automated / Comprehensive) and adds a fourth
  tier — **External** — for L8.

### Changed

- **Verification pyramid expanded from 8 to 9 levels.** Updated diagrams
  and counts in `testing.md`, `apes-verify.md`, `README.md`, and
  `ARCHITECTURE.md`.
- **`/apes-verify`** runs L8 as a single-shot review (no loop) after the
  browser-tier levels. Conditional on `enabled:true` in
  `.dos-apes/codex-review-config.json` AND `scripts/codex-review.js` being
  installed. **L8 never contributes to FAIL** — it fails open.
- **`/apes-build`** invokes the L8 loop for the active mission between
  L0–L7 verification and evidence-packet generation. Same enabled-flag
  guard. Branches on all six terminal states; `exhausted` and
  `no-progress` set `codex_findings_unresolved: true` in the mission
  frontmatter and still proceed to packet generation (the packet is the
  audit artifact — surfacing unresolved findings beats hiding them).
- **`scripts/log-verification.js`** recognizes `L8` as `Adversarial Review`
  in `LEVEL_NAMES`. Pre-3.2.0 versions reject `L8` as an unknown level
  (exit 2); `codex-review.js` tolerates that defensively (warns and
  continues) so users who upgrade the Codex pieces without re-running the
  installer see clear stderr output instead of silent data loss. Both
  defenses stay — belt and suspenders.
- **`package.json` description** mentions the 9-level pyramid.
- **`package.json` `files` array** extended with the four new templates.

### Required (optional)

- **Codex CLI** for L8 functionality. Install via
  `npm install -g @openai/codex` and run `codex login` once per machine
  (auth via ChatGPT account; no API key required). The framework remains
  **fully functional without it** — every L8 entry point fails open.
- **Node ≥ 18, Git ≥ 2.20** (unchanged from prior releases).

### Notes — issues encountered during the playbook execution

The playbook (P1–P7) ran end-to-end with three deviations from the spec
worth recording. Each is intentional, documented in code, and was approved
by the user during the review pass.

#### Deviation 1: P3 hybrid positional/stdin prompt routing

**Where:** `framework/scripts/codex-review.js` `spawnCodex()`.

**Spec said:** "Pass the prompt as a positional argument (not via stdin)
for cross-platform reliability — PowerShell's stdin handling differs from
bash's, and the playbook needs to work on both."

**Why deviated:** On Windows where the Codex CLI installs as a `.cmd`
shim (the `npm install -g` default), the resolved binary forces routing
through `cmd.exe`, whose argv ceiling is ~8 KB. A 500-line diff produces
an ~80 KB prompt — silently truncated under strict positional-only.
Verified with `codex.cmd` on the maintainer's machine: routed-through-cmd
fails the acceptance criterion "diff substitution works with at least one
~500-line diff."

**Resolution:** Hybrid — positional arg under a 7 KB threshold, switches
to spawnSync's `input` option (with `-` as the positional) above. Critical
nuance: spawnSync's stdin handling writes to the child's stdin via OS
APIs with **no shell involvement**, so the cross-platform concern the
spec raised (PowerShell-vs-bash piping behavior) does not apply here —
that concern is about _shell-level_ piping (`Get-Content | codex`),
not Node-mediated stdin. Documented in the file header.

**Why this matters going forward:** Spec rules that conflict with real
platform constraints should produce visible deviations with reasoning,
not silent truncation. The framework's "L8 fails open" contract would
not save us here — a 7 KB prompt that succeeds and an 80 KB prompt that
silently delivers ~7 KB worth of diff would both look like "L8 ran
green." Hard to debug; better to surface the routing decision in code.

#### Deviation 2: P6 version-bump correction (2.2.0 → 3.2.0)

**Where:** `package.json`, `CHANGELOG.md`, `ARCHITECTURE.md`.

**Spec said:** "Bump package.json version to 2.2.0."

**Why deviated:** The codebase had already shipped `3.0.0` (commit
`36fb25b`) and `3.1.0` (commit `010ff3a`). Bumping to `2.2.0` would have
been a downgrade — semver-confusing (`npm install dos-apes-super-agent`
would still resolve to `3.1.0` as `latest`, leaving the L8 release
effectively invisible) and a regression of the `version` field. There
is direct precedent: the 3.1.0 changelog (line 158, "Non-issue:
version-number question") records the same situation from the prior
playbook (called for `2.1.0` against a 3.0.0 baseline; bumped to
`3.1.0`).

**Resolution:** Bumped to **3.2.0** — the next minor from the actual
current version. Documented here so a future spec author updating the
playbook from a stale baseline gets a clean diff.

#### Deviation 3: P6 pyramid-diagram-in-apes-build is non-applicable

**Where:** `framework/commands/apes-build.md`.

**Spec said:** "Update the pyramid ASCII diagram in apes-verify.md and
apes-build.md to show L8."

**Why deviated:** `apes-build.md` does not have its own pyramid ASCII
diagram. It explicitly delegates: "The verification pyramid runs as
documented in `.claude/skills/testing.md`" (line 156, pre-P6). The
canonical diagram lives in `testing.md` and is updated there.

**Resolution:** Updated `testing.md` and `apes-verify.md`. Did not add a
duplicate diagram to `apes-build.md` — duplication invites drift, and
`apes-build.md` already routes readers to the canonical source. If a
future contributor wants symmetry, the right move is to remove the
delegation prose from `apes-build.md` and add a single canonical
diagram, not to maintain two.

#### Operational note: TODO[P5] for Claude Code CLI invocation

`framework/scripts/codex-review-loop.js`'s `spawnClaudeFix()` carries a
clearly-flagged `TODO[P5]` block listing four specific things to verify
against the live Claude Code CLI: the non-interactive flag (currently
`-p`), explicit-vs-description-match skill loading, allowed-tools
inheritance, and exit-code contract. The loop's defensive paths (ENOENT,
timeout, non-zero exit, no-HEAD-advance) all route to the `no-progress`
terminal state, so a CLI flag drift surfaces visibly rather than
corrupting the loop. Validation deferred to real use — see
`/apes-codex-review --loop` against an intentional-bugs branch.

---

## [3.1.0] — 2026-05-01

The **missions release**. The framework gains a filesystem-backed mission
layer between strategic roadmap phases and tactical verification: the atomic
unit of work is now a mission file whose location on disk is its lifecycle
state, executed in an isolated git worktree, audited via a structured
verification log, and consumable by reviewers as a single evidence-packet
bundle.

### Added

- **Missions architecture.** Mission files at `.planning/missions/<state>/M-NNNN-<slug>.md`,
  where `<state>` is one of `todo`, `doing`, `review`, `done`, `canceled`.
  Transitions happen via `git mv`; audit trail is `git log --follow`.
- **Worktree workspaces.** Every `doing` mission runs in `.worktrees/M-NNNN/`
  on its own branch (`feat/m-nnnn-<slug>`). Created and managed by
  `scripts/mission-worktree.js` (zero-dep Node, `execFileSync` only — no
  shell, strict ID/path/branch validation, refuses to remove dirty
  worktrees). Requires git ≥ 2.20.
- **Structured verification log.** Each verification run appends a JSONL
  record to `.planning/missions/<state>/M-NNNN/verification.jsonl` via
  `scripts/log-verification.js`. Schema: `{ timestamp, level, level_name,
outcome, duration_ms, details, summary }`. Helper resolves the active
  mission from `.planning/active-mission` and degrades gracefully (warns
  to stderr, exits 0) when no mission is active.
- **Evidence packets.** `scripts/evidence-packet.js generate <M-NNNN>`
  assembles `summary.md`, `verification.jsonl`, `diff-stats.txt`, `diff.patch`,
  `auto-review.md`, and `screenshots/` under `.planning/missions/review/M-NNNN/evidence/`.
  Idempotent (wipe + rewrite). **Refuses to generate if any
  `verification.required_levels` lacks a passing entry** — the validation moat.
- **`/apes-mission` command.** Five subcommands: `new`, `list`, `show`,
  `move`, `workpad`. Auto-allocates IDs by scanning all five state dirs
  for `max + 1`. Documents preconditions for every state transition.
- **`/apes-evidence` command.** Wraps the packet generator and prints the
  cover sheet on success.
- **`framework/skills/missions.md`** — Mission file format, lifecycle, FSM,
  naming conventions, dependency resolution, phase relationship, workpad
  protocol, acceptance criteria format, anti-patterns.
- **`framework/skills/worktrees.md`** — Worktree lifecycle, recovery from
  corrupt/stale worktrees, cross-platform notes.
- **`framework/skills/evidence-packets.md`** — Packet contents, reviewer
  checklist, refusal contract, idempotency.
- **`framework/templates/mission-template.md`** — Canonical mission file
  with documented frontmatter schema.
- **`framework/templates/ROADMAP-TEMPLATE.md`** — Phases with metadata
  blocks and an auto-tracked active-missions section.
- **L1.5 verification level** (Documentation Drift), wired through
  `check-doc-drift.sh`.

### Changed

- **`/apes-build` is mission-aware.** New `--mission <M-NNNN>` flag builds
  one mission end-to-end. With `--prd`/`--idea`, generates missions in
  `todo/` first; combined with `--ralph`, iterates through them in priority
  order. `--mission` is mutually exclusive with `--prd`/`--idea`. Default
  (no flags) picks the highest-priority unblocked mission. `.planning/active-mission`
  is cleaned up on every abort path.
- **`/apes-status` reads missions.** New "Missions" section groups by state
  (`Doing`, `Review`, `Todo` top-5, `Done this week`), sorts by priority
  then created date, flags blocked missions with their unmet dependencies,
  reports evidence-packet presence in `review/`, renders empty states
  gracefully. Existing git/progress/worktree sections are untouched.
- **`check-coverage.sh`, `check-secrets.sh`, `check-doc-drift.sh`** now
  call `log-verification.js` after their main work (levels L2.5, L5, L1.5
  respectively). Logging failures never block the verification pipeline.
- **CLI installer** scaffolds `.planning/missions/{todo,doing,review,done,canceled}/`
  with `.gitkeep` files on fresh installs (preserves an existing tree),
  copies `mission-template.md` to `docs/templates/`, and copies
  `ROADMAP-TEMPLATE.md` to `.planning/ROADMAP.md` (preserves an existing roadmap).
- **`testing.md` skill** documents the verification-log schema and the
  graceful-degradation contract for `log-verification.js`.
- **`CLAUDE-TEMPLATE.md`** gains a "Planning & Missions" section, an
  acceptance-criteria writing guide (Specific / Testable / Atomic), and the
  workpad convention with a fully worked example.
- **`README.md`** has a new "Missions" section with the lifecycle CLI, a
  "Why missions?" explainer distinguishing missions (atomic) from phases
  (strategic), updated command tables, and updated file-inventory tree.
- **`ARCHITECTURE.md`** gains a "Mission Layer" section between "Core
  Components" and "Verification Pyramid," an updated architecture diagram
  showing missions and worktrees, and an updated file inventory (53 files).

### Required

- **Git ≥ 2.20** for `git worktree` modern semantics. The worktree script
  exits non-zero with a clear message on older versions.
- **Node ≥ 18** (unchanged from prior releases).

### Notes — issues encountered during the playbook execution

The playbook ran end-to-end with two issues worth recording. Both were
detected and fixed within the same task; nothing leaked downstream.

#### Issue 1: Bash parameter-expansion default trap in verification scripts

**Where:** `check-coverage.sh`, `check-secrets.sh`, `check-doc-drift.sh`
during P5 integration testing.

**Symptom:** When the helper function used `"${3:-{}}"` to default the
details JSON to an empty object, Bash silently appended a stray `}` to any
non-empty value. The resulting string parsed as JSON in the simple case
(empty default `{}`) but failed parsing for every real call site, e.g.
`{"src_changed":true,"doc_updated":false}}`.

**Root cause:** Bash parameter expansion `${VAR:-WORD}` reads `WORD` until
the _first_ unescaped `}` — that closes the expansion. The intended
default `{}` looks like `{` to the parser, and the trailing `}` becomes a
literal character appended after the expansion. This is documented Bash
behavior, not a Bash bug. The pattern is widely used and looks correct
unless you read it carefully.

**Fix:** Replaced the inline default with a temp variable:

```bash
local DETAILS="${3-}"
if [ -z "$DETAILS" ]; then DETAILS='{}'; fi
node scripts/log-verification.js LEVEL "$1" "$2" "$DETAILS" 2>/dev/null || true
```

**Why this matters going forward:** The verification log was being silently
truncated to argument-validation errors (exit 2) from `log-verification.js`,
which were swallowed by `2>/dev/null || true` — exactly the right
defensive posture for keeping the pipeline running, but it hid the bug
during the first integration round. Lesson: when wrapping a call in
`|| true`, run it without the wrapper at least once to verify the happy
path actually succeeds.

#### Issue 2: ROADMAP-TEMPLATE.md missing from npm package on first ship

**Where:** P3 created `framework/templates/ROADMAP-TEMPLATE.md` and wired
the CLI to copy it to `.planning/ROADMAP.md`. Surfaced in P10 when the
`npm pack --dry-run` check was added.

**Symptom:** On a real npm install (vs running CLI from a local checkout),
the template would be missing — the CLI's runtime fallback to a stub would
fire silently, hiding the failure.

**Root cause:** `package.json`'s `files` array enumerates each
template by name rather than including the whole `framework/templates/`
directory. P3 added the file to `framework/templates/` and wired the CLI,
but did not update the `files` allowlist. The CLI worked locally because
local development reads from disk, not from the packed tarball.

**Fix:** Added `framework/templates/ROADMAP-TEMPLATE.md` and
`framework/templates/mission-template.md` to `package.json` `files`. Verified
both ship via `npm pack --dry-run` in P10 and again in P12.

**Why this matters going forward:** Files-array enumeration is a
maintenance burden. Consider switching to `"framework/templates/"` as a
directory entry on the next release so new templates ship by default.
Tradeoff: that also ships any internal templates we don't intend to
publish, so it requires hygiene about what lives in that directory.

#### Non-issue: version-number question (2.1.0 vs 3.1.0)

The playbook (P1–P12) was authored against a v2.0 baseline; the codebase
had since shipped 3.0.0 (commit `36fb25b`, "release: v3.0.0"). The
playbook called for "2.1.0" throughout. After flagging the discrepancy,
the chosen version is **3.1.0** — the natural next minor after the
already-published 3.0.0. Going with 2.1.0 would have been numerically
publishable but semver-confusing: `npm install dos-apes-super-agent` would
still resolve to 3.0.0 as `latest`, leaving the missions release effectively
invisible to anyone not pinning a version.

---

## [3.0.0] — 2026-02

Product/orchestration roles, gate-enforced state machine, acceptance
criteria verification, four new skills, `/apes-board`, `/apes-gc`,
ExecPlans, architecture boundary enforcement, enhanced installer.

## [2.0.0] — 2025-02

Agent Teams rebuild, skills architecture, 8-level pyramid, hooks.

## [1.0.0] — 2025-02

Initial release with 12 agents, 5-level verification.
