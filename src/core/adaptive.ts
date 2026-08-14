import type { Difficulty, Question } from "./types.js";

const ORDER: Difficulty[] = ["easy", "medium", "hard"];

/**
 * A staircase: two correct in a row steps up, one wrong steps down.
 *
 * This is deliberately not a "get everything right" design. Learning is fastest
 * at roughly 85% accuracy — hard enough to strain, not so hard you disengage
 * (Wilson et al., 2019). A 2-up/1-down staircase converges near that band on its
 * own, so the quiz keeps finding the edge of what you know without any tuning.
 */
export class Staircase {
  private level = 1; // start at medium
  private consecutiveCorrect = 0;
  private served = new Set<string>();

  constructor(private pool: Question[] = []) {}

  /**
   * Questions can arrive after the game has started — generation runs in
   * parallel batches and we begin play as soon as the first one lands.
   */
  add(questions: Question[]): void {
    for (const q of questions) {
      if (!this.pool.some((existing) => existing.id === q.id)) this.pool.push(q);
    }
  }

  get remaining(): number {
    return this.pool.filter((q) => !this.served.has(q.id)).length;
  }

  get difficulty(): Difficulty {
    return ORDER[this.level];
  }

  record(correct: boolean): void {
    if (correct) {
      this.consecutiveCorrect++;
      if (this.consecutiveCorrect >= 2) {
        this.level = Math.min(ORDER.length - 1, this.level + 1);
        this.consecutiveCorrect = 0;
      }
    } else {
      this.consecutiveCorrect = 0;
      this.level = Math.max(0, this.level - 1);
    }
  }

  /**
   * Next unseen question at the current level, widening outward if that tier is
   * exhausted. Returns null only when the whole pool has been served.
   */
  next(): Question | null {
    const unseen = this.pool.filter((q) => !this.served.has(q.id));
    if (unseen.length === 0) return null;

    // Prefer exact tier, then nearest tier by distance, then anything left.
    const byDistance = [...unseen].sort((a, b) => {
      const da = Math.abs(ORDER.indexOf(a.difficulty) - this.level);
      const db = Math.abs(ORDER.indexOf(b.difficulty) - this.level);
      if (da !== db) return da - db;
      // Within a tier, lead with the archetypes that teach most.
      return weight(b) - weight(a);
    });

    const picked = byDistance[0];
    this.served.add(picked.id);
    return picked;
  }
}

/** Archetypes that force reasoning outside the diff are worth more airtime. */
function weight(q: Question): number {
  switch (q.archetype) {
    case "failure-mode":
      return 5;
    case "blast-radius":
      return 4;
    case "language-concept":
      return 3;
    case "trap":
      return 3;
    case "why-this-line":
      return 2;
    default:
      return 1;
  }
}
