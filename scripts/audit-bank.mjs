#!/usr/bin/env node
/**
 * Build gate for bank quality.
 *
 * Multiple choice rots in a specific, predictable way: whoever writes the
 * questions makes the correct answer longer and more specific than the
 * distractors, and readers learn to pick the wordiest option without reading
 * the code. Good intentions do not prevent this — the first hand-written
 * version of this bank failed at 81%. So it is a gate, not a guideline.
 */
import { bankQuestions, bankConcepts, bankSize } from "../dist/core/bank.js";
import { auditDistractors } from "../dist/core/quiz.js";
import { RULES } from "../dist/core/concepts.js";

const LIMITS = {
  longestIsCorrect: 0.35, // random baseline is 0.25
  lengthRatio: 1.1,
  letterMax: 0.4,
  minOptionsPerQuestion: 4,
};

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
if (audit.lengthRatio > LIMITS.lengthRatio) {
  failures.push(
    `Correct options average ${audit.lengthRatio.toFixed(2)}x the length of wrong ones (limit ${LIMITS.lengthRatio}).`,
  );
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
// ever match it, so it can never be served.
const detectable = new Set(RULES.map((r) => r.concept));
for (const concept of bankConcepts()) {
  if (!detectable.has(concept)) {
    failures.push(`Concept "${concept}" has bank entries but no detection rule.`);
  }
}

console.log(`\n  poppr bank audit — ${bankSize()} questions, ${bankConcepts().length} concepts\n`);
console.log(`  correct-is-longest  ${(audit.longestIsCorrect * 100).toFixed(0)}%   (limit ${LIMITS.longestIsCorrect * 100}%, random baseline 25%)`);
console.log(`  length ratio        ${audit.lengthRatio.toFixed(2)}   (limit ${LIMITS.lengthRatio})`);
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
