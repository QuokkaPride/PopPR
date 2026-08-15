#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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
import { codeFiles, detectConcepts } from "../core/concepts.js";
import { bankQuestions, certifySet } from "../core/bank.js";
import { MasteryLoop } from "../core/mastery.js";
import { certifyComment, STATUS_CONTEXT } from "../core/certify.js";
import { classifyConcepts } from "../core/classify.js";
import { formatDuration } from "../core/scorecard.js";
import type { PrContext, Question, RunResult } from "../core/types.js";
import { runGame } from "./game.js";
import { renderReview } from "./review.js";
import { retryMissed, runMasteryLoop, confirmKey } from "./retry.js";
import { runInit } from "./init.js";
import { runPractice } from "./practice.js";
import { runGhEvent } from "./gh-event.js";

const exec = promisify(execFile);

const program = new Command();

// Without this, a program-level option is eaten by the program even when it
// appears after a subcommand name, so `poppr init --certify` sets `--certify` on
// the quiz rather than on init. Positional options stop parsing at the
// subcommand, which is what everyone assumes is happening anyway.
program.enablePositionalOptions();

program
  .name("poppr")
  .description("Pop quiz for the pull request you just shipped.")
  .argument("[pr]", "PR number or URL. Defaults to your most recent PR.")
  .option("--local", "quiz on the local branch diff instead of a GitHub PR")
  .option("--base <ref>", "base ref for --local (default: auto-detected)")
  .option(
    "-s, --smart",
    "let AI pick which concepts matter in your diff, then quiz from the bank (~12s)",
  )
  .option(
    "-d, --deep",
    "quiz on YOUR code specifically, written fresh for this PR (needs AI, ~3min)",
  )
  .option("-t, --time <seconds>", "how long the run lasts", "180")
  .option(
    "--certify",
    "answer every question correctly, untimed after the clock, then post the completion comment",
  )
  .option("--questions <n>", "how many questions a --certify run has to get right", "10")
  .option("--provider <name>", "claude-code | cursor-agent | anthropic | openai | openrouter | ollama")
  .option("--stats", "show your concept mastery over time and exit")
  .option(
    "--detect",
    "print the concepts this diff touches and exit, without playing",
  )
  .option("--json", "machine-readable output, for --detect")
  .action(main);

program
  .command("practice")
  .description("quiz yourself on your weak concepts, with no PR involved")
  .option("--concept <slug>", "drill one concept instead of the weakest ones")
  .option("-t, --time <seconds>", "how long the run lasts", "180")
  .action((opts: { concept?: string; time?: string }) => runPractice(opts));

program
  .command("init")
  .description("write the GitHub Action workflow that comments on every PR")
  .option("--certify", "ask contributors to certify, and report the poppr/certified check")
  .option("--force", "overwrite an existing workflow file")
  .action((opts: { certify?: boolean; force?: boolean }) => runInit(opts));

// Hidden because it is the Action's own entry point: it reads the event off
// GITHUB_EVENT_PATH and does nothing recognisable from a terminal.
program
  .command("gh-event", { hidden: true })
  .description("handle one GitHub Actions event")
  .action(() => runGhEvent());

async function main(prArg: string | undefined, opts: Record<string, any>) {
  if (opts.stats) return showStats();
  if (opts.detect) return detectOnly(prArg, opts);

  if (opts.certify && opts.local) {
    console.error(
      pc.yellow(
        "\n  Certification binds to a PR's head commit, and --local has none. Give it a PR.\n",
      ),
    );
    process.exit(1);
  }
  if (opts.certify && opts.deep) {
    console.error(
      pc.yellow(
        "\n  Certification asks from the curated bank, so it cannot run with --deep.\n",
      ),
    );
    process.exit(1);
  }

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
    // The exact set certification is a claim about. Held separately from the
    // staircase because the staircase serves what the clock reaches, and the
    // claim covers every question whether the clock reached it or not.
    let certifyPool: Question[] = [];
    /** Deep generation failed but the bank had already seeded a playable run. */
    let deepFailed = false;

    if (opts.deep) {
      // Deep mode: questions about YOUR code. Needs a model, and the model has
      // to actually reason about the diff, so it is the slow path.
      //
      // Seed from the curated bank FIRST, which costs a few milliseconds and no
      // network. Waiting for the model before showing anything was deep mode's
      // worst property: measured at 228 seconds on a large diff, which is three
      // minutes of spinner before a timed game starts. Now the run begins
      // immediately on bank questions and the written-for-you ones join the live
      // pool as each batch lands.
      const detected = detectConcepts(ctx);
      const seed = bankQuestions(detected, 20, { codeFiles: codeFiles(ctx) });
      staircase.add(seed);

      spin.update("Picking a backend");
      let backend;
      try {
        backend = await detectProvider(opts.provider);
      } catch (err) {
        // No backend installed is the commonest deep-mode failure by far, and it
        // used to end the run. With a seeded pool there is still a game to play,
        // so report it once at the end rather than exiting here.
        if (seed.length === 0) throw err;
        spin.stop();
        deepFailed = true;
        backend = null;
      }
      const review = conceptsDueForReview(history);

      // Three parallel batches, each feeding the live pool as it arrives.
      pending = backend ? 3 : 0;
      let firstBatch: (() => void) | null = null;
      const ready = new Promise<void>((resolve) => (firstBatch = resolve));

      if (backend) {
      spin.update(`Reading your code  ${pc.dim(`(${backend.note})`)}`);
      generation = generateQuizStreaming(ctx, backend.provider, {
        reviewConcepts: review,
        onBatch(batch) {
          pending--;
          staircase.add(batch);
          if (staircase.remaining > 0 || pending === 0) firstBatch?.();
        },
      }).catch((err) => {
        firstBatch?.();
        // A backend that is missing or broken is not a reason to refuse to
        // play, now that there is always something in the pool. Swallow it
        // when the bank seeded the run and report it on the review screen.
        if (seed.length === 0) throw err;
        deepFailed = true;
      });
      }

      // Only block when the bank had nothing to offer, which is a diff with no
      // code in it or none the rules could read.
      if (seed.length === 0) {
        await ready;
        if (staircase.remaining === 0) await generation;
      }
      spin.stop();
    } else {
      // Quick mode: pure pattern matching against a curated bank. No model, no
      // network, no key: a few milliseconds. This is the default because a
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

      if (opts.certify) {
        // A different selection from the scored run: smaller, and round-robin
        // across concepts so no single regex hit can decide what someone has to
        // master before merging. See certifySet.
        certifyPool = certifySet(detected, {
          limit: Number(opts.questions) || 10,
          topUp: { codeFiles: codeFiles(ctx) },
        });
        if (certifyPool.length === 0) {
          spin.stop();
          console.log(
            pc.dim(`\n  Nothing to certify: no bank concepts matched ${ctx.label}.\n`),
          );
          return;
        }
        staircase.add(certifyPool);
      } else {
        staircase.add(bankQuestions(detected, 20, { codeFiles: codeFiles(ctx) }));
      }
      spin.stop();

      if (!opts.certify && staircase.remaining < 3) {
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
      // A certify run still has a gate to clear. Answering nothing under the
      // clock is not a forfeit: the timed pass only scores you, and MasteryLoop
      // treats every unreached question exactly as it treats a missed one. The
      // browser already behaved this way, so returning here made the two front
      // ends disagree about whether ctrl-c costs you the merge.
      if (!opts.certify) return;
      await certify(certifyPool, result, ctx, String(pr), cwd);
      return;
    }

    const updated = await recordRun(result);
    result.streak = currentStreak(updated);

    console.log(renderReview(result, updated.runs.length, conceptTrends(updated)));

    // Deep mode now seeds from the bank and plays immediately, so a backend that
    // is missing or slow costs you the written-for-you questions and not the run.
    // Say which one you got, because the two are not the same product.
    if (deepFailed) {
      console.log(
        pc.yellow("  Those were curated bank questions.\n") +
          pc.dim("  Deep mode needs an AI backend: `npm i -g @anthropic-ai/claude-code`, or set ANTHROPIC_API_KEY.\n"),
      );
    } else if (opts.deep && pending > 0) {
      console.log(
        pc.dim("  The clock beat the model: some questions written for this PR arrived too late.\n") +
          pc.dim("  Run it again and they will be waiting, or give it longer with `-t 300`.\n"),
      );
    }

    if (opts.certify) {
      // Certification supersedes the optional retry: it covers the same misses
      // and does not stop until they are right.
      await certify(certifyPool, result, ctx, String(pr), cwd);
    } else {
      // Retrieval beats re-reading, so offer the misses again before we let go
      // of them. Opt-in, off the clock, unscored: see retry.ts.
      await retryMissed(result.answered.filter((a) => !a.correct));
    }
  } catch (err) {
    spin.stop();
    console.error(pc.red(`\n  ${(err as Error).message}\n`));
    process.exit(1);
  }
}

/** Slot for the commit we could not read. Not 40 hex, so a verbatim paste is
 *  quietly ignored by the verifier rather than looking certified. */
const SHA_SLOT = "HEAD-SHA-GOES-HERE";

/**
 * The untimed tail of a --certify run, and the handover of the comment.
 *
 * Every branch here ends with the comment on screen or on the PR. Someone who
 * just answered ten questions correctly has done the work, and losing that to a
 * missing `gh` or a stale token would be the cruellest bug in the tool.
 *
 * Posting is a keypress rather than automatic. The comment goes out under the
 * contributor's name and says something about them in public, so it is theirs to
 * send.
 */
async function certify(
  pool: Question[],
  result: RunResult,
  ctx: PrContext,
  pr: string,
  cwd: string,
): Promise<void> {
  const loop = new MasteryLoop(pool, result.answered);
  // The loop redraws full frames over the review screen. Remember whether it is
  // going to: a clean timed run has nothing to master and should keep its review
  // on screen, and a run that played the loop should not read its comment under
  // the last explanation.
  const willDraw = !loop.done;
  const finished = await runMasteryLoop(loop);
  if (willDraw && process.stdout.isTTY) process.stdout.write("\x1b[H\x1b[2J");

  if (!finished) {
    console.log(pc.dim("\n  Stopped before every question was right, so nothing is certified."));
    console.log(pc.dim(`  Nothing is lost either: \`poppr ${pr} --certify\` starts it again.\n`));
    return;
  }

  console.log("");
  console.log(
    `  ${pc.bold(pc.green("Certified."))} ` +
      pc.dim(`All ${pool.length} question${pool.length === 1 ? "" : "s"} on ${ctx.label} answered correctly.`),
  );

  if (!ctx.headSha) {
    console.log("");
    console.log(pc.yellow("  I could not read this PR's head commit, so I cannot bind the comment to it."));
    console.log(pc.dim(`  Run \`gh pr view ${pr} --json headRefOid -q .headRefOid\`, then swap`));
    console.log(pc.dim(`  ${SHA_SLOT} below for what it prints, and ${SHA_SLOT.slice(0, 7)} for its first seven.`));
    printComment(certifyComment({ headSha: SHA_SLOT, questions: pool }), "copy this onto the PR");
    return;
  }

  const body = certifyComment({ headSha: ctx.headSha, questions: pool });
  printComment(body);

  const post = await confirmKey(
    "p",
    `  ${pc.bold(pc.cyan("p"))}${pc.dim(` to post it on ${ctx.label}, any other key to copy it yourself`)}`,
  );

  if (!post) {
    console.log(pc.dim(`  Copy this onto the PR. ${STATUS_CONTEXT} turns green once it lands.\n`));
    return;
  }

  try {
    // An argument vector, never a shell string: the body is markdown with
    // backticks in it, and a shell would happily run them.
    await exec("gh", ["pr", "comment", pr, "--body", body], { cwd });
    console.log(`  ${pc.green("Posted.")} ${pc.dim(`${STATUS_CONTEXT} turns green once the Action sees it.`)}`);
    console.log("");
  } catch (err) {
    const detail = ((err as { stderr?: string }).stderr || (err as Error).message || "")
      .trim()
      .split("\n")[0];
    console.log(pc.yellow(`  gh could not post it: ${detail}`));
    printComment(body, "copy this onto the PR");
  }
}

/** Framed, and never indented: indentation would come along with the copy. */
function printComment(body: string, note?: string): void {
  const rule = pc.dim("  " + "─".repeat(68));
  console.log("");
  if (note) console.log(pc.dim(`  ${note}`));
  console.log(rule);
  console.log(body);
  console.log(rule);
  console.log("");
}

/**
 * What would this diff be quizzed on? No game, no clock, no history written.
 *
 * Exists because CI has nobody at the keyboard: a timed quiz cannot be played
 * by a runner, so the GitHub Action reports what the PR touches and leaves the
 * playing to a human. Also useful on its own for seeing why a run asked what it
 * asked.
 */
async function detectOnly(prArg: string | undefined, opts: Record<string, any>) {
  const cwd = process.cwd();
  const ctx = await readDiff({ cwd, pr: opts.local ? undefined : prArg, base: opts.base });
  const detected = detectConcepts(ctx);
  const questions = bankQuestions(detected, 20, { codeFiles: codeFiles(ctx) });

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          label: ctx.label,
          files: ctx.files.length,
          concepts: detected.map((d) => ({
            concept: d.concept,
            files: d.files,
            weight: d.weight,
          })),
          questions: questions.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!detected.length) {
    console.log(pc.dim(`\n  No bank concepts matched ${ctx.label}.\n`));
    return;
  }

  console.log("");
  console.log(`  ${pc.bold(pc.magenta("PopPR"))}  ${pc.dim(ctx.label)}`);
  console.log("");
  for (const d of detected) {
    console.log(
      `  ${d.concept.padEnd(24)} ${pc.dim(d.files.slice(0, 2).join(", "))}`,
    );
  }
  console.log("");
  console.log(pc.dim(`  ${questions.length} questions available. Play them with \`poppr\`.`));
  console.log("");
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
    `  ${pc.bold(pc.magenta("PopPR"))}  ${history.runs.length} runs  ·  🔥 ${currentStreak(
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
      `  ${pc.bold(pc.magenta("PopPR"))}  ${pc.dim(label)}  ${mode === "quick" ? pc.dim(mode) : pc.cyan(mode)}`,
    );
    // Match the mm:ss the timer itself shows. "180s" here then "3:00" one line
    // down reads like two different clocks.
    console.log(
      `  ${pc.dim(`${formatDuration(seconds * 1000)} on the clock · answer as many as you can`)}`,
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

// main() catches its own errors; this covers the subcommands, which would
// otherwise surface as an unhandled rejection and a stack trace.
program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(pc.red(`\n  ${(err as Error).message}\n`));
  process.exit(1);
});
