#!/usr/bin/env node

// codex-review.js — single-shot Codex code review pass.
//
// Usage:
//   node scripts/codex-review.js --base <ref> [--mission <id>] [--out <path>]
//
// Behavior (in order):
//   1. Load .dos-apes/codex-review-config.json via codex-config.js. L8 is
//      opt-in: skip unless the config is a parsed object with enabled:true
//      (absent/unparseable/invalid config all skip — absence is not consent).
//   2. Verify Codex readiness (cache-first, falls back to scripts/codex-check.js).
//      Failures here skip rather than fail (fail-open).
//   3. Compute diff vs --base (overrides config.diff_base, default 'main').
//      Empty diff → skip "no changes".
//   4. Load mission frontmatter/body (optional, tolerant of missing files).
//   5. Substitute placeholders into the prompt template, invoke Codex with
//      --output-schema and --output-last-message.
//   6. Parse the JSON, validate top-level keys, filter findings against
//      config.skip_paths.
//   7. Write the review to --out (or .dos-apes/codex-reviews/<stamp>.json),
//      append an L8 entry to the mission verification log if applicable,
//      print the review JSON to stdout.
//
// Exit codes:
//   0  review completed (any verdict) OR skipped (skipped:true in stdout)
//   1  script error (config, invocation, schema parse failure)
//
// Cross-platform note: the prompt is passed positionally when it fits the
// resolved binary's argv ceiling. When it doesn't (typically on Windows where
// `codex` is a `.cmd` shim wrapped by cmd.exe), we pass `-` and pipe the
// prompt via spawnSync's `input` option. That uses Node's OS-level stdin
// write — not shell piping — so it's uniform across PowerShell/cmd/bash.

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const { MissionTracker } = require("../lib/mission-tracker.js");
const parser = require("../lib/mission-parser.js");
const { loadCodexConfig } = require("./codex-config.js");

// ─── Paths ──────────────────────────────────────────────────────────────────

function findProjectRoot() {
  // From inside a worktree, `git rev-parse --git-common-dir` points at the
  // main repo's .git/ directory; its parent is the canonical project root.
  try {
    const commonDir = execFileSync(
      "git", ["rev-parse", "--git-common-dir"],
      { encoding: "utf8", cwd: process.cwd() }
    ).trim();
    const abs = path.resolve(process.cwd(), commonDir);
    return path.dirname(abs);
  } catch {
    return process.cwd();
  }
}

const PROJECT_ROOT = findProjectRoot();
const DOS_APES_DIR = path.join(PROJECT_ROOT, ".dos-apes");
const CONFIG_PATH = path.join(DOS_APES_DIR, "codex-review-config.json");
const PROMPT_PATH = path.join(DOS_APES_DIR, "codex-review-prompt.md");
const SCHEMA_PATH = path.join(DOS_APES_DIR, "codex-review-schema.json");
const CAPABILITIES_PATH = path.join(DOS_APES_DIR, "codex-capabilities.json");
const REVIEWS_DIR = path.join(DOS_APES_DIR, "codex-reviews");
const CHECK_SCRIPT = path.join(PROJECT_ROOT, "scripts", "codex-check.js");
const LOG_VERIFICATION = path.join(PROJECT_ROOT, "scripts", "log-verification.js");

const IS_WINDOWS = process.platform === "win32";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// No `enabled` key here by design (M-0005): enablement comes only from a
// strict enabled === true on the parsed config — see codex-config.js.
const DEFAULT_CONFIG = {
  model: "gpt-6.1-sol",
  reasoning_effort: "high",
  sandbox: "read-only",
  diff_base: "main",
  timeout_seconds: 300,
  skip_paths: [],
};

// ─── CLI parsing ────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { base: null, mission: null, out: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--base": out.base = argv[++i]; break;
      case "--mission": out.mission = argv[++i]; break;
      case "--out": out.out = argv[++i]; break;
      case "--help":
      case "-h": out.help = true; break;
      default:
        process.stderr.write(`codex-review: unknown argument '${a}'\n`);
        process.exit(1);
    }
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    "Usage: node scripts/codex-review.js --base <ref> [--mission <id>] [--out <path>]\n" +
    "\n" +
    "Single-shot Codex review pass. Reads config from .dos-apes/.\n" +
    "Skips silently when disabled, Codex unavailable, or diff is empty.\n"
  );
}

// ─── Output helpers ─────────────────────────────────────────────────────────

function emit(payload, exitCode) {
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(exitCode);
}

function warn(msg) {
  process.stderr.write(`codex-review: ${msg}\n`);
}

// ─── Codex readiness ────────────────────────────────────────────────────────

function readCapabilityCache(model) {
  try {
    if (!fs.existsSync(CAPABILITIES_PATH)) return null;
    const data = JSON.parse(fs.readFileSync(CAPABILITIES_PATH, "utf8"));
    if (!data || data.model !== model) return null;
    if (data.supports_output_schema !== true) return null;
    const verified = Date.parse(data.verified_at);
    if (!Number.isFinite(verified)) return null;
    if (Date.now() - verified > CACHE_TTL_MS) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function checkCodexReady(config) {
  const model = config.model || DEFAULT_CONFIG.model;

  // Fast path — capability already verified within TTL.
  if (readCapabilityCache(model)) return { ok: true };

  // Slow path — delegate to codex-check.js.
  if (!fs.existsSync(CHECK_SCRIPT)) {
    return { ok: false, message: "scripts/codex-check.js not found — reinstall framework" };
  }

  const result = spawnSync(process.execPath, [CHECK_SCRIPT], {
    encoding: "utf8",
    timeout: 120_000,
  });

  if (result.error) {
    return { ok: false, message: `codex-check failed: ${result.error.message}` };
  }

  let parsed;
  try {
    parsed = JSON.parse((result.stdout || "").trim());
  } catch (_) {
    return { ok: false, message: "codex-check returned non-JSON output" };
  }

  if (!parsed || parsed.ok !== true) {
    return { ok: false, message: parsed && parsed.message ? parsed.message : "codex-check reported not-ready" };
  }
  return { ok: true };
}

// ─── Codex binary resolution ────────────────────────────────────────────────

// Resolve a concrete Codex executable so we can avoid cmd.exe (8K argv limit)
// when a real .exe is on PATH. Falls back to letting spawnSync resolve the
// name through PATHEXT via shell:true.
function resolveCodexBinary() {
  const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);

  if (!IS_WINDOWS) {
    for (const dir of dirs) {
      const candidate = path.join(dir, "codex");
      if (fs.existsSync(candidate)) return { command: candidate, useShell: false };
    }
    return { command: "codex", useShell: false };
  }

  // Windows — prefer .exe over .cmd to maximize argv room.
  const pathext = (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";");
  const ranked = [...pathext].sort((a, b) => {
    const score = (x) => (x.toUpperCase() === ".EXE" ? 0 : x.toUpperCase() === ".COM" ? 1 : 2);
    return score(a) - score(b);
  });

  for (const dir of dirs) {
    for (const ext of ranked) {
      const candidate = path.join(dir, "codex" + ext.toLowerCase());
      if (fs.existsSync(candidate)) {
        const isShim = /\.(cmd|bat)$/i.test(candidate);
        return { command: candidate, useShell: isShim };
      }
    }
  }
  return { command: "codex", useShell: true };
}

function quoteForCmd(arg) {
  if (!IS_WINDOWS) return arg;
  if (!/[\s"]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function spawnCodex(args, opts) {
  const { command, useShell } = resolveCodexBinary();

  // When we route through cmd.exe (a .cmd shim), the Windows command-line
  // length is capped near 8 KB — a 500-line diff easily exceeds that. Codex
  // accepts `-` as the prompt to read from stdin. spawnSync's `input` option
  // writes to the child's stdin via OS APIs with no shell involvement, so the
  // PowerShell-vs-bash stdin-handling differences (which apply to shell-level
  // piping) don't apply here. Stay positional when the prompt fits.
  const promptArg = args[args.length - 1];
  const argvBytes = args.reduce(
    (sum, a) => sum + Buffer.byteLength(String(a), "utf8") + 1,
    0
  );
  const ceiling = useShell ? 7000 : 30000;
  const useStdin = argvBytes > ceiling && typeof promptArg === "string";

  const argsToUse = useStdin ? [...args.slice(0, -1), "-"] : args;
  const finalArgs = useShell ? argsToUse.map(quoteForCmd) : argsToUse;

  return spawnSync(command, finalArgs, {
    encoding: "utf8",
    shell: useShell,
    windowsHide: true,
    input: useStdin ? promptArg : undefined,
    ...opts,
  });
}

// ─── Diff ───────────────────────────────────────────────────────────────────

function computeDiff(range) {
  const args = ["diff", "--unified=5", range];
  let text;
  try {
    text = execFileSync("git", args, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      cwd: PROJECT_ROOT,
    });
  } catch (err) {
    throw new Error(`git diff failed: ${err.stderr ? err.stderr.toString().trim() : err.message}`);
  }

  let stat;
  try {
    stat = execFileSync("git", ["diff", "--stat", range], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      cwd: PROJECT_ROOT,
    });
  } catch (err) {
    stat = "";
    warn(`git diff --stat failed: ${err.message}`);
  }

  return { text, stats: stat.trim() };
}

// ─── Mission loading ────────────────────────────────────────────────────────
//
// Loads the active mission's body and Acceptance Criteria section to feed
// into the Codex prompt. Best-effort: any failure (no missions tree, mission
// not found, unreadable file) returns empty context — the review continues
// without mission framing, since L8 is fail-open.
//
// Note: this lookup is more permissive than tracker.findMissionById, which
// requires the "M-NNNN-<slug>.md" form. Codex was sometimes called with
// missions whose filename was just "<id>.md" or "<id>_<slug>.md", so we keep
// a small probe here that covers those legacy shapes.

function loadMission(missionId) {
  const empty = { context: "", acceptance: "", state: null, frontmatter: null };
  const missionsRoot = path.join(PROJECT_ROOT, ".planning", "missions");
  if (!fs.existsSync(missionsRoot)) return empty;

  const tracker = new MissionTracker({ root: missionsRoot });

  let mission = null;
  try {
    mission = tracker.findMissionById(missionId);
  } catch (err) {
    // Duplicate-mission corruption — surface and continue with empty context.
    warn(`mission lookup failed for ${missionId}: ${err.message}`);
    return empty;
  }

  let body;
  let state = null;
  let frontmatter = null;
  if (mission) {
    body = mission.body;
    state = mission.state;
    frontmatter = mission.frontmatter;
  } else {
    // Legacy filename probes: <id>.md, <id>_<slug>.md (the canonical form
    // is <id>-<slug>.md and is what tracker.findMissionById returns).
    const legacyFile = findLegacyMissionFile(missionsRoot, missionId);
    if (!legacyFile) return empty;
    let text;
    try { text = fs.readFileSync(legacyFile, "utf8"); }
    catch (err) {
      warn(`could not read mission ${missionId}: ${err.message}`);
      return empty;
    }
    const parsed = parser.parseFrontmatter(text);
    body = parsed.body;
    frontmatter = parsed.frontmatter || null;
    // The legacy probe finds the file at <missionsRoot>/<state>/<file>; the
    // immediate parent dir name is the canonical state.
    state = path.basename(path.dirname(legacyFile));
  }

  // Extract an Acceptance Criteria section (## or ### heading). The lib's
  // extractBodySection only handles `## ` headings, so we stay with the
  // permissive inline scan here to also catch `### Acceptance Criteria`.
  const lines = body.split(/\r?\n/);
  let inSection = false;
  const accLines = [];
  for (const line of lines) {
    if (/^#{2,}\s+Acceptance\s+Criteria\b/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^#{1,}\s/.test(line)) break;
    if (inSection) accLines.push(line);
  }

  return {
    context: body.trim(),
    acceptance: accLines.join("\n").trim(),
    state,
    frontmatter,
  };
}

function findLegacyMissionFile(missionsRoot, missionId) {
  const states = ["todo", "doing", "review", "done", "canceled"];
  for (const state of states) {
    const stateDir = path.join(missionsRoot, state);
    if (!fs.existsSync(stateDir)) continue;
    let entries;
    try { entries = fs.readdirSync(stateDir); } catch (_) { continue; }
    const match = entries.find((f) =>
      f.endsWith(".md") && (
        f === `${missionId}.md` ||
        f.startsWith(`${missionId}_`)
      )
    );
    if (match) return path.join(stateDir, match);
  }
  return null;
}

// ─── Prompt building ────────────────────────────────────────────────────────

function buildPrompt(template, vars) {
  return template
    .replace(/\{\{MISSION_CONTEXT\}\}/g, vars.mission_context || "")
    .replace(/\{\{ACCEPTANCE_CRITERIA\}\}/g, vars.acceptance_criteria || "")
    .replace(/\{\{DIFF_STATS\}\}/g, vars.diff_stats || "")
    .replace(/\{\{DIFF\}\}/g, vars.diff || "");
}

// ─── Glob filter ────────────────────────────────────────────────────────────

// Convert a minimal glob (supports **, *, ?) into a RegExp anchored at full
// match. Sufficient for the documented skip_paths patterns; not a full
// minimatch implementation.
function globToRegex(glob) {
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^$|(){}[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  re += "$";
  return new RegExp(re);
}

function filterFindings(findings, skipPaths) {
  if (!Array.isArray(findings)) return [];
  if (!skipPaths || skipPaths.length === 0) return findings;
  const matchers = skipPaths.map(globToRegex);
  return findings.filter((f) => {
    const file = String(f.file || "").replace(/\\/g, "/");
    return !matchers.some((m) => m.test(file));
  });
}

// ─── Codex invocation ───────────────────────────────────────────────────────

function isReasoningEffortRejection(result) {
  const blob = ((result.stderr || "") + " " + (result.stdout || "")).toLowerCase();
  return /model_reasoning_effort/.test(blob) ||
    /unknown\s+(config|option|key|flag|argument)/.test(blob) ||
    /invalid\s+(config|key|option|argument)/.test(blob) ||
    /unrecognized/.test(blob);
}

function invokeCodex({ config, prompt }) {
  const tmpFile = path.join(os.tmpdir(), `codex-review-${process.pid}.json`);
  const timeoutMs = (Number(config.timeout_seconds) || 300) * 1000;

  const baseArgs = [
    "exec",
    "--sandbox", config.sandbox || DEFAULT_CONFIG.sandbox,
    "--model", config.model || DEFAULT_CONFIG.model,
    "--output-schema", SCHEMA_PATH,
    "--output-last-message", tmpFile,
    "--skip-git-repo-check",
  ];

  const reasoningArgs = [
    "-c", `model_reasoning_effort=${config.reasoning_effort || DEFAULT_CONFIG.reasoning_effort}`,
  ];

  try {
    let result = spawnCodex([...baseArgs, ...reasoningArgs, prompt], { timeout: timeoutMs });

    if (result.status !== 0 && isReasoningEffortRejection(result)) {
      warn("model_reasoning_effort flag rejected by installed Codex CLI; retrying without it (default is medium)");
      // Clean any stale tmpfile from the rejected attempt before retry.
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      result = spawnCodex([...baseArgs, prompt], { timeout: timeoutMs });
    }

    if (result.error && (result.error.code === "ETIMEDOUT" || result.signal === "SIGTERM")) {
      return { ok: false, message: `codex exec timed out after ${timeoutMs}ms` };
    }
    if (result.error) {
      return { ok: false, message: `codex exec failed to launch: ${result.error.message}` };
    }
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();
      const tail = detail.length > 1000 ? `…${detail.slice(-1000)}` : detail;
      const errPath = path.join(os.tmpdir(), `codex-review-err-${process.pid}.log`);
      try { fs.writeFileSync(errPath, detail); } catch {}
      return { ok: false, message: `codex exec failed (full output: ${errPath}):\n${tail}` };
    }

    if (!fs.existsSync(tmpFile)) {
      return { ok: false, message: "codex did not write --output-last-message file" };
    }
    const raw = fs.readFileSync(tmpFile, "utf8").trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return {
        ok: false,
        message: `output is not valid JSON: ${err.message}. First 200 chars: ${raw.slice(0, 200)}`,
      };
    }

    const required = ["verdict", "confidence", "summary", "findings"];
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
        return {
          ok: false,
          message: `output missing required key '${key}'. First 200 chars: ${raw.slice(0, 200)}`,
        };
      }
    }
    if (!Array.isArray(parsed.findings)) {
      return {
        ok: false,
        message: `output.findings is not an array. First 200 chars: ${raw.slice(0, 200)}`,
      };
    }

    return { ok: true, data: parsed };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) { /* may not exist */ }
  }
}

// ─── Output paths ───────────────────────────────────────────────────────────

function defaultOutPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(REVIEWS_DIR, `${stamp}.json`);
}

// ─── Mission verification log ───────────────────────────────────────────────

function logMissionVerification(missionId, review, outputPath) {
  if (!fs.existsSync(LOG_VERIFICATION)) {
    // Helper not installed — graceful no-op.
    return;
  }

  const verdictToOutcome = { accept: "pass", revise: "fail", reject: "fail" };
  const outcome = verdictToOutcome[review.verdict] || "fail";

  const findingsCount = Array.isArray(review.findings) ? review.findings.length : 0;
  const summary = `Codex L8: ${review.verdict} (confidence ${review.confidence}, ${findingsCount} finding${findingsCount === 1 ? "" : "s"})`;
  const details = JSON.stringify({
    mission_id: missionId,
    verdict: review.verdict,
    confidence: review.confidence,
    findings_count: findingsCount,
    output_path: outputPath,
  });

  const result = spawnSync(process.execPath, [
    LOG_VERIFICATION,
    "L8",
    outcome,
    summary,
    details,
  ], { encoding: "utf8", cwd: PROJECT_ROOT });

  if (result.status !== 0) {
    // Most common cause today: log-verification.js LEVEL_NAMES does not yet
    // include L8. Surface clearly but never fail the review.
    const detail = (result.stderr || "").trim();
    warn(`mission verification log skipped (helper exited ${result.status}); detail: ${detail.slice(0, 200)}`);
  }
}

// ─── Post-review side effects ──────────────────────────────────────────────
//
// After a successful review, two things are recorded against the mission.
// Both are best-effort: by the time we get here the review JSON is already
// on disk and the user is waiting on stdout, so a downstream hiccup must
// never take down the review.
//
// 1. log-verification.js appends an L8 entry to the mission's
//    verification.jsonl. In 3.2.0 the helper didn't recognize L8 and exited
//    non-zero — logMissionVerification handles that internally via warn().
//    The outer try/catch here is a belt-and-suspenders safety net in case
//    a future change starts throwing instead of returning an error code.
//
// 2. MissionTracker.setCodexState writes the codex block onto the mission
//    frontmatter (M-0005). This routes through the schema validation gate
//    and can throw on a missing mission, schema version mismatch, or
//    invalid field values. Same defense applies.
//
// Both wrappers live here so the defensive pattern is discoverable in one
// place rather than scattered across main(). New post-review side effects
// should follow the same shape: small dedicated try/catch, one stderr line
// on failure, no rethrow.

const VERDICT_TO_LAST_VERDICT = Object.freeze({
  accept: "accepted",
  revise: "findings-reported",
  reject: "findings-reported",
});

function countUnresolvedFindings(findings) {
  if (!Array.isArray(findings)) return 0;
  let count = 0;
  for (const f of findings) {
    if (!f || typeof f !== "object") continue;
    const sev = String(f.severity || "").toLowerCase();
    if (sev === "high" || sev === "critical") count++;
  }
  return count;
}

function recordCodexReview({ missionId, review, outputPath, projectRoot, tracker } = {}) {
  // No mission target — nothing to record against.
  if (!missionId) return;

  // Side effect 1: append L8 verification log entry.
  try {
    logMissionVerification(missionId, review, outputPath);
  } catch (err) {
    warn(`mission verification log threw: ${err && err.message ? err.message : err}`);
  }

  // Side effect 2: update the codex block on the mission's frontmatter.
  try {
    const last_verdict = VERDICT_TO_LAST_VERDICT[review.verdict];
    if (!last_verdict) {
      warn(`codex block update skipped: unrecognized verdict "${review.verdict}"`);
      return;
    }
    const root = projectRoot || PROJECT_ROOT;
    const t = tracker || new MissionTracker({
      root: path.join(root, ".planning", "missions"),
    });
    const relativePath = path.relative(root, outputPath).split(path.sep).join("/");
    t.setCodexState(missionId, {
      last_verdict,
      last_review_path: relativePath,
      unresolved_findings: countUnresolvedFindings(review.findings),
      last_run_at: new Date().toISOString(),
    });
  } catch (err) {
    warn(`codex block update skipped: ${err && err.message ? err.message : err}`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Opt-in gate — must stay ahead of the checkCodexReady capability gate.
  const { enabled, reason, config } = loadCodexConfig({
    configPath: CONFIG_PATH,
    defaults: DEFAULT_CONFIG,
    warn,
  });

  if (!enabled) {
    return emit({ skipped: true, reason }, 0);
  }

  const ready = checkCodexReady(config);
  if (!ready.ok) {
    return emit({ skipped: true, reason: ready.message }, 0);
  }

  const base = args.base || config.diff_base || DEFAULT_CONFIG.diff_base;

  // Load mission first so we can pin the diff to its branch from frontmatter
  // instead of HEAD. From the main checkout HEAD is on `main` (== base) and
  // the diff is empty — silent no-op. Pinning to workspace.branch lets the
  // review run identically from main, a worktree, or CI.
  const mission = args.mission
    ? loadMission(args.mission)
    : { context: "", acceptance: "", state: null, frontmatter: null };
  const branch = mission.frontmatter?.workspace?.branch || "HEAD";
  // branch already defaults to "HEAD" above, so the single range form is
  // correct from main checkout, worktree, and CI alike.
  const diffRange = `${base}...${branch}`;

  let diff;
  try {
    diff = computeDiff(diffRange);
  } catch (err) {
    warn(err.message);
    process.exit(1);
  }

  if (!diff.text.trim()) {
    // Belt-and-suspenders: a mission in doing/ with an empty diff is a hard
    // error, not a silent skip. The misconfiguration (stale branch, wrong
    // base, branch not reachable) needs to surface — /apes-build was
    // treating it as success and advancing missions with no L8 record.
    if (args.mission && mission.state === "doing") {
      warn(`mission ${args.mission} is in doing/ but the diff vs ${base} is empty — `
         + `check the mission's branch is reachable and up to date`);
      process.exit(2);
    }
    return emit({ skipped: true, reason: "no changes" }, 0);
  }

  if (!fs.existsSync(PROMPT_PATH)) {
    warn(`prompt template missing: ${PROMPT_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(SCHEMA_PATH)) {
    warn(`schema missing: ${SCHEMA_PATH}`);
    process.exit(1);
  }

  const template = fs.readFileSync(PROMPT_PATH, "utf8");
  const prompt = buildPrompt(template, {
    mission_context: mission.context,
    acceptance_criteria: mission.acceptance,
    diff_stats: diff.stats,
    diff: diff.text,
  });

  const review = invokeCodex({ config, prompt });
  if (!review.ok) {
    warn(review.message);
    process.exit(1);
  }

  review.data.findings = filterFindings(review.data.findings, config.skip_paths || []);

  const outPath = args.out ? path.resolve(PROJECT_ROOT, args.out) : defaultOutPath();
  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(review.data, null, 2));
  } catch (err) {
    warn(`could not write review output to ${outPath}: ${err.message}`);
    process.exit(1);
  }

  // Best-effort post-review side effects (verification log + codex block).
  // The audit trail at outPath is already on disk; a failure here MUST NOT
  // change that or the exit code.
  recordCodexReview({
    missionId: args.mission,
    review: review.data,
    outputPath: outPath,
  });

  emit({ ...review.data, output_path: outPath }, 0);
}

// Exposed for tests. Production CLI invocation lives behind require.main.
module.exports = {
  recordCodexReview,
  countUnresolvedFindings,
  VERDICT_TO_LAST_VERDICT,
  DEFAULT_CONFIG,
};

if (require.main === module) {
  try {
    main();
  } catch (err) {
    warn(`fatal: ${err && err.message ? err.message : String(err)}`);
    process.exit(1);
  }
}
