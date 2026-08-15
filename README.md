<img src="https://raw.githubusercontent.com/QuokkaPride/PopPR/main/assets/poppr_icon.png" alt="PopPR" width="120">

# PopPR

[![npm](https://img.shields.io/npm/v/@quokkapride/poppr)](https://www.npmjs.com/package/@quokkapride/poppr)
[![license](https://img.shields.io/npm/l/@quokkapride/poppr)](LICENSE)

### Understand your own AI slop.

You shipped it, but can you explain it?

PopPR quizzes you on the engineering concepts in your PR. Three minutes, multiple choice, generated on your machine from your diff.

```bash
npx @quokkapride/poppr
```

![PopPR in action](https://raw.githubusercontent.com/QuokkaPride/PopPR/main/demo/poppr.gif)

## What it actually does

1. **Reads your diff.** Your open PR, or your local branch.
2. **Identifies the core engineering concepts in it.** 108 of them, across 9 languages.
3. **Asks you about those exact lines.** 8 to 20 multiple-choice questions on a 3-minute clock.
4. **Shows you what you missed**, and which line of yours triggered each question.

No account, no API key, no signup. Starts in about 50 milliseconds.

## Your code never leaves your machine

**There is no PopPR server.** Nothing to send your code to, because there is nowhere to send it.

The default mode is a regex pass over your own diff plus a question bank bundled in the package. It works on a plane. Your history sits in `~/.poppr/history.json`.

`--deep` is the one exception, and it uses the AI you already pay for: Claude Code, Cursor, your own API key, or a local Ollama model. Your account, your choice, no middleman.

The GitHub Action runs inside your CI and reads the diff through the GitHub API. It never checks out or executes PR code, which is what makes it safe on forks and what makes it work on repos that are not Node at all.

## Put it on your team's repo

```bash
npx @quokkapride/poppr init            # comments on every PR
npx @quokkapride/poppr init --require  # adds a poppr/quiz-passed check
```

Both write `.github/workflows/poppr.yml`. Commit it and it runs.

**`--require` does not block merges on its own.** It posts a check that stays pending until the author has answered every question about their diff correctly. To make GitHub enforce it: open one PR so the check runs once, then go to **Settings → Branches → Require status checks to pass** and add `poppr/quiz-passed`. ([GitHub's guide](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging))

The check has two states. Green means the author worked through every question, and a comment on the PR says so. Wrong answers come back untimed until they are right, and PopPR publishes no score. A docs-only PR goes green on its own, and a new push resets the check to pending.

## Two modes

| | questions | needs AI |
|---|---|---|
| `poppr` | 328 questions, matched to the concepts in your diff | no |
| `poppr --deep` | those, plus questions written about your exact code | yes |

`--deep` starts instantly on those questions and streams the written-for-you ones in as the model produces them: who calls the function you changed, what breaks if this line goes, why this approach over the obvious one.

## Commands

```bash
poppr                  # your latest PR
poppr 142              # a specific PR
poppr --local          # your current branch, no GitHub needed
poppr --deep           # add AI-written questions about your code
poppr --detect         # what would it ask? no game, no clock
poppr practice         # drill your weak concepts, no PR involved
poppr --stats          # what you are getting better at
```

## Options

```yaml
- uses: QuokkaPride/PopPR@v1
  with:
    certify: true      # require a passing quiz, report poppr/quiz-passed. default false
    questions: 10      # how many questions that quiz holds. default 10
    time: 180          # seconds on the timed first pass. default 180
```

Your workflow needs `pull-requests: write`, plus `statuses: write` when the quiz is required. `init` writes both.

## It gets to know you

Every question carries a concept tag, so your history shows what you are getting better at.

```
  PopPR  23 runs  ·  🔥 12 day streak

  async/concurrency      ↑  79%  ▏███████████████   14 seen
  retry-backoff          ↑  72%  ▏██████████████     9 seen
  sql-null               ·  58%  ▏███████████        6 seen
```

Miss a concept and it comes back days later, on a different PR that happens to use it. Difficulty adapts as you go, so it stays hard enough to be worth playing.

## Sharing

```
PopPR #142 · 4/6 · 0:52 · 🔥12
🟩🟥🟩🟩🟥🟩
weakest: retry-backoff
```

No code, no filenames, no repo name.

## More

- [How it works](docs/HOW-IT-WORKS.md): the coverage measurement, the anti-cheating audit, and exactly what the required check does.
- [Contributing](CONTRIBUTING.md): the question bank is the easiest place to start, and one good question benefits everyone who runs PopPR.

Languages: JS/TS, React, Python, Go, Rust, Java, Ruby, C/C++, SQL. Anything else gets general engineering questions rather than an empty screen.

## License

MIT
