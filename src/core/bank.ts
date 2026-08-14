import type { Question } from "./types.js";
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
export function bankQuestions(
  concepts: Array<{ concept: string; files: string[] }>,
  limit = 20,
): Question[] {
  const wanted = new Map(concepts.map((c) => [c.concept, c.files]));
  const matching = BANK.filter((e) => wanted.has(e.concept));

  return shuffled(matching)
    .slice(0, limit)
    .map((entry, i) => {
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
        anchors: (wanted.get(entry.concept) ?? []).slice(0, 3),
      };
    });
}

export function bankSize(): number {
  return BANK.length;
}

export function bankConcepts(): string[] {
  return [...new Set(BANK.map((e) => e.concept))];
}
