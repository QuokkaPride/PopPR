# PopPR

**Pop quiz for your pull request. Don't merge what you can't explain.**

You shipped the PR. Your agent wrote most of it. Now your boss is going to ask what it does.

```bash
npx poppr
```

60 seconds, multiple choice, on a clock. Then it tells you what you didn't know.

![PopPR in action](https://raw.githubusercontent.com/QuokkaPride/PopPR/main/demo/poppr.gif)

---

## Why

AI writes most of the code now, and it writes a lot of it. PRs got bigger and comprehension got thinner. The gap doesn't show up until someone asks you a question in review and you find out you can't answer it.

PopPR runs **after** you ship, not before. It isn't a gate and it doesn't block anything — getting the PR out is the goal, and learning it is what you do in the five minutes after.

## Install

```bash
npx poppr           # no install needed
npm i -g poppr      # or keep it around
```

No account. No API key. No config file. Quick mode works offline.

## Three modes

| | what it asks | speed | needs AI |
|---|---|---|---|
| `poppr` | the concepts your diff uses | **instant** | no |
| `poppr --smart` | the concepts that actually *matter* here | ~10s | yes |
| `poppr --deep` | your specific code, written fresh for this PR | ~60s | yes |

**Quick** detects which language and systems primitives your added lines exercise — `Promise.all`, a query in a loop, a nullable column in a filter, a cache with no eviction — and serves hand-written questions about those. The questions are curated rather than generated, so they're sharper than anything a model writes on the fly, and it all happens in about 50 milliseconds with no network.

**Smart** spends one small model call deciding which concepts genuinely matter in this change, then serves the same curated questions. Pattern matching answers "does the text `Promise.all` appear?" when the question you want answered is "is concurrency a real risk here?". Smart mode drops the `.sort()` in your test fixture and catches the unbounded `Map` the regex scored but couldn't weigh.

**Deep** has a model write questions about your actual code — who calls the function you changed, what breaks if this line goes, why this approach over the obvious one. Slowest, and the only mode that can name your variables.

## Where the AI comes from

PopPR never ships inference. It borrows compute you already pay for, in this order:

1. **Claude Code** — if `claude` is on your PATH, it shells out to headless mode. Costs nothing beyond your existing subscription.
2. **Cursor** — same, via `cursor-agent`.
3. **Your own key** — `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`.
4. **A local model** — set `OLLAMA_HOST`.

Quick mode needs none of these.

## Where the PR comes from

`poppr` with no arguments finds the PR on your current branch via the GitHub CLI, falling back to your most recent PR in the repo.

```bash
poppr                  # your latest PR
poppr 142              # a specific PR
poppr --local          # the current branch vs its base, no GitHub needed
poppr --local --base develop
```

## Scoring

Hard questions are worth 3.5x easy ones, speed multiplies up to 1.6x, and consecutive correct answers multiply up to 2x. That combination is deliberate: pure speed optimisation would push you toward easy questions and recognition-level thinking, so the winning strategy has to be answering *hard* things fast.

Difficulty adapts as you go — two right steps up, one wrong steps down. It converges around 85% accuracy, which is roughly where learning is fastest (Wilson et al., 2019). It is not trying to let you ace it.

Explanations are held until the end. Reading a paragraph while your clock is running kills the flow the game just built, so during the run you get a ✓ or ✗ and nothing to read.

## Progress

```bash
poppr --stats
```

```
  POPPR  23 runs  ·  🔥 12 day streak

  async/concurrency      ↑  79%  ▏███████████████   14 seen
  retry-backoff          ↑  72%  ▏██████████████     9 seen
  sql-null               ·  58%  ▏███████████        6 seen
```

Every question is tagged with a transferable concept, so what accumulates is a picture of what you're actually getting better at. Concepts you miss come back days later against a **different** PR — spaced repetition is what makes it stick rather than something you clicked through once.

History lives in `~/.poppr/history.json`. Nothing leaves your machine.

## Sharing

```
PopPR #142 · 4/6 · 0:52 · 🔥12
🟩🟥🟩🟩🟥🟩
weakest: retry-backoff
```

No code, no filenames, no repo name — safe to paste in a work Slack.

## Contributing questions

The bank is the best part of this project and it's the easiest thing to contribute to. One good question benefits everyone who runs PopPR.

Questions live in `src/bank/` grouped by area. Add an entry, add a detection rule in `src/core/concepts.ts` if the concept is new, and run:

```bash
npm test
```

**One rule matters more than the rest.** Multiple choice rots in a specific way: whoever writes the questions makes the correct answer longer and more specific than the distractors, and readers learn to pick the wordiest option without reading anything. Good intentions don't prevent this — the first hand-written version of this bank failed at 81%. So it's enforced:

```
  poppr bank audit — 109 questions, 35 concepts

  correct-is-longest  2%   (limit 35%, random baseline 25%)
  length ratio        0.92   (limit 1.1)
  letter spread       A 22%  B 26%  C 27%  D 26%

  ✓ bank is healthy
```

Write your three distractors first, at full specificity, then write the correct answer to match their length. Every wrong option should be a real misconception someone holds, and `whyTempting` should name it — that field is what turns a wrong answer into a lesson.

## Roadmap

- VS Code / Cursor extension (free inference via the Copilot Language Model API, so no key at all)
- Claude Code plugin (`/quiz-me`)
- GitHub Action that posts your comprehension score on the PR
- More languages in the bank: Rust, Java, Ruby, Swift

## License

MIT
