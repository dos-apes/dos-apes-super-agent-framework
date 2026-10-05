---
id: M-0008
title: "L8 default reviewer for new installations: gpt-6.1-sol at high reasoning"
priority: 2
labels:
  - l8
  - defaults
depends_on: []
codex:
  required: true # one real L8 review with the new default is part of the proof
verification:
  required_levels:
    - L2
    - L8
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

- [ ] AC-1 — `codex-review.js` `DEFAULT_CONFIG` is `model: "gpt-6.1-sol"`,
      `reasoning_effort: "high"`, `sandbox: "read-only"`, with no `enabled` key.
- [ ] AC-2 — `codex-check.js` `DEFAULT_MODEL` equals that model, and its
      unsupported-model hint names it.
- [ ] AC-3 — the installed template is `enabled: false`, `gpt-6.1-sol`,
      `high`, `read-only`; its README and `/apes-codex-review` and the README
      agree, and state that the ID is explicit and that existing configs are
      not rewritten.
- [ ] AC-4 — the default is an explicit model ID; no floating alias.
- [ ] AC-5 — L8 stays opt-in, read-only, fail-open, configurable and
      capability-gated. No behaviour change beyond the default values.
- [ ] AC-6 — an existing config selecting another model is byte-identical
      after a reinstall (automated test, with a mutation control).
- [ ] AC-7 — every `gpt-5.5` reference in the repository is reconciled:
      updated, or preserved as historical with a stated reason.
- [ ] AC-8 — `npm test` green; `codex-check` succeeds for `gpt-6.1-sol`
      structured output; one real L8 review runs with `gpt-6.1-sol`/`high`.

## Workpad

_Evidence is recorded here as it is produced._
