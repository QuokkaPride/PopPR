# Reddit

Two subreddits, two different posts. Posting the same text to both is
the fastest way to get removed from one and downvoted in the other.

**Post them on different days.** Cross-posting the same launch in one afternoon
reads as a campaign, which is what both subs filter for.

---

## r/opensource

Friendliest audience for this. They are the buyer, and the sub tolerates a maker
post that is about the problem rather than the product.

**Title**

```
Built a GitHub Action that quizzes PR authors on their own diff, because I could not tell who understood their contributions any more
```

**Body**

```
Maintainer problem I could not solve any other way, so I would like to know whether it is just me.

More of every contribution that arrives is agent-written now. That is fine, and often the code is fine. What is not fine is that a diff no longer tells me whether the person who sent it can explain it, and I find out three review round trips in, on a patch I could have written faster myself.

Nothing in CI answers this. Tests check the code. Linters check the style. Nothing checks the author.

So PopPR reads the diff, works out which concepts the added lines exercise, and asks the contributor multiple-choice questions about those lines. It posts a comment showing which line triggered which concept, so as a reviewer I can disagree with the detection in a glance and I know where to start reading.

The design decisions I would most like feedback on, because they are the ones I went back and forth on:

It reports by default and gates only if you opt in. Turning on certify makes the contributor answer every question correctly before a poppr/certified check goes green, and you have to add that check to branch protection yourself for it to block anything.

Nobody can fail it. Wrong answers come back untimed until they are right.

It publishes completion, never a score, and the number of attempts is never published. I went back and forth on this and landed here because publishing "this contributor scored 3/10" makes a tool contributors route around, and I would rather have engagement than a metric.

Free, MIT, no account, no API key, one command to add. It never checks out or runs PR code, which is what makes it safe on fork PRs.

Question for other maintainers: does this help, or is it one more hoop that costs you the drive-by contributor you wanted?

https://github.com/QuokkaPride/PopPR
```

---

## r/programming

Harsh sub. It removes anything that reads as promotion, and a maker post about a
tool usually dies. Lead with the measurement finding, which stands on its own,
and mention the tool once at the end.

**Title**

```
I measured my own multiple-choice question bank and found it was cheating in three different ways
```

**Body**

```
Multiple choice has a known failure mode: whoever writes the questions makes the correct answer longer and more specific than the distractors, and readers learn to pick the wordiest option without reading the question. I knew this. I wrote the rule against it before writing any questions.

Then I measured. The correct answer was the longest option in 81% of my questions.

I fixed it and measured again, this time in the other direction, which I had not thought to do the first time. Correct-is-shortest: 48%. "Pick the shortest option" had become the winning strategy while the number I was reporting said a healthy 3%. Writing the distractors first and matching the correct answer to them, which is the standard advice, pushes the correct answer terse.

I fixed that too, and produced a third leak. Lengthening correct answers made whoever wrote them reach for the same contrastive construction, so one phrase ended up in five correct answers and zero of sixty-three distractors. A perfect predictor, in a bank that passed both length checks.

The useful lesson is about gates rather than length. A gate written after a specific bug catches that bug, and the next one will be something nobody thought of. So the check is now general: learn from the bank itself which surface features correlate with correct answers, apply them blind with no access to the question text, and see what that scores. Chance is 25%. It scored 45%. It now scores 26%.

One more finding, which cost me a day and which I have not seen written down anywhere. The obvious guard is "the correct answer must never be the longest or the shortest". Apply that and both metrics read 0%, which looks perfect. It also means "drop both extremes and guess between the two survivors" is worth 56%.

Every threshold needs a floor as well as a ceiling. Being reliably un-extreme is as exploitable as being reliably extreme, and it is harder to see because the metric looks better the worse it gets.

The bank belongs to a tool that quizzes pull request authors on their own diffs, MIT and free, but the audit is the part I would defend: https://github.com/QuokkaPride/PopPR/blob/main/scripts/audit-bank.mjs
```

---

## Rules for both

- Reply to every top-level comment for the first two hours.
- Never argue with the "this is condescending" comment. It is off by default, it
  cannot be failed, no score is published. Say that, then ask what would change
  their mind.
- Do not post to both subs on the same day.
- Check each sub's self-promotion rule before posting. r/programming removes
  first and reads later.
