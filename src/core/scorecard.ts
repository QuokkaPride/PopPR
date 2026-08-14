import type { Answered, RunResult } from "./types.js";

/**
 * Wordle's real invention was not the game, it was the emoji grid: tiny,
 * spoiler-free, pasteable anywhere. This is the equivalent — and critically it
 * contains NO code, no filenames, and no repo name, which is what makes it safe
 * to paste into a work Slack.
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
  if (pct >= 0.9) return "You could defend this in review. Ship with confidence.";
  if (pct >= 0.7) return "Solid. A couple of soft spots worth a second look.";
  if (pct >= 0.5) return "You know what it does. You don't yet know what it costs.";
  if (pct >= 0.3) return "Be honest: how much of this did you actually read?";
  return "You merged this. Your reviewer is going to ask. Go read it.";
}
