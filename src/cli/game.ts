import readline from "node:readline";
import pc from "./colors.js";
import { Staircase } from "../core/adaptive.js";
import { liveValue, scoreAnswer } from "../core/score.js";
import type { Answered, Question, RunResult } from "../core/types.js";
import { formatDuration } from "../core/scorecard.js";
import { draw, enterFullScreen, leaveFullScreen } from "./screen.js";

const KEYS = ["a", "b", "c", "d", "e", "f"];

interface GameOptions {
  durationMs: number;
  prLabel: string;
  repo: string;
  streak: number;
  /** Omitted off the AI path, where the pool cannot grow mid-run. */
  moreComing?: () => boolean;
}

function bar(fraction: number, width = 24): string {
  const filled = Math.max(0, Math.min(width, Math.round(fraction * width)));
  const body = "█".repeat(filled) + "░".repeat(width - filled);
  if (fraction > 0.5) return pc.green(body);
  if (fraction > 0.2) return pc.yellow(body);
  return pc.red(body);
}

/**
 * Usable text width for this terminal.
 *
 * A Windows console is 80 columns by default and option text regularly runs
 * past that, wrapping mid-word into column 0 and destroying the A/B/C/D
 * alignment the screen is read by. Clamped at both ends: a very wide terminal
 * should not produce lines the eye cannot track back to the next row, and a
 * narrow one should not collapse into a one-word column.
 */
function screenWidth(): number {
  return Math.max(40, Math.min((process.stdout.columns || 80) - 6, 76));
}

function wrap(text: string, width = screenWidth(), indent = "  "): string[] {
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

/**
 * The line in your own diff that caused this question.
 *
 * Without it a bank question reads as trivia that happens to be attached to a
 * PR: the concept tag says "promise-all", which does not tell you that YOU
 * wrote a Promise.all in checkout.ts an hour ago. One dim line closes that gap,
 * and it stays one line because the question is what should hold the attention.
 */
function whyLine(question: Question): string[] {
  const first = question.evidence?.[0];
  if (!first) return [];

  const where = first.line ? `${first.file}:${first.line}` : first.file;
  const room = screenWidth() - where.length - 6;
  // A long path on a narrow terminal leaves no room for the code. Negative room
  // inverted the truncation and printed an over-long line instead of eliding, so
  // below a usable width drop the fragment and keep the location.
  if (room < 12) return [`  ${pc.dim("↳")} ${pc.cyan(where)}`];
  const code = first.text.length > room ? first.text.slice(0, room - 1) + "…" : first.text;
  return [`  ${pc.dim("↳")} ${pc.cyan(where)}  ${pc.dim(code)}`];
}

/**
 * Which half of the product this question came from.
 *
 * Only the AI ones are marked. Bank questions are the common case and a tag on
 * every row would be noise; the absence of a tag is the answer for them. Cyan
 * because it is the thing worth noticing, dim would bury it.
 */
function sourceTag(q: Question): string {
  return q.source === "ai" ? `  ${pc.cyan("✦ ai")}` : "";
}

/** The same tag without colour, so the column padding can be measured. */
function plainSourceTag(q: Question): string {
  return q.source === "ai" ? "  ✦ ai" : "";
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
  // Not a const: a miss stops the clock while the answer is read, and resuming
  // pushes the deadline out by however long that took.
  let deadline = startedAt + opts.durationMs;

  let points = 0;
  let combo = 0;
  let bestCombo = 0;

  readline.emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  enterFullScreen();

  const cleanup = () => {
    leaveFullScreen();
    if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw ?? false);
    process.stdin.pause();
  };

  try {
    while (Date.now() < deadline) {
      let question = staircase.next();

      // The pool can run dry mid-run while a later batch is still generating.
      // Hold the clock rather than ending the game early, but only briefly.
      //
      // `pending` was only ever non-zero under --deep before; it is non-zero on
      // the default path now, so an exhausted pool used to end the run and now
      // stalls. Unbounded, a thin diff seeded with eight questions spends the
      // rest of a 180-second clock on a spinner. The wait is also the one place
      // in the run with no keypress listener attached while raw mode is on, so
      // it has to listen for ctrl-c itself or the player cannot leave.
      if (!question && opts.moreComing?.()) {
        question = await waitForMore(staircase, opts, deadline);
        if (question === ABORTED) break;
      }
      if (!question) break;

      const beforeFlash = Date.now();
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
      // Reading the answer is not play time, so give the clock back.
      if (!correct) deadline += Date.now() - beforeFlash - outcome.ms;
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

/** Distinct from null, which just means "no question": the player quit. */
const ABORTED = Symbol("aborted") as unknown as Question;

/** How long an empty pool may hold the clock waiting for the next AI batch. */
const MAX_STALL_MS = 5000;

/**
 * Wait for generation to land something, briefly, and let ctrl-c out.
 *
 * Returns the next question, null when the wait ran out, or ABORTED when the
 * player pressed ctrl-c. The listener is the point: without one, raw mode
 * swallows ctrl-c and the only way out of the stall is closing the terminal.
 */
function waitForMore(
  staircase: Staircase,
  opts: GameOptions,
  deadline: number,
): Promise<Question | null> {
  return new Promise((resolve) => {
    const until = Math.min(Date.now() + MAX_STALL_MS, deadline);
    let done = false;

    const finish = (value: Question | null) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      process.stdin.off("keypress", onKey);
      resolve(value);
    };

    const onKey = (_s: string, key: { name?: string; ctrl?: boolean }) => {
      if (key?.ctrl && key.name === "c") finish(ABORTED);
    };

    const timer = setInterval(() => {
      const next = staircase.next();
      if (next) return finish(next);
      if (Date.now() >= until || !opts.moreComing?.()) return finish(null);
      draw(["", "", `  ${pc.dim("loading more questions…")}`]);
    }, 300);

    process.stdin.on("keypress", onKey);
    draw(["", "", `  ${pc.dim("loading more questions…")}`]);
  });
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
 * second so the clock and the draining point value keep moving: the moving
 * number is what creates urgency, and telling people to hurry does not.
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
        )}${sourceTag(question)}${" ".repeat(
          Math.max(1, 44 - question.concept.length - plainSourceTag(question).length),
        )}${pc.dim("+" + value)}`,
        ...whyLine(question),
        "",
      ];

      const body = wrap(question.prompt);

      // Continuation lines hang under the text rather than under the letter, so
      // the column of keys stays scannable when an option needs two rows.
      const options = question.options.flatMap((o) => {
        const [head, ...tail] = wrap(o.text, screenWidth() - 8, "");
        return [
          `    ${pc.bold(pc.cyan(o.key))}   ${head ?? ""}`,
          ...tail.map((l) => `        ${l}`),
        ];
      });

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
      key: { name?: string; ctrl?: boolean; meta?: boolean; sequence?: string },
    ) => {
      if (done) return;
      if (key?.ctrl && key.name === "c") return finish(null, true);
      // readline reports ctrl-d as name "d", so without this a stray ctrl-d
      // answers D and moves on.
      if (key?.ctrl || key?.meta) return;
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
 * A hit is 350ms of pure signal with nothing to read, which is what keeps the
 * run moving. The explanation is held back to the review screen: making someone
 * read a paragraph while their clock runs kills the flow state the timer built.
 *
 * A miss is the one moment with something worth reading, and it used to print
 * the bare letter of the right answer for half a second, which is unreadable
 * once the options have scrolled away. It now names the option and waits for a
 * keypress, with the clock stopped by the caller: the timer is meant to measure
 * whether you know the answer, not how fast you read.
 */
function flash(correct: boolean, question: Question, combo: number): Promise<void> {
  if (correct) {
    draw([
      "",
      "",
      `        ${pc.bold(pc.green("✓"))}`,
      combo >= 3 ? `        ${pc.yellow(`${combo} in a row`)}` : "",
    ]);
    return new Promise((r) => setTimeout(r, 350));
  }

  const right = question.options.find((o) => o.key === question.correct);
  draw([
    "",
    "",
    `  ${pc.bold(pc.red("✗"))}`,
    "",
    ...wrap(`${pc.green(question.correct)}  ${right?.text ?? ""}`),
    "",
    `  ${pc.dim("clock paused · press any key to continue")}`,
  ]);

  return new Promise((resolve) => {
    const onKey = (_s: string, key: { ctrl?: boolean; name?: string }) => {
      if (key?.ctrl && key.name === "c") return; // let the main handler quit
      process.stdin.off("keypress", onKey);
      resolve();
    };
    process.stdin.on("keypress", onKey);
    process.stdin.resume();
  });
}
