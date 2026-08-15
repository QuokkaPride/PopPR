# LinkedIn kit

Everything for one LinkedIn launch. Pick a post, edit it, paste it.

## How to post it

1. **Pick one post** from the three below. They are alternatives, not a sequence.
2. **No link in the body.** LinkedIn suppresses reach on posts with an outbound
   link. Put it in the first comment and say you have.
3. **Attach one image.** `demo/poppr.gif` or `launch/assets/hosted-brief.png`.
   A post with media gets meaningfully more reach than plain text.
4. **Post Tuesday to Thursday, 8 to 10am** in your audience's timezone.
5. **Reply to every comment in the first two hours.** LinkedIn weights early
   engagement heavily, and replies count.
6. **Do not edit the post for the first hour.** Editing resets distribution.

## Numbers you are quoting, so they are right

All measured, all reproducible from the repo:

- 328 questions, 108 concepts, 8 languages
- 487 held-out merged PRs from 28 repos, none used to write a rule
- 60% of code PRs match at least one concept
- Correct-is-longest was 81% in the first version
- Correct-is-shortest hit 48% after the first fix
- A blind player scored 45%, now scores 24%, chance is 25%
- `--deep` time to first question: 228 seconds, now about 2

---

# Post 1: the origin story

Longest and most personal. Best if your audience is mixed and you want the
"why" to carry it. This is the one I would post.

```
I reviewed a pull request last month, asked a question about one of the lines, and realised the person who opened it did not know the answer either.

An agent wrote it. They shipped it. Neither of us understood it.

That is not a rare story any more. And nothing in CI catches it:

Tests check the code.
Linters check the style.
Nothing checks the author.

So I built PopPR. It reads a pull request, works out which concepts the changed lines exercise, and asks the person who opened it multiple-choice questions about their own diff. Three minutes. The result posts on the PR, where the reviewer already is.

Two decisions I want to be honest about, because the whole thing rests on them:

It publishes completion, never a score. Maintainers can require it before merge, but nobody can fail it. Wrong answers come back, untimed, until they are right, and how many attempts it took stays private. A tool that publishes "this contributor got 3 out of 10" is a tool contributors route around.

And the questions get measured harder than anything else in the project. Multiple choice rots in a specific way: whoever writes it makes the correct answer longer and more specific, and readers learn to pick the wordiest option without reading any code.

Mine did exactly that. 81% of questions had the correct answer as the longest option, written by me, the day after I wrote the rule against doing it.

Fixing it overcorrected: correct-is-shortest hit 48% while the first number read a healthy 3%.

Fixing that produced a third version I did not see coming, where one phrase appeared in five correct answers and zero wrong ones.

So the build now fails on the only question that matters: what would someone score if they never read the question at all?

Chance is 25%. It scores 24%.

Free, MIT, no account, no API key. One command adds it to a repo.

If you maintain something that takes outside contributions, I would like to know whether this helps or gets in the way.
```

---

# Post 2: the short one

Reads in eight seconds. Best if your feed is busy or you want maximum shares.

```
Tests check the code.
Linters check the style.
Nothing checks the author.

More of every pull request is written by an agent now, and a diff no longer tells you whether the person who sent it can explain it. You find out in review, three round trips in, on a patch that would have been faster to write yourself.

So I built the missing check. PopPR asks whoever opened the PR multiple-choice questions about the lines they changed, and posts the result where you review.

Three minutes. Nobody can fail it, and no score is ever published: what gets posted is that someone worked through every question about their own diff.

Free, MIT, one command.

Does this solve a problem you have, or create one?
```

---

# Post 3: the engineering one

Travels on the measurement finding rather than the product. Best for a
developer-heavy following, and the most likely to be shared by people who will
never use the tool.

```
I built a quiz tool, then caught my own question bank cheating. Three times.

The failure mode of multiple choice is well known: whoever writes the questions makes the correct answer longer and more specific than the wrong ones, and readers learn to pick the wordiest option without reading anything.

I knew that. I wrote the rule against it. Then I measured my own bank: the correct answer was the longest option in 81% of questions.

Fixed it. Measured again, in the other direction this time. Correct-is-shortest: 48%. "Pick the shortest" had become the winning strategy while the metric I was reporting said a healthy 3%.

Fixed that. And produced a third leak, because lengthening correct answers made me reach for the same construction every time. One phrase appeared in five correct answers and zero distractors. A perfect predictor, in a bank that passed both length checks.

The lesson is about gates rather than length. A gate written after a specific bug catches that bug, and the next one will be something nobody thought of. So the check is now general: learn what surface features correlate with correct answers, apply them blind, and see what that scores.

Chance is 25%. It scored 45%. After the fix, 24%.

One more thing worth stating out loud, because it cost me a day. The obvious guard is "the correct answer must never be the longest or the shortest." Apply that and both numbers read 0%, which looks perfect and means "drop both extremes and guess between the two survivors" is worth 56%.

Every threshold needs a floor as well as a ceiling. Being reliably un-extreme is as strong a tell as being reliably extreme.

The tool is PopPR, it is free and MIT, and the audit is the part I am most confident about.
```

---

# First comment

Post this yourself, seconds after the post goes live. Same for all three.

```
Link, since LinkedIn buries posts that have one in the body: https://github.com/QuokkaPride/PopPR

Try it on your own current branch, no install:
npx @quokkapride/poppr --local
```

---

# Hashtags

Put them at the end of the post body, not in the comment. Three to five is the
sweet spot; more looks like spam.

```
#opensource #developertools #codereview #softwareengineering
```

Swap `#softwareengineering` for `#engineeringmanagement` if your audience is
leads rather than ICs.

---

# Replies, ready to go

You will get these. Having the answer ready is what keeps you in the thread for
the two hours that matter.

**"Can't they just paste it into ChatGPT?"**

```
Yes, and the timed run is not the point. What the gate publishes is that someone worked through every question about their own diff, untimed, until each one was right. If a contributor routes a three-minute quiz about their own patch through a model to avoid reading it, you have learned something worth knowing about that contributor.
```

**"This is condescending to contributors."**

```
Fair worry, and it is why it is off by default and reports rather than blocks. When a maintainer does turn the gate on, nobody can fail it and no score is published. The alternative most maintainers use today is deciding on their own that a PR is not worth the review time, and never telling the author.
```

**"Does this actually measure understanding?"**

```
It measures whether someone can answer questions about the lines they changed, which is narrower than understanding and a lot better than nothing. The honest limit is that a three-minute multiple-choice run measures test-taking under time pressure, not engineering. That is exactly why there is no failing threshold and no published score.
```

**A senior engineer pushes back on the whole premise:**

```
The honest limit is that a three-minute multiple-choice run measures test-taking under time pressure, not engineering. A model can beat it, so a score gate would filter honest contributors and pass dishonest ones. That is inverted selection, which is why there is no threshold.

What it does buy: the contributor has to have engaged with their own diff, and the maintainer gets to see which concepts the change touches, line by line, before they start reading.
```

**"What languages?"**

```
JS/TS, React, Python, Go, Rust, Java, Ruby, C/C++ and SQL. Measured on 487 merged PRs from 28 repos that were never used to write a rule: 60% of PRs containing code match at least one concept. The rest get general engineering questions rather than an empty screen.
```

**"Nice, how do I try it?"**

```
npx @quokkapride/poppr --local

Quizzes your current branch. No install, no key, about 50ms. If you want it on a repo, npx @quokkapride/poppr init writes the workflow.
```

---

# Follow-up post, three to five days later

Only post this if the first one got engagement. It builds on the same audience
rather than repeating the pitch.

```
Follow-up to last week's post about quizzing pull request authors on their own diffs.

The most useful thing that came out of it was not signups. It was people telling me where the questions were wrong on code I have never seen.

[Replace with what you learned. One concrete example beats a summary.]

Two things I would do differently if I were starting again:

Measure the thing you are afraid of before you build the fix. I wrote the rule against making the correct answer the longest option, then wrote 145 questions, then measured and found I had done it 81% of the time. The rule in my head did nothing. The build gate did.

And measure on data you did not design against. Every detection rule I wrote scored 15 to 20 points higher on the repos I built it from than on repos it had never seen. Every one. If you are quoting a number from your own test set, it is optimistic and you know by roughly how much.

https://github.com/QuokkaPride/PopPR
```

---

# If you want to update your profile too

**Headline:** add `Building PopPR` if you want inbound from this post.

**Featured section:** pin the launch post after it settles. It keeps working for
months, which a feed post does not.
