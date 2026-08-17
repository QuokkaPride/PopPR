# Show HN

Hacker News is the highest-value and least forgiving channel here. The audience
is exactly your buyer, and it punishes marketing language harder than anywhere
else.

**Post 9 to 11am ET, Tuesday to Thursday.** Then leave it alone. Do not ask
anyone to upvote, do not post the link in a group chat, and stay out of your own
thread for the first ten minutes.

## Title

Show HN titles cannot be a pitch. State what it is.

```
Show HN: PopPR, a quiz for pull request authors on their own diff
```

Backups:

```
Show HN: A GitHub Action that checks whether the PR author understands the PR
```
```
Show HN: I measured my own quiz bank and found it was cheating three ways
```

That third one is a different post: it leads with the measurement story rather
than the tool. It is the one most likely to reach the front page and the least
likely to convert. Use it only if you care more about the discussion than the
signups.

## URL

```
https://github.com/QuokkaPride/PopPR
```

## Text

```
I reviewed a PR, asked about one of the lines, and got an answer that made it clear the contributor had not read it either. An agent wrote it, they shipped it, and neither of us understood it.

Nothing in CI catches that. Tests check the code, linters check the style, nothing checks the author.

PopPR reads a diff, works out which concepts the added lines exercise, and serves multiple-choice questions about those lines. The PR comment shows which line triggered which concept, so a reviewer can disagree with the detection in one glance. Quick mode is regex plus a curated bank: no key, no network, about 50ms. Optional modes hand the diff to Claude Code or your own key if you want questions written for your specific code.

Two things I would rather state than have found:

It publishes completion, never a score. A maintainer can require a poppr/quiz-passed check before merge, but nobody can fail it: wrong answers come back untimed until they are right, and the attempt count is never published. A three-minute multiple-choice run measures test-taking under time pressure rather than engineering, and a model beats it without effort. A score threshold would filter honest contributors and pass dishonest ones, which is inverted selection. So there is no threshold.

The bank is the product, so the build gates on it. Multiple choice rots when anything other than content predicts the answer, and mine rotted three times. Correct-is-longest at 81%, written by me the day after I wrote the rule against it. Then correct-is-shortest at 48% after I overcorrected, while the metric I was reporting still read a healthy 3%. Then a signature phrase in five correct answers and zero distractors. The check is now general rather than three specific bans: learn which surface features correlate with correct answers, apply them blind, and see what that scores. Chance is 25%, it scored 45%, and it now scores 24%.

The trap worth sharing: "never the longest and never the shortest" makes both numbers read 0%, which looks perfect and makes "drop both extremes and guess between the survivors" worth 56%. Every threshold needs a floor as well as a ceiling.

Coverage is measured on 487 merged PRs from 28 repos that were never used to write a rule: 60% of PRs containing code match at least one concept, per-language numbers in the README. The remaining 40% are one guard or one renamed field, and get general engineering questions instead of an empty screen. A PR with no code gets nothing on purpose.

MIT. npx @quokkapride/poppr --local quizzes your current branch.

The thing I cannot get on my own is where the questions are wrong on code I have never seen. I would take that over stars.
```

## Rules that get Show HN posts killed

- Any upvote request anywhere, including private messages. It is detectable and
  the penalty is the post.
- Editing the title after posting.
- Replying defensively. The correct reply to "this is condescending to
  contributors" is that it is off by default, cannot be failed, and publishes no
  score. Then ask what would make it useful.
- Marketing adjectives. "Powerful", "seamless" and "revolutionary" read as noise
  here and cost you the room.

## The comment you will get

**"This is just a quiz, a model can pass it."**

```
Correct, and that is why there is no failing threshold. A model can pass a three-minute multiple-choice run, so gating on a score would filter the honest contributors and pass the dishonest ones. What the gate publishes is that someone worked through every question about their own diff, untimed, until each one was right. If a contributor routes that through a model to avoid reading their own patch, you have learned something worth knowing about that contributor.
```

**"Regex-based concept detection will be full of false positives."**

```
It is, which is why the PR comment shows the exact added line that triggered each concept instead of just the concept name. You can disagree with it in one glance. --smart spends a single model call filtering the list, and I kept the regexes loose on purpose because a missed concept is invisible and a wrong one is obvious.
```
