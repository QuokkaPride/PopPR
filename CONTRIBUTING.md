# Contributing to PopPR

The question bank is the best part of this project and the easiest thing to
contribute to. One good question benefits everyone who runs PopPR.

```bash
git clone https://github.com/QuokkaPride/PopPR.git
cd PopPR
npm install
npm test
node dist/cli/index.js --local   # try it on your own branch
```

## Adding questions

1. **Make the concept detectable.** `src/core/concepts.ts` maps a regex to a
   concept slug. If your concept isn't there, add a rule. Patterns are matched
   against added lines only. Loose patterns are fine — `--smart` mode filters
   false positives, so don't over-engineer the regex.

2. **Add the entries** to the right file in `src/bank/`. Three per concept:
   roughly one easy, one medium, one hard, each probing a different facet.

3. **Run `npm test`.**

## The rule that matters

Multiple choice rots in a predictable way. Whoever writes the questions makes
the correct answer longer and more specific than the distractors, and readers
learn to pick the wordiest option without reading any code. The quiz still looks
fine; it just stops measuring anything.

This isn't hypothetical — the first hand-written version of this bank had the
correct answer as the longest option in **81%** of questions. So it's a build
gate, not a guideline:

```
  correct-is-longest  2%   (limit 35%, random baseline 25%)
  length ratio        0.92   (limit 1.1)
```

**Write your three distractors first, at full specificity. Then write the
correct answer to match their length.**

Every wrong option should be a real misconception someone actually holds, and
`whyTempting` should name it in one sentence. That field is what the review
screen shows after a miss, and it's usually the most valuable line on that
screen.

## What makes a good question

Good — tests something that bites in production:

> A customer reports that when Stripe times out, the Adyen charge still goes
> through. Why?

Bad — syntax recall, no consequence:

> What does `Promise.all` return?

Also bad — three rephrasings of one idea across the difficulty tiers.

## Code

- ESM only, Node 18+, TypeScript strict.
- `src/core/` must stay free of terminal concerns — the VS Code extension
  imports it directly. Anything writing to stdout belongs in `src/cli/`.
- Two runtime dependencies. Adding a third needs a reason in the PR description.
- Comments explain *why*. A lot of decisions here look arbitrary without their
  rationale.

## Things we'd love help with

- Bank coverage for Rust, Java, Ruby, Swift, C#
- Making `--deep` faster than its current ~3 minutes
- Unit tests around `diff.ts` and `adaptive.ts`
- The VS Code / Cursor extension
