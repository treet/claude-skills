---
name: review-pr
description: "Review and resolve PR review comments. Three-phase workflow: fetch & summarize, apply fixes, post replies & resolve threads."
argument-hint: "PR number or URL (optional — defaults to current branch PR)"
---

# PR Comment Review

Three-phase workflow with hard STOP gates between phases. PR comment reply style: terse, no emdashes (use hyphens).

## PR Number Resolution

Resolve the PR number in this order:
1. If `$ARGUMENTS` is a number or URL, extract the PR number from it.
2. Otherwise, run `gh pr view --json number -q .number` to get the current branch's PR.

## Phase 1: Fetch & Summarize

Run the helper script to list unresolved review threads:

```
bun ~/.claude/skills/review-pr/list-threads.ts <pr-number>
```

Present each unresolved thread as:

1. **Comment** — full text of all comments in the thread.
2. **Context** — 1-2 sentence summary of what the comment is about. No code dumps.
3. **Suggested Action** — fix or dismiss, with reasoning.

When a thread is marked `Outdated: yes`, the code it references has been rewritten, reverted, or removed since the comment was posted (usually via force-push or rebase). The default suggested action for outdated threads is **"reply briefly that the code has since changed, then resolve"** — no code fix needed. Only deviate when you can confirm the underlying concern still applies to code that's currently in the tree.

**STOP.** Do not proceed. Wait for the user to decide per-thread what action to take.

## Phase 2: Apply Local Fixes

For each thread the user wants fixed:
- Apply the code fix locally.
- Draft terse reply text for the thread.

Present all changes and draft replies.

**STOP.** Do not proceed. Wait for the user to approve reply text (may edit).

## Phase 3: Post & Resolve

For each approved thread, run:

```
bun ~/.claude/skills/review-pr/resolve-thread.ts <thread-id> "<reply text>"
```

Report results (success/failure per thread). Permission is per-round — if there are remaining threads, present them and wait for approval before the next batch.
