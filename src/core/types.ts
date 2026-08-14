export type Difficulty = "easy" | "medium" | "hard";

/**
 * Question archetypes. "What does this file do?" is a chore people abandon after
 * two runs. Each archetype below is designed to be un-answerable by re-skimming
 * the diff — you have to actually understand the change.
 */
export type Archetype =
  | "blast-radius" // who calls this, what breaks downstream
  | "why-this-line" // justify one specific non-obvious line
  | "language-concept" // do you understand the primitive you used
  | "failure-mode" // what input breaks this
  | "rejected-alternative" // why not the other approach
  | "trap"; // premise is false; the correct answer rejects it

export interface Option {
  /** "A" | "B" | "C" | "D" */
  key: string;
  text: string;
  /**
   * Why this distractor is tempting. Never shown before answering; shown after,
   * because "here's why you fell for it" is where the learning actually happens.
   */
  whyTempting?: string;
}

export interface Question {
  id: string;
  difficulty: Difficulty;
  archetype: Archetype;
  /**
   * Free-form concept tag, e.g. "async/concurrency", "sql-indexes",
   * "type-narrowing". This is the unit of mastery tracked across runs and the
   * key for spaced repetition, so it matters more than it looks.
   */
  concept: string;
  prompt: string;
  options: Option[];
  correct: string;
  /** Shown after answering, right or wrong. Two sentences, max. */
  explanation: string;
  /** Files this question is anchored to; shown after answering. */
  anchors: string[];
}

export interface Answered {
  question: Question;
  /** null when the clock ran out mid-question. */
  chosen: string | null;
  correct: boolean;
  /** Milliseconds spent on this question. */
  ms: number;
  /** Points earned, after speed and combo multipliers. */
  points: number;
  /** Combo length at the moment this was answered. */
  comboAt: number;
}

export interface RunResult {
  prLabel: string;
  repo: string;
  answered: Answered[];
  correctCount: number;
  totalMs: number;
  points: number;
  /** Longest consecutive correct run within this session. */
  bestCombo: number;
  /** Concepts sorted worst-first, only those with at least one miss. */
  weakConcepts: string[];
  /** Consecutive days played. */
  streak: number;
}

export interface DiffFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  patch: string;
}

export interface PrContext {
  /** Human label, e.g. "PR #142" or "feat/checkout vs main". */
  label: string;
  repo: string;
  base: string;
  head: string;
  title?: string;
  body?: string;
  url?: string;
  files: DiffFile[];
  /** Symbol -> files outside the diff that reference it. Powers blast-radius. */
  callSites?: Record<string, string[]>;
}

/** The one interface every AI backend implements. */
export interface Provider {
  name: string;
  generate(prompt: string, opts?: { maxTokens?: number }): Promise<string>;
}
