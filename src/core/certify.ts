import type { Evidence, Question } from "./types.js";

/**
 * Certification: the proof a contributor answered every question about their
 * diff correctly, and the rules for believing it.
 *
 * Everything here is pure string work and decisions, with no I/O and no node
 * builtins, so the browser bundle can render the same comment the CLI does and
 * the verifier can be tested without a network.
 *
 * On spoofing, stated plainly because it is a design position rather than an
 * oversight: a completion comment is a claim, not a proof. Someone can write
 * the marker by hand or have a model answer for them. Closing that would mean
 * grading on a server we control, which means accounts, a backend and a bill,
 * for a tool whose entire economics rest on having none of those. The comment
 * says as much in its own footer. What this buys a maintainer is that the
 * ritual happened and was cheap to demand; what it buys a contributor is that
 * they read their own diff before someone else had to.
 */

/** Canonical hosted web app. Consumers' own github.io pages 404. */
export const WEB_APP = "https://quokkapride.github.io/PopPR/";

/**
 * Ceiling on a certify set.
 *
 * Lives here rather than in each front end because the PR comment states how
 * many questions the gate holds and the player has to run that same number. A
 * cap in only one of them makes the comment lie.
 */
export const MAX_CERTIFY_QUESTIONS = 25;

/** The ref third parties pin. `poppr init` writes it; the release must tag it. */
export const ACTION_REF = "QuokkaPride/PopPR@v1";

/** The commit status a maintainer marks required to make certify a hard gate. */
export const STATUS_CONTEXT = "poppr/quiz-passed";

/** Marker on the detect comment, so it is edited in place instead of repeated. */
export const DETECT_MARKER = "<!-- poppr-scorecard -->";

export const CERTIFY_MARKER_RE =
  /<!--\s*poppr-certify v1 sha=([0-9a-fA-F]{40}) questions=(\d+)\s*-->/;

export interface CertifyClaim {
  sha: string;
  questions: number;
}

/**
 * The comment a contributor posts when the mastery loop is done.
 *
 * It publishes completion and nothing else. No score, no emoji grid, no pass
 * count: a grid would leak which questions were missed on the timed pass, and
 * the whole promise of the design is that only finishing is public.
 */
export function certifyComment(opts: {
  headSha: string;
  questions: Question[];
}): string {
  const concepts = [...new Set(opts.questions.map((q) => q.concept))];
  const n = opts.questions.length;
  return [
    `<!-- poppr-certify v1 sha=${opts.headSha} questions=${n} -->`,
    `**PopPR** · quiz passed on \`${opts.headSha.slice(0, 7)}\``,
    "",
    `All ${n} question${n === 1 ? "" : "s"} on this diff answered correctly: ` +
      `${concepts.map((c) => `\`${c}\``).join(", ")}.`,
    "",
    "<sub>Self-reported with [PopPR](https://github.com/QuokkaPride/PopPR). " +
      "It shows the author worked through every question on this diff, and cannot show they did it unaided.</sub>",
  ].join("\n");
}

export function parseCertifyComment(body: string): CertifyClaim | null {
  const match = CERTIFY_MARKER_RE.exec(body ?? "");
  if (!match) return null;
  return { sha: match[1].toLowerCase(), questions: Number(match[2]) };
}

export interface VerifyInput {
  body: string;
  commenter: string;
  prAuthor: string;
  headSha: string;
  certifyEnabled: boolean;
}

export interface VerifyDecision {
  action: "success" | "ignore";
  reason: string;
}

/**
 * Should this comment turn the check green?
 *
 * Split out from the event handler so the rules are testable without GitHub.
 * Every rejection is quiet: a wrong-author or stale comment sets no status and
 * says nothing on the PR, because a bot that publicly corrects people is a bot
 * maintainers uninstall.
 */
export function verifyDecision(input: VerifyInput): VerifyDecision {
  if (!input.certifyEnabled) {
    return { action: "ignore", reason: "certify is off for this repo" };
  }

  const claim = parseCertifyComment(input.body);
  if (!claim) {
    return { action: "ignore", reason: "not a certify comment" };
  }

  // Both call sites default a missing login to "", and "" === "" would hand the
  // status to a stranger. This is the only rule between a third party and the
  // check, so it refuses to compare absent identities at all.
  if (!input.commenter || !input.prAuthor) {
    return { action: "ignore", reason: "could not identify the commenter or the PR author" };
  }

  if (input.commenter.toLowerCase() !== input.prAuthor.toLowerCase()) {
    return {
      action: "ignore",
      reason: `only the PR author can certify, and this is from ${input.commenter}`,
    };
  }

  // A push invalidates certification. This is the same rule GitHub applies to
  // stale review approvals, and for the same reason: the proof was about a
  // diff that no longer exists.
  if (claim.sha !== input.headSha.toLowerCase()) {
    return {
      action: "ignore",
      reason: `stale: certified ${claim.sha.slice(0, 7)}, head is ${input.headSha.slice(0, 7)}`,
    };
  }

  return { action: "success", reason: `certified by ${input.commenter}` };
}

export interface QuizUrlOptions {
  owner: string;
  repo: string;
  number: number | string;
  certify?: boolean;
  questions?: number;
  time?: number;
}

/** Built by hand rather than with URLSearchParams so the link stays readable. */
export function quizUrl(o: QuizUrlOptions): string {
  let url = `${WEB_APP}?pr=${o.owner}/${o.repo}/${o.number}`;
  if (o.certify) {
    url += "&certify=1";
    if (o.questions) url += `&n=${o.questions}`;
    if (o.time) url += `&t=${o.time}`;
  }
  return url;
}

export interface DetectData {
  concepts: Array<{
    concept: string;
    files: string[];
    weight?: number;
    evidence?: Evidence[];
  }>;
  questions: number;
}



/**
 * The comment posted on every PR.
 *
 * This lands uninvited on someone else's work, so it says what the change
 * touches and stops. With certify off it asks for nothing at all. With certify
 * on it states the requirement once, in the contributor's own interest, and
 * still never scolds.
 */
export function detectComment(
  data: DetectData,
  opts: {
    owner: string;
    repo: string;
    number: number | string;
    certify?: boolean;
    questions?: number;
    time?: number;
  },
): string {
  const pkg = "@quokkapride/poppr";
  const out = [DETECT_MARKER, ""];

  if (!data.concepts.length) {
    out.push(
      "**PopPR** found no bank concepts in this diff.",
      "",
      `Nothing here adds code the bank can read: documentation, lockfiles and generated files come up empty on purpose. Running it in your terminal also has an AI write questions about this specific code, if you have one set up.`,
    );
    if (opts.certify) {
      out.push("", "Nothing to certify here, so the check passes on its own.");
    }
    return out.join("\n") + "\n";
  }

  // No per-concept table any more. It listed what the regexes matched, which is
  // not what the player is asked: the browser serves the bank, and a terminal
  // run with a backend adds questions written about this specific code. A table
  // promising a set nobody is guaranteed to see was precision about the wrong
  // thing, and it was the longest part of the comment.
  // Concepts are counted, never listed. The list was what the regexes matched,
  // which is not the set the player is asked, and it was the longest thing here.
  const n = data.concepts.length;
  out.push(
    `**PopPR** · ${data.questions} question${data.questions === 1 ? "" : "s"}, from ${n} concept${n === 1 ? "" : "s"} found in this diff.`,
  );

  // The terminal leads, because it is the only one that can write questions
  // about THIS code. The browser needs nothing installed and is the better
  // answer for someone who just wants to play, so it stays one click away
  // rather than gone.
  out.push(
    "",
    "```bash",
    `npx ${pkg} ${opts.number}${opts.certify ? " --require" : ""}`,
    "```",
    "",
    "Uses our question bank, plus AI-written questions about your specific code if you have Claude Code, Cursor or an AI API key.",
  );

  if (opts.certify) {
    out.push(
      "",
      `This repo requires a passing quiz before merge. Answer under the clock, then keep going untimed until every question is right. No score to beat, and tries are never published, so you cannot fail it. Post the comment it gives you and \`${STATUS_CONTEXT}\` turns green.`,
    );
  }

  out.push(
    "",
    `<details><summary>Want the question bank only, without the AI questions? Play in your browser.</summary>`,
    "",
    `**[Take the quiz](${quizUrl(opts)})** · Nothing to install, no account, public repositories only.`,
    "</details>",
  );

  return out.join("\n") + "\n";
}
