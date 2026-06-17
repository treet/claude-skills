---
name: land-pr
description: "Drive an open, already-prepped PR to mergeable state autonomously: fix failing checks, verify and resolve bot review threads, and reschedule the next round (~5 min) until the PR is mergeable, blocked on a human-only issue, or closed. Never merges and never writes to the default branch; it only readies the PR for a person to press merge. Run directly via /land-pr; the finalize skill calls it after prune/review/compliance, and natural-language 'land the PR' or 'open a PR' routes to finalize, not here."
argument-hint: "PR number or URL (optional — defaults to current branch's PR)"
---

# Land PR

Drive an open PR to mergeable state. One invocation runs one round; if the round didn't terminate the PR, the skill schedules itself to run again in ~5 minutes via a one-shot `CronCreate`. The recurrence is self-perpetuating — there is no separate loop to manage.

Cron schedules are in-memory by default and die with the Claude session. Use `durable: true` only if the user explicitly asks the loop to survive across sessions.

PR replies and commit messages are terse, no emdashes. Never accept a bot suggestion without verifying it against the actual code.

## One round

Resolve the target PR — the argument carries a number or URL, otherwise default to the current branch's PR. If nothing resolves to an open PR, report and stop.

Then:

"Mergeable" here means the merge button is actually pressable right now: no conflicts, no unresolved bot threads, and every required check and job has finished and passed. A check that is queued or in progress is not mergeable, even if nothing has failed yet — that is a "still running" round, not a terminal state.

An **in-flight Copilot review** counts the same as an in-progress check. Copilot reviews asynchronously and its state is **not** in the check rollup, so a round can otherwise look mergeable while Copilot is still about to post threads. If Copilot has been re-requested for the current head but has not yet submitted that review, the round is "still running" — wait it out rather than declaring mergeable. Detect this with the `copilot-inflight.ts` helper below; never treat it as a wait condition by guessing.

**Read the PR's state.** Mergeability, check rollup, unresolved review threads, head SHA vs. local. If the PR is no longer open, or the local branch isn't the PR's head branch, or the remote moved and won't fast-forward — report and stop. Don't rebase, don't force-push, don't switch branches.

**Resolve failing checks.** For each failure, pull enough log to understand it.

- A real defect in this PR's code → fix, run the project's pre-commit hook (whatever the repo already runs), commit, push.
- A flake → re-run once. If the same check fails again on the next round, treat it as opaque.
- Anything outside this loop's reach (secrets, expired credentials, missing services, runner outages, providers without accessible logs) → report and stop.

**Triage review threads.** Bot threads only — human threads are out of scope. For each unresolved bot thread, open the file at the PR's current head SHA and verify the cited snippet still exists there — bots regularly flag code that was refactored away on the base branch or never landed in the first place. Then form your own judgment:

- Concern is real and in scope → fix, commit, push, reply acknowledging the fix, resolve the thread.
- Concern doesn't apply → reply with a brief polite decline citing why, resolve the thread.
- Cited code no longer exists at head (refactor on base branch, prior commit removed it, bot misread) → resolve with a brief "moot after rebase" / "no longer applies" reply, no code change.

If a bot reposts the same concern after dismissal, evaluate it again, and if it still doesn't apply, treat it as a signal that the solution contains a decision that is not obvious from the code alone. Document the decision, either a very brief code comment or in a suitable documentation file in the repository.

**Decide what happens after this round.**

- Merge button pressable **and no Copilot review in flight**: no conflicts, every check and job finished and passed, no unresolved bot threads, and `copilot-inflight.ts` reports `inflight: false` → report "ready to merge" and stop.
- Anything else — any check or job still queued or in progress, **or a Copilot review still in flight** (`inflight: true`) → schedule the same skill invocation to fire again in ~5 minutes via a one-shot `CronCreate`, then end the round quietly.

The schedule should land off the :00/:30 fleet hot-spots — pick a minute offset. Stop looping and tell the user if the PR is not mergable after 10 rounds or 2h — this cap also bounds the pathological case where Copilot is requested but never posts, so an in-flight check can't loop forever.

## Constraints

- Current branch only. Never check out, create, or switch branches.
- New commits only. No `--amend`, no `--force` of any kind, no `--no-verify`, no resets that discard work.
- Don't stage files unrelated to this round's fixes, even if the working tree is dirty.
- Don't open new PRs and don't merge this one.

## Terminal outcomes

Terminal outcomes (mergeable, blocked, closed, diverged, wrong branch, etc.) are reported in one short summary describing what happened and what the user needs to do next. Mid-loop rounds are silent — they fire on a 5-minute cadence and a per-round report would be noise.

On the **mergeable** outcome, count `// TODO:` lines added on this branch vs the default branch (`git diff origin/HEAD...HEAD`). If any exist, append "N flagged issue(s) — review the TODOs before merge" to that summary. These are `finalize`'s sanctioned stuck-critical markers — the durable breadcrumb for issues it couldn't resolve, since the prep session may be long gone by the time the loop finishes.

## Existing helpers

These scripts already do the GitHub plumbing — use them rather than rebuilding the API calls:

- `bun ~/.claude/skills/review-pr/list-threads.ts <PR>` — list unresolved threads with author, file, line, body.
- `bun ~/.claude/skills/review-pr/resolve-thread.ts <thread-id> "<reply>"` — post reply and resolve in one shot.
- `bun ~/.claude/skills/review-pr/copilot-inflight.ts <PR>` — report whether a Copilot review is in flight for the PR head. Prints `inflight: true|false` (exit 2 = in flight, 0 = clear). In flight = Copilot's latest `review_requested` timeline event is newer than its latest submitted review — true exactly during a review window, and not merely because the head is newer than the last reviewed commit (Copilot does not re-review every push). Treat `inflight: true` as a still-running round; never declare mergeable while it holds.

## Reporting

Each round ends with a short summary: PR title, mergeability, check pass/total, unresolved thread counts split by bot vs. human, what was done this round, what's blocking. Keep it tight — the reader is scanning across many rounds. Mention "next round in ~5 min" when scheduling, or the terminal outcome when stopping.
