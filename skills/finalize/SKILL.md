---
name: finalize
description: "Autonomously drive a branch to a merge-ready PR — prune complexity, solution-review, compliance-audit, then commit, push, open the PR if missing, and hand off to the land-pr convergence loop. Runs unattended and never merges; surfaces only what it cannot safely resolve. TRIGGER on 'finalize', 'land the PR', 'land PR <n>', 'finish and land', 'ship this PR', 'open a PR' / 'open the PR'."
argument-hint: "PR number or URL (optional — defaults to the current branch)"
---

# Finalize

Take the current branch all the way to a merge-ready PR, unattended: prune → solution-review → compliance, then commit, push, open the PR if there isn't one, and hand the convergence loop to `land-pr`.

**Do as much as possible before a human is involved.** Apply every clear improvement and fix; never stop for approval. Even when one issue can't be safely fixed, keep going — fix the build, typechecking, unrelated review comments, everything else — and surface only what's left. This skill never merges and never writes to the default branch.

Overarching principle: **minimalism and YAGNI.** Every line, abstraction, and branch must earn its place. When in doubt, remove.

Run the phases sequentially: prune simplifies, review examines what remains, compliance checks the final code. Each phase operates on the previous phase's result.

## Scope

Review the **whole branch diff against the default branch** — committed and uncommitted together (diff against `git merge-base HEAD origin/HEAD`, plus the working tree). If a PR number/URL is given, it identifies the PR to land into; the diff is still the branch's full change.

If there is nothing to review and an open PR already exists, hand straight to `land-pr`. If there is nothing at all, say so and stop.

## Phase 1: Prune

Evaluate the diff as if seeing this code for the first time. Do not carry forward justifications from the implementation discussion — the code must justify itself on its own merits. Challenge every piece of added complexity; every new type, helper, layer, branch, and config option must beat "just delete it."

For each logical chunk:

1. **Solves a real problem right now?** Not future, not theoretical. "Might be needed later" / "good practice" is not a reason.
2. **Needs to be its own thing?** Called from 2+ places? If not, why isn't it inline?
3. **A knob nobody will turn?** Config for values that never vary, one-field options, one-variant enums, params always passed the same.
4. **Guarding against something that can't happen?** Null checks on never-null values, branches for conditions the caller prevents, validation of just-constructed data.
5. **A layer where a direct call would do?** Wrappers that delegate without transforming, indirection where a direct call is clearer.
6. **Even in scope?** Tangential feature/edge case; a nice-to-have masquerading as a requirement.
7. **The simplest way to the same result?** Challenge the approach — simpler data structure, shorter call chain, a built-in that already does it.
8. **A bespoke scheme where a convention exists?** A new path/key layout, id format, naming, error mapping, or storage shape that diverges from how the codebase already solves it (see Phase 2b §3).

**Action:** Apply every simplification with clear benefit and low-to-medium loss. Skip only when loss is high or the trade-off is genuinely unclear. When in doubt, simplify — the diff restores anything.

**Emit a removal list.** For every cut, record one line: what was removed and the rationale — especially any "can't happen / unreachable / never null / caller already prevents this" judgment. Phase 2 re-validates these.

## Phase 2: Solution review

Review the code **as it stands after pruning**, and re-validate Phase 1's removal list: for each "can't happen" cut, independently confirm the value really can't be null, the branch really is unreachable, the guard really was redundant. A wrong prune is a bug introduced here — catch it. Use conversation + Linear context to tell intentional design from defects.

Prioritize systemic flaws over local nits. Ignore performance and observability unless they affect correctness.

Where feasible, **exercise** the changed surface rather than only reading it (Phase 2b §2) — observed behavior beats inferred.

**Look for:** logic errors (off-by-one, inverted conditions, null/undefined crashes, races, swallowed errors, coercion); edge cases (empty/zero/boundary inputs, concurrency, unicode); won't-work-in-practice (dev-only assumptions, misused libraries, unbounded growth); undocumented limitations (implicit dependencies, order-of-operations, unguaranteed cleanup); security (unsanitized input reaching dangerous ops, credential leaks, auth bypasses).

**Ignore:** safety theater (try-catch with no specific lost error, "this could fail", "validate inputs" when validated upstream); out-of-scope ("add tests", "update docs").

Label each: Category (Bug / Edge Case / Limitation / Risk), Severity (CRITICAL / HIGH / MEDIUM / LOW).

**Action:** CRITICAL/HIGH → fix (minimum code; an edge case may be fixed by removing flawed code and asserting the limitation). MEDIUM/LOW → fix if small, reduces complexity, or aligns with patterns. Don't guess intent on a HIGH — leave the safer minimal form and record it under Unresolved.

## Phase 2b: Beyond the diff

A diff shows what the code *does* — not whether the feature is complete, idiomatic, or works against the real system. A static read can't see a missing capability, a one-off convention, or a resource that isn't deployed. Apply these lenses with **evidence, not inference** — run it, grep it, query it — scoped to the surface the diff touches. When a check can't run (no creds, nothing deployed), say so and reason instead; never report unobserved as verified. Fix what's safe and in scope; record the rest under Unresolved. A gap that's a deliberate decision is fine — but it must be a *decision*, not an oversight.

1. **Feature completeness.** Review the change as a capability, not a patch. Every create needs a delete/cleanup; every state must be reachable *and* exitable (publish without unpublish, draft without discard); every write has a day-2 op (edit, copy, undo, list). Enumerate what a user will expect that the diff omits — absence is invisible in a diff, so list it deliberately.

2. **Exercise it, don't infer it.** Observe behavior, don't read it. Call the API on happy *and* each error path (test harness, scratch script, or `curl` against a stage); drive the UI you changed (incl. empty/disabled/error); seed a record and read it back through the real code path. Anything reachable by manual testing is reachable programmatically — write the few lines, run them, check the output. A path you only read is unverified.

3. **Convention fit.** For any new scheme (path/key layout, id format, naming, error→HTTP mapping, storage shape, config knob), grep how the codebase already solves it and compare. Flag one-offs — prefer the established pattern unless there's a stated reason. Ask "how is this already done here?" before accepting anything bespoke.

4. **Runtime/deploy reality.** Verify the system the code assumes, against the deployed stage not the source: resource names resolve, the object/route is reachable, it lives where expected. Distinguish what deploys *with this change* from shared infra that redeploys elsewhere, and per-stage from shared resources. Probe it (CLI/HTTP) where creds allow; otherwise state the assumption as unverified.

## Phase 3: Compliance audit (delegated)

Spawn the `compliance-reviewer` agent (Agent tool, `subagent_type: compliance-reviewer`): target type `implementation`, the post-prune/post-review working tree. This checks the change against the CLAUDE.md rules and active skills (comment policy, "pick one approach", plain English) — a separate concern from correctness.

Apply its CRITICAL/HIGH findings; treat MEDIUM/LOW with the same pragmatism as Phase 2. Run once, after Phase 2, so it reviews the final code.

## Unresolved criticals

Anything still unresolved after the phases — an unfixable bug, a HIGH whose intent is unclear, a compliance FAIL you couldn't satisfy — does **not** block landing and is **never** posted to the PR. Surface it two ways:

- In the session summary.
- Where it sits in code and a marker genuinely helps the next reader: a single **extremely short** `// TODO:`, used **sparingly**. Add these **after** the compliance audit (Phase 3) so the audit doesn't flag them. They are a sanctioned exception to the no-comment / no-TODO rule — for stuck criticals only, nowhere else.

## Commit, push, open PR

Operate on the **current branch only — never `main`/`master`.** New commits only: no `--amend`, no `--force`, no `--no-verify`, no resets that discard work. Let the repo's pre-commit hooks run; if one fails, fix the cause and make a new commit.

Commit the prep edits with a terse message (no emdashes), push. If no open PR exists for the branch, open one — one-paragraph body per the PR-description rules (goal/outcome only, no test plan).

## Hand off to land-pr

Invoke `land-pr` for this branch. It owns the convergence loop — failing checks, bot threads, merge-readiness — and reschedules itself until the PR is mergeable or blocked. Finalize's job ends once land-pr is running; do not also poll the PR yourself.

## Summary

Tight, scannable. Omit empty sections.

```
## Finalize

### Applied
**Prune** — N. `thing`: what changed. Lost: what, if anything.
**Solution review** — N. [SEVERITY] `loc`: issue → fix.
**Compliance** — N. [SEVERITY] `loc`: rule → fix.

### Unresolved (flagged, not blocking)
N. [SEVERITY] `loc`: issue → why it's stuck. TODO dropped: yes/no.

### Landing
PR #<n> pushed; land-pr running. <terminal state or "next round ~5 min">.
```
