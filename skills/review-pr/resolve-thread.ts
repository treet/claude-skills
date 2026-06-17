#!/usr/bin/env bun
import { parseArgs } from "util";

const { positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
});

const [threadId, body] = positionals;
if (!threadId || !body) {
  console.error("Usage: resolve-thread.ts <thread-id> <body>");
  process.exit(1);
}

// Guardrail: confirm the id is a review thread in an allowed org *before* any
// write. A wrong/fabricated node id can resolve to an object in another repo
// (this once posted a reply onto odoo/odoo); the owner allowlist stops that.
const ALLOWED_OWNERS = (process.env.REVIEW_ALLOWED_OWNERS ?? "project-cas,treet")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const ownerProc = Bun.spawnSync([
  "gh", "api", "graphql",
  "-F", `id=${threadId}`,
  "-f", `query=query($id: ID!) {
    node(id: $id) {
      __typename
      ... on PullRequestReviewThread {
        repository { nameWithOwner owner { login } }
      }
    }
  }`,
]);

if (ownerProc.exitCode !== 0) {
  console.error(`Failed to look up thread ${threadId}:`, ownerProc.stderr.toString());
  process.exit(1);
}

const node = JSON.parse(ownerProc.stdout.toString())?.data?.node;
if (node?.__typename !== "PullRequestReviewThread") {
  console.error(
    `Refusing to act: ${threadId} is not a PullRequestReviewThread (got ${node?.__typename ?? "null"}). Use an id straight from list-threads.`,
  );
  process.exit(1);
}

const owner = node.repository?.owner?.login?.toLowerCase();
if (!owner || !ALLOWED_OWNERS.includes(owner)) {
  console.error(
    `Refusing to act: thread is in '${node.repository?.nameWithOwner}', owner '${owner}' not in allowlist [${ALLOWED_OWNERS.join(", ")}]. Set REVIEW_ALLOWED_OWNERS to override.`,
  );
  process.exit(1);
}

// Reply to the thread
const replyProc = Bun.spawnSync([
  "gh", "api", "graphql",
  "-F", `threadId=${threadId}`,
  "-F", `body=${body}`,
  "-f", `query=mutation($threadId: ID!, $body: String!) {
    addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $threadId, body: $body}) {
      comment { url }
    }
  }`,
]);

if (replyProc.exitCode !== 0) {
  console.error(`Failed to reply to thread ${threadId}:`, replyProc.stderr.toString());
  process.exit(1);
}

const replyData = JSON.parse(replyProc.stdout.toString());
const commentUrl = replyData.data.addPullRequestReviewThreadReply.comment.url;
console.log(`Replied: ${commentUrl}`);

// Resolve the thread
const resolveProc = Bun.spawnSync([
  "gh", "api", "graphql",
  "-F", `threadId=${threadId}`,
  "-f", `query=mutation($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
      thread { isResolved }
    }
  }`,
]);

if (resolveProc.exitCode !== 0) {
  console.error(`Reply posted but failed to resolve thread ${threadId}:`, resolveProc.stderr.toString());
  process.exit(1);
}

console.log(`Resolved: ${threadId}`);
