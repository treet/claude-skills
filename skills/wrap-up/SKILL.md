---
name: wrap-up
description: Use when user says "wrap up", "close session", "end session", "wrap things up", "close out this task", or invokes /wrap-up — runs end-of-session checklist for shipping, memory, and self-improvement
---

# Session Wrap-Up

Run four phases in order. Each phase is conversational and inline — no separate documents.

## Phase 1: Remember It

Review what was learned during the session. Decide where each piece of knowledge belongs in the memory hierarchy:

**Memory placement guide:**

- **Project docs** (`docs/adrs/`, `docs/specs/`, READMEs, etc.) — Findings about how the project actually works: delivery channels, architectural constraints, runtime behaviour, gotchas teammates will hit. If the finding affects how *other people* operate the codebase, it belongs in the codebase's own docs, not in Claude-only memory. Check first whether an existing ADR or spec already covers the area and extend it rather than creating new docs.
- **Auto memory** (Claude writes for itself) — Debugging insights, patterns discovered during the session, project quirks that only Claude needs to recall. Tell Claude to save these: "remember that..." or "save to memory that..."
- **CLAUDE.md** (instructions for Claude) — Permanent project rules, conventions, commands, architecture decisions that should guide all future sessions
- **`.claude/rules/`** (modular project rules) — Topic-specific instructions that apply to certain file types or areas. Use `paths:` frontmatter to scope rules to relevant files (e.g., testing rules scoped to `tests/**`)
- **`CLAUDE.local.md`** (private per-project notes) — Personal WIP context, local URLs, sandbox credentials, current focus areas that shouldn't be committed
- **`@import` references** — When a CLAUDE.md would benefit from referencing another file rather than duplicating its content

**Decision framework:**

- Does it affect how teammates use or operate the codebase (delivery pipeline, runtime behaviour, system constraints)? → Project docs first; check whether an existing ADR/spec covers the area before adding a new file
- Is it a permanent project convention for Claude? → CLAUDE.md or `.claude/rules/`
- Is it scoped to specific file types? → `.claude/rules/` with `paths:` frontmatter
- Is it a Claude-only pattern or insight (debugging recipes, naming conventions Claude needs)? → Auto memory
- Is it personal/ephemeral context? → `CLAUDE.local.md`
- Is it duplicating content from another file? → Use `@import` instead

Note anything important in the appropriate location.

## Phase 2: Review & Suggest

Analyze the conversation for self-improvement findings. If the session was short or routine with nothing notable, say "Nothing to improve" and proceed to the next phase.

**Finding categories:**

- **Skill gap** — Things Claude struggled with, got wrong, or needed multiple attempts - mistakes and near misses.
- **Friction** — Repeated manual steps, things user had to ask for explicitly that should have been automatic
- **Knowledge** — Facts about projects, preferences, or setup that Claude didn't know but should have
- **Automation** — Repetitive patterns that could become skills, hooks, or scripts

**Action types:**

- **Project docs** — Edit an ADR / spec / README when the finding affects how teammates use or operate the codebase
- **CLAUDE.md** — Edit the relevant project or global CLAUDE.md
- **Rules** — Create or update a `.claude/rules/` file
- **Auto memory** — Save an insight for future sessions
- **Skill / Hook** — Document a new skill or hook spec for implementation
- **CLAUDE.local.md** — Create or update per-project local memory

Present findings as suggestions — do not apply anything. Wait for approval before making changes. Format:

Findings:

1. Skill gap: Cost estimates were wrong multiple times
   → Suggest: [CLAUDE.md] Add token counting reference table

2. Knowledge: Worker crashes on 429/400 instead of retrying
   → Suggest: [Rules] Add error-handling rules for worker

3. Automation: Checking service health after deploy is manual
   → Suggest: [Skill] Create post-deploy health check skill spec

---

No action needed:

4. Knowledge: Discovered X works this way
   Already documented in CLAUDE.md

Wait for the user to approve, reject, or modify each suggestion before applying anything.

## Phase 3: Follow-up List

Scan the conversation for work that was mentioned but not acted on: parked ideas, out-of-scope observations, "we should fix this later" moments, pre-existing issues discovered in passing, or cleanup tasks that didn't belong in the session's main PR.

Present the findings as candidate issues/tickets. Each entry should include:

1. **Title** — short, action-oriented
2. **Context** — 1-2 sentences explaining what was noticed and why it's worth tracking
3. **Suggested destination** — Linear/Jira/GitHub issue, a TODO in `CLAUDE.local.md`, or "drop" if it doesn't justify tracking

Format:

Follow-ups:

1. Fix E2E assertions that have drifted from current UI text
   Two stale assertions were found during this session. Nobody was watching E2E on main, so drift accumulated.
   → Linear: file issue to add periodic E2E baseline on main

2. Investigate `incremental: true` + `types: []` for CI tsc cache
   Identified as the real lever for tsc speed but not attempted.
   → GitHub issue in project repo

Wait for the user to approve, reject, or modify each follow-up before filing or adding anything. If nothing worth following up on, say "No follow-ups" and move on.

## Phase 4: Team-facing Notes

Only run if the session surfaced a non-obvious technical finding worth sharing with teammates — something the next person will hit and waste time on if they don't know about it. The bar is: "would a colleague's hour be saved by this?"

Keep it lightweight. Do NOT draft anything until the user approves.

If a finding meets the bar, present it as a one-line candidate with a suggested destination:

- **Slack message** — team channel, for conversational or time-sensitive findings
- **Internal docs / wiki** — for durable technical knowledge that the team will refer back to
- **CLAUDE.md / AGENTS.md / agent instructions** — for rules that should guide future AI sessions in this repo
- **Skill (`~/.claude/skills/`)** — for reusable workflow patterns

Format:

Team notes:

1. Reanimated's `useScrollOffset` drags `ComponentProps` → `IntrinsicElements` into every call, causing ~120ms tsc hotspots per usage.
   → Slack post in #react-native, 3-4 sentences

Wait for the user to pick which (if any) to formalize. Keep the final note short and direct — finding and implication, no fluff.

If nothing meets the bar, say "No team notes" and you're done.
