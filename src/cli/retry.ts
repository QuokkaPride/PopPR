import readline from "node:readline";
import pc from "./colors.js";
import type { Answered, Question } from "../core/types.js";
import type { MasteryLoop } from "../core/mastery.js";
import { append, draw, enterFullScreen, leaveFullScreen } from "./screen.js";

const KEYS = ["a", "b", "c", "d", "e", "f"];

/**
 * The untimed screens, and the two things that drive them.
 *
 * `retryMissed` is the optional second pass after a scored run; `runMasteryLoop`
 * is the compulsory one that certification hangs off. They differ only in the
 * header and in who decides when to stop, so they share one renderer: two copies
 * of a question screen drift, and the drift always lands on the screen fewer
 * people see.
 *
 * Reading an explanation is recognition; answering the question again is
 * retrieval, and retrieval is what actually encodes. Without this, a miss ends
 * with a paragraph you nodded at and a promise that the concept returns "in a
 * future run, on a different PR", which is days away and on someone else's code.
 *
 * Deliberately unlike the main game:
 *   - No clock. The timer exists to force recognition-speed recall during the
 *     run; here the goal is getting it right, and a clock would push you back
 *     toward guessing.
 *   - No points. Scoring a retry would make the scorecard a measure of
 *     persistence rather than comprehension, and the scorecard is the thing
 *     people paste in Slack.
 */
export async function retryMissed(misses: Answered[]): Promise<number> {
  if (!misses.length || !process.stdin.isTTY) return 0;

  // Opt-in on one keypress. PopPR is a snack, and anything that makes finishing
  // feel mandatory turns it back into the gate we deleted.
  const wanted = await confirmKey(
    "r",
    `  ${pc.bold(pc.cyan("r"))}${pc.dim(` to retry the ${misses.length} you missed, any other key to finish`)}`,
  );
  if (!wanted) return 0;

  const restore = rawKeys();

  let correct = 0;
  try {
    for (let i = 0; i < misses.length; i++) {
      const q = misses[i].question;
      const chosen = await askUntimed(q, `second pass  ${i + 1}/${misses.length}`);
      if (chosen === null) break; // ctrl-c
      const right = chosen === q.correct;
      if (right) correct++;
      await reveal(q, chosen, right);
    }
  } finally {
    restore();
  }

  // No clear: restore() has already put the normal screen back, and the summary
  // belongs under the review screen the run just printed there.
  console.log("");
  console.log(`  ${pc.bold(pc.magenta("PopPR"))}  ${pc.bold(`${correct}/${misses.length}`)} on the second pass`);
  console.log(`  ${pc.dim(closingLine(correct, misses.length))}`);
  console.log("");
  return correct;
}

/**
 * Certification's untimed tail: ask what is not yet right, until nothing is.
 *
 * Returns true only when the loop is genuinely finished, because the caller
 * turns that boolean into a public claim. Ctrl-c returns false with the question
 * unrecorded, so quitting halfway certifies nothing and costs nothing either.
 *
 * The header is the only progress signal on screen, and it counts what is left
 * rather than what has been done. "3 left" is a shrinking number you can finish;
 * "attempt 11" is a scoreboard of your own struggling, and mastery.ts throws
 * that count away for the same reason.
 */
export async function runMasteryLoop(loop: MasteryLoop): Promise<boolean> {
  // A clean timed run leaves nothing to master. Say nothing, draw nothing.
  if (loop.done) return true;
  if (!process.stdin.isTTY) return false;

  const restore = rawKeys();
  try {
    for (;;) {
      const question = loop.next();
      if (!question) break;
      // Read progress after next(): it is the call that rolls the pass over.
      const { pass, remaining } = loop.progress;
      const chosen = await askUntimed(
        question,
        `mastery · pass ${pass} · ${remaining} left`,
        "no clock, no score, tries are never published  ·  ctrl-c to stop",
      );
      if (chosen === null) return false; // ctrl-c, and the question goes back
      const right = chosen === question.correct;
      loop.record(right);
      await reveal(question, chosen, right);
    }
  } finally {
    restore();
  }

  return loop.done;
}

function closingLine(correct: number, total: number): string {
  if (correct === total) return "All of them. These still come back on a future PR.";
  if (correct === 0) return "None of them yet. They come back on a future PR.";
  return `${total - correct} still shaky. Those come back on a future PR.`;
}

/**
 * Raw mode, the full-screen buffer, and the restore both loops need in a
 * `finally`.
 *
 * `isRaw` is captured rather than assumed false: the game may already have put
 * the terminal in raw mode, and blindly clearing it strands the shell.
 */
function rawKeys(): () => void {
  readline.emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  enterFullScreen();
  return () => {
    leaveFullScreen();
    process.stdin.setRawMode(wasRaw ?? false);
    process.stdin.pause();
  };
}

/**
 * One keypress, so declining costs nothing. Resolves true only for `key`, and
 * false for ctrl-c, because a prompt you cannot back out of is a trap.
 */
export function confirmKey(key: string, prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    // setRawMode does not exist on a non-TTY stdin, and calling it there threw a
    // TypeError immediately after a successful `--certify` run printed
    // "Certified.", turning a finished certification into exit code 1. Declining
    // is the safe answer when there is nobody at the keyboard to accept.
    if (!process.stdin.isTTY) return resolve(false);

    readline.emitKeypressEvents(process.stdin);
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);

    console.log(prompt);
    console.log("");

    const onKey = (_s: string, pressed: { name?: string; ctrl?: boolean }) => {
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(wasRaw ?? false);
      process.stdin.pause();
      if (pressed?.ctrl && pressed.name === "c") return resolve(false);
      resolve(pressed?.name === key);
    };

    process.stdin.on("keypress", onKey);
    process.stdin.resume();
  });
}

/** The one untimed question screen. Null means ctrl-c. */
function askUntimed(
  question: Question,
  header: string,
  footer = "no clock, no points  ·  ctrl-c to stop",
): Promise<string | null> {
  return new Promise((resolve) => {
    const valid = question.options.map((o) => o.key.toLowerCase());

    draw([
      "",
      `  ${pc.bold(pc.magenta("PopPR"))}  ${pc.dim(header)}`,
      "",
      `  ${pc.dim(question.concept)}`,
      "",
      ...wrap(question.prompt),
      "",
      ...question.options.map((o) => `    ${pc.bold(pc.cyan(o.key))}   ${o.text}`),
      "",
      `  ${pc.dim(footer)}`,
    ]);

    const onKey = (
      _s: string,
      key: { name?: string; ctrl?: boolean; meta?: boolean; sequence?: string },
    ) => {
      if (key?.ctrl && key.name === "c") {
        process.stdin.off("keypress", onKey);
        return resolve(null);
      }
      // readline reports ctrl-d as name "d", so without this a stray ctrl-d
      // answers D and moves on.
      if (key?.ctrl || key?.meta) return;
      const name = (key?.name ?? key?.sequence ?? "").toLowerCase();
      if (!valid.includes(name)) return;
      process.stdin.off("keypress", onKey);
      resolve(question.options[KEYS.indexOf(name)]?.key ?? name.toUpperCase());
    };

    process.stdin.on("keypress", onKey);
    process.stdin.resume();
  });
}

/**
 * The explanation shows here rather than at the end. During the timed run
 * holding it back protects the flow state; on an untimed pass there is no flow
 * to protect and the explanation is the entire point.
 */
function reveal(question: Question, chosen: string, correct: boolean): Promise<void> {
  return new Promise((resolve) => {
    const answer = question.options.find((o) => o.key === question.correct);
    const picked = question.options.find((o) => o.key === chosen);

    const lines = ["", `  ${correct ? pc.green("✓ right") : pc.red("✗ still wrong")}`, ""];
    if (!correct && picked?.whyTempting) {
      lines.push(...wrap(pc.dim(picked.whyTempting)), "");
    }
    if (!correct && answer) {
      lines.push(`  ${pc.green("answer")}  ${answer.text}`, "");
    }
    if (question.explanation) lines.push(...wrap(question.explanation), "");
    lines.push(`  ${pc.dim("any key to continue")}`);
    append(lines);

    const onKey = () => {
      process.stdin.off("keypress", onKey);
      resolve();
    };
    process.stdin.on("keypress", onKey);
    process.stdin.resume();
  });
}

function wrap(text: string, width = 66, indent = "  "): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
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
