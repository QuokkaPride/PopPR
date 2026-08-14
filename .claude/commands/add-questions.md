---
description: Add curated bank questions for a concept, with the distractor rules enforced
---

Add bank questions for: **$ARGUMENTS**

Follow this exactly.

## 1. Check the concept is detectable

Look in `src/core/concepts.ts` for a `RULES` entry with this concept slug. If
there isn't one, add it — a bank entry whose concept has no detection rule can
never be served, and `npm run audit:bank` will fail on it.

The regex is matched against **added lines only** (`+` lines in the diff), and
`extensions` narrows it to relevant file types. Loose is fine: `--smart` mode
exists to filter false positives, so do not try to make the regex clever.

## 2. Write the questions

Add to the matching file in `src/bank/` (`async.ts`, `data.ts`, `react.ts`,
`pygo.ts`, `systems.ts`), or create a new one and register it in
`src/bank/index.ts`.

Write **3 questions per concept**: roughly one easy, one medium, one hard. Each
must probe a *different* facet — three rephrasings of one idea is a failure.

Every question must test a semantic that bites in production. No syntax recall,
no trivia. A senior engineer should think the question is fair and worth asking.

## 3. The distractor rules — this is the part that matters

Write the **three distractors first**, at full specificity. Then write the
correct answer to match their length and tone.

Each wrong option must satisfy at least one of:
- true of very similar code but false here
- a real, common misconception about the primitive in play
- what the code looks like it does on a fast skim

Each wrong option must NOT be:
- absurd, or referencing APIs that don't exist
- a paraphrase of another option
- carrying "always"/"never"/"automatically" only in the wrong ones

**Length discipline.** In at least 65% of questions a WRONG option must be the
single longest. The correct option must never exceed 110% of the mean
wrong-option length. Count characters before you finish.

Set `whyTempting` on at least two wrong options per question, naming the
misconception in one sentence. That field is what the review screen shows to
turn a wrong answer into a lesson — it is not optional flavour.

Vary `correct` across 0/1/2/3.

## 4. Verify

```bash
npm test
```

The audit must stay under 35% correct-is-longest. If it moved meaningfully,
report the before and after numbers rather than just saying it passed.
