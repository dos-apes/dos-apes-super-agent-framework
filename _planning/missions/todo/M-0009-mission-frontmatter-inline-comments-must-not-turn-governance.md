---
id: M-0009
schema_version: 2
title: "Mission frontmatter: inline comments must not turn governance booleans into strings; codex.required fails closed"
state: todo
created: 2026-10-05
updated: 2026-10-05
priority: 1
labels:
  - bugfix
  - governance
  - mission-parser
  - l8
workspace:
  branch: feat/m-0009-mission-frontmatter-inline-comments-must-not-turn-governance
  worktree: .worktrees/M-0009
codex:
  required: true
verification:
  required_levels:
    - L2
    - L8
---

## Problem

Mission frontmatter can silently turn a boolean governance field into a string,
and the `review → done` completion gate then **fails open** on it. Found at
M-0008 closeout (PR #26), where the record as merged had never opted into the
gate it declared.

Three defects, one path:

1. **The parser keeps inline comments inside scalar values.**
   `framework/lib/mission-parser.js:131` skips only whole-line comments. So
   `required: true  # reason` parses as the string `"true  # reason"`, whether
   the comment is preceded by one space, two spaces or a tab. Probe (2026-10-05,
   `main` `3c1eb90`):

   ```
   "required: true # one space"   => {"required":"true # one space"}
   "required: true  # two spaces" => {"required":"true  # two spaces"}
   "required: true\t# tab"        => {"required":"true\t# tab"}
   "required: true"               => {"required":true}
   ```

   The parser already refuses other unsupported YAML loudly. For example,
   flow-style sequences (`[a, b]`) throw `unsupported YAML feature`. Inline
   comments are the one unsupported feature it accepts silently, and they
   corrupt the value.

2. **The completion gate never validates the field it reads.**
   `MissionTracker._checkCodexCompletionGate` returns "gate not applicable"
   whenever `codex.required !== true`. A malformed value such as
   `"true  # reason"` therefore *bypasses* the gate. `mission-schema.js:204`
   does reject a non-boolean `codex.required`, but only on write
   (`_writeFile`, `moveMissionState`'s pre-validation), never in
   `canTransition()`. A governance gate that a typo can switch off is
   fail-open.

3. **The gate's refusal message prints `undefined:` for the mission ID.** The
   message builds on `mission.id`, but the object from `findMissionById()` /
   `_locateInState()` is `{ state, path, frontmatter, body }`, with no `id`.
   Observed at M-0008 closeout:
   `"undefined: codex.required is true and the reviewer verdict is \"none\" …"`.
   Included here because the fix is in the same function this mission must
   change (`frontmatter.id`), and its regression test belongs with the gate's.

### Affected records today (`main` `3c1eb90`)

| Record | Frontmatter | Parses today as |
| --- | --- | --- |
| `done/M-0001` | `required: true  # …` | refused (flow-style `labels`) |
| `done/M-0002` | `depends_on: [M-0001]  # …` | refused (flow-style) |
| `done/M-0003` | `required: false  # …` | string `"false  # …"`, schema-invalid |
| `review/M-0005` | `required: false  # …` | string `"false  # …"`, schema-invalid |
| `todo/M-0006` | `required: true  # …`, `depends_on: [M-0001]  # …` | refused (flow-style) |
| `todo/M-0007` | `required: false # …` | string `"false # …"`, schema-invalid |

M-0006 is the live hazard. It declares `required: true` on a mission that
touches user-owned settings files. Once its flow-style lists are converted, it
would parse as the string `"true  # …"`, and the gate would let it reach
`done` with no accepted review.

## Scope

**In:**

- `framework/lib/mission-parser.js`: handle inline comments on scalar lines.
  Either strip a YAML comment (whitespace then `#`, outside quotes) or refuse it
  loudly through the existing `exoticError` path. Choose one and record why.
  Either way, a commented scalar must never come back as a string carrying the
  comment. Quoted strings that contain `#` (the serializer already quotes
  ` #`, `mission-parser.js:377`) must keep round-tripping.
- `framework/lib/mission-tracker.js` `_checkCodexCompletionGate`: validate
  `codex.required` before deciding whether the gate applies. Any present,
  non-boolean value refuses `→ done` with a reason naming the field and the
  value. Only an absent block, an absent field, or a boolean `false` may skip
  the gate.
- The same function: name the mission correctly in the refusal message.
- Regression tests in `mission-parser.test.js` and `mission-tracker.test.js`.

**Out:**

- Rewriting existing mission records. Their disposition is decided and
  recorded under AC-7 and done separately if needed.
- Broader YAML support (flow-style sequences stay refused).
- The PR-triggered CI workflow (separate mission).

## Acceptance

- [ ] AC-1: `required: true # x`, `required: true  # x` and
      `required: true\t# x` never parse to a string containing `#`. They
      either yield boolean `true` or throw a parser error naming inline
      comments. The same holds for `false` and for the `depends_on` line
      pattern.
- [ ] AC-2: A quoted value containing ` #` still round-trips through
      serialize → parse unchanged.
- [ ] AC-3: `canTransition(id, "done")` refuses (fails closed) when
      `codex.required` is present and not a boolean: a string `"true"`,
      `"true  # x"`, `"false # x"`, a number, or `null`. The reason names
      `codex.required` and the value.
- [ ] AC-4: Gate behaviour for valid records is unchanged. Boolean `false` or
      an absent field skips the gate; `true` plus `accepted` passes; `true`
      plus a valid `human_adjudication` passes; `true` plus any other verdict
      refuses.
- [ ] AC-5: The refusal message names the mission ID. No `undefined:`.
- [ ] AC-6: Regression tests cover the exact known patterns:
      `required: true  # …` (M-0001/M-0006), `required: false # …`
      (M-0007), `required: false  # …` (M-0003/M-0005), and
      `depends_on: [M-0001]  # …` (M-0002/M-0006). Each new test is shown to
      fail against `main` `3c1eb90` before the fix.
- [ ] AC-7: Each affected record above has a recorded disposition:
      unchanged and why, or converted in a separate record-only commit. No
      record changes state as a side effect.
- [ ] AC-8: `npm test` green. L8 review of the implementation range reaches a
      real verdict.

## Workpad

_Filed 2026-10-05 from the M-0008 closeout findings (PR #26). Not started._
