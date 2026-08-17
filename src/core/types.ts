export type Difficulty = "easy" | "medium" | "hard";

/**
 * Question archetypes. "What does this file do?" is a chore people abandon after
 * two runs. Each archetype below is designed to be un-answerable by re-skimming
 * the diff: you have to understand the change.
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

/**
 * The line in YOUR diff that caused a question to be asked.
 *
 * Without this a bank question reads as trivia: correct, well written, and
 * apparently unrelated to the change you just made. The concept tag alone does
 * not close that gap, because "promise-all" does not tell you that it was the
 * line you added in checkout.ts. Showing the line turns "why am I being asked
 * this" into "oh, that line", which is the difference between a quiz and a
 * review of your own work.
 */
export interface Evidence {
  file: string;
  /** 1-based line in the file after the change, when the hunk header gives it. */
  line?: number;
  /** The added line itself, trimmed. */
  text: string;
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
  /** Lines in the diff that caused this concept to be picked. */
  evidence?: Evidence[];
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
  /**
   * Full 40-hex head commit. Only set when the context came from a real PR,
   * because certification binds to a commit: a completion comment is proof
   * about one specific diff, and a push has to invalidate it.
   */
  headSha?: string;
  files: DiffFile[];
  /** Symbol -> files outside the diff that reference it. Powers blast-radius. */
  callSites?: Record<string, string[]>;
}

/** The one interface every AI backend implements. */
export interface Provider {
  name: string;
  generate(prompt: string, opts?: { maxTokens?: number }): Promise<string>;
}
