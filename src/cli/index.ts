#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { readDiff, findCallSites } from "../core/diff.js";
import { findRecentPr, repoName, hasGh } from "../core/pr.js";
import { detectProvider } from "../core/providers/index.js";
import { generateQuizStreaming } from "../core/quiz.js";
import {
  loadHistory,
  recordRun,
  currentStreak,
  conceptsDueForReview,
  conceptTrends,
} from "../core/history.js";
import { Staircase } from "../core/adaptive.js";
import { detectConcepts } from "../core/concepts.js";
import { bankQuestions } from "../core/bank.js";
import { classifyConcepts } from "../core/classify.js";
import { runGame } from "./game.js";
import { renderReview } from "./review.js";

const program = new Command();

program
  .name("poppr")
  .description("Pop quiz for your pull request. Don't merge what you can't explain.")
  .argument("[pr]", "PR number or URL. Defaults to your most recent PR.")
  .option("--local", "quiz on the local branch diff instead of a GitHub PR")
  .option("--base <ref>", "base ref for --local (default: auto-detected)")
  .option(
    "-s, --smart",
    "let AI pick which concepts matter in your diff, then quiz from the bank (~10s)",
  )
  .option(
    "-d, --deep",
    "quiz on YOUR code specifically, written fresh for this PR (needs AI, ~60s)",
  )
  .option("-t, --time <seconds>", "how long the run lasts", "180")
  .option("--provider <name>", "claude-code | cursor-agent | anthropic | openai | openrouter | ollama")
  .option("--stats", "show your concept mastery over time and exit")
  .action(main);

async function main(prArg: string | undefined, opts: Record<string, any>) {
  if (opts.stats) return showStats();

  const cwd = process.cwd();
  const spin = startSpinner("Finding your PR");

  try {
    let pr = prArg;
    if (!opts.local && !pr) {
      if (!(await hasGh())) {
        spin.stop();
        console.error(
          pc.yellow(
            "\n  The GitHub CLI isn't set up, so I can't find your PR.\n" +
              "  Run `gh auth login`, or use `poppr --local` to quiz on your current branch.\n",
          ),
        );
        process.exit(1);
      }
      const found = await findRecentPr(cwd);
      if (!found) {
        spin.stop();
        console.error(
          pc.yellow(
            "\n  No PR found for you in this repo. Try `poppr --local` to quiz on your branch.\n",
          ),
        );
        process.exit(1);
      }
      pr = String(found.number);
    }

    spin.update("Reading the diff");
    const ctx = await readDiff({ cwd, pr: opts.local ? undefined : pr, base: opts.base });
    ctx.repo = await repoName(cwd);
    ctx.callSites = await findCallSites(ctx, cwd);

    const history = await loadHistory();
    const staircase = new Staircase();
    let pending = 0;
    let generation: Promise<unknown> = Promise.resolve();

    if (opts.deep) {
      // Deep mode: questions about YOUR code. Needs a model, and the model has
      // to actually reason about the diff, so it is the slow path.
      spin.update("Picking a backend");
      const { provider, note } = await detectProvider(opts.provider);
      const review = conceptsDueForReview(history);

      spin.update(`Reading your code  ${pc.dim(`(${note})`)}`);

      // Three parallel batches. The game starts the moment the first lands and
      // later batches feed the live pool, so the wait is one batch, not three.
      pending = 3;
      let firstBatch: (() => void) | null = null;
      const ready = new Promise<void>((resolve) => (firstBatch = resolve));

      generation = generateQuizStreaming(ctx, provider, {
        reviewConcepts: review,
        onBatch(batch) {
          pending--;
          staircase.add(batch);
          if (staircase.remaining > 0 || pending === 0) firstBatch?.();
        },
      }).catch((err) => {
        firstBatch?.();
        throw err;
      });

      await ready;
      spin.stop();
      if (staircase.remaining === 0) await generation;
    } else {
      // Quick mode: pure pattern matching against a curated bank. No model, no
      // network, no key — a few milliseconds. This is the default because a
      // tool you have to configure before the first play is a tool nobody plays.
      let detected = detectConcepts(ctx);

      if (opts.smart) {
        // Smart mode: same curated questions, but a model decides which
        // concepts genuinely matter here instead of a regex guessing from
        // keywords. One small call, because the output is a list of slugs.
        spin.update("Working out what matters in this diff");
        const { provider } = await detectProvider(opts.provider);
        const classified = await classifyConcepts(ctx, provider);
        if (classified.length) detected = classified;
      }

      staircase.add(bankQuestions(detected));
      spin.stop();

      if (staircase.remaining < 3) {
        console.log(
          pc.yellow(
            `\n  Only ${staircase.remaining} concept${staircase.remaining === 1 ? "" : "s"} in the bank matched this diff.\n`,
          ) + pc.dim("  Try `poppr --deep` for questions written about your actual code.\n"),
        );
        if (staircase.remaining === 0) return;
      }
    }

    const seconds = Number(opts.time) || 180;
    await countdown(ctx.label, seconds, opts.deep ? "deep" : opts.smart ? "smart" : "quick");

    const result = await runGame(staircase, {
      durationMs: seconds * 1000,
      prLabel: ctx.label,
      repo: ctx.repo,
      streak: currentStreak(history),
      moreComing: () => pending > 0,
    });

    void generation.catch(() => {});

    if (result.answered.length === 0) {
      console.log(pc.dim("\n  Stopped before answering anything. Nothing recorded.\n"));
      return;
    }

    const updated = await recordRun(result);
    result.streak = currentStreak(updated);

    console.log(renderReview(result, updated.runs.length, conceptTrends(updated)));
  } catch (err) {
    spin.stop();
    console.error(pc.red(`\n  ${(err as Error).message}\n`));
    process.exit(1);
  }
}

async function showStats() {
  const history = await loadHistory();
  if (history.runs.length === 0) {
    console.log(pc.dim("\n  No runs yet. Run `poppr` after your next PR.\n"));
    return;
  }
  const trends = conceptTrends(history);
  console.log("");
  console.log(
    `  ${pc.bold(pc.magenta("POPPR"))}  ${history.runs.length} runs  ·  🔥 ${currentStreak(
      history,
    )} day streak`,
  );
  console.log("");
  for (const t of trends.slice(0, 15)) {
    const arrow = t.delta > 5 ? pc.green("↑") : t.delta < -5 ? pc.red("↓") : pc.dim("·");
    const barWidth = Math.round(t.recentPct / 5);
    console.log(
      `  ${t.concept.padEnd(22)} ${arrow} ${String(t.recentPct).padStart(3)}%  ` +
        pc.dim("▏") +
        (t.recentPct >= 70 ? pc.green("█".repeat(barWidth)) : pc.yellow("█".repeat(barWidth))) +
        pc.dim(`  ${t.seen} seen`),
    );
  }
  console.log("");
}

/** A three-two-one before the clock starts, so nobody loses 10s to surprise. */
function countdown(label: string, seconds: number, mode: string): Promise<void> {
  return new Promise((resolve) => {
    console.log("");
    console.log(
      `  ${pc.bold(pc.magenta("POPPR"))}  ${pc.dim(label)}  ${mode === "quick" ? pc.dim(mode) : pc.cyan(mode)}`,
    );
    console.log(
      `  ${pc.dim(`${seconds}s on the clock · answer as many as you can`)}`,
    );
    console.log(`  ${pc.dim("hard questions are worth 3.5x. speed and streaks multiply.")}`);
    console.log("");

    let n = 3;
    const tick = setInterval(() => {
      if (n === 0) {
        clearInterval(tick);
        resolve();
        return;
      }
      process.stdout.write(`\r  ${pc.bold(pc.cyan(String(n)))}   `);
      n--;
    }, 700);
  });
}

function startSpinner(initial: string) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  let text = initial;
  const isTty = process.stdout.isTTY;
  const timer = isTty
    ? setInterval(() => {
        process.stdout.write(`\r  ${pc.magenta(frames[i++ % frames.length])} ${text}${" ".repeat(20)}`);
      }, 80)
    : null;
  if (!isTty) console.log(`  ${text}`);
  return {
    update(next: string) {
      text = next;
      if (!isTty) console.log(`  ${text}`);
    },
    stop() {
      if (timer) clearInterval(timer);
      if (isTty) process.stdout.write("\r" + " ".repeat(60) + "\r");
    },
  };
}

program.parseAsync(process.argv);
