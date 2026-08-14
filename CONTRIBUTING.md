# Contributing to PopPR

The question bank is the easiest place to start, and one good question benefits
everyone who runs PopPR.

```bash
git clone https://github.com/QuokkaPride/PopPR.git
cd PopPR
npm install
npm test
node dist/cli/index.js --local   # try it on your own branch
```

`npm link` makes `poppr` available everywhere and runs your working copy rather
than the published one, which is what you want while developing.

Note that `npx @quokkapride/poppr` fails inside this repo with
`sh: poppr: command not found`. That is npx, not a broken package: this
directory declares the same package name, so npx resolves it locally and looks
for a bin in `node_modules/.bin` that a package never links for itself. It works
fine in any other directory.

## Adding questions

1. **Make the concept detectable.** `src/core/concepts.ts` maps a regex to a
   concept slug. Add a rule if yours is missing. Patterns match added lines
   only, and loose patterns are fine, since `--smart` filters false positives.

2. **Add the entries** to the right file in `src/bank/`. Three per concept:
   one easy, one medium, one hard, each probing a different facet.

3. **Run `npm test`.**

## The rule that matters

Multiple choice rots in a predictable way. Whoever writes the questions makes
the correct answer longer and more specific than the distractors, and players
learn to pick the wordiest option without reading any code. The quiz still looks
fine. It stops measuring anything.

The first hand-written version of this bank failed that way in **81%** of
questions, so it is a build gate rather than a guideline:

```
  correct-is-longest  2%   (limit 35%, random baseline 25%)
  length ratio        0.92   (limit 1.1)
```

**Write your three distractors first, at full specificity. Then write the
correct answer to match their length.**

Every wrong option should be a real misconception someone holds, and
`whyTempting` should name it in one sentence. That field is what the review
screen shows after a miss, and it is usually the most valuable line there.

## What makes a good question

Good, because it tests something that bites in production:

> A customer reports that when Stripe times out, the Adyen charge still goes
> through. Why?

Bad, because it is syntax recall with no consequence:

> What does `Promise.all` return?

Also bad: three rephrasings of one idea across the difficulty tiers.

## Code

- ESM only, Node 18+, TypeScript strict.
- `src/core/` stays free of terminal concerns. The VS Code extension imports it
  directly, so anything writing to stdout belongs in `src/cli/`.
- Two runtime dependencies. Adding a third needs a reason in the PR description.
- Comments explain *why*. A lot of decisions here look arbitrary without their
  rationale.

## Where help is most welcome

- Bank coverage for Rust, Java, Ruby, Swift, C#
- Making `--deep` faster than its current ~3 minutes
- Unit tests around `diff.ts` and `adaptive.ts`
- The VS Code / Cursor extension
