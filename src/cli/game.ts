import readline from "node:readline";
import pc from "picocolors";
import { Staircase } from "../core/adaptive.js";
import { liveValue, scoreAnswer } from "../core/score.js";
import type { Answered, Question, RunResult } from "../core/types.js";
import { formatDuration } from "../core/scorecard.js";

const KEYS = ["a", "b", "c", "d", "e", "f"];

interface GameOptions {
  durationMs: number;
  prLabel: string;
  repo: string;
  streak: number;
  /** True while more question batches are still being generated. */
  moreComing?: () => boolean;
}

/** Full-frame redraw. Simpler than diffing, and at 4fps nobody can tell. */
function draw(lines: string[]): void {
  process.stdout.write("\x1b[H\x1b[2J" + lines.join("\n") + "\n");
}

function bar(fraction: number, width = 24): string {
  const filled = Math.max(0, Math.min(width, Math.round(fraction * width)));
  const body = "█".repeat(filled) + "░".repeat(width - filled);
  if (fraction > 0.5) return pc.green(body);
  if (fraction > 0.2) return pc.yellow(body);
  return pc.red(body);
}

function wrap(text: string, width = 68, indent = "  "): string[] {
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
  return out;
}

function difficultyTag(d: string): string {
  if (d === "hard") return pc.red(d);
  if (d === "medium") return pc.yellow(d);
  return pc.green(d);
}

export async function runGame(
  staircase: Staircase,
  opts: GameOptions,
): Promise<RunResult> {
  const answered: Answered[] = [];
  const startedAt = Date.now();
  const deadline = startedAt + opts.durationMs;

  let points = 0;
  let combo = 0;
  let bestCombo = 0;

  readline.emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdout.write("\x1b[?25l"); // hide cursor

  const cleanup = () => {
    process.stdout.write("\x1b[?25h"); // show cursor
    if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw ?? false);
    process.stdin.pause();
  };

  try {
    while (Date.now() < deadline) {
      let question = staircase.next();

      // The pool can run dry mid-run while a later batch is still generating.
      // Hold the clock rather than ending the game early.
      while (!question && opts.moreComing?.() && Date.now() < deadline) {
        draw(["", "", `  ${pc.dim("loading more questions…")}`]);
        await new Promise((r) => setTimeout(r, 300));
        question = staircase.next();
      }
      if (!question) break;

      const outcome = await askOne(question, {
        deadline,
        combo,
        points,
        streak: opts.streak,
        totalMs: opts.durationMs,
        number: answered.length + 1,
      });

      if (outcome.aborted) break;

      const correct = outcome.chosen === question.correct;
      const event = correct
        ? scoreAnswer(question.difficulty, outcome.ms, combo)
        : { points: 0, base: 0, speed: 0, combo: 0 };

      points += event.points;
      combo = correct ? combo + 1 : 0;
      bestCombo = Math.max(bestCombo, combo);

      answered.push({
        question,
        chosen: outcome.chosen,
        correct,
        ms: outcome.ms,
        points: event.points,
        comboAt: combo,
      });

      staircase.record(correct);

      if (outcome.chosen !== null) {
        await flash(correct, question, combo);
      }
    }
  } finally {
    cleanup();
  }

  const missesByConcept = new Map<string, { seen: number; wrong: number }>();
  for (const a of answered) {
    const c = missesByConcept.get(a.question.concept) ?? { seen: 0, wrong: 0 };
    c.seen++;
    if (!a.correct) c.wrong++;
    missesByConcept.set(a.question.concept, c);
  }

  const weakConcepts = [...missesByConcept.entries()]
    .filter(([, s]) => s.wrong > 0)
    .sort((a, b) => b[1].wrong / b[1].seen - a[1].wrong / a[1].seen)
    .map(([concept]) => concept);

  return {
    prLabel: opts.prLabel,
    repo: opts.repo,
    answered,
    correctCount: answered.filter((a) => a.correct).length,
    totalMs: Math.min(Date.now() - startedAt, opts.durationMs),
    points,
    bestCombo,
    weakConcepts,
    streak: opts.streak,
  };
}

interface AskContext {
  deadline: number;
  combo: number;
  points: number;
  streak: number;
  totalMs: number;
  /**
   * Position in this run, 1-based. Not the bank id: ids look like `bank7`, so
   * rendering one reads as "Qbank7" and jumps around as the staircase picks.
   */
  number: number;
}

/**
 * Renders one question and waits for a single keypress. Redraws four times a
 * second so the clock and the draining point value are visibly moving — the
 * moving number is what creates urgency; telling people to hurry does not.
 */
function askOne(
  question: Question,
  ctx: AskContext,
): Promise<{ chosen: string | null; ms: number; aborted: boolean }> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let done = false;

    const validKeys = question.options.map((o) => o.key.toLowerCase());

    const render = () => {
      if (done) return;
      const now = Date.now();
      const remaining = Math.max(0, ctx.deadline - now);
      const elapsed = now - startedAt;
      const value = liveValue(question.difficulty, elapsed, ctx.combo);

      const header = [
        "",
        `  ${pc.bold(pc.magenta("PopPR"))}  ${bar(remaining / ctx.totalMs)}  ${pc.bold(
          formatDuration(remaining),
        )}` +
          `     ${pc.cyan("⚡ " + ctx.points.toLocaleString())}` +
          (ctx.combo > 0 ? `   ${pc.yellow(`🔥 x${(1 + 0.1 * Math.min(ctx.combo, 10)).toFixed(1)}`)}` : ""),
        "",
        `  ${pc.dim("Q" + ctx.number)} ${difficultyTag(question.difficulty)} ${pc.dim(
          "· " + question.concept,
        )}${" ".repeat(Math.max(1, 44 - question.concept.length))}${pc.dim("+" + value)}`,
        "",
      ];

      const body = wrap(question.prompt);

      const options = question.options.flatMap((o) => [
        `    ${pc.bold(pc.cyan(o.key))}   ${o.text}`,
      ]);

      draw([
        ...header,
        ...body,
        "",
        ...options,
        "",
        `  ${pc.dim(`press ${question.options.map((o) => o.key).join("/")}  ·  ctrl-c to stop`)}`,
      ]);
    };

    const ticker = setInterval(() => {
      if (Date.now() >= ctx.deadline) {
        finish(null, false);
        return;
      }
      render();
    }, 250);

    const onKey = (
      _str: string,
      key: { name?: string; ctrl?: boolean; sequence?: string },
    ) => {
      if (done) return;
      if (key?.ctrl && key.name === "c") return finish(null, true);
      const name = (key?.name ?? key?.sequence ?? "").toLowerCase();
      if (validKeys.includes(name)) {
        finish(question.options[KEYS.indexOf(name)]?.key ?? name.toUpperCase(), false);
      }
    };

    function finish(chosen: string | null, aborted: boolean) {
      if (done) return;
      done = true;
      clearInterval(ticker);
      process.stdin.off("keypress", onKey);
      resolve({ chosen, ms: Date.now() - startedAt, aborted });
    }

    process.stdin.on("keypress", onKey);
    process.stdin.resume();
    render();
  });
}

/**
 * 400ms of pure signal — no text to read. Explanations are deliberately held
 * until the review screen: making someone read a paragraph while their clock is
 * running is the fastest way to kill the flow state we just built.
 */
function flash(correct: boolean, question: Question, combo: number): Promise<void> {
  const lines = correct
    ? [
        "",
        "",
        `        ${pc.bold(pc.green("✓"))}`,
        combo >= 3 ? `        ${pc.yellow(`${combo} in a row`)}` : "",
      ]
    : ["", "", `        ${pc.bold(pc.red("✗"))}`, `        ${pc.dim(question.correct)}`];

  draw(lines);
  return new Promise((r) => setTimeout(r, correct ? 350 : 550));
}
