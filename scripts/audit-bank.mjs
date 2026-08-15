#!/usr/bin/env node
/**
 * Build gate for bank quality.
 *
 * Multiple choice rots when ANYTHING about the correct answer other than its
 * content predicts it. Readers find the pattern long before they notice they
 * are using it, and the quiz keeps looking fine while it stops measuring
 * anything. Good intentions do not prevent this, so it is a gate.
 *
 * It has been found three times here, and each gate below was written the day
 * after being burned:
 *
 *   1. LENGTH, long. The first hand-written bank had the correct answer as the
 *      longest option in 81% of questions, written by someone who had just
 *      finished writing the rule against doing that.
 *   2. LENGTH, short. Fixing the first overcorrected. Nobody measured the other
 *      direction, so the bank reached 61% shortest while reporting a healthy 3%
 *      longest, and "pick the shortest" quietly became the better strategy.
 *   3. SHAPE. Fixing the second introduced the third: lengthening correct
 *      answers by reaching for one contrastive construction put ", not X" in 5
 *      of 21 correct options in data.ts and 0 of 63 distractors, a perfect
 *      predictor.
 *
 * The shape check below is deliberately general rather than a ban on those
 * three words, because the next form will be a fourth thing nobody has thought
 * of yet. It asks the only question that matters: does any construction appear
 * in correct answers at a rate that gives the answer away?
 */
import { bankQuestions, bankConcepts, bankSize } from "../dist/core/bank.js";
import { auditDistractors } from "../dist/core/quiz.js";
import { RULES } from "../dist/core/concepts.js";
import { UNIVERSAL_CONCEPTS } from "../dist/bank/index.js";

const LIMITS = {
  // Ceilings AND floors. A ceiling alone was how the fourth form of this got
  // in: told that the correct answer must never be the longest or the shortest,
  // a rewrite made it never either, so "drop the extremes and guess between the
  // two survivors" scored 56%. Both numbers read 0% and the gate said healthy.
  // Never being the extreme is as strong a tell as always being it.
  longestIsCorrect: 0.35,
  longestIsCorrectMin: 0.1,
  shortestIsCorrect: 0.35,
  shortestIsCorrectMin: 0.1,
  // A band, not a ceiling. An upper bound alone lets the bank drift terse,
  // which is exactly how form 2 went unnoticed.
  lengthRatioMax: 1.1,
  lengthRatioMin: 0.9,
  letterMax: 0.4,
  minOptionsPerQuestion: 4,
  // What a code-blind player may score before the bank is leaking. Chance is
  // 25%; this allows a little slack for markers that correlate with meaning.
  blindMax: 0.375,
  // On questions where exactly one option carries a marker, how often that
  // option may be the answer. Symmetric, because a marker that is never right
  // is a free elimination rule.
  markerMax: 0.45,
  markerMin: 0.08,
};

/** Fewer diagnostic questions than this and a rate is noise. */
const MIN_DIAGNOSTIC = 12;

/**
 * Surface features a player can see without understanding the question.
 *
 * None of these is forbidden. The gate is that none of them may PREDICT the
 * answer, in either direction. An inverse tell is as exploitable as a positive
 * one: a construction that never appears in a correct answer is a free
 * elimination rule, and one that appears in 26 distractors and no correct
 * answers removes options for nothing.
 */
const MARKERS = [
  { name: '", and " clause', re: /,\s+and\s/i },
  { name: "colon gloss", re: /:\s/ },
  { name: '" but "', re: /\sbut\s/i },
  { name: '"because"', re: /\bbecause\b/i },
  { name: '"rather than"', re: /\brather than\b/i },
  { name: '"instead of"', re: /\binstead of\b/i },
  { name: '", not X"', re: /,\s+not\s+\w/i },
  { name: 'leading "Only"', re: /^only\b/i },
  { name: 'leading "Nothing"', re: /^nothing\b/i },
  { name: '"every" / "always"', re: /\b(every|always)\b/i },
  { name: '"never"', re: /\bnever\b/i },
  { name: "backticked code", re: /`[^`]+`/ },
];

/** Questions where exactly one option carries the marker: the diagnostic ones. */
function markerStats(qs) {
  return MARKERS.map((m) => {
    let correctOptions = 0;
    let wrongOptions = 0;
    let diagnostic = 0;
    let diagnosticCorrect = 0;

    for (const q of qs) {
      const carrying = q.options.filter((o) => m.re.test(o.text));
      for (const o of carrying) {
        if (o.key === q.correct) correctOptions++;
        else wrongOptions++;
      }
      // The exploitable case: one option stands out, so a player can act on it.
      if (carrying.length === 1) {
        diagnostic++;
        if (carrying[0].key === q.correct) diagnosticCorrect++;
      }
    }

    const rate = diagnostic ? diagnosticCorrect / diagnostic : 0;
    return { ...m, correctOptions, wrongOptions, diagnostic, rate };
  });
}

/**
 * What a player who never reads the question would score.
 *
 * This is the honest threat model and the only number that subsumes the rest.
 * Someone who has played a few runs learns which surface features go with
 * correct answers, whether or not they could name them. So: learn each marker's
 * association from the bank itself, apply it blind, and see what it scores.
 * Learning and testing on the same bank overstates a newcomer's edge and
 * understates a regular's, which is the right way to be wrong here.
 *
 * 25% is chance. Anything meaningfully above it is the quiz measuring
 * something other than comprehension.
 */
function blindStrategyScore(qs) {
  const stats = markerStats(qs);
  // Log-odds of correctness for each marker, ignoring the ones too rare to
  // learn from.
  const weights = stats
    .filter((m) => m.correctOptions + m.wrongOptions >= 8)
    .map((m) => ({
      re: m.re,
      weight: Math.log((m.correctOptions + 0.5) / (m.wrongOptions + 0.5)),
    }));

  // How often the correct option sits at each length rank. A uniform bank is
  // 25% at every rank; anything else is a strategy.
  const rankHits = [0, 0, 0, 0];
  for (const q of qs) {
    const ranked = [...q.options].sort((a, b) => b.text.length - a.text.length);
    const rank = ranked.findIndex((o) => o.key === q.correct);
    if (rank >= 0 && rank < 4) rankHits[rank]++;
  }
  const rankWeight = rankHits.map((n) => Math.log((n + 0.5) / (qs.length / 4 + 0.5)));

  let right = 0;
  for (const q of qs) {
    const ranked = [...q.options].sort((a, b) => b.text.length - a.text.length);
    let best = null;
    let bestScore = -Infinity;
    for (const o of q.options) {
      let score = 0;
      const rank = ranked.findIndex((r) => r.key === o.key);
      if (rank >= 0 && rank < 4) score += rankWeight[rank];
      for (const w of weights) if (w.re.test(o.text)) score += w.weight;
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    if (best && best.key === q.correct) right++;
  }
  return right / (qs.length || 1);
}

const questions = bankQuestions(
  bankConcepts().map((c) => ({ concept: c, files: [] })),
  1000,
);
const audit = auditDistractors(questions);
const failures = [];

if (audit.longestIsCorrect > LIMITS.longestIsCorrect) {
  failures.push(
    `Correct answer is the longest option in ${(audit.longestIsCorrect * 100).toFixed(0)}% of questions (limit ${LIMITS.longestIsCorrect * 100}%).`,
  );
}
// The mirror of the check above, added after measuring: the bank sat at 61%
// shortest while reporting 3% longest, because writing distractors first and
// matching the correct answer to them pushes the correct answer terse. One
// sided measurement is what let that happen.
if (audit.longestIsCorrect < LIMITS.longestIsCorrectMin) {
  failures.push(
    `Correct answer is never the longest option (${(audit.longestIsCorrect * 100).toFixed(0)}%, floor ${LIMITS.longestIsCorrectMin * 100}%), so dropping the longest is a free elimination.`,
  );
}

if (audit.shortestIsCorrect < LIMITS.shortestIsCorrectMin) {
  failures.push(
    `Correct answer is never the shortest option (${(audit.shortestIsCorrect * 100).toFixed(0)}%, floor ${LIMITS.shortestIsCorrectMin * 100}%), so dropping the shortest is a free elimination.`,
  );
}

if (audit.shortestIsCorrect > LIMITS.shortestIsCorrect) {
  failures.push(
    `Correct answer is the shortest option in ${(audit.shortestIsCorrect * 100).toFixed(0)}% of questions (limit ${LIMITS.shortestIsCorrect * 100}%).`,
  );
}

if (audit.lengthRatio > LIMITS.lengthRatioMax || audit.lengthRatio < LIMITS.lengthRatioMin) {
  failures.push(
    `Correct options average ${audit.lengthRatio.toFixed(2)}x the length of wrong ones (band ${LIMITS.lengthRatioMin} to ${LIMITS.lengthRatioMax}).`,
  );
}

const markers = markerStats(questions);
const blind = blindStrategyScore(questions);

if (blind > LIMITS.blindMax) {
  failures.push(
    `A player who never reads the question scores ${(blind * 100).toFixed(0)}% by surface features alone (limit ${LIMITS.blindMax * 100}%, chance is 25%).`,
  );
}

for (const m of markers) {
  if (m.diagnostic < MIN_DIAGNOSTIC) continue;
  if (m.rate > LIMITS.markerMax) {
    failures.push(
      `${m.name} points at the answer: on the ${m.diagnostic} questions where one option has it, it is right ${(m.rate * 100).toFixed(0)}% of the time (limit ${LIMITS.markerMax * 100}%).`,
    );
  }
  if (m.rate < LIMITS.markerMin) {
    failures.push(
      `${m.name} eliminates for free: on the ${m.diagnostic} questions where one option has it, it is right only ${(m.rate * 100).toFixed(0)}% of the time (floor ${LIMITS.markerMin * 100}%).`,
    );
  }
}
for (const [letter, share] of Object.entries(audit.letterSpread)) {
  if (share > LIMITS.letterMax) {
    failures.push(`Answer "${letter}" is correct ${(share * 100).toFixed(0)}% of the time.`);
  }
}
for (const q of questions) {
  if (q.options.length < LIMITS.minOptionsPerQuestion) {
    failures.push(`"${q.concept}" has only ${q.options.length} options.`);
  }
  if (!q.explanation) failures.push(`"${q.concept}" is missing an explanation.`);
}

// A bank entry whose concept no rule can detect is dead weight: nothing will
// ever match it, so it can never be served. Universal concepts are the one
// exception and are exempt by design: they are topped up when a diff adds code
// and the rules found little, so a rule for them would be wrong.
const detectable = new Set(RULES.map((r) => r.concept));
for (const concept of bankConcepts()) {
  if (UNIVERSAL_CONCEPTS.has(concept)) continue;
  if (!detectable.has(concept)) {
    failures.push(`Concept "${concept}" has bank entries but no detection rule.`);
  }
}

// The mirror check, which is what let 48 concepts detect and serve nothing for
// half a day: a rule with no questions behind it names a concept on the review
// screen and has nothing to ask about it.
const answerable = new Set(bankConcepts());
const orphanRules = [...new Set(RULES.map((r) => r.concept))].filter(
  (c) => !answerable.has(c),
);
if (orphanRules.length) {
  failures.push(
    `${orphanRules.length} rule(s) detect a concept with no bank questions: ${orphanRules.slice(0, 6).join(", ")}${orphanRules.length > 6 ? ", ..." : ""}`,
  );
}

console.log(`\n  poppr bank audit · ${bankSize()} questions, ${bankConcepts().length} concepts\n`);
console.log(`  correct-is-longest  ${(audit.longestIsCorrect * 100).toFixed(0)}%   (limit ${LIMITS.longestIsCorrect * 100}%, random baseline 25%)`);
console.log(`  correct-is-shortest ${(audit.shortestIsCorrect * 100).toFixed(0)}%   (limit ${LIMITS.shortestIsCorrect * 100}%, random baseline 25%)`);
console.log(`  length ratio        ${audit.lengthRatio.toFixed(2)}   (band ${LIMITS.lengthRatioMin} to ${LIMITS.lengthRatioMax})`);
console.log(`  blind strategy      ${(blind * 100).toFixed(0)}%   (limit ${LIMITS.blindMax * 100}%, chance 25%)`);
const ranks = [0, 0, 0, 0];
for (const q of questions) {
  const ranked = [...q.options].sort((a, b) => b.text.length - a.text.length);
  const r = ranked.findIndex((o) => o.key === q.correct);
  if (r >= 0 && r < 4) ranks[r]++;
}
console.log(
  `  length rank         ` +
    ranks.map((n, i) => `#${i + 1} ${Math.round((100 * n) / questions.length)}%`).join("  ") +
    `   (uniform is 25% each)`,
);
const ranked = markers
  .filter((m) => m.diagnostic >= MIN_DIAGNOSTIC)
  .sort((a, b) => Math.abs(b.rate - 0.25) - Math.abs(a.rate - 0.25))
  .slice(0, 3);
for (const m of ranked) {
  console.log(`    ${m.name.padEnd(20)} ${(m.rate * 100).toFixed(0)}% right when it stands alone  (${m.diagnostic} questions)`);
}
console.log(
  `  letter spread       ${Object.entries(audit.letterSpread)
    .sort()
    .map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`)
    .join("  ")}`,
);

if (failures.length) {
  console.error(`\n  ✗ ${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`    - ${f}`);
  console.error("");
  process.exit(1);
}
console.log("\n  ✓ bank is healthy\n");
