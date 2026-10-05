"use strict";
//
// codex-review-cwd-equivalence.test.js — regression coverage for Bug #4
// (silent no-op when invoked from main checkout) and the doing/ guard.
//
// The bug fix lives in codex-review.js (PROJECT_ROOT resolution +
// branch-pinned diff range). The loop driver is a thin shell-out, so this
// test exercises codex-review.js directly across two working directories:
//   1. the main checkout
//   2. a git worktree pinned to the mission's branch
//
// A stubbed `codex` executable on PATH returns a canned accept verdict so
// the test runs offline. The assertion is that the two invocations produce
// identical review.json content (verdict / confidence / summary / findings),
// proving the diff is pinned to the mission's branch — not HEAD — from
// whichever directory the script is run.
//
// Run: node framework/scripts/codex-review-cwd-equivalence.test.js
//

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const REVIEW_SCRIPT = path.join(__dirname, "codex-review.js");
const LOOP_SCRIPT = path.join(__dirname, "codex-review-loop.js");
const LIB_DIR = path.join(__dirname, "..", "lib");
const IS_WINDOWS = process.platform === "win32";

let passed = 0;
let failed = 0;
const failures = [];
const cleanups = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    process.stdout.write(`  ✗ ${name}\n`);
  }
}

function group(name, fn) {
  process.stdout.write(`\n${name}\n`);
  fn();
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const STUB_RESPONSE = {
  verdict: "accept",
  confidence: 0.86,
  summary: "stubbed clean review",
  findings: [],
};

function mkdtemp(prefix) {
  // Resolve to a real (non-symlink) path so process.chdir doesn't trip on
  // /var → /private/var indirections (macOS) and git diff sees the same path.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const resolved = fs.realpathSync(dir);
  cleanups.push(() => {
    try { fs.rmSync(resolved, { recursive: true, force: true }); }
    catch (_) { /* best-effort */ }
  });
  return resolved;
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

// Stub `codex` that:
//   - parses argv for --output-last-message <path>
//   - writes STUB_RESPONSE to that path as JSON
//   - prints the same JSON to stdout
//   - exits 0
//
// Returns the directory to prepend to PATH so resolveCodexBinary picks it up.
function installCodexStub() {
  const stubDir = mkdtemp("codex-stub-");
  const stubJs = path.join(stubDir, "codex-stub.js");
  fs.writeFileSync(
    stubJs,
    `"use strict";
const fs = require("fs");
const argv = process.argv.slice(2);
const i = argv.indexOf("--output-last-message");
const outPath = i >= 0 ? argv[i + 1] : null;
const payload = ${JSON.stringify(JSON.stringify(STUB_RESPONSE))};
if (outPath) { try { fs.writeFileSync(outPath, payload); } catch (_) {} }
process.stdout.write(payload + "\\n");
process.exit(0);
`
  );

  if (IS_WINDOWS) {
    fs.writeFileSync(
      path.join(stubDir, "codex.cmd"),
      `@echo off\r\nnode "%~dp0codex-stub.js" %*\r\n`
    );
  } else {
    const shim = path.join(stubDir, "codex");
    fs.writeFileSync(
      shim,
      `#!/bin/sh\nexec node "$(dirname "$0")/codex-stub.js" "$@"\n`
    );
    fs.chmodSync(shim, 0o755);
  }
  return stubDir;
}

// Build a project fixture:
//   - git repo with main branch (initial.txt committed)
//   - feature branch feat/m-<id> with one extra commit (feature.txt)
//   - mission file at .planning/missions/doing/<id>-<slug>-mission.md
//   - worktree at .worktrees/<id> bound to the feature branch (when requested)
//   - .dos-apes/ with config, prompt, schema, fresh capability cache
//
// Mission frontmatter intentionally matches the v2 schema MissionTracker
// expects (id, schema_version, title, state, created, updated, workspace).
function makeProject({ missionBranch, withWorktree }) {
  const root = mkdtemp("codex-cwd-test-");
  const missionId = "M-0099";

  git(root, "init", "-q", "--initial-branch=main");
  git(root, "config", "user.email", "test@test.local");
  git(root, "config", "user.name", "test");

  fs.writeFileSync(path.join(root, "initial.txt"), "initial\n");
  git(root, "add", "initial.txt");
  git(root, "commit", "-q", "-m", "initial");

  // Branch with real changes — only created when the test wants a non-empty
  // diff. The doing-guard subtest pins workspace.branch back to main so the
  // diff is empty and the guard fires.
  if (missionBranch !== "main") {
    git(root, "checkout", "-q", "-b", missionBranch);
    fs.writeFileSync(path.join(root, "feature.txt"), "added by mission\n");
    git(root, "add", "feature.txt");
    git(root, "commit", "-q", "-m", "feature change");
    git(root, "checkout", "-q", "main");
  }

  if (withWorktree) {
    git(root, "worktree", "add", "-q", `.worktrees/${missionId}`, missionBranch);
  }

  // Mission file — minimal v2 frontmatter with workspace.branch set.
  const missionsDir = path.join(root, ".planning", "missions", "doing");
  fs.mkdirSync(missionsDir, { recursive: true });
  const missionPath = path.join(missionsDir, `${missionId}-cwd-test-mission.md`);
  fs.writeFileSync(
    missionPath,
    [
      "---",
      `id: ${missionId}`,
      "schema_version: 2",
      "title: cwd equivalence regression",
      "state: doing",
      "created: 2026-05-19",
      "updated: 2026-05-19",
      "workspace:",
      `  branch: ${missionBranch}`,
      `  worktree: .worktrees/${missionId}`,
      "---",
      "",
      "## Workpad",
      "",
    ].join("\n")
  );

  // .dos-apes/ — config, prompt, schema, fresh capability cache so
  // checkCodexReady fast-paths and never spawns codex-check.js.
  const dosApesDir = path.join(root, ".dos-apes");
  fs.mkdirSync(dosApesDir, { recursive: true });
  fs.writeFileSync(
    path.join(dosApesDir, "codex-review-config.json"),
    JSON.stringify({
      enabled: true,
      model: "gpt-6.1-sol",
      diff_base: "main",
      timeout_seconds: 60,
    })
  );
  fs.writeFileSync(
    path.join(dosApesDir, "codex-review-prompt.md"),
    "Review the following diff.\n{{DIFF}}\n"
  );
  // The schema here is for the stub's response — the stub ignores it, but
  // codex-review.js checks the file exists.
  fs.writeFileSync(
    path.join(dosApesDir, "codex-review-schema.json"),
    JSON.stringify({ type: "object" })
  );
  fs.writeFileSync(
    path.join(dosApesDir, "codex-capabilities.json"),
    JSON.stringify({
      model: "gpt-6.1-sol",
      supports_output_schema: true,
      verified_at: new Date().toISOString(),
    })
  );

  return { root, missionId, missionPath, missionBranch };
}

// Stage framework/scripts/codex-review.js + framework/lib/* into the fixture so
// the loop's `REVIEW_SCRIPT = path.join(PROJECT_ROOT, "scripts", "codex-review.js")`
// resolves. Only codex-review.js is needed — codex-check.js is bypassed by the
// fresh capability cache, and log-verification.js is a graceful no-op when missing.
function stageFrameworkScripts(root) {
  const scriptsDir = path.join(root, "scripts");
  const libDir = path.join(root, "lib");
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(libDir, { recursive: true });
  fs.copyFileSync(REVIEW_SCRIPT, path.join(scriptsDir, "codex-review.js"));
  for (const f of fs.readdirSync(LIB_DIR)) {
    if (f.endsWith(".js")) {
      fs.copyFileSync(path.join(LIB_DIR, f), path.join(libDir, f));
    }
  }
}

function runReview({ cwd, missionId, stubDir, outPath }) {
  const env = { ...process.env, PATH: stubDir + path.delimiter + process.env.PATH };
  // Use the real framework script — its findProjectRoot resolves PROJECT_ROOT
  // from `cwd`, so the same script invocation behaves differently from a
  // worktree vs the main checkout. That's exactly what we're regression-testing.
  return spawnSync(
    process.execPath,
    [REVIEW_SCRIPT, "--mission", missionId, "--base", "main", "--out", outPath],
    { cwd, env, encoding: "utf8" }
  );
}

function runLoop({ cwd, missionId, stubDir }) {
  const env = { ...process.env, PATH: stubDir + path.delimiter + process.env.PATH };
  return spawnSync(
    process.execPath,
    [LOOP_SCRIPT, "--mission", missionId, "--base", "main", "--max-iterations", "1", "--no-fix"],
    { cwd, env, encoding: "utf8" }
  );
}

// Subset of review fields that must match across cwds. Excludes file paths
// (which embed absolute tmp roots) and timestamps.
function reviewBody(json) {
  return {
    verdict: json.verdict,
    confidence: json.confidence,
    summary: json.summary,
    findings: json.findings,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

group("PROJECT_ROOT + branch-pinned diff: identical results from main vs worktree", () => {
  test("review.json content matches when run from main checkout and from .worktrees/M-NNNN", () => {
    const stubDir = installCodexStub();
    const proj = makeProject({ missionBranch: "feat/m-0099", withWorktree: true });

    const mainOut = path.join(proj.root, "main-review.json");
    const worktreeOut = path.join(proj.root, "worktree-review.json");

    const mainRes = runReview({
      cwd: proj.root,
      missionId: proj.missionId,
      stubDir,
      outPath: mainOut,
    });
    assert.strictEqual(
      mainRes.status, 0,
      `main checkout invocation failed (exit ${mainRes.status}):\n` +
      `stderr: ${mainRes.stderr}\nstdout: ${mainRes.stdout}`
    );

    // Critical: must NOT have skipped with "no changes". Bug #4 was the
    // silent skip from the main checkout when HEAD == base.
    const mainStdout = mainRes.stdout.trim();
    assert(
      !/"skipped"\s*:\s*true/.test(mainStdout),
      `regression: main-checkout invocation skipped (Bug #4) — stdout: ${mainStdout}`
    );

    const worktreeCwd = path.join(proj.root, ".worktrees", proj.missionId);
    const worktreeRes = runReview({
      cwd: worktreeCwd,
      missionId: proj.missionId,
      stubDir,
      outPath: worktreeOut,
    });
    assert.strictEqual(
      worktreeRes.status, 0,
      `worktree invocation failed (exit ${worktreeRes.status}):\n` +
      `stderr: ${worktreeRes.stderr}\nstdout: ${worktreeRes.stdout}`
    );

    const mainJson = JSON.parse(fs.readFileSync(mainOut, "utf8"));
    const worktreeJson = JSON.parse(fs.readFileSync(worktreeOut, "utf8"));

    assert.deepStrictEqual(
      reviewBody(mainJson),
      reviewBody(worktreeJson),
      "review.json content must be identical across cwds"
    );

    // Match the healthy reference shape from the reporter's M-0003 run.
    assert.strictEqual(mainJson.verdict, "accept");
    assert.strictEqual(mainJson.confidence, 0.86);
    assert.deepStrictEqual(mainJson.findings, []);
  });
});

group("Doing-guard: empty diff in a doing/ mission is a hard error (exit 2)", () => {
  test("mission in doing/ with workspace.branch == base produces exit 2", () => {
    const stubDir = installCodexStub();
    // workspace.branch == main → diff main...main is empty.
    const proj = makeProject({ missionBranch: "main", withWorktree: false });

    const outPath = path.join(proj.root, "out.json");
    const res = runReview({
      cwd: proj.root,
      missionId: proj.missionId,
      stubDir,
      outPath,
    });

    assert.strictEqual(
      res.status, 2,
      `doing-guard should exit 2; got ${res.status}\nstderr: ${res.stderr}\nstdout: ${res.stdout}`
    );
    assert(
      /is in doing\/ but the diff vs main is empty/.test(res.stderr),
      `expected doing-guard warning in stderr; got: ${res.stderr}`
    );
    // The script must NOT have produced an output file when the guard fires.
    assert(
      !fs.existsSync(outPath),
      "doing-guard exit path must not write a review.json"
    );
  });

  test("mission in another state (todo) with empty diff still skips cleanly (exit 0)", () => {
    const stubDir = installCodexStub();
    const proj = makeProject({ missionBranch: "main", withWorktree: false });

    // Relocate mission file from doing/ to todo/ — the guard only fires
    // when the mission is actively being worked on.
    const todoDir = path.join(proj.root, ".planning", "missions", "todo");
    fs.mkdirSync(todoDir, { recursive: true });
    const moved = path.join(todoDir, path.basename(proj.missionPath));
    fs.renameSync(proj.missionPath, moved);
    // Update state field in frontmatter so MissionTracker validates it.
    const text = fs.readFileSync(moved, "utf8").replace("state: doing", "state: todo");
    fs.writeFileSync(moved, text);

    const outPath = path.join(proj.root, "out.json");
    const res = runReview({
      cwd: proj.root,
      missionId: proj.missionId,
      stubDir,
      outPath,
    });

    assert.strictEqual(
      res.status, 0,
      `todo/ mission with empty diff should skip cleanly; got exit ${res.status}\nstderr: ${res.stderr}`
    );
    assert(
      /"skipped"\s*:\s*true/.test(res.stdout),
      `expected skipped:true in stdout; got: ${res.stdout}`
    );
  });
});

group("Loop forwarding: codex-review-loop.js propagates the doing-guard, not 'skipped'", () => {
  test("loop on doing/ mission with empty diff exits non-zero and emits no skipped state", () => {
    const stubDir = installCodexStub();
    // workspace.branch == main → diff main...main is empty → single-shot
    // codex-review.js exits 2 (doing-guard). The original Bug #4 lived in
    // the loop forwarding single-shot result as state:"skipped" exit 0; with
    // the fix, the loop must propagate the non-zero exit and NEVER emit a
    // skipped-success terminal payload.
    const proj = makeProject({ missionBranch: "main", withWorktree: false });
    stageFrameworkScripts(proj.root);

    const res = runLoop({ cwd: proj.root, missionId: proj.missionId, stubDir });

    assert.notStrictEqual(
      res.status, 0,
      `loop must exit non-zero when single-shot doing-guard fires; got 0\n` +
      `stderr: ${res.stderr}\nstdout: ${res.stdout}`
    );
    assert(
      !/"state"\s*:\s*"skipped"/.test(res.stdout),
      `regression: loop emitted state:"skipped" terminal (Bug #4) — stdout: ${res.stdout}`
    );
  });
});

// ─── Teardown ───────────────────────────────────────────────────────────────

for (const c of cleanups) {
  try { c(); } catch (_) { /* best-effort */ }
}

process.stdout.write(`\n${passed} passed${failed ? `, ${failed} failed` : ""}\n`);
if (failed > 0) {
  for (const { name, err } of failures) {
    process.stderr.write(`\n--- ${name}\n${err && err.stack ? err.stack : err}\n`);
  }
  process.exit(1);
}
