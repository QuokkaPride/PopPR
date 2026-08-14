# PopPR

[![npm](https://img.shields.io/npm/v/@quokkapride/poppr)](https://www.npmjs.com/package/@quokkapride/poppr)
[![license](https://img.shields.io/npm/l/@quokkapride/poppr)](LICENSE)

**Pop quiz for the pull request you just shipped.**

Your agent wrote most of it. Tomorrow someone asks you what it does.

```bash
npx @quokkapride/poppr
```

Multiple choice on a three-minute clock, then a review screen showing what you missed.

![PopPR in action](https://raw.githubusercontent.com/QuokkaPride/PopPR/main/demo/poppr.gif)

## Why

AI writes the code, PRs get bigger, and your grasp of them gets thinner. You find out in review, when someone asks a question you can't answer.

PopPR runs after you ship. It gates nothing and blocks nothing. Getting the PR out is the goal; understanding it is what you do in the five minutes after.

## Install

```bash
npx @quokkapride/poppr        # no install
npm i -g @quokkapride/poppr   # or keep it, then run `poppr`
```

No account, no API key, no config. Quick mode runs offline.

## Three modes

| | asks about | speed | needs AI |
|---|---|---|---|
| `poppr` | the concepts your diff touches | 50ms | no |
| `poppr --smart` | the concepts that matter here | 12s | yes |
| `poppr --deep` | your specific code, written fresh | ~3min | yes |

**Quick** scans your added lines for `Promise.all`, a query inside a loop, a nullable column in a filter, a cache with no eviction, then serves hand-written questions on those concepts. Curated beats generated, and it runs offline in 50ms.

**Smart** spends one model call deciding which concepts matter in this change, then serves the same curated bank. Regex tells you `Promise.all` appears; smart mode tells you whether concurrency is a risk here. On the test repo it dropped two false positives the regex flagged and caught the unbounded `Map` the regex scored but couldn't weigh.

**Deep** has a model write questions about your code: who calls the function you changed, what breaks if this line goes, why this approach over the obvious one. Slowest, and the only mode that names your variables.

## Where the AI comes from

PopPR ships no inference. It borrows compute you already pay for, in this order:

1. **Claude Code**, if `claude` is on your PATH. Costs nothing beyond your subscription.
2. **Cursor**, via `cursor-agent`.
3. **Your own key**: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`.
4. **A local model**, via `OLLAMA_HOST`.

Quick mode needs none of them.

## Picking a PR

With no arguments, `poppr` finds the PR on your current branch through the GitHub CLI, falling back to your most recent PR in the repo.

```bash
poppr                  # your latest PR
poppr 142              # a specific PR
poppr --local          # current branch vs its base, no GitHub needed
poppr --local --base develop
```

## Scoring

Hard questions pay 3.5x easy ones, speed multiplies up to 1.6x, and a streak multiplies up to 2x. Speed alone would push you toward easy questions and recognition-level thinking, so the winning strategy is answering hard questions fast.

Difficulty adapts as you go: two right steps up, one wrong steps down. It settles near 85% accuracy, where learning is fastest (Wilson et al., 2019). It is not trying to let you ace it.

Explanations wait for the review screen. Reading a paragraph while your clock ticks kills the flow the game just built, so a run gives you a ✓ or ✗ and nothing else.

## Progress

```bash
poppr --stats
```

```
  PopPR  23 runs  ·  🔥 12 day streak

  async/concurrency      ↑  79%  ▏███████████████   14 seen
  retry-backoff          ↑  72%  ▏██████████████     9 seen
  sql-null               ·  58%  ▏███████████        6 seen
```

Every question carries a transferable concept tag, so your history shows what you are getting better at. Miss a concept and it comes back days later against a different PR. Spaced repetition is what makes it stick.

History lives in `~/.poppr/history.json`. Nothing leaves your machine.

## Sharing

```
PopPR #142 · 4/6 · 0:52 · 🔥12
🟩🟥🟩🟩🟥🟩
weakest: retry-backoff
```

No code, no filenames, no repo name. Safe to paste in a work Slack.

## Contributing

The question bank is the easiest place to start, and one good question benefits everyone who runs PopPR. Full guide in [CONTRIBUTING.md](CONTRIBUTING.md).

One rule governs it. Multiple choice rots when the correct answer is longer and more specific than the distractors, because players learn to pick the wordiest option without reading any code. The first hand-written version of this bank failed that way in 81% of questions, so `npm test` enforces the fix:

```
  correct-is-longest  3%   (limit 35%, random baseline 25%)
  length ratio        0.92   (limit 1.1)
  letter spread       A 22%  B 26%  C 22%  D 30%

  ✓ bank is healthy
```

Write your three distractors first, at full specificity, then write the correct answer to match their length.

## Roadmap

- **GitHub Action.** Your score posts on the PR where the reviewer sees it, so "yes, I read what I shipped" stops being an assumption. It reports; it does not block the merge.
- **VS Code / Cursor extension**, using the Copilot Language Model API so smart and deep modes need no key.
- **Claude Code plugin** (`/quiz-me`).
- **Bank coverage** for Rust, Java, Ruby, Swift.

## License

MIT
