import type { Answered, RunResult } from "./types.js";

/**
 * Wordle's real invention was not the game, it was the emoji grid: tiny,
 * spoiler-free, pasteable anywhere. This is the equivalent. It contains NO code,
 * no filenames and no repo name, which is what makes it safe to paste into a
 * work Slack.
 */
export function scorecard(result: RunResult, runNumber: number): string {
  const grid = result.answered.map(cell).join("");
  const time = formatDuration(result.totalMs);
  const streak = result.streak > 1 ? ` · 🔥${result.streak}` : "";
  const total = result.answered.length;

  const lines = [
    `PopPR #${runNumber} · ${result.correctCount}/${total} · ${time}${streak}`,
    grid,
  ];
  if (result.weakConcepts.length) {
    lines.push(`weakest: ${result.weakConcepts.slice(0, 2).join(", ")}`);
  }
  return lines.join("\n");
}

/**
 * Green = right. Yellow = right, but slowly (you had to work for it).
 * Red = wrong. Grey = clock ran out before you answered.
 */
function cell(a: Answered): string {
  if (a.chosen === null) return "⬜";
  if (!a.correct) return "🟥";
  return a.ms > 25_000 ? "🟨" : "🟩";
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The other half of the share: a one-line, self-deprecating summary. The most
 * viral thing this tool can produce is someone posting that they scored badly on
 * their own PR, so we lean into it rather than softening it.
 */
export function verdictLine(result: RunResult): string {
  const total = result.answered.length || 1;
  const pct = result.correctCount / total;
  if (pct >= 0.9) return "You could defend every line of this in review.";
  if (pct >= 0.7) return "Solid, with a couple of soft spots worth a second look.";
  if (pct >= 0.5) return "You can describe the change but not its failure modes.";
  if (pct >= 0.3) return "More of this was unfamiliar than it looked.";
  // Says nothing about what anyone else will do. Predicting that a reviewer
  // will ask is a promise the tool cannot keep, and being wrong about it is
  // how a line like this stops landing.
  return "Worth reading this one properly before it goes further.";
}
