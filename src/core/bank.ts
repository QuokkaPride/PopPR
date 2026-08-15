import type { Evidence, Question } from "./types.js";
import { MAX_CERTIFY_QUESTIONS } from "./certify.js";
import type { BankEntry } from "../bank/types.js";
import { ALL_ENTRIES } from "../bank/index.js";

/**
 * The curated concept bank.
 *
 * These questions are the same for everyone, because the semantics of
 * Promise.all don't vary by repo. That has three consequences worth stating:
 *
 *   1. Quick mode needs no AI, no API key and no network. It is instant.
 *   2. Because each question is written once and reused by everyone, it can be
 *      far better crafted than anything generated per-run.
 *   3. It is the natural place for community contributions — one good PR adds a
 *      question every user benefits from.
 *
 * Distractor discipline is the same as for generated questions: every wrong
 * option is a real misconception someone actually holds, and the correct answer
 * is never the longest option.
 */
const BANK = ALL_ENTRIES;

/** Fisher-Yates, seeded off the entry so a question isn't identical run to run. */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const LETTERS = ["A", "B", "C", "D", "E"];

/**
 * Pull bank questions for the concepts this diff actually touches. Options are
 * shuffled on every serve so the answer position can't be memorised.
 */
export interface ConceptSelection {
  concept: string;
  files: string[];
  evidence?: Evidence[];
}

export function bankQuestions(
  concepts: ConceptSelection[],
  limit = 20,
): Question[] {
  const wanted = new Map(concepts.map((c) => [c.concept, c]));
  const matching = BANK.filter((e) => wanted.has(e.concept));
  return toQuestions(shuffled(matching).slice(0, limit), wanted);
}

/**
 * The question set for a certify run, where every question must eventually be
 * answered correctly.
 *
 * Different selection from `bankQuestions` on purpose. That one shuffles the
 * whole matched set and truncates, so a diff touching ten concepts can hand you
 * five questions about one of them. That is fine for a scored run and wrong for
 * a gate: the set is smaller, and a single concept must not be able to
 * monopolise what someone has to master before merging. Concepts arrive in
 * detection-weight order, so the round-robin also front-loads the concepts the
 * diff leans on hardest.
 */
export function certifySet(
  concepts: ConceptSelection[],
  opts: { limit?: number; perConcept?: number } = {},
): Question[] {
  const perConcept = opts.perConcept ?? 2;
  // Clamped to the shared ceiling: the PR comment quotes this number, so a
  // maintainer configuring 40 must not get a comment promising 40 and a gate
  // that runs 25.
  const limit = Math.min(opts.limit ?? 10, MAX_CERTIFY_QUESTIONS);

  // Keyed by slug, which also dedupes. `detectConcepts` cannot repeat a concept
  // but `classifyConcepts` can, and a duplicate group would make someone answer
  // the identical question twice before the gate opened.
  const wanted = new Map(concepts.map((c) => [c.concept, c]));

  const groups = [...wanted.keys()]
    .map((concept) => shuffled(BANK.filter((e) => e.concept === concept)))
    .filter((g) => g.length > 0);

  const picked: BankEntry[] = [];
  for (let round = 0; round < perConcept && picked.length < limit; round++) {
    for (const group of groups) {
      if (picked.length >= limit) break;
      const entry = group[round];
      if (entry) picked.push(entry);
    }
  }

  return toQuestions(picked, wanted);
}

/**
 * Re-serve a question with its options in a new order.
 *
 * The mastery loop asks the same question until it is answered correctly, and
 * without this you would be picking a remembered letter rather than recalling
 * the answer. `correct` is recovered by matching option text, the same way the
 * initial serve does it.
 */
export function shuffleOptions(question: Question): Question {
  const correctText = question.options.find((o) => o.key === question.correct)?.text;
  const options = shuffled(question.options).map((o, idx) => ({
    key: LETTERS[idx],
    text: o.text,
    whyTempting: o.whyTempting,
  }));
  return {
    ...question,
    options,
    correct: options.find((o) => o.text === correctText)?.key ?? options[0].key,
  };
}

function toQuestions(
  entries: BankEntry[],
  wanted: Map<string, ConceptSelection>,
): Question[] {
  return entries.map((entry, i) => {
    const correctText = entry.options[entry.correct].text;
    const options = shuffled(entry.options).map((o, idx) => ({
      key: LETTERS[idx],
      text: o.text,
      whyTempting: o.whyTempting || undefined,
    }));
    return {
      id: `bank${i + 1}`,
      difficulty: entry.difficulty,
      archetype: "language-concept" as const,
      concept: entry.concept,
      prompt: entry.prompt,
      options,
      correct: options.find((o) => o.text === correctText)!.key,
      explanation: entry.explanation,
      anchors: (wanted.get(entry.concept)?.files ?? []).slice(0, 3),
      evidence: wanted.get(entry.concept)?.evidence,
    };
  });
}

export function bankSize(): number {
  return BANK.length;
}

export function bankConcepts(): string[] {
  return [...new Set(BANK.map((e) => e.concept))];
}
