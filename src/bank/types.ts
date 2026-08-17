import type { Difficulty } from "../core/types.js";

/**
 * One curated concept question, written once and reused by every user.
 *
 * The options array is stored in authoring order with `correct` naming the
 * index, and shuffled at serve time, so answer position is never a
 * contributor's problem and nobody can memorise "it's always C".
 */
export interface BankEntry {
  /** Must match a concept slug in core/concepts.ts, or it will never be served. */
  concept: string;
  difficulty: Difficulty;
  prompt: string;
  options: Array<{ text: string; whyTempting?: string }>;
  /** Zero-based index into options. */
  correct: number;
  /** At most two sentences. Teaches the idea, not just the fact. */
  explanation: string;
}
