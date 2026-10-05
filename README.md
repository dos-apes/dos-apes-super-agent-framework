# Dos Apes Super Agent Framework

```
                       .:+*-.                                         .:+*-.
                      .*@@@@@%*:                                  ..+%@@@@@%:
                      +@@@@@@@@@%+.                             .-#@@@@@@@@@%.
                    .=%@@@@@@@@@@@@+.                         .-%@@@@@@@@@@@@#.
                   .*@@@@@@@@@@@@@@@@=.                     .:%@@@@@@@@@@@@@@@@-
                  .-:=*%%%#*-..=%@@@@@%:.                  .*@@@@@@*...+*#%%#+:-.
                 ..-%=....:-+=..:%@@@@@@@%+:..        ..-%@@@@@@@@#..-+-:....-#*..
             ..=@@%.=@#-+%@@-  .:@@@@@@@@@@@@%:.   ..#@@@@@@@@@@@@#.  .@@%*-*%%.+@@*..
           .-@@@@@@@-*=.:=.   .*@@@@@@@@@@@@@@@#. .+@@@@@@@@@@@@@@@%:.  .:=.:*.*@@@@@@*.
          .%@@@@@@@=.......  :#%@@@@@@@@@@@@@@@@%.-@@@@@@@@@@@@@@@@@%=. .......:@@@@@@@@=
         .%@@@@@@@%:.          .%@@@@@@@@@@@@@@@%:#@@@@@@@@@@@@@@@@-          ..%@@@@@@@@:
         =@@@@@@@@#::::=###*-..-@@@@@@@@@@@@@@@@%:*@@@@@@@@@@@@@@@@*. :*###*-:::-@@@@@@@@%.
         *@@@@@@@@@#.        .=%@@@@@@@@@@@@@@@@#.-@@@@@@@@@@@@@@@@@#.        .=@@@@@@@@@%:
        .%@@@@@@@@@@%+.    .+%@*%@@@@@@@@@@@@@@%: .#@@@@@@@@@@@@@@%*%@*..  ..-%@@@@@@@@@@@=
        .%@@@@@@@@@@@@@@@@@@@%:%@@@@@@@@@@@@@@@= ...%@@@@@@@@@@@@@@@*#@@@@@@@@@@@@@@@@@@@@=
        .%@@@@@@@@@@@@@@@@@@@-@@@@@@@@@@@@@@@@*..#=.-%@@@@@@@@@@@@@@@=+@@@@@@@@@@@@@@@@@@@=
         #@@@@@@@@@@@@@@@@@%.#@@@@@@@@@@@@@@@# .#@%-.=@@@@@@@@@@@@@@@@=*@@@@@@@@@@@@@@@@@@-
         +@@@@@@@@@@@@@@@@@-*@@@@@@@@@@@@@@@%:.*@@@@-.+@@@@@@@@@@@@@@@%.*@@@@@@@@@@@@@@@@%:
         =@@@@@@@@@@@@@@@@=:%@@@@@@@@@@@@@@%:.*@@@@@%..#@@@@@@@@@@@@@@@+:@@@@@@@@@@@@@@@@%.
         :%@@@@@@@@@@@@@@#.=@@@@@@@@@@@@@@@=.=@@@@@@@@:.#@@@@@@@@@@@@@@@.-@@@@@@@@@@@@@@@+
         .%@@@@@@@@@@@@@@-.%@@@@@@@@@@@@@@=.=@@@@@@@@@#.:@@@@@@@@@@@@@@@=.#@@@@@@@@@@@@@@:
          =@@@@@@@@@@@@@+ -@@@@@@@@@@@@@@*.-%@@@@@@@@@@%.:%@@@@@@@@@@@@@*.:@@@@@@@@@@@@@#.
          .%@@@@@@@@@@@%..#@@@@@@@@@@@@@+..%@@@@@@@@@@@@=.:@@@@@@@@@@@@@%..-@@@@@@@@@@@@=
           +@@@@@@@@@@@. .#@@@@@@@@@@@@#. :@@@@@@@@@@@@@*. -%@@@@@@@@@@@@: .#@@@@@@@@@@@.
           :%@@@@@@@@@=  :%@@@@@@@@@@@*.  .*@@@@@@@@@@@%-  .:%@@@@@@@@@@@+. .%@@@@@@@@@=
           .+@@@@@@@@%.  :%@@@@@@@@@@+.    .*@@@@@@@@@%:     :%@@@@@@@@@@#.  -@@@@@@@@#.
            .#@@@@@@@=.  :@@@@@@@@@@+.      .*@@@@@@@@-       .%@@@@@@@@@#. .:%@@@@@@@=.
             =@@@@@@@@@=.:%@@@@@@@@@#.       :@@@@@@@*.      .+@@@@@@@@@@#.:%@@@@@@@@#.
             .:#%@@@@@@@-.:#@@@@@@@@@-       .%@@@@@@-       .%@@@@@@@@%+ .%@@@@@@@%+.
```

## We ain't monkeying around with code!

**Feed it a PRD. Walk away. Come back to a shipped product.**

Dos Apes is a software engineering framework for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that turns ideas into production-ready applications. It uses Agent Teams for multi-agent orchestration, a 9-level verification pyramid for quality enforcement (now including opt-in cross-model review via the Codex CLI), and automated hooks for deterministic code review — so you can focus on product decisions while Claude handles the engineering.

```bash
npx dos-apes-super-agent
```

---

## Quick Start

### Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/getting-started) installed and authenticated
- Node.js 18+
- Git

#### Optional: Codex CLI (for L8 Adversarial Review)

L8 — cross-model review of your diff via OpenAI's Codex CLI — is **opt-in and disabled by default**. The framework runs end-to-end without it. If you want to enable it:

```bash
npm install -g @openai/codex
codex login
```

No API key required — auth is via your ChatGPT account. The default reviewer model for new installations is **`gpt-6.1-sol`** with `reasoning_effort: high` — an explicit model ID, never a floating "latest" alias, so a review stays attributable to a known model. The installer never overwrites an existing `.dos-apes/codex-review-config.json`, so projects that already pin a model keep it. Don't configure `gpt-5-codex` — that slug silently drops `--output-schema`, which breaks the structured-findings parser; the prerequisite check (`scripts/codex-check.js`) verifies the configured model actually honors structured outputs before letting the review run.

### Install

```bash
# Navigate to your project (or create one)
mkdir my-app && cd my-app && git init

# Install the framework
npx dos-apes-super-agent
```

The installer will ask you:
1. **Install location** — This project (recommended) or global
2. **Project type** — Greenfield (new) or brownfield (existing)
3. **Product description** — What you're building (flows into PROJECT.md)
4. **Tech stack** — Preset or custom (generates a tailored CLAUDE.md)
5. **Deployment target** — Vercel, Railway, Docker, AWS, GCP, Azure, etc.
6. **Testing strategy** — Local dev, preview deploys, staging, CI-only

### Build Something

```bash
# Start Claude Code
claude

# Build from a PRD
/apes-build --prd requirements.md --ralph

# Or describe what you want
/apes-build --idea "Build a task management app with team collaboration"
```

### Add to an Existing Project

```bash
claude

/apes-map                                    # Analyze your codebase
/apes-feature "Add real-time notifications"  # Add a feature (single-phase)
/apes-fix "Login fails with special chars"   # Fix a bug
/apes-refactor "Extract API client layer"    # Refactor safely

# For multi-phase features with a PRD, use build (works for brownfield too)
/apes-build --prd feature-prd.md --ralph
```

---

## Claude Desktop authoring workflow

Dos Apes can be used end-to-end, including the planning step in Claude Desktop. After install, the framework drops a `claude-desktop-skills/` directory at your project root. Copy those `.md` files into your Claude Desktop project's project files to enable the full authoring → execution workflow:

```bash
# After running npx dos-apes-super-agent in your project,
# copy these files into your Claude Desktop project's project files:
./claude-desktop-skills/dos-apes-authoring.md
./claude-desktop-skills/authoring-prd-missions.md
./claude-desktop-skills/authoring-feature-missions.md
./claude-desktop-skills/authoring-bugfix-missions.md
```

With these files loaded, Claude Desktop will guide you through structured interviews to produce well-formed PRDs, feature missions, and bug reports that Claude Code then executes against. The parent skill (`dos-apes-authoring.md`) routes each conversation to the right workflow guide; the three sub-guides handle greenfield PRDs, brownfield feature missions, and bugfix missions respectively.

---

## How It Works

Dos Apes is a **playbook, not a runtime**. It provides Claude Code with:

- **Slash commands** that assemble agent teams for specific workflows
- **Skills** that teach teammates domain expertise (architecture, testing, frontend, etc.)
- **Hook scripts** that enforce quality gates automatically on every file edit
- **CI workflows** that run scheduled quality sweeps

The platform (Claude Code Agent Teams + Tasks API) handles orchestration. Dos Apes defines *how to build software properly*.

### Build Flow

```
/apes-build --prd requirements.md --ralph
       │
       ▼
   INGEST ─── Parse PRD → PROJECT.md, ROADMAP.md
       │
       ▼
   PLAN ───── Break into phases → Create tasks via Tasks API
       │
       ▼
   TEAM ───── Assemble teammates: architect, builder, tester, reviewer
       │
       ▼
   BUILD ──── Each task: implement → verify → commit → tag
       │         │
       │         └─ Hooks fire on every edit:
       │              • TypeScript check on .ts files
       │              • Tests run on test file changes
       │              • Main branch protection
       │              • File tracking for auto-review
       │
       ▼
   VERIFY ─── 9-level pyramid (build → types → lint → tests →
       │       coverage → security → E2E → visual regression)
       │
       ▼
   BROWSER ── UI smoke test gate (Playwright or MCP fallback)
       │
       ▼
   MERGE ──── Squash merge to main, tag phase complete
       │
       ▼
   ITERATE ── More phases? Loop back to PLAN
       │
       ▼
   SHIP ───── PRODUCT_COMPLETE 🦍🦍
```

---

## Missions

A **mission** is the atomic unit of work — one focused outcome a team finishes, verifies, and merges. Each mission lives as a single markdown file under `.planning/missions/<state>/M-NNNN-<slug>.md`, where `<state>` is one of `todo`, `doing`, `review`, `done`, or `canceled`. The file's location on disk *is* its lifecycle state; transitions happen via `git mv`, so the audit trail is the file's git history.

### Why missions?

Missions are atomic; **roadmap phases** are strategic. A phase says "where we're going next quarter"; a mission says "this specific change, with these acceptance criteria, verified by these levels, finished and merged." Multiple missions can claim a phase via the optional `phase` frontmatter field, but missions also stand alone — bug fixes and quick wins don't need a phase. Missions replace ad-hoc TODOs scattered through chat, issue trackers, and code: there is now exactly one place a unit of work lives, and one filesystem-driven state machine governs how it moves.

### Lifecycle

```bash
# 1. Create a mission in .planning/missions/todo/
/apes-mission new "Add POST /todos endpoint" --priority 2 --label backend

# 2. Build it — moves to doing/, creates an isolated worktree, runs verification
/apes-build --mission M-0001

# 3. Generate the evidence packet (verification log + diff + auto-review + screenshots)
/apes-evidence M-0001

# 4. Submit for review (move into review/), reviewer reads the packet, then approves
/apes-mission move M-0001 review
/apes-mission move M-0001 done
```

Or chain through several at once:

```bash
/apes-build --prd requirements.md --ralph    # PRD generates missions, then builds them in priority order
```

`/apes-status` summarizes everything — what's in flight, what's blocked, what's done this week.

### State machine

```
todo ──▶ doing ──▶ review ──▶ done
                      │
                      └──▶ doing  (rejected revision)

any state ──▶ canceled  (except done; done is terminal)
```

Every transition has preconditions: dependencies must be `done` to leave `todo`; required verification levels must show `pass` to leave `doing`; an evidence packet must exist to leave `review`. The framework refuses transitions that skip those gates.

---

## Commands

### Build

| Command | Purpose |
|---------|---------|
| `/apes-build` | Full autonomous build from PRD, idea, or specific mission |
| `/apes-build --mission M-NNNN` | Build a single mission end-to-end (todo → review) |

### Missions

| Command | Purpose |
|---------|---------|
| `/apes-mission new "<title>"` | Create a mission in `todo/` with auto-incremented ID |
| `/apes-mission list` | List missions, filterable by state, phase, or label |
| `/apes-mission show <M-NNNN>` | Display a mission's full file and per-mission directory |
| `/apes-mission move <M-NNNN> <state>` | Transition a mission via `git mv` with precondition checks |
| `/apes-mission workpad <M-NNNN> "<note>"` | Append a timestamped workpad entry |
| `/apes-evidence <M-NNNN>` | Generate the evidence packet (proof-of-work bundle for review) |

### Brownfield

| Command | Purpose |
|---------|---------|
| `/apes-map` | Analyze existing codebase |
| `/apes-feature "desc"` | Add a single-phase feature (for multi-phase PRDs, use `/apes-build`) |
| `/apes-fix "desc"` | Test-first bug fix |
| `/apes-refactor "desc"` | Behavior-preserving refactor |

### Quality

| Command | Purpose |
|---------|---------|
| `/apes-verify` | Run 9-level verification pyramid |
| `/apes-test-e2e` | Generate and run E2E tests from user stories |
| `/apes-test-visual` | Visual regression screenshot testing |
| `/apes-test-a11y` | WCAG 2.1 AA accessibility audit |
| `/apes-security-scan` | Full security pipeline (npm audit, secrets, OWASP) |
| `/apes-codex-review` | L8 — cross-model review via Codex CLI (opt-in). `--loop` for the review-fix-review feedback loop; `--enable` / `--disable` / `--status` for config management |

### Maintenance

| Command | Purpose |
|---------|---------|
| `/apes-gc` | Codebase garbage collection (stale docs, dead code, drift) |
| `/apes-gc --fix` | GC with auto-fix for safe issues |

### Info

| Command | Purpose |
|---------|---------|
| `/apes-board` | Kanban board with critical path and phase progress |
| `/apes-status` | Show current position and progress |
| `/apes-metrics` | Session and project metrics dashboard |
| `/apes-help` | All commands with examples |

### Flags

| Flag | Effect |
|------|--------|
| `--mission <M-NNNN>` | Build a specific mission (mutually exclusive with `--prd`/`--idea`) |
| `--prd [file]` | Generate missions from a PRD; combine with `--ralph` to build them |
| `--idea "[text]"` | Generate missions from a one-line idea; combine with `--ralph` to build |
| `--ralph` | Autonomous iteration loop until `todo/` is drained |
| `--max-iterations N` | Per-mission iteration cap (default: 50) |

---

## Verification Pyramid

Every task must pass before commit. Hooks enforce L0–L2.5 automatically.

```
L8  Adversarial Review   ← Cross-model review via Codex CLI (opt-in, fails open)
L7  Visual Regression    ← Screenshot diff against baselines
L6  E2E / Browser        ← Playwright + agent-browser
L5  Security Scan        ← npm audit + gitleaks + semgrep
L4  UI Integration       ← Component actually used in app?
L3  Integration Tests    ← API and E2E tests
L2.5 Coverage Gate       ← 80% threshold enforced
L2  Unit Tests           ← Function-level tests
L1  Static Analysis      ← TypeScript + ESLint
L0.5 Auto Code Review    ← Fires on every Stop (automatic)
L0  Build                ← Does it compile?
```

**L0–L2.5** are deterministic — hooks fire on every file edit regardless of agent behavior. **L3–L5** are automated via scripts. **L6–L7** run automatically when `playwright.config.ts/js` exists in your project. When Playwright isn't configured, the tester uses Playwright MCP tools as a fallback — opening the app, navigating routes, and taking screenshots for evidence. Either way, browser verification is part of every build and feature flow. **L8** is in its own "External" tier — it requires the Codex CLI, runs only when explicitly enabled in `.dos-apes/codex-review-config.json`, and **fails open**: a Codex problem (offline, unauthenticated, disabled) never fails the pyramid. Findings surface to the user as input to a separate fix loop.

---

## Architecture

### Role-Based Agent Teams

Each `/apes-build` run assembles a role-based team. 11 skill files provide domain expertise:

| Skill | Domain |
|-------|--------|
| `product.md` | PRD parsing, acceptance criteria, backlog structuring |
| `orchestration.md` | Agent roles, handoff contracts, parallel execution |
| `architecture.md` | System design, ADRs, ExecPlans, architecture rules |
| `backend.md` | APIs, database, auth, business logic |
| `frontend.md` | Components, state, routing, accessibility |
| `testing.md` | TDD, coverage gates, acceptance criteria verification |
| `browser-verification.md` | Playwright, visual regression, E2E |
| `design-integration.md` | Figma MCP, design tokens, pixel validation |
| `review.md` | Confidence-based code review, security audit |
| `observability.md` | Structured logging, performance verification, health checks |
| `devops.md` | Deployment pipelines, environments, platform config |
| `cross-model-review.md` | L8 consumer protocol: triage Codex findings, address by severity gate, terminal states for the review-fix-review loop |

Commands assemble the right team. `/apes-build` spawns lead + architect + builder + tester + reviewer. `/apes-fix` spawns a focused debugger + tester pair. Each role has defined handoff gates — work doesn't proceed until the gate passes.

### Cross-Model Review (L8)

L8 is opt-in cross-model review. A second model (Codex CLI, default `gpt-6.1-sol`) reads the diff produced by the first model (Claude) and emits structured findings against a JSON schema. Two different models catching each other's blind spots is more robust than one model reviewing its own work.

**The contract:**

- **Opt-in.** Disabled by default. Flip via `/apes-codex-review --enable` or by editing `.dos-apes/codex-review-config.json`.
- **Capability-gated.** `scripts/codex-check.js` runs an actual `--output-schema` round-trip against the configured model and caches the result for 24 hours. The configured model must honor structured outputs or the review refuses to run. (The notorious `gpt-5-codex` slug silently drops the flag and is rejected at this stage.)
- **Fails open.** Codex offline, unauthenticated, or rate-limited never fails the pyramid. The check returns a `skipped` JSON envelope and the surrounding command continues.
- **Severity-gated loop.** The `--loop` form addresses only `high`/`critical` findings (configurable). `low`/`medium` findings are reported but never auto-fixed — left for human review by design.
- **ChatGPT account auth.** No API key. `codex login` once per machine.

The prompt template, schema, and config all live in `.dos-apes/` so users can customize per project. The consumer protocol — how to read findings, prioritize fixes, and decide when to stop the loop — lives in `cross-model-review.md`.

**Codex review state is now visible on the mission board (3.4.0).** `/apes-status` shows the latest verdict and unresolved-finding count for each active mission, sourced from the `codex` block in mission frontmatter (schema v2). Both `codex-review.js` (single-shot) and `codex-review-loop.js` write their terminal state into the mission file via `MissionTracker.setCodexState`, so the same surface drives `/apes-build`'s post-L8 branching, `/apes-status`'s dashboard, and any custom command that wants to reason about review history. Set `codex.required: true` on a mission to make the loop refuse to terminate with `skipped` when Codex is unavailable — useful for missions that genuinely depend on adversarial review before merge. See `framework/skills/missions.md` "Codex review state" for the field reference.

> **⚠️ Windows users:** the JSON files at `.dos-apes/codex-review-config.json`, `.dos-apes/codex-review-schema.json`, and the Markdown at `.dos-apes/codex-review-prompt.md` must be written **without a UTF-8 byte-order mark**. PowerShell's default `Out-File -Encoding utf8` writes a BOM that breaks the Codex CLI's JSON parsing. Edit these files in your IDE (VS Code's default UTF-8 is BOM-free), or if you must script changes use `[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))`. The framework's installer and the `node` scripts always write BOM-free.

### Hook Scripts (Deterministic Quality)

These fire automatically — no agent cooperation required:

| Hook | Trigger | Action |
|------|---------|--------|
| `guard-main-branch.sh` | PreToolUse (Edit/Write) | Blocks edits on main branch |
| `track-modified-files.sh` | PostToolUse (Edit/Write) | Tracks files for auto-review |
| `check-coverage.sh` | On verify | Enforces 80% coverage threshold |
| `check-secrets.sh` | On verify | Detects leaked secrets (gitleaks) |
| `metrics-init.sh` | SessionStart | Initializes metrics tracking |
| `metrics-update.sh` | PostToolUse | Updates file modification counts |
| `check-doc-drift.sh` | On verify | Warns when source changes without doc updates |
| `check-task-gates.sh` | Explicit (orchestrator) | Enforces state machine transitions |
| `check-structure.sh` | PostToolUse (Edit/Write) | Architectural boundary enforcement |

TypeScript checking, test running, and auto-formatting also fire as PostToolUse hooks (configured in `settings.json`). All PostToolUse hooks include safety nets (`|| true`) to prevent cascading failures when bash can't start (common on Windows).

### What Gets Installed

```
project-root/
├── CLAUDE.md                    # Project brain (generated for your stack)
├── .claude/
│   ├── commands/                # 18 slash commands
│   │   ├── apes-build.md
│   │   ├── apes-feature.md
│   │   ├── apes-fix.md
│   │   ├── apes-refactor.md
│   │   ├── apes-map.md
│   │   ├── apes-mission.md      # Mission CRUD and state transitions
│   │   ├── apes-evidence.md     # Generate evidence packets
│   │   ├── apes-verify.md
│   │   ├── apes-test-e2e.md
│   │   ├── apes-test-visual.md
│   │   ├── apes-test-a11y.md
│   │   ├── apes-security-scan.md
│   │   ├── apes-codex-review.md # L8 single-shot review + --loop driver
│   │   ├── apes-board.md
│   │   ├── apes-gc.md
│   │   ├── apes-status.md
│   │   ├── apes-metrics.md
│   │   └── apes-help.md
│   ├── skills/                  # 15 domain skills + README
│   │   ├── product.md
│   │   ├── orchestration.md
│   │   ├── architecture.md
│   │   ├── backend.md
│   │   ├── frontend.md
│   │   ├── testing.md
│   │   ├── browser-verification.md
│   │   ├── design-integration.md
│   │   ├── review.md
│   │   ├── observability.md
│   │   ├── devops.md
│   │   ├── missions.md          # Mission file format and lifecycle
│   │   ├── worktrees.md         # Mission worktree management
│   │   ├── evidence-packets.md  # Evidence packet format and review
│   │   └── cross-model-review.md # L8 consumer protocol (triage / fix / terminal states)
│   └── settings.json            # Hooks, permissions, MCP servers
├── lib/                         # Library layer — canonical mission API
│   ├── mission-schema.js        # Frozen constants + validation + migration framework
│   ├── mission-parser.js        # Frontmatter / body / acceptance / workpad parsing
│   └── mission-tracker.js       # MissionTracker — identity, state, deps, workpad, authoring
├── scripts/                     # 19 hook + helper scripts
│   ├── guard-main-branch.sh
│   ├── hook-format-and-stage.sh
│   ├── hook-typecheck.sh
│   ├── hook-test-related.sh
│   ├── track-modified-files.sh
│   ├── check-coverage.sh
│   ├── check-secrets.sh
│   ├── check-doc-drift.sh
│   ├── check-task-gates.sh
│   ├── check-structure.sh
│   ├── metrics-init.sh
│   ├── metrics-update.sh
│   ├── mission-cli.js           # Thin CLI wrapper around MissionTracker (JSON I/O)
│   ├── mission-worktree.js      # Worktree create/sync/remove/list
│   ├── log-verification.js      # Append run to active mission's verification.jsonl
│   ├── evidence-packet.js       # Generate the proof-of-work bundle
│   ├── codex-check.js           # L8 prerequisite check (CLI + auth + structured-output capability)
│   ├── codex-review.js          # L8 single-shot review primitive
│   └── codex-review-loop.js     # L8 review-fix-review loop driver
├── .planning/                   # Project state
│   ├── PROJECT.md               # Vision, users, success criteria
│   ├── ROADMAP.md               # Strategic phases + auto-tracked missions
│   ├── MEMORY.md                # Cross-session learnings
│   ├── active-mission           # Single line: ID of mission this session is executing
│   └── missions/                # Mission files per state
│       ├── todo/
│       ├── doing/
│       ├── review/
│       ├── done/
│       └── canceled/
├── .dos-apes/                   # L8 config + capability cache + review history (created on init)
│   ├── codex-review-config.json      # enabled flag, model, severity gate, skip globs
│   ├── codex-review-config.README.md # field-by-field documentation
│   ├── codex-review-prompt.md        # reviewer prompt template (placeholders for diff/mission)
│   ├── codex-review-schema.json      # JSON schema Codex must conform to
│   ├── codex-capabilities.json       # 24h-TTL cache: which model honors --output-schema
│   └── codex-reviews/                # per-iteration packets + result.json (audit trail)
├── docs/templates/              # PRD, ADR, ExecPlan, mission, architecture rules
└── .github/workflows/           # CI workflow templates (optional)
    ├── weekly-quality.yml
    ├── dependency-audit.yml
    └── post-merge-verify.yml
```

---

## Git Workflow

Built-in branching strategy with hook-enforced main branch protection:

| Action | What Happens |
|--------|-------------|
| Phase start | Branch from main: `feat/phase-N-description` |
| Each task | Commit + git tag: `phase-N/task-M-complete` |
| Phase complete | Squash merge to main |
| Task rollback | `git reset --hard phase-N/task-M-complete` |
| Approval gates | `[APPROVAL]` tasks block until human confirms |
| Browser gate | `[GATE] UI Smoke Test` verifies app works in browser after each phase |

---

## CI Workflows (Optional)

Three GitHub Actions templates are installed to `.github/workflows/`:

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `weekly-quality.yml` | Monday 3am | Full quality sweep: build, typecheck, lint, test |
| `dependency-audit.yml` | Biweekly | npm audit + auto-update with test verification |
| `post-merge-verify.yml` | On merge to main | Full verification pyramid after every merge |

Skip with `npx dos-apes --no-ci`.

---

## Configuration

### settings.json

The main configuration file at `.claude/settings.json` controls:

- **Hooks** — SessionStart, PreToolUse, PostToolUse, Stop hooks
- **Permissions** — Allowed CLI commands (git, npm, node, etc.)
- **MCP Servers** — Playwright MCP for browser testing
- **Environment** — Framework version and flags

### CLAUDE.md

Your project brain file. The CLI generates it with your tech stack, but you should maintain it:

- Add project-specific conventions as they emerge
- Log mistakes so Claude doesn't repeat them
- Keep it under 2000 tokens — prune aggressively
- Commit to git so it persists across sessions

### Installer Flags

```bash
npx dos-apes-super-agent                   # Interactive setup
npx dos-apes-super-agent --local           # Install to ./.claude/ (this project)
npx dos-apes-super-agent --global          # Install to ~/.claude/ (all projects)
npx dos-apes-super-agent --greenfield      # New project (skip prompt)
npx dos-apes-super-agent --brownfield      # Existing project (skip prompt)
npx dos-apes-super-agent --yes             # Accept all defaults
npx dos-apes-super-agent --no-hooks        # Skip hook scripts
npx dos-apes-super-agent --no-ci           # Skip CI workflow templates
npx dos-apes-super-agent --version         # Print version
npx dos-apes-super-agent --help            # Show all options
```

---

## The AI Software Company

Every `/apes-build` run assembles an AI software company:

- **Product Manager** (lead) — Parses the PRD, writes acceptance criteria, structures the backlog
- **Architect** — Designs the system, writes ADRs and ExecPlans, defines architecture rules
- **Engineers** (builder) — Implement against the architect's contracts, write unit tests
- **QA** (tester) — Verifies every acceptance criterion has a passing test, runs the pyramid
- **Reviewer** — Confidence-scored code review, security audit, never fixes directly

Each role loads specific skills and has defined handoff gates. The task state machine (BACKLOG → READY → IN_PROGRESS → IN_REVIEW → IN_QA → VERIFIED → MERGED) enforces that work doesn't skip steps. Gate checks are mechanical — no agent can bypass them.

---

## Philosophy

### Plan First, Execute Second

Every piece of work starts in plan mode. A good plan pays back 5x during execution. The framework enforces this — `/apes-build` plans before it builds, `/apes-feature` specs before it codes.

### Verify Everything

Claude must prove its work, not just claim completion. Hooks make verification automatic. If Claude can't verify it, it's not done.

### Skills Over Agents

v1 had 12 hardcoded agents. v3 has 11 skill files that any teammate can load, plus product and orchestration roles for requirements analysis and coordination. The platform handles orchestration; the framework provides domain expertise.

### Hooks Over Trust

Quality checks fire deterministically regardless of agent behavior. TypeScript is checked on every `.ts` edit. Tests run on every test file change. Main branch is protected on every write. No cooperation required.

---

## Troubleshooting

### Commands not showing up

Slash commands must be in `.claude/commands/`. If you installed globally, they're in `~/.claude/commands/`. Restart Claude Code after installing.

### Hooks not firing

Check that `scripts/` directory exists in your project root and scripts are executable. Claude Code runs hook commands through Git Bash natively on Windows; if your Git Bash is in a nonstandard location, set `CLAUDE_CODE_GIT_BASH_PATH` in your settings `env`. Without Git Bash installed, Claude Code uses the PowerShell tool and the framework's bash hooks (including the permission guard) cannot run — install [Git for Windows](https://git-scm.com/download/win). If your `.claude/settings.json` hook commands reference the retired `scripts\run-hook.cmd` wrapper (installed by earlier Windows versions), re-run the installer — it migrates them back to the plain `bash scripts/*.sh` form; the wrapper silently broke all hooks under native Git Bash execution.

### Playwright MCP not connecting

The framework configures Playwright MCP in `settings.json`, but you need `@playwright/mcp` installed. It will auto-install via `npx` on first use, but you can pre-install:

```bash
npm install -D @playwright/test
npx playwright install
```

### Gate check failing

Task state transitions are enforced by `scripts/check-task-gates.sh`. If a gate blocks progression, fix the underlying issue (e.g., failing tests for IN_PROGRESS → IN_REVIEW). The gate will tell you which check failed. Do not bypass gates — they exist to catch issues early.

### Coverage gate failing

The default threshold is 80%. Adjust in `scripts/check-coverage.sh` or skip with:

```bash
DOS_APES_SKIP_COVERAGE=true
```

---

## Credits

Built on patterns from:

- **[Claude Code Agent Teams](https://docs.anthropic.com/en/docs/claude-code)** — Native multi-agent orchestration
- **[GSD](https://github.com/glittercowboy/get-shit-done)** — Spec-driven development, context engineering
- **[VibeKanban](https://vibekanban.com)** — Git worktree orchestration, parallel execution
- **[Ralph Wiggum](https://github.com/anthropics/claude-code/blob/main/plugins/ralph-wiggum/README.md)** — Iterative loops, persistence
- **Boris Cherny's Workflow** — Verification-first philosophy, shared CLAUDE.md
- **[OpenAI Harness Engineering](https://x.com/GrantSlatton/status/1888657344296124680)** — "Map not manual", mechanical enforcement over documentation

---

## License

MIT — Use freely, contribute back.

---

🦍🦍 **Dos Apes: We ain't monkeying around with code!**
