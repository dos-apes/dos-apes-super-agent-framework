---
id: M-0010
schema_version: 2
title: PR-triggered npm test CI for the Framework repository
state: todo
created: 2026-10-05
updated: 2026-10-05
priority: 2
labels:
  - ci
  - verification
workspace:
  branch: feat/m-0010-pr-triggered-npm-test-ci-for-the-framework-repository
  worktree: .worktrees/M-0010
verification:
  required_levels:
    - L2
---

## Problem

No CI runs the Framework's own test suite. The repository has no
`.github/workflows/`. The only PR checks are GitHub's CodeQL default setup
("CodeQL", "Analyze (javascript-typescript)"). PR #25 and PR #26 (M-0008)
merged with `npm test` evidence that existed only as local runs reported in
the PR body. A regression would reach `main` unless the author ran the suite
locally and reported it truthfully.

## Scope

**In:**

- A repository workflow under `.github/workflows/` that runs `npm test` on
  every pull request targeting `main`. A `push` trigger on `main` for
  post-merge confirmation is optional.
- An OS matrix covering at least `ubuntu-latest` and `windows-latest`. The
  Framework's scripts must work in Git Bash on Windows, and several tests
  exercise Windows-specific paths (shell quoting, `codex.cmd` resolution, CRLF
  handling).
- Least-privilege workflow token (`permissions: contents: read`), no secrets,
  no network beyond checkout and Node setup.

**Out:**

- `framework/ci/`: the workflows *shipped to user projects*. This mission
  adds CI for the Framework repository itself, and the two must not be
  conflated. `.github/` is not in `package.json` `files` and must stay out of
  the tarball.
- Running L8 / Codex in CI. The suite already stubs or poisons `codex`, and no
  test may need a real Codex CLI or credentials.
- Making the check *required* in the `Main` ruleset. That is a repository
  setting the maintainer changes, recorded under AC-5.

## Open questions for the maintainer

- **Node versions.** `package.json` declares `engines.node >=18.0.0`. Should
  the matrix test the floor (18), current LTS, or both? Node 18 is past
  end-of-life, so testing it may need a separate decision about the engines
  floor.
- **Action pinning.** Pin third-party actions (`actions/checkout`,
  `actions/setup-node`) by full commit SHA, or by major tag?

## Acceptance

- [ ] AC-1: A PR to `main` triggers the workflow, which runs `npm test` and
      reports pass/fail as a PR check, on Linux and Windows.
- [ ] AC-2: The workflow token is `contents: read` and no secrets are
      referenced.
- [ ] AC-3: The suite passes on both runners without a Codex CLI installed.
      Any test that silently depends on host state (installed tools, the git
      identity, `os.tmpdir()` location) is fixed or explicitly guarded.
- [ ] AC-4: Negative control: a deliberately failing commit on a throwaway
      branch makes the check fail. The run URL is recorded.
- [ ] AC-5: `npm pack --dry-run` still excludes `.github/`. The maintainer's
      decision on making the check required in the `Main` ruleset is
      recorded (made, deferred, or declined).
- [ ] AC-6: README / CLAUDE.md "Commands" sections mention the CI check, if
      they describe verification.

## Workpad

_Filed 2026-10-05 from the M-0008 follow-up list. Not started._
