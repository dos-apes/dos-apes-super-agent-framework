#!/usr/bin/env node

// Prerequisite check for L8 Codex review.
// Verifies the Codex CLI is installed, authenticated, and that the configured
// model honors --output-schema (required by the structured-findings parser).
//
// Usage: node scripts/codex-check.js
// Output: single JSON object to stdout — { ok, code, message, model }
// Exit codes: 0=ready, 1=cli missing, 2=not authenticated,
//             3=model lacks structured-output support, 4=network/timeout.

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const PROJECT_ROOT = process.cwd();
const CONFIG_PATH = path.join(PROJECT_ROOT, ".dos-apes", "codex-review-config.json");
const CAPABILITIES_PATH = path.join(PROJECT_ROOT, ".dos-apes", "codex-capabilities.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const IS_WINDOWS = process.platform === "win32";

const DEFAULT_MODEL = "gpt-6.1-sol";
const VERSION_TIMEOUT_MS = 5_000;
const AUTH_TIMEOUT_MS = 30_000;
const CAPABILITY_TIMEOUT_MS = 90_000;

// ─── Output helpers ─────────────────────────────────────────────────────────

function emit(result, exitCode) {
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exit(exitCode);
}

// ─── Config ─────────────────────────────────────────────────────────────────

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (_) {
    // Fall through to defaults; readers shouldn't fail because the user
    // typo'd JSON — they should fail loudly when codex itself doesn't work.
  }
  return {};
}

// ─── Codex invocation helpers ───────────────────────────────────────────────

// Quote args containing whitespace when running through cmd.exe so the prompt
// stays a single argv entry. POSIX shells don't need this since shell:false.
function quoteArg(arg) {
  if (!IS_WINDOWS) return arg;
  if (!/[\s"]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function runCodex(args, timeoutMs) {
  return spawnSync("codex", args.map(quoteArg), {
    encoding: "utf8",
    timeout: timeoutMs,
    shell: IS_WINDOWS, // resolves codex.cmd via PATHEXT on Windows
    windowsHide: true,
  });
}

// ─── Checks ─────────────────────────────────────────────────────────────────

function checkVersion() {
  try {
    execFileSync("codex", ["--version"], {
      encoding: "utf8",
      stdio: "pipe",
      timeout: VERSION_TIMEOUT_MS,
      shell: IS_WINDOWS,
      windowsHide: true,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, err };
  }
}

function checkAuth() {
  const result = runCodex(
    ["exec", "--sandbox", "read-only", "echo ready"],
    AUTH_TIMEOUT_MS
  );

  if (result.error && (result.error.code === "ETIMEDOUT" || result.signal === "SIGTERM")) {
    return {
      ok: false,
      code: 4,
      message: `codex exec timed out after ${AUTH_TIMEOUT_MS}ms — check network or codex daemon`,
    };
  }
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    const detail = stderr || stdout || `exit ${result.status}`;
    return {
      ok: false,
      code: 2,
      message: `codex not authenticated — run 'codex login'. ${detail}`,
    };
  }
  return { ok: true };
}

function checkCapability(model) {
  const tmpDir = os.tmpdir();
  const stamp = `${process.pid}-${Date.now()}`;
  const schemaFile = path.join(tmpDir, `dos-apes-codex-schema-${stamp}.json`);
  const outFile = path.join(tmpDir, `dos-apes-codex-out-${stamp}.txt`);

  const schema = {
    type: "object",
    properties: { ok: { type: "boolean" } },
    required: ["ok"],
    additionalProperties: false,
  };

  try {
    // utf8 — explicit, no BOM (Node's writeFileSync never adds a BOM, but be
    // defensive against future regressions and signal intent).
    fs.writeFileSync(schemaFile, JSON.stringify(schema), { encoding: "utf8" });

    const result = runCodex(
      [
        "exec",
        "--model", model,
        "--output-schema", schemaFile,
        "--output-last-message", outFile,
        "--sandbox", "read-only",
        "Reply with ok=true",
      ],
      CAPABILITY_TIMEOUT_MS
    );

    if (result.error && (result.error.code === "ETIMEDOUT" || result.signal === "SIGTERM")) {
      return {
        ok: false,
        code: 4,
        message: `codex capability check timed out after ${CAPABILITY_TIMEOUT_MS}ms`,
      };
    }
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();
      return {
        ok: false,
        code: 4,
        message: `codex capability check failed: ${detail}`,
      };
    }

    if (!fs.existsSync(outFile)) {
      return {
        ok: false,
        code: 3,
        message: `model ${model} did not write --output-last-message; structured outputs unsupported`,
      };
    }

    const raw = fs.readFileSync(outFile, "utf8").trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      return {
        ok: false,
        code: 3,
        message: `model ${model} does not honor --output-schema; use gpt-6.1-sol or another supported model`,
      };
    }
    if (typeof parsed !== "object" || parsed === null || typeof parsed.ok !== "boolean") {
      return {
        ok: false,
        code: 3,
        message: `model ${model} does not honor --output-schema; use gpt-6.1-sol or another supported model`,
      };
    }
    return { ok: true };
  } finally {
    for (const f of [schemaFile, outFile]) {
      try { fs.unlinkSync(f); } catch (_) { /* file may not exist */ }
    }
  }
}

// ─── Capability cache ───────────────────────────────────────────────────────

function readCache(model) {
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

function writeCache(model) {
  try {
    fs.mkdirSync(path.dirname(CAPABILITIES_PATH), { recursive: true });
    const payload = {
      model,
      supports_output_schema: true,
      verified_at: new Date().toISOString(),
    };
    fs.writeFileSync(CAPABILITIES_PATH, JSON.stringify(payload, null, 2));
  } catch (_) {
    // Cache failures are non-fatal — next run will re-verify.
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const config = readConfig();
  const model = (typeof config.model === "string" && config.model.trim()) || DEFAULT_MODEL;

  const version = checkVersion();
  if (!version.ok) {
    emit(
      {
        ok: false,
        code: 1,
        message: "codex CLI not found on PATH — install Codex CLI and ensure it is on PATH",
        model,
      },
      1
    );
  }

  const auth = checkAuth();
  if (!auth.ok) {
    emit({ ok: false, code: auth.code, message: auth.message, model }, auth.code);
  }

  const cached = readCache(model);
  if (cached) {
    emit(
      {
        ok: true,
        code: 0,
        message: `codex ready (cached capability verified ${cached.verified_at})`,
        model,
      },
      0
    );
  }

  const capability = checkCapability(model);
  if (!capability.ok) {
    emit(
      { ok: false, code: capability.code, message: capability.message, model },
      capability.code
    );
  }

  writeCache(model);
  emit({ ok: true, code: 0, message: "codex ready", model }, 0);
}

// Exposed for tests. Production CLI invocation lives behind require.main.
module.exports = { DEFAULT_MODEL };

if (require.main === module) {
  main();
}
