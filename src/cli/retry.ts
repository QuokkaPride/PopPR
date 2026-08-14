import readline from "node:readline";
import pc from "picocolors";
import type { Answered, Question } from "../core/types.js";

const KEYS = ["a", "b", "c", "d", "e", "f"];

/**
 * The second pass over what you just missed.
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
 *   - Opt-in on one keypress. PopPR is a snack. Anything that makes finishing
 *     feel mandatory turns it back into the gate we deleted.
 */
export async function retryMissed(misses: Answered[]): Promise<number> {
  if (!misses.length || !process.stdin.isTTY) return 0;

  const wanted = await confirm(misses.length);
  if (!wanted) return 0;

  readline.emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdout.write("\x1b[?25l");

  let correct = 0;
  try {
    for (let i = 0; i < misses.length; i++) {
      const q = misses[i].question;
      const chosen = await askUntimed(q, i + 1, misses.length);
      if (chosen === null) break; // ctrl-c
      const right = chosen === q.correct;
      if (right) correct++;
      await reveal(q, chosen, right);
    }
  } finally {
    process.stdout.write("\x1b[?25h");
    process.stdin.setRawMode(wasRaw ?? false);
    process.stdin.pause();
  }

  process.stdout.write("\x1b[H\x1b[2J");
  console.log("");
  console.log(`  ${pc.bold(pc.magenta("PopPR"))}  ${pc.bold(`${correct}/${misses.length}`)} on the second pass`);
  console.log(`  ${pc.dim(closingLine(correct, misses.length))}`);
  console.log("");
  return correct;
}

function closingLine(correct: number, total: number): string {
  if (correct === total) return "All of them. These still come back on a future PR.";
  if (correct === 0) return "None of them yet. They come back on a future PR.";
  return `${total - correct} still shaky. Those come back on a future PR.`;
}

/** One keypress, so declining costs nothing. */
function confirm(count: number): Promise<boolean> {
  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);

    console.log(
      `  ${pc.bold(pc.cyan("r"))}${pc.dim(` to retry the ${count} you missed, any other key to finish`)}`,
    );
    console.log("");

    const onKey = (_s: string, key: { name?: string; ctrl?: boolean }) => {
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(wasRaw ?? false);
      process.stdin.pause();
      if (key?.ctrl && key.name === "c") return resolve(false);
      resolve(key?.name === "r");
    };

    process.stdin.on("keypress", onKey);
    process.stdin.resume();
  });
}

function askUntimed(question: Question, n: number, total: number): Promise<string | null> {
  return new Promise((resolve) => {
    const valid = question.options.map((o) => o.key.toLowerCase());

    process.stdout.write("\x1b[H\x1b[2J");
    const lines = [
      "",
      `  ${pc.bold(pc.magenta("PopPR"))}  ${pc.dim(`second pass  ${n}/${total}`)}`,
      "",
      `  ${pc.dim(question.concept)}`,
      "",
      ...wrap(question.prompt),
      "",
      ...question.options.map((o) => `    ${pc.bold(pc.cyan(o.key))}   ${o.text}`),
      "",
      `  ${pc.dim("no clock, no points  ·  ctrl-c to stop")}`,
    ];
    process.stdout.write(lines.join("\n") + "\n");

    const onKey = (_s: string, key: { name?: string; ctrl?: boolean; sequence?: string }) => {
      if (key?.ctrl && key.name === "c") {
        process.stdin.off("keypress", onKey);
        return resolve(null);
      }
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
 * holding it back protects the flow state; on the second pass there is no flow
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
    process.stdout.write(lines.join("\n") + "\n");

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
