import pc from "./colors.js";
import { bankConcepts, bankQuestions } from "../core/bank.js";
import {
  conceptsDueForReview,
  currentStreak,
  loadHistory,
  recordRun,
  conceptTrends,
} from "../core/history.js";
import { Staircase } from "../core/adaptive.js";
import type { History } from "../core/history.js";
import { runGame } from "./game.js";
import { renderReview } from "./review.js";
import { retryMissed } from "./retry.js";

/**
 * A run with no PR attached.
 *
 * The gate is for maintainers; this is for the other half of the audience, the
 * person training themselves. It also fixes an awkward gap in spaced
 * repetition: a concept you got wrong is scheduled to come back, but it can
 * only come back on a PR that happens to touch it again. Waiting for the right
 * diff to reappear is not a schedule.
 *
 * Selection is weakest-first, then unseen. Both halves matter: without the
 * first it is not practice, and without the second a new player with no history
 * gets an empty session on their very first try.
 */
export async function runPractice(opts: {
  concept?: string;
  time?: string;
}): Promise<void> {
  // Same reason as the main run: raw mode needs a real terminal, and without one
  // the repaint loop just scrolls frames nobody can answer. See index.ts.
  if (!process.stdin.isTTY) {
    console.error(pc.yellow("\n  PopPR needs an interactive terminal to play.\n"));
    process.exit(1);
  }

  const history = await loadHistory();
  const seconds = Number(opts.time) || 180;

  const chosen = opts.concept ? [opts.concept] : selectConcepts(history);

  if (opts.concept && !bankConcepts().includes(opts.concept)) {
    console.error(
      pc.yellow(`\n  "${opts.concept}" is not a concept in the bank.\n`) +
        pc.dim("  Run `poppr --stats` to see the ones you have played.\n"),
    );
    process.exit(1);
  }

  const pool = bankQuestions(
    chosen.map((concept) => ({ concept, files: [] })),
    12,
  );

  if (pool.length === 0) {
    console.log(pc.dim("\n  No questions available for that selection.\n"));
    return;
  }

  const staircase = new Staircase();
  staircase.add(pool);

  console.log("");
  console.log(`  ${pc.bold(pc.magenta("PopPR"))}  ${pc.dim("practice")}`);
  console.log(`  ${pc.dim(describe(chosen, history))}`);
  console.log("");

  const result = await runGame(staircase, {
    durationMs: seconds * 1000,
    // No PR, so these are labels rather than references. `recordRun` takes them
    // verbatim, which keeps practice in the same history and the same streak:
    // a day you practised is a day you played.
    prLabel: "practice",
    repo: "practice",
    streak: currentStreak(history),
  });

  if (result.answered.length === 0) {
    console.log(pc.dim("\n  Stopped before answering anything. Nothing recorded.\n"));
    return;
  }

  const updated = await recordRun(result);
  result.streak = currentStreak(updated);
  console.log(renderReview(result, updated.runs.length, conceptTrends(updated)));
  await retryMissed(result.answered.filter((a) => !a.correct));
}

/**
 * Weakest concepts first, topped up with ones never seen.
 *
 * `conceptsDueForReview` caps at five and excludes anything practised in the
 * last three days, so on its own it hands back nothing to a new player and
 * nothing to a diligent one. Unseen concepts fill the gap and double as a
 * curriculum: the bank's order is roughly language primitives then systems
 * behaviour, which is the order worth meeting them in.
 */
function selectConcepts(history: History, want = 5): string[] {
  const due = conceptsDueForReview(history);
  if (due.length >= want) return due.slice(0, want);

  const played = new Set(Object.keys(history.concepts));
  const unseen = bankConcepts().filter((c) => !played.has(c) && !due.includes(c));

  return [...due, ...unseen.slice(0, want - due.length)];
}

function describe(concepts: string[], history: History): string {
  const played = new Set(Object.keys(history.concepts));
  const revisiting = concepts.filter((c) => played.has(c)).length;
  const fresh = concepts.length - revisiting;

  const parts: string[] = [];
  if (revisiting) parts.push(`${revisiting} to shore up`);
  if (fresh) parts.push(`${fresh} you have not seen`);
  return `${parts.join(", ")}  ·  no PR, nothing published`;
}
