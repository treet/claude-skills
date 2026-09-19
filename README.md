# Claude Code skills

A bundle of Claude Code skills and one agent. The layout
mirrors `~/.claude/` — drop `skills/`, `agents/`, and `scripts/` into place (or a
project's `.claude/`) to install.

```
skills/
  finalize/    SKILL.md + scripts/   drive a branch to a merge-ready PR, unattended
  land-pr/     SKILL.md              convergence loop: fix checks + bot threads until mergeable
  review-pr/   SKILL.md + scripts/   review & resolve PR threads; GitHub plumbing scripts
  wrap-up/     SKILL.md              end-of-session checklist (ship, memory, self-improve)
  grill-me/    SKILL.md              interview/stress-test a plan or design
agents/
  compliance-reviewer.md            fresh-context reviewer: checks code vs the project's own rules
```

`badges/` holds SVG logomarks used to label a PR comment as written by a coding agent.

## How the PR-landing skills fit together

- **`finalize`** is the entry point: **prune → solution-review → beyond-the-diff
  → compliance audit**, then commit, push, open the PR if missing, and hand off
  to `land-pr`. It never merges and never writes to the default branch. Phases
  1–2b are inlined in its `SKILL.md` (no separate prune/solution-review skills).
- **Phase 3** delegates to the **`compliance-reviewer`** agent, which re-derives
  the project's rules from `CLAUDE.md` files + skill bodies and reports
  violations against the working tree.
- **`land-pr`** owns the post-push loop: fix failing checks, verify and resolve
  bot review threads, detect in-flight Copilot reviews, and reschedule itself
  (~5 min) until the PR is mergeable or blocked.
- **`review-pr`** holds the GitHub plumbing scripts `land-pr` uses:
  `list-threads`, `resolve-thread`, `copilot-inflight`.

`wrap-up` and `grill-me` are standalone — no external dependencies.

## Setup notes

- **Bun** runs the `.ts` scripts (`bun list-threads.ts <PR>`); they shell out to
  the authenticated **GitHub CLI** (`gh`).
- `review-pr/resolve-thread.ts` has an **owner-allowlist guardrail** — set
  `REVIEW_ALLOWED_OWNERS` (comma-separated GitHub orgs/users) before use; it
  refuses to resolve threads outside the allowlist.
- The `finalize/scripts/*` copies are an **older variant** without that guardrail
  and the outdated-thread split; `land-pr` invokes the `review-pr/*` versions.
- `land-pr` self-schedules via Claude Code's `CronCreate` tool.
- These skills assume a personal `CLAUDE.md` convention set (terse PR bodies,
  no-emdash commits). Adjust to taste.
