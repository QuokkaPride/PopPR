import test from "node:test";
import assert from "node:assert/strict";

import {
  WEB_APP,
  STATUS_CONTEXT,
  certifyComment,
  detectComment,
  parseCertifyComment,
  quizUrl,
  verifyDecision,
} from "../dist/core/certify.js";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const OTHER_SHA = "fedcba9876543210fedcba9876543210fedcba98";

/** Only `concept` is read out of a question here, but pass the whole shape. */
function q(id, concept) {
  return {
    id,
    difficulty: "medium",
    archetype: "language-concept",
    concept,
    prompt: `prompt for ${id}`,
    options: [
      { key: "A", text: "alpha" },
      { key: "B", text: "bravo" },
      { key: "C", text: "charlie" },
      { key: "D", text: "delta" },
    ],
    correct: "A",
    explanation: "because",
    anchors: [],
  };
}

test("certifyComment renders exactly the comment a maintainer will read", () => {
  // A golden string rather than a set of `includes` checks. This text lands
  // uninvited on other people's pull requests, so a change to a single word of
  // it should require someone to say so here on purpose.
  const expected = [
    `<!-- poppr-certify v1 sha=${SHA} questions=2 -->`,
    "**PopPR** · quiz passed on `0123456`",
    "",
    "All 2 questions on this diff answered correctly: `promise-all`, `usememo`.",
    "",
    "<sub>Self-reported with [PopPR](https://github.com/QuokkaPride/PopPR). It shows the author worked through every question on this diff, and cannot show they did it unaided.</sub>",
  ].join("\n");

  assert.equal(
    certifyComment({
      headSha: SHA,
      questions: [q("bank1", "promise-all"), q("bank2", "usememo")],
    }),
    expected,
  );
});

test("certifyComment carries the full 40-hex sha in the marker and the short one in the prose", () => {
  const body = certifyComment({ headSha: SHA, questions: [q("bank1", "promise-all")] });
  assert.match(body, new RegExp(`sha=${SHA}\\b`));
  assert.ok(body.includes("`0123456`"), "the human line shows the seven character sha");
});

test("certifyComment says question in the singular for a one question set", () => {
  const body = certifyComment({ headSha: SHA, questions: [q("bank1", "promise-all")] });
  assert.ok(body.includes("All 1 question on this diff"), body);
});

test("certifyComment lists each distinct concept once", () => {
  const body = certifyComment({
    headSha: SHA,
    questions: [
      q("bank1", "promise-all"),
      q("bank2", "promise-all"),
      q("bank3", "usememo"),
      q("bank4", "promise-all"),
    ],
  });

  const listed = body.match(/`promise-all`/g) ?? [];
  assert.equal(listed.length, 1, "a concept with four questions is still named once");
  assert.ok(body.includes("`usememo`"));
  assert.ok(body.includes("All 4 questions"), "the count is questions, not concepts");
});

test("parseCertifyComment round-trips what certifyComment produced", () => {
  const questions = [q("bank1", "promise-all"), q("bank2", "usememo"), q("bank3", "react-key")];
  const claim = parseCertifyComment(certifyComment({ headSha: SHA, questions }));

  assert.deepEqual(claim, { sha: SHA, questions: 3 });
});

test("parseCertifyComment returns null for a 39-hex sha", () => {
  const short = SHA.slice(0, 39);
  assert.equal(short.length, 39);
  assert.equal(parseCertifyComment(`<!-- poppr-certify v1 sha=${short} questions=10 -->`), null);
});

test("parseCertifyComment returns null when the marker is absent", () => {
  assert.equal(parseCertifyComment(""), null);
  assert.equal(parseCertifyComment("<!-- poppr-scorecard -->"), null);
  assert.equal(parseCertifyComment("<!-- poppr-certify v1 -->"), null);
});

test("parseCertifyComment returns null for ordinary prose", () => {
  assert.equal(
    parseCertifyComment("LGTM, though I certified this one already on 0123456789abcdef0123456789abcdef01234567."),
    null,
    "mentioning a sha in a sentence is not a claim",
  );
  assert.equal(parseCertifyComment("poppr-certify v1 sha=" + SHA + " questions=10"), null, "the HTML comment is the marker");
});

test("parseCertifyComment finds the marker when it is surrounded by other text", () => {
  const body = [
    "Thanks for the review, pushing a fixup shortly.",
    "",
    `<!-- poppr-certify v1 sha=${SHA} questions=7 -->`,
    "",
    "Anything else you want covered here?",
  ].join("\n");

  assert.deepEqual(parseCertifyComment(body), { sha: SHA, questions: 7 });
});

test("parseCertifyComment lowercases an uppercase sha so comparisons are on one form", () => {
  const body = `<!-- poppr-certify v1 sha=${SHA.toUpperCase()} questions=4 -->`;
  assert.deepEqual(parseCertifyComment(body), { sha: SHA, questions: 4 });
});

const valid = () => ({
  body: certifyComment({ headSha: SHA, questions: [q("bank1", "promise-all")] }),
  commenter: "octocat",
  prAuthor: "octocat",
  headSha: SHA,
  certifyEnabled: true,
});

test("verifyDecision ignores everything when certify is off for the repo", () => {
  const decision = verifyDecision({ ...valid(), certifyEnabled: false });
  assert.equal(decision.action, "ignore");
  assert.match(decision.reason, /off/);
});

test("verifyDecision ignores a comment that is not a certify claim", () => {
  const decision = verifyDecision({ ...valid(), body: "ship it" });
  assert.equal(decision.action, "ignore");
  assert.match(decision.reason, /not a certify comment/);
});

test("verifyDecision ignores a comment from someone other than the PR author, and names them", () => {
  const decision = verifyDecision({ ...valid(), commenter: "helpful-bystander" });
  assert.equal(decision.action, "ignore");
  assert.match(
    decision.reason,
    /helpful-bystander/,
    "the reason goes in the run log, so it has to say who it was",
  );
});

test("verifyDecision ignores a claim about a commit that is no longer the head", () => {
  const decision = verifyDecision({
    ...valid(),
    body: certifyComment({ headSha: OTHER_SHA, questions: [q("bank1", "promise-all")] }),
  });

  assert.equal(decision.action, "ignore", "a push has to invalidate the proof");
  assert.match(decision.reason, /stale/);
  assert.match(decision.reason, /fedcba9/, "the reason shows what was certified");
  assert.match(decision.reason, /0123456/, "and what the head is now");
});

test("verifyDecision is case-insensitive on both the login and the sha", () => {
  const decision = verifyDecision({
    ...valid(),
    body: `<!-- poppr-certify v1 sha=${SHA.toUpperCase()} questions=1 -->`,
    commenter: "OctoCat",
    prAuthor: "octocat",
    headSha: SHA.toUpperCase(),
  });

  assert.equal(
    decision.action,
    "success",
    "GitHub logins are case-insensitive and shas get printed both ways, so neither may decide a merge",
  );
});

test("verifyDecision succeeds on the happy path and credits the commenter", () => {
  const decision = verifyDecision(valid());
  assert.equal(decision.action, "success");
  assert.match(decision.reason, /octocat/);
});

test("quizUrl builds the canonical host with no certify params by default", () => {
  assert.equal(
    quizUrl({ owner: "QuokkaPride", repo: "PopPR", number: 42 }),
    "https://quokkapride.github.io/PopPR/?pr=QuokkaPride/PopPR/42",
  );
});

test("quizUrl adds the certify params only when certify is on", () => {
  assert.equal(
    quizUrl({ owner: "QuokkaPride", repo: "PopPR", number: 42, certify: true, questions: 10, time: 180 }),
    "https://quokkapride.github.io/PopPR/?pr=QuokkaPride/PopPR/42&certify=1&n=10&t=180",
  );
  assert.equal(
    quizUrl({ owner: "QuokkaPride", repo: "PopPR", number: 42, questions: 10, time: 180 }),
    "https://quokkapride.github.io/PopPR/?pr=QuokkaPride/PopPR/42",
    "the question and time knobs only mean something under certify",
  );
  assert.equal(
    quizUrl({ owner: "QuokkaPride", repo: "PopPR", number: "42", certify: true }),
    "https://quokkapride.github.io/PopPR/?pr=QuokkaPride/PopPR/42&certify=1",
  );
});

test("the hosted app and status context are the ones the docs and branch protection name", () => {
  // Both are copied by hand into README instructions and into repo settings, so
  // a rename here is a silent break in someone else's branch protection rule.
  assert.equal(WEB_APP, "https://quokkapride.github.io/PopPR/");
  assert.equal(STATUS_CONTEXT, "poppr/quiz-passed");
});

// ── hostile input ──────────────────────────────────────────────────────────
//
// On a fork PR the filenames are attacker-controlled, and this comment is
// posted with the BASE repo's token. Git permits backticks, pipes and angle
// brackets in a path, so an unsealed code span would render attacker-authored
// HTML in a comment that appears to come from the project.

/** A span is sealed iff its fence is longer than any backtick run inside it. */
function unsealedSpan(markdown) {
  const re = /(`+)([\s\S]*?)\1(?!`)/g;
  let m;
  while ((m = re.exec(markdown))) {
    const inside = (m[2].match(/`+/g) ?? []).map((r) => r.length);
    if (Math.max(0, ...inside) >= m[1].length) return m[2];
  }
  return null;
}

const HOSTILE = [
  'src/a`<img src=x onerror=alert(1)>|evil.ts',
  "a``b<script>alert(1)</script>.ts",
  "trailing`.ts",
  "```.ts",
];

for (const path of HOSTILE) {
  test(`a filename containing backticks cannot break out of its code span: ${path.slice(0, 24)}`, () => {
    const body = detectComment(
      {
        concepts: [
          {
            concept: "promise-all",
            files: [path],
            evidence: [{ file: path, line: 1, text: "const x = `tpl ${y}` | pipe" }],
          },
        ],
        questions: 1,
      },
      { owner: "o", repo: "r", number: 1, certify: true },
    );

    assert.equal(unsealedSpan(body), null, "a code span was left unsealed");

    // Inside a sealed span the tag is literal text, which is the whole point.
    // What must not happen is a tag surviving OUTSIDE one, so strip the spans
    // and check what is left.
    const outsideSpans = body.replace(/(`+)[\s\S]*?\1(?!`)/g, "");
    assert.ok(!/<img|<script/i.test(outsideSpans), "raw HTML escaped its code span");

    // The row must stay two columns: an unescaped pipe would add cells.
    const row = body.split("\n").find((l) => l.startsWith("| `promise-all`"));
    const cells = row.split(/(?<!\\)\|/).filter((s) => s.trim()).length;
    assert.equal(cells, 2, `row split into ${cells} cells`);
  });
}

test("a filename with no backticks still gets a plain single-backtick span", () => {
  const body = detectComment(
    { concepts: [{ concept: "promise-all", files: ["src/a.ts"], evidence: [{ file: "src/a.ts", line: 3, text: "await Promise.all(x)" }] }], questions: 1 },
    { owner: "o", repo: "r", number: 1 },
  );
  assert.match(body, /\| `promise-all` \| `src\/a\.ts:3`/);
});
