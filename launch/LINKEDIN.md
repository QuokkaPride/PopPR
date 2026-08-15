# LinkedIn

Post the first version. The others are there if it does not land, or for a
follow-up later in the week.

**Timing:** Tuesday to Thursday, 8 to 10am in your audience's timezone.
**Format:** no link in the post body. LinkedIn suppresses reach on posts with
outbound links, so put the link in the first comment and say so.

---

## Post (primary)

```
I reviewed a pull request last month, asked a question about one of the lines, and realised the person who opened it did not know the answer either.

An agent wrote it. They shipped it. Neither of us understood it.

That is not a rare story any more. And nothing in CI catches it:

Tests check the code.
Linters check the style.
Nothing checks the author.

So I built PopPR. It reads a pull request, works out which concepts the changed lines actually exercise, and asks the person who opened it multiple-choice questions about their own diff. Three minutes. The result posts on the PR, where the reviewer already is.

Two decisions I want to be honest about, because the whole thing rests on them:

It publishes completion, never a score. Maintainers can require it before merge, but nobody can fail it. Wrong answers come back, untimed, until they are right, and how many attempts it took stays private. A tool that publishes "this contributor got 3 out of 10" is a tool contributors route around.

The questions get measured harder than anything else in the project. Multiple choice rots in a specific way: whoever writes it makes the correct answer longer and more specific, and readers learn to pick the wordiest option without reading any code.

Mine did exactly that. 81% of questions had the correct answer as the longest option, written by me, the day after I wrote the rule against doing it.

Fixing it overcorrected: correct-is-shortest hit 48% while the first number read a healthy 3%.

Fixing that produced a third version I did not see coming, where one phrase appeared in five correct answers and zero wrong ones.

So the build now fails on the only question that matters: what would someone score if they never read the question at all?

Chance is 25%. It sits at 26%.

Free, MIT, no account, no API key. One command adds it to a repo.

If you maintain something that takes outside contributions, I would like to know whether this helps or gets in the way.
```

**First comment, post it yourself:**

```
Link, since LinkedIn buries posts that have one in the body: https://github.com/QuokkaPride/PopPR

Try it on your own current branch in about 50 milliseconds, no install:
npx @quokkapride/poppr --local
```

---

## Post (shorter alternative)

If you want something that reads in eight seconds.

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

## Post (the engineering angle)

Better for a developer-heavy following. This one travels on the measurement
story rather than the product.

```
I built a quiz tool, then caught my own question bank cheating. Three times.

The failure mode of multiple choice is well known: whoever writes the questions makes the correct answer longer and more specific than the wrong ones, and readers learn to pick the wordiest option without reading anything.

I knew that. I wrote the rule against it. Then I measured my own bank: the correct answer was the longest option in 81% of questions.

Fixed it. Measured again, in the other direction this time. Correct-is-shortest: 48%. "Pick the shortest" had become the winning strategy while the metric I was reporting said a healthy 3%.

Fixed that. And produced a third leak, because lengthening correct answers made me reach for the same construction every time. One phrase appeared in five correct answers and zero distractors. A perfect predictor, in a bank that passed both length checks.

The lesson is not "measure length". It is that a specific gate only catches the version of the bug you already found. So the check is now general: learn what surface features correlate with correct answers, apply them blind, and see what that scores.

Chance is 25%. It scored 45%. After the fix, 26%.

One more thing worth stating out loud, because it cost me a day. The obvious guard is "the correct answer must never be the longest or the shortest." Apply that and both numbers read 0%, which looks perfect and means "drop both extremes, guess between the two survivors" is worth 56%.

Every threshold needs a floor as well as a ceiling. Being reliably un-extreme is as strong a tell as being reliably extreme.

The tool is PopPR, it is free and MIT, and the audit is the part I am most confident about.
```

---

## If someone senior comments, reply with this

```
The honest limit is that a three-minute multiple-choice run measures test-taking under time pressure, not engineering. That is exactly why there is no failing threshold and no published score. A model can beat a timed quiz, so a score gate would filter honest contributors and pass dishonest ones, which is inverted selection.

What it does buy: the contributor has to have engaged with their own diff, and the maintainer gets to see which concepts the change actually touches, line by line, before they start reading.
```
