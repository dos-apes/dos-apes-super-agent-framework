"use strict";
//
// codex-review.test.js — exercises the post-review side-effect surface of
// codex-review.js (recordCodexReview + helpers). The Codex invocation path
// (spawn, prompt assembly, schema parsing) is integration territory and is
// covered separately; here we focus on the contract that single-shot
// review writes its terminal state into the mission's codex frontmatter
// block via MissionTracker, best-effort.
//
// Run:  node framework/scripts/codex-review.test.js
//

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { MissionTracker, STATES } = require("../lib/mission-tracker.js");
const parser = require("../lib/mission-parser.js");

const codexReview = require("./codex-review.js");

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

function makeProjectTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-review-test-"));
  for (const s of STATES) {
    fs.mkdirSync(path.join(root, ".planning", "missions", s), { recursive: true });
  }
  cleanups.push(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function seedMission(root, state, id, extras = {}) {
  const fm = {
    id,
    schema_version: 2,
    title: `Mission ${id}`,
    state,
    created: "2026-05-01",
    updated: "2026-05-01",
    ...extras,
  };
  const text = `---\n${parser.serializeFrontmatter(fm)}\n---\n\n## Workpad\n`;
  const file = path.join(root, ".planning", "missions", state, `${id}-mission.md`);
  fs.writeFileSync(file, text);
  return file;
}

// Capture stderr writes for the duration of fn(). Restores the original
// writer afterwards. Returns the joined captured output.
function captureStderr(fn) {
  const orig = process.stderr.write.bind(process.stderr);
  const lines = [];
  process.stderr.write = (chunk) => { lines.push(String(chunk)); return true; };
  try { fn(); } finally { process.stderr.write = orig; }
  return lines.join("");
}

function writeAuditTrail(root, name = "test.json") {
  const file = path.join(root, ".dos-apes", "codex-reviews", name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ stub: true }));
  return file;
}

// ─── recordCodexReview — happy path ────────────────────────────────────────

group("recordCodexReview — mission update", () => {
  test("with --mission, writes the codex block via MissionTracker", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001");
    const tracker = new MissionTracker({ root: path.join(root, ".planning", "missions") });
    const outputPath = writeAuditTrail(root, "rev1.json");

    codexReview.recordCodexReview({
      missionId: "M-0001",
      review: {
        verdict: "revise",
        confidence: 0.85,
        summary: "needs work",
        findings: [
          { severity: "critical", file: "a.js", note: "boom" },
          { severity: "high",     file: "b.js", note: "bang" },
          { severity: "medium",   file: "c.js", note: "meh"  },
          { severity: "low",      file: "d.js", note: "nit"  },
        ],
      },
      outputPath,
      projectRoot: root,
      tracker,
    });

    const codex = tracker.getCodexState("M-0001");
    assert.notStrictEqual(codex, null, "codex block should be present");
    assert.strictEqual(codex.last_verdict, "findings-reported");
    assert.strictEqual(codex.unresolved_findings, 2, "only high+critical count");
    assert.strictEqual(codex.last_review_path, ".dos-apes/codex-reviews/rev1.json");
    assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(codex.last_run_at),
      `last_run_at should be ISO 8601, got: ${codex.last_run_at}`);
  });

  test("verdict 'accept' maps to 'accepted'", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001");
    const tracker = new MissionTracker({ root: path.join(root, ".planning", "missions") });

    codexReview.recordCodexReview({
      missionId: "M-0001",
      review: { verdict: "accept", confidence: 0.95, summary: "lgtm", findings: [] },
      outputPath: writeAuditTrail(root, "ok.json"),
      projectRoot: root,
      tracker,
    });

    const codex = tracker.getCodexState("M-0001");
    assert.strictEqual(codex.last_verdict, "accepted");
    assert.strictEqual(codex.unresolved_findings, 0);
  });

  test("verdict 'reject' maps to 'findings-reported'", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001");
    const tracker = new MissionTracker({ root: path.join(root, ".planning", "missions") });

    codexReview.recordCodexReview({
      missionId: "M-0001",
      review: {
        verdict: "reject",
        confidence: 0.7,
        summary: "no",
        findings: [{ severity: "critical", file: "x.js", note: "broken" }],
      },
      outputPath: writeAuditTrail(root, "no.json"),
      projectRoot: root,
      tracker,
    });

    assert.strictEqual(tracker.getCodexState("M-0001").last_verdict, "findings-reported");
    assert.strictEqual(tracker.getCodexState("M-0001").unresolved_findings, 1);
  });

  test("partial update preserves earlier codex fields (e.g. required, max_rounds)", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001", {
      codex: { required: true, max_rounds: 5, last_verdict: "none", unresolved_findings: 0 },
    });
    const tracker = new MissionTracker({ root: path.join(root, ".planning", "missions") });

    codexReview.recordCodexReview({
      missionId: "M-0001",
      review: { verdict: "accept", confidence: 0.95, summary: "ok", findings: [] },
      outputPath: writeAuditTrail(root, "merge.json"),
      projectRoot: root,
      tracker,
    });

    const codex = tracker.getCodexState("M-0001");
    assert.strictEqual(codex.required, true, "required field preserved across updates");
    assert.strictEqual(codex.max_rounds, 5, "max_rounds preserved across updates");
    assert.strictEqual(codex.last_verdict, "accepted");
  });
});

// ─── recordCodexReview — no-mission and audit-trail invariants ─────────────

group("recordCodexReview — guards", () => {
  test("without missionId, no mission file is touched", () => {
    const root = makeProjectTree();
    const file = seedMission(root, "doing", "M-0001");
    const before = fs.readFileSync(file, "utf8");
    const beforeMtime = fs.statSync(file).mtimeMs;

    codexReview.recordCodexReview({
      missionId: null,
      review: { verdict: "accept", confidence: 0.95, summary: "lgtm", findings: [] },
      outputPath: writeAuditTrail(root, "no-mission.json"),
      projectRoot: root,
    });

    const after = fs.readFileSync(file, "utf8");
    assert.strictEqual(after, before, "no mission file should be modified");
    assert.strictEqual(fs.statSync(file).mtimeMs, beforeMtime, "mtime should not move");
  });

  test("audit trail on disk is left untouched by recordCodexReview", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001");
    const tracker = new MissionTracker({ root: path.join(root, ".planning", "missions") });
    const outputPath = writeAuditTrail(root, "audit.json");
    const auditBefore = fs.readFileSync(outputPath, "utf8");

    codexReview.recordCodexReview({
      missionId: "M-0001",
      review: { verdict: "accept", confidence: 0.95, summary: "ok", findings: [] },
      outputPath,
      projectRoot: root,
      tracker,
    });

    const auditAfter = fs.readFileSync(outputPath, "utf8");
    assert.strictEqual(auditAfter, auditBefore, "audit trail file must not be rewritten");
  });
});

// ─── recordCodexReview — failure tolerance ─────────────────────────────────

group("recordCodexReview — failure tolerance", () => {
  test("tracker.setCodexState throwing does NOT throw; emits stderr warning", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001");
    const outputPath = writeAuditTrail(root, "fail.json");
    const auditBefore = fs.readFileSync(outputPath, "utf8");
    const throwingTracker = {
      setCodexState() { throw new Error("simulated tracker failure"); },
    };

    let didThrow = false;
    const stderr = captureStderr(() => {
      try {
        codexReview.recordCodexReview({
          missionId: "M-0001",
          review: { verdict: "accept", confidence: 0.95, summary: "ok", findings: [] },
          outputPath,
          projectRoot: root,
          tracker: throwingTracker,
        });
      } catch (_) {
        didThrow = true;
      }
    });

    assert.strictEqual(didThrow, false, "recordCodexReview must swallow the error");
    assert(/codex block update skipped/.test(stderr),
      `expected 'codex block update skipped' in stderr; got: ${JSON.stringify(stderr)}`);
    assert(/simulated tracker failure/.test(stderr),
      `expected the underlying error message in stderr; got: ${JSON.stringify(stderr)}`);
    // Audit trail must survive a tracker hiccup unchanged.
    assert.strictEqual(fs.readFileSync(outputPath, "utf8"), auditBefore);
  });

  test("an unrecognized verdict skips the update with a warning, no codex block written", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001");
    const tracker = new MissionTracker({ root: path.join(root, ".planning", "missions") });

    const stderr = captureStderr(() => {
      codexReview.recordCodexReview({
        missionId: "M-0001",
        review: { verdict: "wibble", confidence: 0.5, summary: "?", findings: [] },
        outputPath: writeAuditTrail(root, "weird.json"),
        projectRoot: root,
        tracker,
      });
    });

    assert(/unrecognized verdict "wibble"/.test(stderr),
      `expected 'unrecognized verdict' warning; got: ${JSON.stringify(stderr)}`);
    assert.strictEqual(tracker.getCodexState("M-0001"), null,
      "no codex block should be written for an unknown verdict");
  });

  test("missing mission file produces a stderr warning, not a crash", () => {
    const root = makeProjectTree();
    // Note: no seedMission call — the mission does not exist on disk.
    const tracker = new MissionTracker({ root: path.join(root, ".planning", "missions") });

    let didThrow = false;
    const stderr = captureStderr(() => {
      try {
        codexReview.recordCodexReview({
          missionId: "M-9999",
          review: { verdict: "accept", confidence: 0.9, summary: "ok", findings: [] },
          outputPath: writeAuditTrail(root, "missing.json"),
          projectRoot: root,
          tracker,
        });
      } catch (_) {
        didThrow = true;
      }
    });

    assert.strictEqual(didThrow, false, "recordCodexReview must not throw on missing mission");
    assert(/codex block update skipped/.test(stderr),
      `expected skip warning; got: ${JSON.stringify(stderr)}`);
  });
});

// ─── countUnresolvedFindings ───────────────────────────────────────────────

group("countUnresolvedFindings", () => {
  test("counts only high and critical severity entries", () => {
    assert.strictEqual(codexReview.countUnresolvedFindings([
      { severity: "critical" },
      { severity: "high" },
      { severity: "medium" },
      { severity: "low" },
      { severity: "info" },
    ]), 2);
  });

  test("severity matching is case-insensitive", () => {
    assert.strictEqual(codexReview.countUnresolvedFindings([
      { severity: "HIGH" },
      { severity: "Critical" },
    ]), 2);
  });

  test("returns 0 for non-arrays and bogus entries", () => {
    assert.strictEqual(codexReview.countUnresolvedFindings(null), 0);
    assert.strictEqual(codexReview.countUnresolvedFindings(undefined), 0);
    assert.strictEqual(codexReview.countUnresolvedFindings([null, undefined, "x", 7]), 0);
    assert.strictEqual(codexReview.countUnresolvedFindings([{}, { severity: "" }]), 0);
  });
});

// ─── Verdict mapping table ─────────────────────────────────────────────────

group("VERDICT_TO_LAST_VERDICT", () => {
  test("covers exactly the three single-shot verdicts", () => {
    assert.deepStrictEqual(
      Object.keys(codexReview.VERDICT_TO_LAST_VERDICT).sort(),
      ["accept", "reject", "revise"]
    );
  });
  test("each maps to a valid CODEX_VERDICTS value", () => {
    const schema = require("../lib/mission-schema.js");
    for (const v of Object.values(codexReview.VERDICT_TO_LAST_VERDICT)) {
      assert(schema.CODEX_VERDICTS.includes(v),
        `${v} must be a valid codex.last_verdict per the schema`);
    }
  });
});

// ─── Shipped L8 reviewer defaults (M-0008) ─────────────────────────────────
//
// The reviewer default is stated in three code/config places — codex-review.js
// DEFAULT_CONFIG, codex-check.js DEFAULT_MODEL, and the installed template —
// plus the template README. Nothing pinned them to one another, so one could
// move without the others; these assertions make that a failure.

const SHIPPED_MODEL = "gpt-6.1-sol";

group("shipped L8 reviewer defaults (M-0008)", () => {
  const template = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "templates", "codex-review-config.json"), "utf8"));

  test("codex-review.js defaults to the pinned model at high effort, read-only", () => {
    assert.strictEqual(codexReview.DEFAULT_CONFIG.model, SHIPPED_MODEL);
    assert.strictEqual(codexReview.DEFAULT_CONFIG.reasoning_effort, "high");
    assert.strictEqual(codexReview.DEFAULT_CONFIG.sandbox, "read-only");
  });

  test("codex-review.js defaults carry no enabled key (M-0005 opt-in preserved)", () => {
    assert.ok(!("enabled" in codexReview.DEFAULT_CONFIG),
      "enablement must come only from an explicit enabled === true in the config");
  });

  test("codex-check.js capability-checks the same default model", () => {
    const { DEFAULT_MODEL } = require("./codex-check.js");
    assert.strictEqual(DEFAULT_MODEL, codexReview.DEFAULT_CONFIG.model);
  });

  test("installed template ships disabled, pinned model, high effort, read-only", () => {
    assert.strictEqual(template.enabled, false);
    assert.strictEqual(template.model, SHIPPED_MODEL);
    assert.strictEqual(template.reasoning_effort, "high");
    assert.strictEqual(template.sandbox, "read-only");
  });

  test("the default is an explicit model ID, not a floating alias", () => {
    for (const m of [template.model, codexReview.DEFAULT_CONFIG.model]) {
      assert.ok(!/latest/i.test(m), `${m} must not be a floating alias`);
      assert.match(m, /^gpt-\d+(\.\d+)?-[a-z0-9-]+$/, `${m} must be a versioned, named model ID`);
    }
  });

  test("template README documents the same default model", () => {
    const readme = fs.readFileSync(
      path.join(__dirname, "..", "templates", "codex-review-config.README.md"), "utf8");
    assert.ok(readme.includes(`default \`"${SHIPPED_MODEL}"\``),
      "the `model` field heading must state the shipped default");
  });
});

// ─── Cleanup + summary ─────────────────────────────────────────────────────

for (const c of cleanups) {
  try { c(); } catch (_) { /* ignore */ }
}

if (failed > 0) {
  process.stderr.write(`\n${failed} test(s) failed:\n`);
  for (const { name, err } of failures) {
    process.stderr.write(`\n  ✗ ${name}\n`);
    process.stderr.write(`    ${err.stack || err.message}\n`);
  }
  process.stderr.write(`\n${passed} passed, ${failed} failed\n`);
  process.exit(1);
}
process.stdout.write(`\n${passed} passed\n`);
