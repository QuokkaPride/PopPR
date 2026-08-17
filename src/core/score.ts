import type { Difficulty } from "./types.js";

const BASE: Record<Difficulty, number> = {
  easy: 100,
  medium: 200,
  hard: 350,
};

/**
 * Speed multiplier. Answering instantly is worth 1.6x, decaying to 1.0x at 30s.
 * The decay is visible on screen as a ticking number, which is what actually
 * makes people move: being told to go fast does nothing, watching points
 * drain does.
 */
export function speedMultiplier(ms: number): number {
  const seconds = ms / 1000;
  if (seconds <= 3) return 1.6;
  if (seconds >= 30) return 1.0;
  return 1.6 - (0.6 * (seconds - 3)) / 27;
}

/** Consecutive correct answers, capped at 10, worth up to 2x. */
export function comboMultiplier(combo: number): number {
  return 1 + 0.1 * Math.min(combo, 10);
}

export interface ScoreEvent {
  points: number;
  base: number;
  speed: number;
  combo: number;
}

/**
 * The scoring function is where "engaging" and "educational" are reconciled.
 *
 * Pure speed optimisation would push people toward easy questions and
 * recognition-level thinking, which defeats the point. Weighting hard questions
 * 3.5x means the winning strategy is not "answer fast", it is "answer hard
 * things fast", which is the skill worth rewarding.
 */
export function scoreAnswer(
  difficulty: Difficulty,
  ms: number,
  combo: number,
): ScoreEvent {
  const base = BASE[difficulty];
  const speed = speedMultiplier(ms);
  const comboMult = comboMultiplier(combo);
  return {
    points: Math.round(base * speed * comboMult),
    base,
    speed,
    combo: comboMult,
  };
}

/** Live value of the question currently on screen, for the draining counter. */
export function liveValue(difficulty: Difficulty, elapsedMs: number, combo: number): number {
  return Math.round(BASE[difficulty] * speedMultiplier(elapsedMs) * comboMultiplier(combo));
}
