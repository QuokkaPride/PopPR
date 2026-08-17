import type { Evidence, Question } from "./types.js";
import { MAX_CERTIFY_QUESTIONS } from "./certify.js";
import type { BankEntry } from "../bank/types.js";
import { ALL_ENTRIES, UNIVERSAL_ENTRIES, UNIVERSAL_CONCEPTS } from "../bank/index.js";

/**
 * The curated concept bank.
 *
 * These questions are the same for everyone, because the semantics of
 * Promise.all don't vary by repo. That has three consequences worth stating:
 *
 *   1. Quick mode needs no AI, no API key and no network. It is instant.
 *   2. Because each question is written once and reused by everyone, it can be
 *      far better crafted than anything generated per-run.
 *   3. It is the natural place for community contributions: one good PR adds a
 *      question every user benefits from.
 *
 * Distractor discipline is the same as for generated questions: every wrong
 * option is a real misconception someone actually holds, and nothing about the
 * correct answer other than its content predicts which one it is. See
 * `scripts/audit-bank.mjs`, which fails the build when something does.
 */
const BANK = ALL_ENTRIES;

/** Fisher-Yates on a copy. Unseeded, so option order differs on every serve. */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const LETTERS = ["A", "B", "C", "D", "E"];

export interface ConceptSelection {
  concept: string;
  files: string[];
  evidence?: Evidence[];
}

/**
 * How a thin selection gets topped up.
 *
 * `codeFiles` is the diff's code files, and passing a non-empty list is the
 * caller asserting that this PR contains code someone wrote. Only then do
 * universal questions fill the remaining slots. A documentation or lockfile PR
 * passes an empty list and stays silent, which is the behaviour the project has
 * always had and the one worth keeping.
 */
export interface TopUp {
  codeFiles: string[];
}

/**
 * How many questions a run should have before general ones stop being added.
 *
 * A floor rather than a fill. Filling to the limit was the first attempt and it
 * was wrong: measured over 330 real code PRs it produced a 20-question run for
 * every diff, 19 of them general on a C PR, which is the tool talking over the
 * change instead of about it. Eight is a full run at the default three minutes
 * and leaves a thin diff's own questions as the majority of what gets asked.
 */
const UNIVERSAL_FLOOR = 8;

/**
 * Pull bank questions for the concepts this diff touches. Options are shuffled
 * on every serve so the answer position cannot be memorised.
 */
export function bankQuestions(
  concepts: ConceptSelection[],
  limit = 20,
  topUp?: TopUp,
): Question[] {
  const wanted = new Map(concepts.map((c) => [c.concept, c]));
  const matching = BANK.filter((e) => wanted.has(e.concept));
  const picked = shuffled(matching).slice(0, limit);

  return toQuestions(fillUniversal(picked, limit, topUp, wanted), wanted);
}

/**
 * Add general engineering questions when the diff gave the rules little to work
 * with.
 *
 * Measured on 1,579 merged PRs: about a third add code and match one concept or
 * none, because they are a single guard, a renamed field or one new branch. The
 * rules are right to stay quiet on those, and a two-question run for a five-file
 * change reads as the tool having nothing to say.
 *
 * These questions carry no evidence line, on purpose. `wanted` has no entry for
 * their concepts, so `toQuestions` leaves anchors and evidence empty rather than
 * inventing a line that caused them, and the review screen can say plainly that
 * they were not triggered by anything in particular.
 */
function fillUniversal(
  picked: BankEntry[],
  limit: number,
  topUp: TopUp | undefined,
  wanted: Map<string, ConceptSelection>,
): BankEntry[] {
  if (!topUp?.codeFiles.length) return picked;
  const floor = Math.min(limit, UNIVERSAL_FLOOR);
  if (picked.length >= floor) return picked;

  // Detected concepts stay at the front: a question about a line you wrote is
  // worth more than a good general one, and the clock may not reach the end.
  const spare = shuffled(UNIVERSAL_ENTRIES.filter((e) => !wanted.has(e.concept)));
  return [...picked, ...spare.slice(0, floor - picked.length)];
}

/** Whether a served question came from the universal pool rather than the diff. */
export function isUniversal(concept: string): boolean {
  return UNIVERSAL_CONCEPTS.has(concept);
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
  opts: { limit?: number; perConcept?: number; topUp?: TopUp } = {},
): Question[] {
  const perConcept = opts.perConcept ?? 2;
  // Clamped to the shared ceiling: the PR comment quotes this number, so a
  // maintainer configuring 40 must not get a comment promising 40 and a gate
  // that runs 25.
  const limit = Math.min(opts.limit ?? 5, MAX_CERTIFY_QUESTIONS);

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

  // `perConcept` caps how much one concept can contribute, so a diff touching
  // two concepts gates on four questions however high the limit is set. Topping
  // up matters more here than in a scored run: the maintainer configured a
  // number, and the comment quotes it.
  return toQuestions(fillUniversal(picked, limit, opts.topUp, wanted), wanted);
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

/**
 * A stable id per bank entry, keyed on the entry object itself.
 *
 * It used to be `bank${i + 1}` from the position within one call's result, so
 * every call started at bank1. `Staircase.add` skips ids already in the pool,
 * and `fillUniversal` floors a seed at UNIVERSAL_FLOOR while the concept-widening
 * call asks for the same 8, so the widened set collided completely and every
 * question it found was dropped. Measured: added 0 of 8, on every run with a
 * backend. Keying on the entry makes that dedupe mean "the same curated question
 * twice", which is what the widening call needs, since its concepts genuinely
 * overlap the seed's.
 */
const ENTRY_ID = new Map<BankEntry, string>(ALL_ENTRIES.map((e, i) => [e, `bank${i}`]));

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
      id: ENTRY_ID.get(entry) ?? `bank-unlisted-${i}`,
      source: "bank" as const,
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
