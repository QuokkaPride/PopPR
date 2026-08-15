import pc from "picocolors";
import type { RunResult } from "../core/types.js";
import { scorecard, verdictLine, formatDuration } from "../core/scorecard.js";
import type { ConceptTrend } from "../core/history.js";
import { isUniversal } from "../core/bank.js";

function rule(): string {
  return pc.dim("─".repeat(72));
}

function wrap(text: string, width = 66, indent = "     "): string {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) {
      out.push(indent + line.trim());
      line = w;
    } else {
      line += " " + w;
    }
  }
  if (line.trim()) out.push(indent + line.trim());
  return out.join("\n");
}

/**
 * The review screen. Only misses are shown — nobody reads eight explanations,
 * and showing the ones they got right dilutes the two that matter.
 */
export function renderReview(result: RunResult, runNumber: number, trends: ConceptTrend[]): string {
  const out: string[] = [];
  const total = result.answered.length;

  out.push("");
  out.push(rule());
  out.push(
    `  ${pc.bold(pc.magenta("PopPR"))}  ${pc.bold(`${result.correctCount}/${total}`)}` +
      `   ${pc.cyan(`⚡ ${result.points.toLocaleString()} pts`)}` +
      `   ${pc.dim(formatDuration(result.totalMs))}` +
      (result.bestCombo > 2 ? `   ${pc.yellow(`🔥 best combo ${result.bestCombo}`)}` : ""),
  );
  out.push(`  ${pc.dim(verdictLine(result))}`);
  out.push(rule());

  const misses = result.answered.filter((a) => !a.correct);

  if (misses.length === 0) {
    out.push("");
    out.push(`  ${pc.green("Clean run. Nothing to review.")}`);
  } else {
    out.push("");
    out.push(`  ${pc.bold(`What you missed (${misses.length})`)}`);
    out.push("");

    for (const miss of misses) {
      const q = miss.question;
      const chosenOption = q.options.find((o) => o.key === miss.chosen);
      const correctOption = q.options.find((o) => o.key === q.correct);

      out.push(`  ${pc.dim("·")} ${pc.bold(q.concept)} ${pc.dim(`(${q.difficulty})`)}`);
      out.push(wrap(q.prompt));
      out.push("");

      if (miss.chosen === null) {
        out.push(`     ${pc.dim("you ran out of time")}`);
      } else if (chosenOption) {
        out.push(`     ${pc.red("✗ you said")}  ${chosenOption.text}`);
        // The "why you fell for it" line is the highest-value sentence on this
        // screen: it names the misconception rather than just the fact.
        if (chosenOption.whyTempting) {
          out.push(wrap(pc.dim(chosenOption.whyTempting), 62, "       "));
        }
      }

      if (correctOption) {
        out.push(`     ${pc.green("✓ answer")}    ${correctOption.text}`);
      }
      if (q.explanation) {
        out.push("");
        out.push(wrap(q.explanation));
      }
      // Where this came from in your own diff. The line beats the file list:
      // "src/checkout.ts" is a place to go looking, the line is the answer.
      const ev = q.evidence?.[0];
      if (ev) {
        const where = ev.line ? `${ev.file}:${ev.line}` : ev.file;
        out.push(`     ${pc.dim("↳ " + where)}`);
        out.push(`     ${pc.dim(ev.text.slice(0, 62))}`);
      } else if (q.anchors.length) {
        out.push(`     ${pc.dim("↳ " + q.anchors.slice(0, 3).join(", "))}`);
      } else if (isUniversal(q.concept)) {
        // Say so rather than leave the row blank. "Why am I being asked this"
        // is the question the evidence line exists to answer, and the honest
        // answer here is that nothing in the diff triggered it.
        out.push(`     ${pc.dim("↳ general engineering, not from a line in this diff")}`);
      }
      out.push("");
    }
  }

  const improving = trends.filter((t) => t.seen >= 4 && t.delta >= 10).slice(0, 3);
  if (improving.length) {
    out.push(rule());
    out.push("");
    out.push(`  ${pc.bold("Getting better")}`);
    for (const t of improving) {
      out.push(
        `     ${t.concept.padEnd(24)} ${pc.dim(`${t.overallPct}%`)} ${pc.dim("→")} ${pc.green(
          `${t.recentPct}%`,
        )}`,
      );
    }
    out.push("");
  }

  out.push(rule());
  out.push("");
  out.push(pc.dim("  share:"));
  out.push("");
  out.push(
    scorecard(result, runNumber)
      .split("\n")
      .map((l) => "  " + l)
      .join("\n"),
  );
  out.push("");

  if (result.weakConcepts.length) {
    out.push(
      pc.dim(`  These come back in a future run, on a different PR.`),
    );
    out.push("");
  }

  return out.join("\n");
}
