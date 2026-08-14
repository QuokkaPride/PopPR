# PopPR: project context

Everything a new session needs to pick this up. `CLAUDE.md` covers how to work
in the repo day to day; this file covers *why it is the way it is*, what state
it's in, and what to do next.

---

## What it is

A pop quiz for your own pull request. You shipped it, an agent wrote most of it,
and now you can't explain it. PopPR quizzes you on a three-minute clock and
tells you what you didn't know.

- **npm:** `@quokkapride/poppr`, v0.1.2
- **GitHub:** https://github.com/QuokkaPride/PopPR
- **Install:** `npx @quokkapride/poppr`. The command is `poppr`.
- **License:** MIT

- **Browser:** https://quokkapride.github.io/PopPR/ (public repos only, `web/`)

Status: live and working, on npm, on Pages, and commenting on its own PRs. No
users yet, no launch post yet.

---

## Decisions that should not be re-litigated

These were each argued through and reversed at least once. Changing them back
would undo real reasoning, so if you want to revisit one, know what it cost.

**1. It runs AFTER you merge, not before.**
The first design was a pre-PR gate. That is wrong: a gate is friction on the one
thing the developer cares about, getting the PR out, so it gets disabled within
a week. The real moment is the five minutes *after* shipping, when "shit, now I
have to understand this" hits. PopPR is a snack, not a checkpoint. Anything that
makes it feel like a gate is a regression.

This includes the planned GitHub Action. The score posts as a comment the
reviewer can see, never as a required check that blocks the merge. Teams that
want it strict can mark the check required themselves, which keeps that choice
theirs rather than the default.

**2. Multiple choice, not free text.**
Beyond being lower-friction, MCQ moves all AI work to a single upfront call.
Questions, options, correct answer and explanations are precomputed, so the quiz
runs at zero latency with no model in the loop. That is what makes a timer
possible: you can't put a clock on something that takes eight seconds to grade.

**3. The default mode uses no AI whatsoever.**
Quick mode is regex detection over added lines plus a curated question bank:
~50ms, offline, no API key, no Claude Code install. This is the single most
important adoption decision in the project. A tool you must configure before the
first play is a tool nobody plays. **Never add a required setup step to the
default path.**

**4. One clock for the whole run, not per question.**
Score is "how many in 3:00", which is comparable and shareable, and it composes
with adaptive difficulty, since questions keep coming until time runs out.

**5. Explanations are held until the review screen.**
During the run you get a 400ms ✓/✗ and nothing to read. Making someone read a
paragraph while their clock ticks kills the flow state the game just built. The
teaching happens after.

**6. Hard questions are worth 3.5x.**
This is what reconciles "engaging" with "educational". Optimising for speed
alone would push players toward easy questions and recognition-level thinking.
Weighting hard questions heavily means the winning strategy is answering *hard*
things fast, which is the skill worth having.

**7. Difficulty targets ~85% accuracy, not 100%.**
A 2-up/1-down staircase converges near the band where learning is fastest
(Wilson et al., 2019). It is not trying to let you ace it.

**8. `src/core/` contains no terminal code.**
The VS Code extension will import it directly. Anything touching stdout, ANSI or
`process.argv` belongs in `src/cli/`.

**9. We never ship inference.**
PopPR borrows compute the user already pays for: Claude Code headless →
`cursor-agent` → their own API key → local Ollama. The economics only work
because nobody is paying for our tokens. Don't add a hosted backend.

---

## The one invariant that matters most

Multiple choice rots in a specific, predictable way: whoever writes the questions
makes the correct answer longer and more specific than the distractors, and
players learn to pick the wordiest option without reading any code. The quiz
still looks fine. It stops measuring anything.

**This is not hypothetical.** The first hand-written version of this bank had the
correct answer as the longest option in **81%** of questions, written by someone
who had just finished writing the rule against doing that. It is now **3%**, and
`npm run audit:bank` fails the build above 35%.

When adding questions: **write the three distractors first, at full specificity,
then write the correct answer to match their length.** Every wrong option should
be a real misconception someone holds, and `whyTempting` should name it. That
field is what the review screen shows after a miss, and it is usually the most
valuable line on the screen.

---

## Prose style

No em dashes anywhere: prose, question text, option text, CLI output. The bank
uses a colon for the "short answer, then gloss" pattern, and a full stop or
comma in running prose. The `stop-slop` skill covers the rest.

The product name is **PopPR** in all prose and on every screen, including the
TUI header and the shareable scorecard. Lowercase `poppr` is reserved for the
literal command and package name. `POPPR_MODEL` stays uppercase, since it is an
environment variable.

---

## Architecture

```
src/core/          the library, no terminal code
  types.ts         Question, Answered, RunResult, PrContext, Provider
  diff.ts          git / gh -> PrContext; filters lockfiles + generated code
  concepts.ts      RULES: regex -> concept slug. Quick mode's whole brain.
  classify.ts      Smart mode: one small AI call -> which concepts matter
  quiz.ts          Deep mode: AI writes questions; also auditDistractors()
  bank.ts          serves curated questions, shuffles option order
  adaptive.ts      Staircase, 2-up/1-down
  score.ts         difficulty x speed x combo
  history.ts       ~/.poppr/history.json, streaks, spaced repetition
  scorecard.ts     the shareable emoji grid
  providers/       claude-code | cursor-agent | api-key

src/bank/          109 curated questions, grouped by area
src/cli/           game loop, review screen, commander wiring
scripts/           audit-bank.mjs, the build gate
demo/              frames.mjs + render.py generate the README GIF
```

### The three modes, with real measured numbers

| mode | selection | questions | measured |
|---|---|---|---|
| quick (default) | regex over added lines | curated bank | **53ms** |
| `--smart` | one AI call picks concepts | curated bank | **12.2s** |
| `--deep` | n/a | AI writes per-PR | **176s to first question** |

Smart mode exists because pattern matching answers "does the text `Promise.all`
appear?" when the question you want answered is "is concurrency a real risk
here?". On the test repo the regex flagged two false positives (`await-in-loop`
in a deliberate retry loop, `try-catch-async` on a fine handler) and missed the
significance of an unbounded `Map`. Smart mode got all three right.

---

## Known rough edges, and be honest about these

- **`--deep` is too slow.** ~176s to the first question even with three parallel
  batches streaming into the live pool. This is the main reason nobody would
  reach for it daily. Likely fixes: generate from the smart-mode concept list
  rather than raw diff reasoning, trim the diff harder, or use a faster model for
  the batching pass.
- **Bank covers JS/TS, React, Python, Go, SQL only.** Rust, Java, Ruby, C# PRs
  come up empty in quick mode. This is pure content work and it is the highest-
  value contribution anyone can make.
- **`concepts.ts` regexes are loose by design** and do produce false positives.
  That is what `--smart` is for. Do not try to fix it with more regex.
- **No unit tests.** `npm test` is build + bank audit. `diff.ts` and `adaptive.ts`
  are the two modules that most deserve real tests.
- **Deep mode's generated questions are not audited.** `auditDistractors()` exists
  and is applied to the bank at build time, but generated questions go straight to
  the player. Running the audit at runtime and regenerating bad batches would be a
  real quality win.
- **The README claimed `--deep` took ~60s and that a run was 60 seconds.** Both
  were wrong (176s, and a 180s default clock). Corrected 14 Aug 2026. Check
  marketing numbers against `HANDOFF.md` before publishing.

---

## Roadmap, in priority order

**1. VS Code / Cursor extension.** Two reasons, both strong. The marketplace is
the only channel with genuine browse-and-rank discovery, and npm has none. The
VS Code Language Model API lets an extension use the user's existing Copilot
subscription, so smart and deep modes become keyless. "Enter your API key" is
where most installs die. Publish to both the VS Code Marketplace and Open VSX;
Cursor has moved to Open VSX, so one extra publish command covers Cursor,
Windsurf and VSCodium. `core/` is already split, so this is mostly webview UI.

**2. Make `--deep` fast.** See above.

**3. Bank coverage for more languages.** Use the `/add-questions <concept>`
command in `.claude/commands/`, which encodes the distractor rules.

**4. GitHub Action** that posts a comprehension score on the PR. This is the
growth loop: every reviewer who sees the comment discovers the tool. It is also
the only piece anyone would plausibly pay for (an org dashboard), which fits the
"nobody pays for AI tokens" constraint. They won't pay for inference, but a VP
might pay for reporting. Keep it non-blocking, per decision 1.

**5. Claude Code plugin** (`/quiz-me`). Small audience, but exactly the people
generating giant AI PRs, and near-zero work since the CLI exists.

**6. Launch post.** Not written yet. The hook is deliberately self-deprecating:
"I scored 4/10 on my own PR." Build it around a **real score from a real PR**,
not a staged one. A fabricated number is the one thing that would undercut the
whole pitch.

---

## Gotchas learned the hard way

- **`npm view <pkg> || echo AVAILABLE` is not a name check.** A network timeout
  prints "AVAILABLE" and you publish against a name someone already owns. Hit
  `https://registry.npmjs.org/<pkg>` directly. A real 404 means free, anything
  else means taken. The bare name `poppr` is an unrelated React modal library.
- **Scoped packages default to private.** `publishConfig.access: "public"` is in
  package.json so plain `npm publish` works without `--access public`.
- **npm requires 2FA to publish.** Publish with `npm publish --otp=123456`.
  Granular tokens with "bypass 2FA" have open CLI bugs; don't rely on them.
- **The demo GIF is generated from the real bank and real scoring functions**
  (`npm run demo`). It cannot drift into misrepresenting the product. Keep it
  that way.
- **The npm page only updates on publish.** README edits are invisible to npm
  users until the next version ships.

---

## Verifying things

```bash
npm test                          # build + bank audit; run before every commit
npm run audit:bank                # the gate on its own
npm run demo                      # regenerate the README GIF
node dist/cli/index.js --local            # quiz the current branch
node dist/cli/index.js --local --smart    # AI picks the concepts
node dist/cli/index.js --stats            # concept mastery over time
```

A healthy audit looks like:

```
  poppr bank audit · 109 questions, 35 concepts
  correct-is-longest  3%   (limit 35%, random baseline 25%)
  length ratio        0.92   (limit 1.1)
  ✓ bank is healthy
```
