# Product Hunt launch kit

Everything below is ready to paste. Fields are in the order Product Hunt asks
for them.

**Post at 12:01am PT.** The leaderboard runs on a Pacific-time day, so anything
posted later is competing with a head start it cannot recover. Second best is
any time before 6am PT.

---

## Name

```
PopPR
```

## Tagline

60 characters max. This one is 58.

```
Does the contributor who opened this PR understand it?
```

Backups, if you want a more literal one:

```
A pop quiz on the pull request you just shipped
```
```
Check the author, not just the code, on every PR
```

## Description

260 characters max. This is 249.

```
Tests check the code. Linters check the style. Nothing checks the author. PopPR asks whoever opened the PR multiple-choice questions about the lines they changed, and posts whether they got them right. One command to add to any repo.
```

## Topics

Pick 3. In priority order:

```
Developer Tools
GitHub
Open Source
```

Alternates if any of those are unavailable: Productivity, Education, Artificial Intelligence.

## Links

- **Website:** https://github.com/QuokkaPride/PopPR
- **Try it:** https://quokkapride.github.io/PopPR/
- **npm:** https://www.npmjs.com/package/@quokkapride/poppr

---

## First comment

Post this yourself the minute the launch goes live. Most visitors read the maker
comment before anything else, so it carries more weight than the description.

```
Hi Product Hunt 👋

I built PopPR after a specific bad afternoon. I reviewed a pull request, asked about one of the lines, and got an answer that made it obvious the contributor had not read it either. An agent wrote it, they shipped it, and neither of us understood it.

That is not a rare story any more, and nothing in CI catches it. Tests check the code. Linters check the style. Nothing checks the author.

PopPR asks them. It reads the diff, finds the concepts the changed lines exercise, and serves multiple-choice questions about those lines on a three-minute clock. The PR comment shows which concept came from which line, so a reviewer can agree or disagree without opening a file.

Two decisions the whole thing rests on, which I would rather state than have found:

**It publishes completion, never a score.** Maintainers can require a poppr/certified check before merge, but you cannot fail it. Wrong answers come back, untimed, until they are right, and how many tries it took stays private. A tool that publishes "this contributor scored 3/10" is a tool contributors route around, and a three-minute quiz is not a hiring bar.

**The questions are the whole product, so I measure them like it.** Multiple choice rots when anything other than the content predicts the right answer. Mine did, three times. The first version had the correct answer as the longest option in 81% of questions. Fixing that overcorrected until it was the shortest 48% of the time. Fixing THAT produced a signature phrase that appeared in five correct answers and zero distractors.

So the build now fails on the only question that matters: what would someone score if they never read the question at all? Chance is 25%. It sits at 26%.

Coverage is measured the same way. 487 merged PRs from 28 repos that were never used to write a single rule: 60% of PRs containing code match at least one concept. The rest get general engineering questions rather than an empty screen.

Free, MIT, no account, no API key. `npx @quokkapride/poppr --local` quizzes your current branch in about 50 milliseconds. `npx @quokkapride/poppr init` adds it to a repo.

Tell me where the questions are wrong. That is the part I can only get from other people's code.
```

---

## Gallery

Product Hunt shows the first image everywhere, so it carries the whole pitch.

1. **`demo/poppr.gif`** (already in the repo). A real run: question, answer, review screen.
2. **The PR comment.** Screenshot a real one showing the concept-to-line table. This is the maintainer's "oh, I see" moment and it is the one asset that is missing.
3. **The certify check.** Screenshot `poppr/certified` green in the checks list on a PR.
4. **`poppr --stats`.** The concept mastery bars over time.
5. **The audit output.** `npm test` showing the blind-strategy number. This is the credibility shot for a technical audience.

To capture 2 and 3, open any merged PR on the repo that has a PopPR comment on it and screenshot at 2x.

---

## Answers to the questions you will get

**"Can't people just paste the question into ChatGPT?"**
Yes, and the timed run is not the point. The gate publishes that someone worked through every question about their own diff, which is the engagement that was missing. If someone routes a three-minute quiz about their own PR through a model to avoid reading it, you have learned something useful about that contributor.

**"Isn't this condescending to contributors?"**
It is off by default and reports rather than blocks. When a maintainer does turn the gate on, nobody can fail it and no score is published. Compare that to the alternative, where a maintainer decides on their own that your PR is not worth the review time and never tells you.

**"Does it work on my language?"**
JS/TS, React, Python, Go, Rust, Java, Ruby, C/C++ and SQL today, with measured per-language numbers in the README. Anything else gets the general engineering questions rather than nothing.

**"Does it see my code?"**
Quick mode is regex over your diff and runs offline. Smart and deep modes send the diff to whichever backend you already pay for. The Action never checks out or executes PR code at all.

**"What about false positives?"**
Real, and the comment shows the line that triggered each concept so you can disagree with it in one glance. `--smart` spends one model call filtering them.

---

## Launch-day checklist

- [ ] Publish npm 0.3.0 and push the git tag first, so the links work
- [ ] Screenshot the PR comment and the green certify check
- [ ] Schedule the post for 12:01am PT
- [ ] Post the maker comment within a minute of going live
- [ ] Post the LinkedIn version (see `LINKEDIN.md`) at 8am your time
- [ ] Reply to every comment within the first four hours, which is when ranking is decided
- [ ] Do not ask for upvotes anywhere. It is against the rules and it is detectable
