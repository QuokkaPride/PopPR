# PopPR: working notes for Claude Code

Pop quiz for your pull request. Runs **after** you ship, not before.

Quizzing yourself is never a gate, and any change that makes it feel like one is
wrong. The single exception is `certify`, which a maintainer opts into for their
own repo: contributors must answer every question correctly before the
`poppr/certified` check goes green. You cannot fail it, only completion is
published, and it blocks a merge only if the maintainer marks that check
required. See decision 1a in `HANDOFF.md` before touching any of it.

**Read `HANDOFF.md` before making product decisions.** It records why the design
is the way it is, which choices were already argued through and reversed, what
state the project is in, and what to build next. This file covers day-to-day
mechanics; that one covers the reasoning.

## Status

- Live on npm as `@quokkapride/poppr` v0.1.2
- Repo: https://github.com/QuokkaPride/PopPR
- Browser version: https://quokkapride.github.io/PopPR/ (public repos, `web/`)
- A GitHub Action comments on every PR with what it touches and a link to play
- No users yet, no launch post yet
- Bank covers JS/TS, React, Python, Go, Rust, Java, Ruby, C/C++ and SQL, plus a
  universal tier for diffs the rules find little in. 328 questions, 108 concepts.
- Measured on 487 held-out merged PRs from 28 repos: 60% of code PRs match at
  least one concept, and every code PR gets at least 8 questions.

## Commands

```bash
npm run build        # tsc -> dist/
npm test             # build + bank audit. Run before every commit.
npm run audit:bank   # the quality gate on its own
node dist/cli/index.js --local          # try it against the current branch
node dist/cli/index.js --local --smart  # same, but AI picks the concepts
node dist/cli/index.js --detect         # what would it ask? no game, no clock
node dist/cli/index.js <pr> --certify   # timed pass, then master every question
npm run build:web                       # web/vendor/ for the browser version
```

There is no test runner yet. `npm test` is the build plus the bank audit; adding
real unit tests around `diff.ts` and `adaptive.ts` is a welcome PR.

## Architecture

```
src/core/          the library: no terminal code, no process.exit, no chalk
  types.ts         Question, Answered, RunResult, PrContext, Provider
  diff.ts          git / gh -> PrContext. Filters lockfiles and generated code.
  concepts.ts      RULES: regex -> concept slug. Quick mode's whole brain.
  classify.ts      Smart mode: one small AI call -> which concepts matter here
  quiz.ts          Deep mode: AI writes questions about the actual code
  bank.ts          serves curated questions, shuffles options, tops up thin
                   diffs from the universal pool
  mastery.ts       the certify loop: re-ask until every question is right
  certify.ts       completion comment, its parser, and the verify decision
  adaptive.ts      Staircase: 2-up/1-down difficulty
  score.ts         difficulty x speed x combo
  history.ts       ~/.poppr/history.json, streaks, spaced repetition
  scorecard.ts     the shareable emoji grid
  providers/       claude-code | cursor-agent | api-key. One generate() each.

src/bank/          the curated question bank, grouped by language
  universal.ts     general engineering, never detected, used to top up a thin
                   diff. See the comment at the top before adding to it.
src/cli/           terminal only: game loop, review screen, commander wiring
  gh-event.ts      the GitHub Action's brain: comment, verify, set the status
  init.ts          `poppr init` writes a consumer's workflow file
action.yml         the composite action third parties use as QuokkaPride/PopPR@v1
test/              node:test suites over dist/
```

**Keep `core/` free of terminal concerns.** The VS Code extension will import it
directly, so anything that writes to stdout or reads `process.argv` belongs in
`cli/`.

## The three modes, and why

| mode | selection | questions | speed |
|---|---|---|---|
| quick (default) | regex over added lines | curated bank | ~50ms |
| `--smart` | one AI call picks concepts | curated bank | ~12s |
| `--deep` | n/a | AI writes them per-PR | ~3min |

Quick mode is the default **because a tool you have to configure before the
first play is a tool nobody plays.** It needs no key, no network, no Claude Code.
Do not add a required setup step to the default path.

## The one invariant that matters

Multiple choice rots in a specific way: whoever writes the questions makes the
correct answer longer and more specific than the distractors, and readers learn
to pick the wordiest option without reading any code.

This is not hypothetical. The first hand-written version of this bank had the
correct answer as the longest option in **81%** of questions.

Fixing that produced the second form and the third. Correct-is-shortest reached
**48%** while the first number read a healthy 3%, because writing distractors
first and matching the correct answer to them pushes it terse. Fixing *that*
produced a signature phrasing, `", not X"`, in 5 of 21 correct options in one
file and 0 of 63 distractors: a perfect predictor.

So the gate is general rather than a ban on three specific mistakes. It asks the
only question that matters: **what would a player who never reads the question
score?** Chance is 25%, the limit is 37.5%, and the bank sits at 26%. Every
length check has a ceiling AND a floor, because being reliably un-extreme is as
strong a tell as being reliably extreme.

When adding questions: **write the three distractors first**, at full
specificity, then write the correct answer to match their length.

## Adding a bank question

1. Find or add the concept slug in `src/core/concepts.ts` (`RULES`). A bank
   entry whose concept has no detection rule can never be served, and the audit
   will fail on it.
2. Add the entry to the right file in `src/bank/`.
3. `npm test`.

The audit enforces both halves of that pairing. A rule with no questions is the
mirror failure and fails the build too: it names a concept on the review screen
and has nothing to ask about it.

Every wrong option needs to be a real misconception someone holds, and
`whyTempting` should name it. That field is what turns a wrong answer into a
lesson on the review screen.

## Adding a detection rule

Do not write the regex from intuition. Every rule in `concepts.ts` carries a
measured hit rate in a comment above it, and the ones that are not there were
measured and rejected: `select!` fires on 0% of merged tokio PRs, and endianness
on 0.1% of Rust files.

Measure on repos you did not design the rule from. The gap is 15 to 20 points,
every time. The corpora and harnesses live in the scratchpad, and the shape is:
pull merged PRs with `gh api`, apply the same added-line and comment filters
detection uses, then report the share of PRs that fire and how many previously
dark PRs the rule rescues. A rule below roughly 5% of a language's PRs does not
pay for the question-writing it obliges.

## Prose style

No em dashes anywhere, including question text, option text and CLI output. Use
a colon for the "short answer, then gloss" pattern that fills the bank, and a
full stop or comma in running prose. The `stop-slop` skill covers the rest: no
throat-clearing openers, no adverbs, no passive voice, no binary "not X, it's Y"
contrasts.

## Known rough edges

- `--deep` takes ~3 minutes cold even with three parallel batches. The batches
  stream into the live pool so play starts after the first, but this needs real
  work before it is the mode anyone reaches for daily.
- C/C++ is the weakest language at 47% of code PRs, and half of what fires on it
  is generic. C's bugs live half in the language and half in the specific data
  structure being touched, and the second half needs `--deep`.
- Detection rates measured on the corpus a rule was designed from run 15 to 20
  points above the same rule on held-out repos. Quote the held-out number.
- `concepts.ts` regexes are loose by design and do produce false positives.
  That is what `--smart` exists to fix, not something to solve with more regex.

## Conventions

- ESM only, Node 18+, TypeScript strict.
- Two dependencies (`commander`, `picocolors`). Adding a third needs a reason.
- Comments explain **why**, not what. The codebase has a lot of load-bearing
  decisions that look arbitrary without their rationale.
