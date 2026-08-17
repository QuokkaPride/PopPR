# Product Hunt

**Post at 12:01am PT.** The leaderboard runs on a Pacific day, so anything later
starts behind. Second best is before 6am PT.

---

## Name

```
PopPR
```

## Tagline

60 characters max. Lead with what it does, because that is the only line most
people read.

```
A 3-minute quiz on the PR you just shipped
```

41 characters. Backups:

```
Understand your own AI slop
```
```
Quiz yourself on the code your agent wrote
```

The slop one is funnier and it is the README hero. It also does not say what the
product does, which costs you installs on a page people scan. Use it if you want
the personality; use the first one if you want the downloads.

## Description

260 characters max. This is 248.

```
Claude Code made us all productive. It also slowed our learning. PopPR reads the diff of the PR you just opened, finds the engineering concepts in it, and quizzes you on those exact lines. 3 minutes, runs locally, no account. npx @quokkapride/poppr
```

The install command is in the description on purpose. Someone who never opens
the comments can still copy it.

## Topics

```
Developer Tools
GitHub
Open Source
```

## Links

- **Website:** https://github.com/QuokkaPride/PopPR
- **Try it:** https://quokkapride.github.io/PopPR/
- **npm:** https://www.npmjs.com/package/@quokkapride/poppr

---

## First comment

Post it within a minute of going live. Written to get a developer from reading
to installed in under thirty seconds, so the command comes early and the
argument comes after.

```
Hi Product Hunt 👋

Claude Code has made me far more productive. It has also slowed down my learning. I suspect a lot of you are in the same place: shipping more, understanding less of what you ship.

PopPR is a three-minute quiz on your own pull request. It reads the diff, finds the engineering concepts in it, and asks you about those exact lines.

Try it on whatever branch you are on right now:

npx @quokkapride/poppr

That is the whole setup. No account, no API key, no signup, and it starts in about 50 milliseconds. 328 hand-written questions across 9 languages. Nothing is sent to me, because there is no PopPR server.

If you already have Claude Code, Cursor or an API key, it also asks that model to write questions about your specific code, and those stream in while you are already playing. Without one it plays the same run at the same speed.

For teams: `npx @quokkapride/poppr init --require` adds a check to every PR. Nobody can fail it, wrong answers just come back until they are right, and no score is ever published.

Free and MIT. Tell me where the questions are wrong on your code, because that is the part I cannot test on my own.
```

**Reply to your own comment a few minutes later** with the credibility note. It
is the strongest thing about the project and it belongs below the install, not
above it.

```
One thing I am proud of, for anyone who has written a quiz before.

Multiple choice rots when anything other than the content predicts the answer. Mine rotted three times. The first version had the correct answer as the longest option in 81% of questions, written by me, the day after I wrote the rule against doing that. Fixing it overcorrected to 48% shortest. Fixing that produced a phrase that showed up in five correct answers and zero wrong ones.

So the build now measures what someone scores if they never read the question at all. Chance is 25%. It was 45%. It is now 24%, and CI fails if it drifts.
```

---

## Gallery

The first image carries the whole pitch.

1. `demo/poppr.gif` in the repo. A real run: question, answer, review screen.
2. `launch/assets/hosted-brief.png`. A real PR reading "30 concepts in this diff, 20 questions". Proof rather than a claim.
3. The PR comment showing the concept-to-line table. **Still to capture.**
4. `poppr/quiz-passed` green in a PR's checks list. **Still to capture.**
5. `launch/assets/audit-output.txt` rendered as a terminal image.

For 3 and 4, open the next PR on the repo and screenshot at 2x once the Action runs.

---

## Answers you will need

**"Can't people paste the question into ChatGPT?"**

```
Yes, and the timed run is not the point. What the check publishes is that someone worked through every question about their own diff, untimed, until each was right. If a contributor routes a three-minute quiz about their own patch through a model to avoid reading it, you have learned something about that contributor.
```

**"Is this condescending to contributors?"**

```
The default is a CLI you run on yourself. The repo check is opt in for a maintainer, nobody can fail it, and no score is published. The alternative most maintainers use today is deciding on their own that a PR is not worth the review time, and never telling the author.
```

**"Does it work on my language?"**

```
JS/TS, React, Python, Go, Rust, Java, Ruby, C/C++ and SQL. Measured on 487 merged PRs from 28 repos that never fed a single rule: 6 in 10 of the PRs with code in them match a concept. The rest get general engineering questions rather than an empty screen.
```

**"Does it see my code?"**

```
There is no PopPR server. The default run is regex over your diff plus a bundled question bank. If you have an AI backend it also writes questions about your code, using your own account and your own key. The GitHub Action never checks out or runs PR code at all.
```

---

## Launch day

- [ ] Publish the current version and confirm npm renders the README
- [ ] Screenshot the PR comment and the green check
- [ ] Schedule for 12:01am PT
- [ ] Maker comment within a minute of going live
- [ ] LinkedIn at 8am your time (see `LINKEDIN.md`)
- [ ] Reply to every comment in the first four hours, which is when ranking is decided
- [ ] Never ask for upvotes. It breaks the rules and it is detectable
