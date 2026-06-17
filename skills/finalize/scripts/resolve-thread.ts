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
