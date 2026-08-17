# How it works

The detail behind the [README](../README.md), for anyone deciding whether to
trust this on a repo they are responsible for.

## Why the questions are curated rather than generated

A model can write a question about your diff, and PopPR has one do exactly
that. The default mode does not, for three reasons:

1. **The semantics of `Promise.all` are identical in every repo on earth.**
   Paying a model to rediscover them on every run is waste.
2. **Written once, reused by everyone, so each question can be far better
   crafted** than anything produced per-run under a latency budget.
3. **It runs offline in 50 milliseconds with no key.** A tool you have to
   configure before the first play is a tool nobody plays.

Detection is a regex pass over your added lines that maps to a concept slug. The
regexes are loose on purpose: a missed concept is invisible, and a wrong one is
obvious the moment you see the line it matched.

## Does it fire on real PRs?

Measured on **487 merged PRs from 28 repos**, none of which were used to write a
single detection rule. Every rule was designed against a separate corpus, which
matters because a rule scores 15 to 20 points higher on the repos it was built
from. These are the held-out numbers.

| language | code PRs matching a concept |
|---|---|
| TypeScript | 79% |
| Rust | 69% |
| Go | 66% |
| Python | 61% |
| Ruby | 54% |
| Java | 51% |
| C/C++ | 47% |
| **overall** | **60%** |

The other 40% are a single guard, a renamed field, one new branch. Those get
general engineering questions instead, so no PR containing code comes back
empty. A PR that adds no code at all gets nothing, on purpose: a lockfile bump
and a changelog entry have nothing to quiz.

About 41% of merged PRs in large repos add no code in any language the tool
reads. Silence there is the correct output, not a coverage gap.

## How the questions stay honest

Multiple choice rots when anything about the correct answer other than its
content predicts it. Players find the pattern long before they notice they are
using it, and the quiz keeps looking fine while it stops measuring anything.

This bank has rotted three times, each in a different disguise:

| form | measured | how it got in |
|---|---|---|
| correct answer is longest | **81%** | Written by someone who had just finished writing the rule against doing it. |
| correct answer is shortest | **61%** | Fixing the first one. "Write the distractors first and match the correct answer to them" pushes it terse, and nobody measured the other direction. |
| a signature phrase | 5 of 21 correct, **0 of 63** distractors | Fixing the second one. Lengthening correct answers made the author reach for the same construction every time. |

So `npm test` gates on the general question rather than three specific bans:
**what would someone score if they never read the question at all?**

```
  poppr bank audit · 328 questions, 108 concepts

  correct-is-longest  23%   (limit 35%, floor 10%, chance 25%)
  correct-is-shortest 11%   (limit 35%, floor 10%)
  blind strategy      24%   (limit 37.5%, chance 25%)
  length rank         #1 24%  #2 37%  #3 28%  #4 12%   (uniform is 25% each)

  ✓ bank is healthy
```

The blind-strategy number learns which surface features go with correct answers
from the bank itself, applies them with no access to the question, and reports
what that scores. Chance is 25%. It was 45%. It is now 24%.

**Note the floors.** The obvious guard is "never the longest and never the
shortest", and applying it makes both numbers read 0%, which looks perfect and
makes "drop both extremes, guess between the two survivors" worth 56%. Being
reliably un-extreme is as strong a tell as being reliably extreme.

The same bug was in the generation prompt at 53% correct-is-shortest.
`npm run test:deep` runs generation against a live model and applies these same
audits to the result.

## Scoring

Hard questions pay 3.5x easy ones, speed multiplies up to 1.6x, and a streak
multiplies up to 2x. Speed alone would push you toward easy questions and
recognition-level thinking, so the winning strategy is answering hard questions
fast.

Difficulty adapts as you go: two right steps up, one wrong steps down. That
settles around 85% accuracy, which is where learning is fastest
([Wilson et al., 2019](https://www.nature.com/articles/s41467-019-12552-4)). It
is not trying to let you ace it.

Explanations wait for the review screen. Reading a paragraph while your clock
ticks kills the flow the game just built, so a run gives you a tick or a cross
and nothing else.

## What the required check actually is

The Action posts a GitHub **commit status** named `poppr/quiz-passed`. It has two
states and never a third:

- **pending**, from the moment the PR opens until the author has answered every
  question about the diff correctly and posted the completion comment
- **success**, once they have

There is no failure state. A wrong answer re-queues the question rather than
ending anything.

A status on its own blocks nothing. GitHub only enforces it once you add
`poppr/quiz-passed` to a branch protection rule or ruleset, which is a separate
decision you make in your repo settings. Until then the check is informational.

Two behaviours worth knowing before you make it required:

- **A PR with nothing to quiz passes on its own.** A docs or lockfile change
  detects no concepts, so the status goes green immediately. Without that, a
  required check would block every typo fix forever, and the first maintainer to
  hit that turns the whole thing off.
- **A push resets it to pending.** The completion comment names the commit it was
  about, so a new commit makes the old proof stale. This is the rule GitHub
  applies to review approvals, for the same reason.

Only the PR author can turn the check green. A completion comment from anyone
else is ignored.

## What the quiz does and does not prove

A three-minute multiple-choice run measures recall under time pressure. It is
not an engineering assessment, and a model can pass it.

That is precisely why there is **no failing threshold**. Gating on a score would
filter honest contributors and pass dishonest ones, which is inverted selection.
What the required check publishes is that the author worked through every
question about their own diff, untimed, until each one was right.

If someone routes a three-minute quiz about their own patch through a model to
avoid reading it, you have learned something worth knowing about that
contributor.

## Fork safety

The GitHub Action runs on `pull_request_target`, which carries a write token in
the base repo's context. The usual way that becomes a supply-chain hole is
checking out the PR head and running its code.

This workflow does neither. The diff arrives as text through the GitHub API, no
code from the PR head ever lands on the runner, and nothing from it executes. A
fork cannot reach the token through a postinstall script or a checked-in config.

That is also what makes it work on repos that are not Node at all: `npx` only
needs the Node the GitHub runner already ships with.
