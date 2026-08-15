import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { bankQuestions, certifySet } from "../core/bank.js";
import {
  DETECT_MARKER,
  STATUS_CONTEXT,
  detectComment,
  parseCertifyComment,
  quizUrl,
  verifyDecision,
} from "../core/certify.js";
import { detectConcepts, type DetectedConcept } from "../core/concepts.js";
import { readDiff } from "../core/diff.js";

/**
 * The whole brain of the GitHub Action.
 *
 * On fork safety, because the trigger looks alarming and the reason it is fine
 * is not obvious from the outside. The recommended trigger is
 * `pull_request_target`, which runs in the BASE repo's context and hands the job
 * a write token even when the PR came from a fork. That combination is the
 * classic supply-chain hole, but only because the usual next step is to check
 * out the PR head and run its build, which hands a stranger's code a token that
 * can write to your repo.
 *
 * This never checks out anything and never executes anything from the PR. It
 * reads the diff as text through the API, matches this repo's own regexes
 * against it, and writes one comment and one commit status. The only
 * PR-controlled inputs are diff text and comment bodies, and both stay data:
 * every GitHub call below is an argument vector, never a shell string, so
 * nothing in a diff can become a command.
 *
 * The absent checkout is also why `readDiff({ pr })` is the only diff path here,
 * and why `findCallSites` is never called: there is no git tree to grep.
 */

const exec = promisify(execFile);

/** GitHub truncates a commit status description at 140 characters. */
const DESCRIPTION_MAX = 140;

/** A thousand comments is already absurd, and an unbounded loop is how CI hangs. */
const MAX_COMMENT_PAGES = 10;

interface Config {
  eventName: string;
  owner: string;
  repo: string;
  certify: boolean;
  /** Question count for the certify set and the `n=` on the quiz link. */
  questions?: number;
  /** Seconds on the clock for the timed pass, passed through as `t=`. */
  time?: number;
}

interface GhUser {
  login?: string;
}

interface IssueComment {
  id: number;
  body?: string;
  html_url?: string;
  user?: GhUser | null;
}

interface PullRequest {
  number: number;
  head?: { sha?: string; repo?: { full_name?: string } | null };
  user?: GhUser | null;
}

interface EventPayload {
  action?: string;
  pull_request?: PullRequest;
  issue?: { number: number; pull_request?: unknown };
  comment?: IssueComment;
}

interface Detection {
  label: string;
  files: number;
  concepts: DetectedConcept[];
}

/**
 * Entry point for `poppr gh-event`.
 *
 * Two branches, one per trigger: a PR event reports what the diff touches and
 * reconciles the check, a comment event verifies a completion claim.
 */
export async function runGhEvent(): Promise<void> {
  const cfg = readConfig();
  const event = await readEvent();

  log(
    `event ${cfg.eventName} on ${cfg.owner}/${cfg.repo}, certify ${cfg.certify ? "on" : "off"}`,
  );

  if (cfg.eventName === "pull_request_target" || cfg.eventName === "pull_request") {
    await handlePullRequest(event, cfg);
    return;
  }

  if (cfg.eventName === "issue_comment") {
    await handleIssueComment(event, cfg);
    return;
  }

  // A trigger this does not handle is a workflow mistake, and a silent green
  // job would let a maintainer believe certify is running when it is not.
  throw new Error(
    `Unsupported event "${cfg.eventName}". Trigger PopPR on pull_request_target, pull_request or issue_comment.`,
  );
}

// ── Branch A: a pull request opened, pushed to, or reopened ─────────────────

async function handlePullRequest(event: EventPayload, cfg: Config): Promise<void> {
  const pr = event.pull_request;
  if (!pr) throw new Error("The event payload has no pull_request object.");

  const number = pr.number;
  const headSha = pr.head?.sha;
  const prAuthor = pr.user?.login ?? "";
  if (!headSha) throw new Error(`PR #${number} has no head sha in the payload.`);

  // Reading the diff and listing the comments are independent and both are
  // network round trips, so they overlap. On a runner this is most of the job's
  // wall clock: `detect` shells out to gh twice on its own.
  //
  // Promise.all rejects on the first failure, which is the behaviour we want
  // here. There is no useful partial state: without the diff there is nothing
  // to say, and without the comments the upsert would post a duplicate rather
  // than edit.
  const [detection, comments] = await Promise.all([
    detect(number),
    listComments(cfg, number),
  ]);
  const questions = countQuestions(detection.concepts, cfg);
  const found = detection.concepts.map((c) => c.concept);
  log(
    `#${number} at ${headSha.slice(0, 7)}: ${plural(found.length, "concept")}, ` +
      `${plural(questions, "question")}${found.length ? ` (${found.join(", ")})` : ""}`,
  );

  // Under plain `pull_request` a fork gets a read-only token, so every write
  // below would 403 through no fault of the contributor. Say so once and stop,
  // rather than paint a red X on someone's first PR.
  const headRepo = pr.head?.repo?.full_name ?? "";
  if (
    cfg.eventName === "pull_request" &&
    headRepo &&
    headRepo.toLowerCase() !== `${cfg.owner}/${cfg.repo}`.toLowerCase()
  ) {
    log(
      `${headRepo} is a fork and this ran on pull_request, so the token is read-only. ` +
        "Trigger on pull_request_target to cover fork PRs.",
    );
    return;
  }

  // One GET feeds both the comment upsert and the certify reconcile: they want
  // the same list.
  const body = detectComment(
    {
      concepts: detection.concepts,
      questions,
    },
    {
      owner: cfg.owner,
      repo: cfg.repo,
      number,
      certify: cfg.certify,
      questions: cfg.questions,
      time: cfg.time,
    },
  );
  await upsertDetectComment(cfg, number, body, comments);

  if (!cfg.certify) return;

  // A required check that can never go green would block every docs-only PR
  // forever, and the first maintainer to hit that turns certify off for good.
  // Guarded on the question count rather than the concept count: a concept with
  // a detection rule but no bank entries yields concepts.length > 0 and an
  // empty quiz, which is the same dead end with a more confusing comment.
  if (questions === 0) {
    await postStatus(cfg, headSha, {
      state: "success",
      description: "No bank concepts matched, nothing to certify",
    });
    return;
  }

  // Reconcile rather than blindly set pending. The proof lives in the comments,
  // so re-runs, reopens and "the workflow was installed after the comment
  // landed" all heal themselves on the next event.
  const proof = findProof(comments, prAuthor, headSha);
  if (proof) {
    await postStatus(cfg, headSha, {
      state: "success",
      description: `Certified by @${proof.login}`,
      targetUrl: proof.url,
    });
    return;
  }

  await postStatus(cfg, headSha, {
    state: "pending",
    description: "Take the quiz, then post the completion comment",
    targetUrl: quizUrl({
      owner: cfg.owner,
      repo: cfg.repo,
      number,
      certify: true,
      questions: cfg.questions,
      time: cfg.time,
    }),
  });
}

/**
 * What does this diff touch?
 *
 * `readDiff` refuses a PR whose every file was filtered as generated, which is
 * a normal PR rather than a broken one. Treat it as nothing detected so the
 * comment and the status still land, and let every other failure through: a
 * missing gh or a 500 should be visibly red.
 */
async function detect(number: number): Promise<Detection> {
  try {
    const ctx = await readDiff({ pr: String(number) });
    return {
      label: ctx.label,
      files: ctx.files.length,
      concepts: detectConcepts(ctx),
    };
  } catch (err) {
    const message = (err as Error)?.message ?? "";
    if (/no reviewable/i.test(message)) {
      log(`#${number} has no reviewable changes once generated files are filtered`);
      return { label: `PR #${number}`, files: 0, concepts: [] };
    }
    throw err;
  }
}

/**
 * How many questions the comment promises.
 *
 * Certify counts its own set, because that selection is round-robin across
 * concepts and caps out well below what the bank could serve. Quoting the
 * scored run's number on a certify PR would advertise a longer gate than the
 * one the contributor is actually asked to clear.
 */
function countQuestions(concepts: DetectedConcept[], cfg: Config): number {
  if (!cfg.certify) return bankQuestions(concepts).length;
  return certifySet(concepts, cfg.questions ? { limit: cfg.questions } : {}).length;
}

/** The newest comment on this head that the author signed. Newest first, because
 * a contributor who pushed and re-certified has several, and only the last one
 * is about the diff that exists now. */
function findProof(
  comments: IssueComment[],
  prAuthor: string,
  headSha: string,
): { login: string; url?: string } | null {
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i];
    const login = comment.user?.login ?? "";
    const decision = verifyDecision({
      body: comment.body ?? "",
      commenter: login,
      prAuthor,
      headSha,
      certifyEnabled: true,
    });
    if (decision.action === "success") {
      log(`found proof: ${decision.reason}`);
      return { login, url: comment.html_url };
    }
  }
  return null;
}

// ── Branch B: someone commented, possibly with the completion marker ────────

async function handleIssueComment(event: EventPayload, cfg: Config): Promise<void> {
  if (!cfg.certify) {
    log("certify is off for this repo, so there is no status a comment could satisfy");
    return;
  }

  // The deleted payload still carries the body, and grading a comment that no
  // longer exists would leave a green check with nothing behind it.
  if (event.action === "deleted") {
    log("comment was deleted, nothing to verify");
    return;
  }

  const issue = event.issue;
  if (!issue?.pull_request) {
    log("comment is on an issue rather than a pull request");
    return;
  }

  const comment = event.comment;
  if (!comment) throw new Error("The issue_comment payload has no comment object.");

  // The payload's issue object carries neither the head sha nor the PR author,
  // and both are what the claim is checked against.
  const pr = await ghJson<PullRequest>(["api", `repos/${cfg.owner}/${cfg.repo}/pulls/${issue.number}`]);
  const headSha = pr.head?.sha;
  const prAuthor = pr.user?.login ?? "";
  if (!headSha) throw new Error(`Could not read the head sha of PR #${issue.number}.`);

  const commenter = comment.user?.login ?? "";
  const decision = verifyDecision({
    body: comment.body ?? "",
    commenter,
    prAuthor,
    headSha,
    certifyEnabled: true,
  });

  // Every rejection is silent on the PR itself. A bot that publicly corrects
  // people is a bot maintainers uninstall, so the Actions log is the only place
  // this explains itself.
  if (decision.action !== "success") {
    log(`ignored comment ${comment.id}: ${decision.reason}`);
    return;
  }

  // Post on the sha the comment claims. verifyDecision already proved it equals
  // the head, and using the claim keeps the status attached to the exact diff
  // that was certified.
  const claimed = parseCertifyComment(comment.body ?? "")?.sha ?? headSha;
  await postStatus(cfg, claimed, {
    state: "success",
    description: `Certified by @${commenter}`,
    targetUrl: comment.html_url,
  });
}

// ── GitHub plumbing ────────────────────────────────────────────────────────

async function listComments(cfg: Config, number: number): Promise<IssueComment[]> {
  const out: IssueComment[] = [];
  for (let page = 1; page <= MAX_COMMENT_PAGES; page++) {
    const batch = await ghJson<IssueComment[]>([
      "api",
      `repos/${cfg.owner}/${cfg.repo}/issues/${number}/comments?per_page=100&page=${page}`,
    ]);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

/**
 * One comment per PR, edited in place. A new comment on every push is how a bot
 * gets muted, and the marker is an HTML comment so the edit target survives
 * whatever the body says.
 */
async function upsertDetectComment(
  cfg: Config,
  number: number,
  body: string,
  comments: IssueComment[],
): Promise<void> {
  const existing = comments.find((c) => (c.body ?? "").includes(DETECT_MARKER));
  if (existing) {
    await gh([
      "api",
      "-X",
      "PATCH",
      `repos/${cfg.owner}/${cfg.repo}/issues/comments/${existing.id}`,
      "-f",
      `body=${body}`,
    ]);
    log(`updated comment ${existing.id}`);
    return;
  }
  await gh([
    "api",
    "-X",
    "POST",
    `repos/${cfg.owner}/${cfg.repo}/issues/${number}/comments`,
    "-f",
    `body=${body}`,
  ]);
  log(`commented on #${number}`);
}

async function postStatus(
  cfg: Config,
  sha: string,
  opts: { state: "success" | "pending"; description: string; targetUrl?: string },
): Promise<void> {
  const args = [
    "api",
    "-X",
    "POST",
    `repos/${cfg.owner}/${cfg.repo}/statuses/${sha}`,
    "-f",
    `state=${opts.state}`,
    "-f",
    `context=${STATUS_CONTEXT}`,
    "-f",
    `description=${opts.description.slice(0, DESCRIPTION_MAX)}`,
  ];
  if (opts.targetUrl) args.push("-f", `target_url=${opts.targetUrl}`);

  await gh(args);
  log(`${STATUS_CONTEXT} ${opts.state} on ${sha.slice(0, 7)}: ${opts.description}`);
}

async function ghJson<T>(args: string[]): Promise<T> {
  return JSON.parse(await gh(args)) as T;
}

async function gh(args: string[]): Promise<string> {
  try {
    const { stdout } = await exec("gh", args, { maxBuffer: 32 * 1024 * 1024 });
    return stdout;
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    if (e.code === "ENOENT") {
      throw new Error(
        "gh is not on PATH. PopPR's action needs the GitHub CLI, which is preinstalled on GitHub-hosted runners.",
      );
    }
    const detail = (e.stderr || e.stdout || e.message || "").trim();
    throw new Error(`gh ${redact(args)} failed: ${detail}`);
  }
}

/** A failed comment write would otherwise dump the whole markdown body into the
 * error line, burying the API message that says why it failed. */
function redact(args: string[]): string {
  return args.map((a) => (a.startsWith("body=") ? "body=<markdown>" : a)).join(" ");
}

// ── Environment ────────────────────────────────────────────────────────────

function readConfig(): Config {
  const slug = process.env.GITHUB_REPOSITORY ?? "";
  const [owner, repo] = slug.split("/");
  if (!owner || !repo) {
    throw new Error(`GITHUB_REPOSITORY is "${slug}", and this needs "owner/repo".`);
  }

  return {
    eventName: process.env.GITHUB_EVENT_NAME ?? "",
    owner,
    repo,
    // Anything other than an explicit "true" leaves certify off. The gate is
    // opt-in, and a typo in a workflow input must not start gating merges.
    certify: (process.env.POPPR_CERTIFY ?? "").trim().toLowerCase() === "true",
    questions: positiveInt(process.env.POPPR_QUESTIONS),
    time: positiveInt(process.env.POPPR_TIME),
  };
}

async function readEvent(): Promise<EventPayload> {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) {
    throw new Error("GITHUB_EVENT_PATH is not set. This command only runs inside a GitHub Actions job.");
  }
  return JSON.parse(await readFile(path, "utf8")) as EventPayload;
}

/** A typo in a workflow input falls back to the defaults rather than putting
 * `n=NaN` in the quiz link. */
function positiveInt(raw: string | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** One prefix, one line per decision: the Actions log is the only record of
 * what this did, and it is read by people debugging a check that will not go
 * green. */
function log(line: string): void {
  console.log(`poppr: ${line}`);
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
