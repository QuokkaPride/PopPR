import type { Answered, Question } from "./types.js";
import { shuffleOptions } from "./bank.js";

/**
 * The mastery loop: keep asking what you have not answered correctly yet, until
 * you have answered all of it correctly.
 *
 * This is the one place PopPR is allowed to be a gate, and the shape of it
 * carries the whole argument for why that is acceptable:
 *
 *   - You cannot fail. There is no score to clear and no attempt limit. The
 *     only exit is understanding, and the loop will wait.
 *   - The timed pass stays a game. Missing questions under the clock costs you
 *     nothing here; the clock decides your score, this decides your merge.
 *   - Attempts are counted for the progress line and then thrown away. Nothing
 *     serialises them, because a maintainer learning that a contributor needed
 *     six tries would turn a learning tool into a humiliation.
 *
 * It deliberately does not use `Staircase`. That class never re-serves a
 * question (its `served` set is private with no reset), which is correct for a
 * scored run and exactly wrong here.
 */
export interface MasteryProgress {
  /** 1 on the first untimed sweep, 2 once the first sweep left misses behind. */
  pass: number;
  /** Questions not yet answered correctly. */
  remaining: number;
  total: number;
  /** Answers given in this loop. Session-local, never persisted or published. */
  attempts: number;
}

export class MasteryLoop {
  private readonly all: Question[];
  private readonly mastered = new Set<string>();
  private queue: Question[] = [];
  private wrong: Question[] = [];
  private current: Question | null = null;
  private passNo = 1;
  private attemptCount = 0;

  /**
   * @param questions the certify set, in full
   * @param firstPass the timed run's answers, if there was one
   */
  constructor(questions: Question[], firstPass: Answered[] = []) {
    this.all = questions;

    const alreadyRight = new Set(
      firstPass.filter((a) => a.correct).map((a) => a.question.id),
    );
    for (const q of questions) {
      if (alreadyRight.has(q.id)) this.mastered.add(q.id);
    }

    // Anything not answered correctly under the clock is queued, including
    // questions the clock never reached. "Every question eventually correct"
    // has to mean every question, or the gate is decided by how fast you read.
    this.queue = questions.filter((q) => !this.mastered.has(q.id));
  }

  get done(): boolean {
    return this.mastered.size >= this.all.length;
  }

  get progress(): MasteryProgress {
    return {
      pass: this.passNo,
      remaining: this.all.length - this.mastered.size,
      total: this.all.length,
      attempts: this.attemptCount,
    };
  }

  /** The next question to ask, options freshly shuffled. Null when done. */
  next(): Question | null {
    // Calling next() twice without record() means the caller abandoned a
    // question. Treat it as unanswered rather than losing it.
    if (this.current) {
      this.wrong.push(this.current);
      this.current = null;
    }

    if (this.queue.length === 0) {
      if (this.wrong.length === 0) return null;
      this.queue = this.wrong;
      this.wrong = [];
      this.passNo++;
    }

    const question = this.queue.shift();
    if (!question) return null;
    this.current = question;
    return shuffleOptions(question);
  }

  /** Grade the question `next()` just handed out. */
  record(correct: boolean): void {
    if (!this.current) return;
    this.attemptCount++;
    if (correct) this.mastered.add(this.current.id);
    else this.wrong.push(this.current);
    this.current = null;
  }
}
