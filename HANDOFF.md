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

**1a. Amended Aug 2026: a maintainer may impose a gate on contributors.**
The rule above was written for the developer quizzing themselves on their own
PR, and for that person it still holds exactly. What changed is who the buyer
is. An open-source maintainer reviewing a contribution from a stranger is not
the same transaction: decision 1 protects you from friction on your own
shipping, while a maintainer is deciding what enters a codebase they will
maintain for years. They are allowed to ask for proof of comprehension, and
"AI wrote this and neither of us understands it" is the failure they are
guarding against.

So `certify` exists, with these properties, each of which is load-bearing:

- **Opt-in, default off.** A repo without `certify: true` behaves exactly as
  before: a comment that gates nothing.
- **You cannot fail it.** The timed pass is scored and costs you nothing;
  afterwards the mastery loop asks whatever you have not answered correctly
  until you have. There is no threshold and no attempt limit, so the only exit
  is understanding.
- **Completion is published, nothing else.** No score, no emoji grid (it would
  leak which questions were missed on the timed pass), no retake count. A
  maintainer learning that a contributor needed six tries turns a learning tool
  into a humiliation.
- **The hard gate is the maintainer's own act.** PopPR only ever posts a
  `poppr/quiz-passed` commit status. It blocks a merge only if the maintainer
  marks that context required in branch protection, which keeps the decision
  where it belongs.
- **AI-assisted answers are accepted.** Verification would mean grading on a
  server, which means accounts and a backend and a bill, for a project whose
  economics depend on having none. The comment says so in its own footer: it
  proves the ritual happened, not that nobody helped. The value is a
  contributor who read their own diff before a reviewer had to.

**2. Multiple choice, not free text.**
Beyond being lower-friction, MCQ moves all AI work to a single upfront call.
Questions, options, correct answer and explanations are precomputed, so the quiz
runs at zero latency with no model in the loop. That is what makes a timer
possible: you can't put a clock on something that takes eight seconds to grade.

**3. The default path never requires setup.**
Revised 16 Aug 2026, and the headline used to read "the default mode uses no AI
whatsoever". The default now *uses* a backend when one happens to be installed
and silently plays the curated bank when one is not. What did not change is the
property underneath, which was always the real decision: a machine with no key,
no Claude Code and no network plays a full run at the same ~50ms
time-to-first-question, and nothing on screen mentions a model. That is only
possible because the bank seeds the run instantly and generated questions stream
in behind it, so the AI is never on the critical path to the first question.

**Never add a required setup step to the default path**, and never let a missing
backend print anything on a run that did not ask for one: nagging every keyless
user on every run is how a tool teaches people to ignore it. `--quick` opts out
of the attempt, `--deep` demands it and says so when it cannot have it.

The cost this buys is real and was accepted deliberately: anyone who does have a
backend now spends tokens on every run, and on the default 180-second clock the
generated questions often arrive too late to be asked. That makes "make `--deep`
fast" (roadmap item 2) load-bearing rather than a nice-to-have.

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
| default, no backend | regex over added lines | curated bank | **53ms** |
| default, backend present | regex, then AI | bank first, AI streams in | **53ms to first question** |
| `--quick` | regex over added lines | curated bank | **53ms** |
| `--smart` | one AI call picks concepts | curated bank | **12.2s** |
| `--deep` | regex, then AI | bank first, AI streams in | **53ms**, AI lands ~176s |

The default and `--deep` run the same code. They differ only in what happens
when there is no backend: the default says nothing and plays the bank, `--deep`
says so on the review screen.

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

- **There are two versioned things, and shipping one is not shipping both.** The
  npm package is what `npx` and the Action download. The `v1` git tag is what
  consumers pin in `uses:`. `poppr init` writes `QuokkaPride/PopPR@v1` from
  `ACTION_REF`, and by GitHub Actions convention that major tag *floats* and has
  to be repointed at every release. It never was, from 0.1.3 through 0.4.0, so
  `@v1` returned 404 and no consumer workflow could ever have run: the entire
  maintainer adoption path was dead while npm looked healthy. `publish.yml` now
  moves the tag itself, because a checklist step that is skipped silently is not
  a step. There is a third pin inside `action.yml`, the npm range the action
  runs; bump it whenever `gh-event.ts` or its imports change, or a fix reaches
  npm and never reaches CI.
- **`npm view <pkg> || echo AVAILABLE` is not a name check.** A network timeout
  prints "AVAILABLE" and you publish against a name someone already owns. Hit
  `https://registry.npmjs.org/<pkg>` directly. A real 404 means free, anything
  else means taken. The bare name `poppr` is an unrelated React modal library.
- **Scoped packages default to private.** `publishConfig.access: "public"` is in
  package.json so plain `npm publish` works without `--access public`.
- **Publish from CI, not your laptop.** `.github/workflows/publish.yml` uses npm
  trusted publishing: no token, no one-time password, and a provenance
  attestation for free. Cut a GitHub release and it goes. This needs a one-time
  setup at npmjs.com under the package's Access settings, pointing a Trusted
  Publisher at `QuokkaPride/PopPR` and `publish.yml`.
- **Publishing by hand is worse than it looks.** `npm publish` from a terminal
  wants 2FA. Without a TTY it fails immediately with EOTP, and the auth URL is
  scrubbed from tooling output as a credential, so you cannot even read it.
  Running it under `script -q /dev/null` gives npm a pty and it prints a link
  you open in a browser, but the link expires while you are looking for it and
  the run dies with a 404 on the done endpoint. Two of three attempts died that
  way. Granular tokens with "bypass 2FA" have open CLI bugs, so they are not the
  escape hatch either.
- **npm rewrites `./` off bin paths** and warns that the entry "was invalid and
  removed", which sounds like it dropped your CLI. It did not: it removes the
  unnormalised form and re-adds the corrected one. Store `dist/cli/index.js`
  rather than `./dist/cli/index.js` and the warning goes away.
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
