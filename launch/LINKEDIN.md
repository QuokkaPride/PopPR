# LinkedIn

Post Tuesday to Thursday morning. Keep the link out of the body, because
LinkedIn buries posts that carry one, and put it in the first comment instead.
Attach `demo/poppr.gif`.

Only the first two lines show before "see more". They decide everything.

---

## 1. Main post

```
I have shipped code I could not explain.
Claude Code gave me the speed. My learning paid for it.

You have probably done the same.

I wrote PopPR to close my own gap. It reads your diff, works out which engineering concepts your change leans on, and asks you 8 to 20 multiple-choice questions about those exact lines. Three minutes on a clock.

It runs on your machine and nothing leaves your laptop. No account, no API key.

You can also put it on a repo and require a passing quiz before anything merges. Wrong answers come back untimed until you get them right, and I never publish a score.

Understand your own AI slop. Free and MIT.

npx @quokkapride/poppr

Has your learning kept up with your shipping this year?
```

718 characters.

---

## 2. The short one

For when you want this out in thirty seconds.

```
I have shipped code I could not explain.
Claude Code gave me the speed. My learning paid for it.

I wrote PopPR to close my own gap. It reads your diff and asks you about the engineering concepts in it. Three minutes, on your machine, no account.

npx @quokkapride/poppr

Free and MIT, link in the comments.

Has your learning kept up with your shipping?
```

354 characters.

---

## 3. The manager one

**Optional, and read this first.** It names your reporting line and says in
public that you ship code you cannot always explain. Your manager will read it.
Post it only if you are happy with both details sitting on your profile in a
year.

```
For four years nobody reviewed my code. Now my manager reads every PR I open.

Best thing to happen to my work. Also the fastest way to find out how much I ship that I cannot explain.

Claude Code gave me the speed. My learning paid for it. I want to be able to explain everything I ship, so I wrote PopPR.

It reads your diff, works out which engineering concepts your change leans on, and asks you about those exact lines. Three minutes, on your machine, no account.

Understand your own AI slop. Free and MIT.

npx @quokkapride/poppr

Who reads your pull requests, and has that changed what you ship?
```

603 characters.

---

## First comment

Post it within a minute of going live. Works with any of the three.

```
Run it on the branch you are on right now: npx @quokkapride/poppr

Repo, docs, and a browser version you can play without installing anything: https://github.com/QuokkaPride/PopPR
```

## Hashtags

On their own line at the end of the post.

```
#DeveloperTools #CodeReview #AI #OpenSource
```

---

## Three replies to have ready

**"Why not just ask Claude to explain the code back to you?"**

```
Because the answer arrives before you have tried to produce one, and reading an explanation feels like knowing. PopPR makes you commit to one of four options first. The three wrong ones are misconceptions people hold, and the review screen names the one you fell for and shows the line of yours that triggered the question.
```

**"Does it know my stack?"**

```
Nine languages so far. The honest limit: I measured it on 487 merged PRs from 28 repos that never fed a single rule, and 6 in 10 of the PRs with code in them matched a concept. The rest get general engineering questions. Tell me what you write and it moves up the list.
```

**"Sounds like another hoop for contributors."**

```
Fair worry, and it is the thing I was most careful about. The default is a CLI you run on yourself, with no account and no server. The repo check is opt in for a maintainer, wrong answers come back untimed until they are right, and I never publish a score. It reports that the author engaged with their own diff. That is all it reports.
```

---

## If someone asks about the questions themselves

Worth having ready. It is the part of this I would defend longest, and it does
not fit in the post.

```
I caught my own question bank cheating three times. The first version had the correct answer as the longest option in 81% of questions, written by me, the day after I wrote the rule against doing that. Fixing it overcorrected until the correct answer was the shortest 48% of the time. Fixing that produced a phrase that showed up in five correct answers and zero wrong ones.

So the build now measures what someone scores if they never read the question at all. Chance is 25%. It was 45%. It is now 24%.
```
