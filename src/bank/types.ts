import type { Difficulty } from "../core/types.js";

/**
 * One curated concept question, written once and reused by every user.
 *
 * The options array is stored with the correct answer at a fixed index and
 * shuffled at serve time, so contributors never have to think about answer
 * position and nobody can memorise "it's always C".
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
