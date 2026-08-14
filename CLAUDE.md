# PopPR — working notes for Claude Code

Pop quiz for your pull request. Runs **after** you ship, not before — it is not a
gate, and any change that makes it feel like one is wrong.

## Commands

```bash
npm run build        # tsc -> dist/
npm test             # build + bank audit. Run before every commit.
npm run audit:bank   # the quality gate on its own
node dist/cli/index.js --local          # try it against the current branch
node dist/cli/index.js --local --smart  # same, but AI picks the concepts
```

There is no test runner yet. `npm test` is the build plus the bank audit; adding
real unit tests around `diff.ts` and `adaptive.ts` is a welcome PR.

## Architecture

```
src/core/          the library — no terminal code, no process.exit, no chalk
  types.ts         Question, Answered, RunResult, PrContext, Provider
  diff.ts          git / gh -> PrContext. Filters lockfiles and generated code.
  concepts.ts      RULES: regex -> concept slug. Quick mode's whole brain.
  classify.ts      Smart mode: one small AI call -> which concepts matter here
  quiz.ts          Deep mode: AI writes questions about the actual code
  bank.ts          serves curated questions, shuffles options
  adaptive.ts      Staircase: 2-up/1-down difficulty
  score.ts         difficulty x speed x combo
  history.ts       ~/.poppr/history.json, streaks, spaced repetition
  scorecard.ts     the shareable emoji grid
  providers/       claude-code | cursor-agent | api-key. One generate() each.

src/bank/          the curated question bank, grouped by area
src/cli/           terminal only: game loop, review screen, commander wiring
```

**Keep `core/` free of terminal concerns.** The VS Code extension will import it
directly, so anything that writes to stdout or reads `process.argv` belongs in
`cli/`.

## The three modes, and why

| mode | selection | questions | speed |
|---|---|---|---|
| quick (default) | regex over added lines | curated bank | ~50ms |
| `--smart` | one AI call picks concepts | curated bank | ~12s |
| `--deep` | — | AI writes them per-PR | ~3min |

Quick mode is the default **because a tool you have to configure before the
first play is a tool nobody plays.** It needs no key, no network, no Claude Code.
Do not add a required setup step to the default path.

## The one invariant that matters

Multiple choice rots in a specific way: whoever writes the questions makes the
correct answer longer and more specific than the distractors, and readers learn
to pick the wordiest option without reading any code.

This is not hypothetical. The first hand-written version of this bank had the
correct answer as the longest option in **81%** of questions. It is now 2%,
and `npm run audit:bank` fails the build above 35%.

When adding questions: **write the three distractors first**, at full
specificity, then write the correct answer to match their length.

## Adding a bank question

1. Find or add the concept slug in `src/core/concepts.ts` (`RULES`). A bank
   entry whose concept has no detection rule can never be served, and the audit
   will fail on it.
2. Add the entry to the right file in `src/bank/`.
3. `npm test`.

Every wrong option needs to be a real misconception someone holds, and
`whyTempting` should name it — that field is what turns a wrong answer into a
lesson on the review screen.

## Known rough edges

- `--deep` takes ~3 minutes cold even with three parallel batches. The batches
  stream into the live pool so play starts after the first, but this needs real
  work before it is the mode anyone reaches for daily.
- The bank covers JS/TS, React, Python, Go and SQL. Rust and Java PRs come up
  empty in quick mode.
- `concepts.ts` regexes are deliberately loose and do produce false positives —
  that is what `--smart` exists to fix, not something to solve with more regex.

## Conventions

- ESM only, Node 18+, TypeScript strict.
- Two dependencies (`commander`, `picocolors`). Adding a third needs a reason.
- Comments explain **why**, not what. The codebase has a lot of load-bearing
  decisions that look arbitrary without their rationale.
