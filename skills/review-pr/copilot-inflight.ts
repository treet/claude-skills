#!/usr/bin/env bun
import { parseArgs } from "node:util";

// Detects whether a Copilot code review is currently in flight for a PR.
// "In flight" = the most recent Copilot `review_requested` timeline event is
// newer than Copilot's most recent submitted review (a request is outstanding
// and unfulfilled). This is true exactly during a review window. It does NOT
// fire merely because HEAD is newer than the last reviewed commit, because
// Copilot does not re-review every push — only ones it is re-requested for.
//
// Exit code: 2 = in flight (caller should wait), 0 = clear, 1 = usage/error.

const { positionals } = parseArgs({
	args: Bun.argv.slice(2),
	allowPositionals: true,
});

const prNumber = positionals[0];
if (!prNumber) {
	console.error("Usage: copilot-inflight.ts <pr-number>");
	process.exit(1);
}

const pr = parseInt(prNumber, 10);
if (Number.isNaN(pr)) {
	console.error(`Invalid PR number: ${prNumber}`);
	process.exit(1);
}

const repoProc = Bun.spawnSync([
	"gh",
	"repo",
	"view",
	"--json",
	"nameWithOwner",
	"-q",
	".nameWithOwner",
]);
if (repoProc.exitCode !== 0) {
	console.error("Failed to detect repo:", repoProc.stderr.toString());
	process.exit(1);
}
const repo = repoProc.stdout.toString().trim();

function latestTimestamp(args: string[]): string {
	const proc = Bun.spawnSync(args);
	if (proc.exitCode !== 0) {
		console.error("gh api failed:", proc.stderr.toString());
		process.exit(1);
	}
	// ISO-8601 UTC (Z) timestamps sort lexically == chronologically.
	const lines = proc.stdout
		.toString()
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean)
		.sort();
	return lines.at(-1) ?? "";
}

const lastRequested = latestTimestamp([
	"gh",
	"api",
	"--paginate",
	`repos/${repo}/issues/${pr}/timeline`,
	"-q",
	`.[] | select(.event=="review_requested" and ((.requested_reviewer.login // "") | test("[Cc]opilot"))) | .created_at`,
]);

const lastReviewed = latestTimestamp([
	"gh",
	"api",
	"--paginate",
	`repos/${repo}/pulls/${pr}/reviews`,
	"-q",
	`.[] | select((.user.login // "") | test("[Cc]opilot")) | .submitted_at`,
]);

const inFlight =
	lastRequested !== "" && (lastReviewed === "" || lastRequested > lastReviewed);

console.log(`last Copilot review requested: ${lastRequested || "(none)"}`);
console.log(`last Copilot review submitted: ${lastReviewed || "(none)"}`);
console.log(`inflight: ${inFlight}`);
process.exit(inFlight ? 2 : 0);
