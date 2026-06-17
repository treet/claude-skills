#!/usr/bin/env bun
import { parseArgs } from "node:util";

const { positionals } = parseArgs({
	args: Bun.argv.slice(2),
	allowPositionals: true,
});

const prNumber = positionals[0];
if (!prNumber) {
	console.error("Usage: list-threads.ts <pr-number>");
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
const [owner, name] = repo.split("/");

const query = `
  query($owner: String!, $name: String!, $pr: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            isOutdated
            path
            line
            comments(first: 50) {
              nodes {
                author { login }
                body
                createdAt
                url
              }
            }
          }
        }
      }
    }
  }
`;

const ghProc = Bun.spawnSync([
	"gh",
	"api",
	"graphql",
	"-F",
	`owner=${owner}`,
	"-F",
	`name=${name}`,
	"-F",
	`pr=${pr}`,
	"-f",
	`query=${query}`,
]);

if (ghProc.exitCode !== 0) {
	console.error("GraphQL query failed:", ghProc.stderr.toString());
	process.exit(1);
}

interface Comment {
	author: { login: string };
	body: string;
	createdAt: string;
	url: string;
}

interface Thread {
	id: string;
	isResolved: boolean;
	isOutdated: boolean;
	path: string | null;
	line: number | null;
	comments: { nodes: Comment[] };
}

const data = JSON.parse(ghProc.stdout.toString());
const threads: Thread[] = data.data.repository.pullRequest.reviewThreads.nodes;
const unresolved = threads.filter((t) => !t.isResolved);

if (unresolved.length === 0) {
	console.log("No unresolved review threads.");
	process.exit(0);
}

function printThread(thread: Thread) {
	console.log(`THREAD ${thread.id}`);
	console.log(`  File: ${thread.path ?? "unknown"}:${thread.line ?? 0}`);
	console.log(`  Outdated: ${thread.isOutdated ? "yes" : "no"}`);
	for (const comment of thread.comments.nodes) {
		console.log("  ---");
		console.log(`  Author: ${comment.author.login}`);
		console.log(`  Date: ${comment.createdAt}`);
		console.log(`  URL: ${comment.url}`);
		console.log(`  ${comment.body.replaceAll("\n", "\n  ")}`);
	}
	console.log();
}

const current = unresolved.filter((t) => !t.isOutdated);
const outdated = unresolved.filter((t) => t.isOutdated);

for (const thread of current) {
	printThread(thread);
}

if (outdated.length > 0) {
	console.log("--- OUTDATED (code has since been rewritten/reverted) ---\n");
	for (const thread of outdated) {
		printThread(thread);
	}
}
