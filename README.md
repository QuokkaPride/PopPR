<img src="https://raw.githubusercontent.com/QuokkaPride/PopPR/main/assets/poppr_icon.png" alt="PopPR" width="120">

# PopPR

[![npm](https://img.shields.io/npm/v/@quokkapride/poppr)](https://www.npmjs.com/package/@quokkapride/poppr)
[![license](https://img.shields.io/npm/l/@quokkapride/poppr)](LICENSE)

**Does the person who opened this PR understand it?**

PopPR asks them, on their own diff, and posts the answer where you review.

```bash
npx @quokkapride/poppr init
```

![PopPR in action](https://raw.githubusercontent.com/QuokkaPride/PopPR/main/demo/poppr.gif)

## The problem

More of every contribution is now written by an agent, and a diff no longer tells you whether the person who sent it can explain it. You find out in review, three round trips in, on a patch that would have been faster to write yourself.

Nothing in your CI answers this. Tests check the code. Linters check the style. Nothing checks the author.

PopPR asks the contributor multiple-choice questions about the lines they changed and reports whether they got them right. Questions with correct answers, about their own diff.

## Add it to your repo

```bash
npx @quokkapride/poppr init            # comments on every PR
npx @quokkapride/poppr init --certify  # and reports a poppr/certified check
```

That writes `.github/workflows/poppr.yml`. Commit it. There is nothing else to configure: no key, no account, no runner minutes beyond one `npx`.

**It never checks out or runs PR code.** The diff arrives as text through the API, which is what makes it safe on fork PRs and what makes it work on repos that are not Node at all.

## What your contributors see

A comment on the PR, naming the concept and the line that triggered it, so you can agree or disagree without opening a file:

> **PopPR** · this PR touches 4 concepts with 11 questions in the bank.
>
> | concept | your line |
> | --- | --- |
> | `go-error-value-pair` | `pkg/store/document.go:88`<br>`ts, err := obj.GetUpdatedTimestamp()` |
> | `go-map-zero-value` | `pkg/store/cache.go:31`<br>`availableCounters: make(map[PoolID]counterSets)` |
>
> [Play it](https://quokkapride.github.io/PopPR/) · 3 minutes, in your browser.

They play in the browser or the terminal. It takes three minutes.

## Making it required

`--certify` adds one thing: the contributor has to answer **every** question correctly before `poppr/certified` goes green. They cannot fail it. Wrong answers come back, untimed, until they are right.

To make it a real gate, add `poppr/certified` to your branch protection rules. That stays your decision, not something you inherit by turning a flag on.

**What gets published is completion, never a score.** Retake counts stay private. The point is that someone engaged with their own diff, and publishing how many tries it took would only make contributors avoid it.

## Options

Everything is optional.

```yaml
- uses: QuokkaPride/PopPR@v1
  with:
    certify: true      # ask for every answer, report poppr/certified. default false
    questions: 10      # how many the certify set holds. default 10
    time: 180          # seconds on the timed first pass. default 180
    token: ${{ secrets.GITHUB_TOKEN }}   # only if you want a named account
```

Your workflow needs `pull-requests: write`, plus `statuses: write` when certify is on. `init` writes both.

## Try it on yourself first

```bash
npx @quokkapride/poppr --local
```

Quizzes your current branch. No install, no key, no network, about 50ms to start.

```bash
poppr             # your latest PR
poppr 142         # a specific PR
poppr --detect    # what would it ask? no game, no clock
poppr practice    # drill your weak concepts, no PR involved
poppr --stats     # what you are getting better at
```

## The three modes

| | asks about | time to first question | needs AI |
|---|---|---|---|
| `poppr` | the concepts your diff touches | 50ms | no |
| `poppr --smart` | the concepts that matter here | 12s | yes |
| `poppr --deep` | your specific code, written fresh | 50ms | yes |

**Quick** scans your added lines for the primitives that bite in production, then serves hand-written questions on them. 328 questions across JS/TS, React, Python, Go, Rust, Java, Ruby, C/C++ and SQL. Offline, instant, and the default because a tool you have to configure before the first play is a tool nobody plays.

**Smart** spends one model call deciding which concepts matter in this change, then serves the same curated bank. Regex tells you `Promise.all` appears; smart mode tells you whether concurrency is a risk here.

**Deep** has a model write questions about your code: who calls the function you changed, what breaks if this line goes, why this approach over the obvious one. It starts on bank questions and the written-for-you ones stream in as they land, so it is quick mode that gets better while you play.

PopPR ships no inference. Smart and deep borrow compute you already pay for: Claude Code if `claude` is on your PATH, then `cursor-agent`, then `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY`, then a local model via `OLLAMA_HOST`.

## Does it fire on real PRs?

Measured on 487 merged PRs from 28 repos, none of which were used to write a single detection rule:

| language | code PRs matching a concept | language | code PRs matching a concept |
|---|---|---|---|
| TypeScript | 79% | Ruby | 54% |
| Rust | 69% | Java | 51% |
| Go | 66% | C/C++ | 47% |
| Python | 61% | **overall** | **60%** |

The other 40% are one guard, one renamed field, one new branch. Those get general engineering questions instead, so no PR with code in it comes back empty. A PR that adds no code at all gets nothing, on purpose.

## How the questions stay honest

Multiple choice rots when anything about the correct answer other than its content predicts it. Players find the pattern long before they notice they are using it, and the quiz keeps looking fine while it stops measuring anything.

So `npm test` measures what a player who never reads the question would score:

```
  poppr bank audit · 328 questions, 108 concepts

  correct-is-longest  23%   (limit 35%, floor 10%, chance 25%)
  correct-is-shortest 11%   (limit 35%, floor 10%)
  blind strategy      26%   (limit 37.5%, chance 25%)

  ✓ bank is healthy
```

That gate has caught this bank three times, each in a different disguise. Correct-is-longest at 81%. Then correct-is-shortest at 48%, after the first fix overcorrected. Then a signature phrase in five correct answers and no distractors. Note the floors: being reliably un-extreme is as strong a tell as being reliably extreme.

## Scoring and progress

Hard questions pay 3.5x, speed multiplies up to 1.6x, streaks up to 2x, so the winning strategy is answering hard questions fast. Difficulty adapts as you go and settles near 85% accuracy, where learning is fastest (Wilson et al., 2019).

Every question carries a transferable concept tag, so your history shows what you are getting better at. Miss one and it comes back days later against a different PR.

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

Write your three distractors first, at full specificity, then write the correct answer to match. Every wrong option should be a real misconception someone holds, and `whyTempting` should name it.

## Roadmap

- **VS Code / Cursor extension**, using the Copilot Language Model API so smart and deep modes need no key.
- **Claude Code plugin** (`/quiz-me`).
- **Bank coverage** for Swift, Kotlin, PHP and C#.
- **Private repos in the browser**, which today need the terminal.

## License

MIT
