# Changelog

## 0.5.0

**The AI questions now actually reach you.** They never had. Measured on the
shipped 0.4.0 code, the first generated batch landed at 221.9s against a
180-second clock, so it arrived 42 seconds after the game had already ended.
Three things were wrong at once:

- The first batch now asks the fastest model on your backend rather than
  whichever one you have configured. `claude-code` was passing no `--model` at
  all, so everyone inherited their slowest. Same input, back to back: 263s on
  the default model, 139s on the fast one.
- The concept-widening call had never added a single question. Bank ids were
  minted per call, so a second draw always collided with the first and every
  widened question was dropped. Measured: added 0 of 8, every run.
- Nothing said so. A backend still working when the clock stopped printed
  nothing at all, which is how a feature that had never once worked survived a
  year.

**You can now see which questions are which.** Generated ones are marked `✦ ai`
on the question row as you play, and the review says how many were written
about your diff.

**And you can wait for them.** Generation cannot be made reliably fast: across
runs the first batch landed at 40s, 114s, 122s and past 180s, on diffs from
eleven lines to thirty-two files. Asking for fewer questions saved eight
seconds; trimming the diff made it slower. So the wait is a choice offered
before the clock starts, and doing nothing starts the run.

**`--certify` is now `--require`.** It describes what the maintainer is turning
on rather than what happens to the contributor, and it already matched
`poppr init --require`. The old flag still works. `action.yml` still honours
`certify:` too, because an input GitHub does not recognise is silently ignored,
and dropping it would switch a merge gate off without failing anywhere.

**`--deep` and `--smart` are gone.** `--smart` was hidden, strictly worse than
the default, and broke `--quick`'s "no AI, no network, no key" promise by
forcing a provider call. `--deep` meant "tell me when there is no backend",
which every run now does.

**A required quiz defaults to five questions**, down from ten.

**The PR comment is shorter.** It no longer lists every detected concept, which
was what the regexes matched rather than what you are asked. It leads with the
terminal, because that is the only one that can write questions about your
code, and keeps the browser one click away.

Also fixed: a correct answer flashed for 350ms, too fast to register, and now
holds for 700ms and shows the points earned. `--quick` made a 288ms network
call on every run for a label in a local file. `readDiff` ran three git
invocations in series that share no state. `cursor-agent` silently discarded
the fast-model request. The browser gated a required quiz on ten questions
while every other default said five.


## 0.4.0

**AI-written questions are now on by default, and still never required.** If you
have Claude Code, Cursor, an API key or Ollama, PopPR asks it to write questions
about your actual diff and streams them in while you are already playing. If you
have none of those, the run is byte-for-byte the one you got before, at the same
speed, and nothing on screen mentions a model. `--quick` skips the attempt.
`--deep` demands it and tells you when it cannot have it.

The old behaviour is `--quick`. Nothing about the curated bank changed.

**PopPR runs on Windows.** It was written and tested only on macOS, and several
things broke there that no amount of reading catches:

- The AI backends could never launch. npm installs its global CLIs as `.cmd`
  shims, libuv's path search only tries `.com` and `.exe`, and Node refuses to
  exec a batch file directly since the fix for CVE-2024-27980. Detection said
  Claude Code was present and every launch failed. Backends are now resolved to
  a real path and batch shims run through `cmd.exe`.
- `npm test` could not run at all: it depended on the shell expanding
  `test/*.test.mjs`, which cmd.exe and PowerShell do not do.
- Colour codes leaked into redirected output, because picocolors treats every
  win32 process as a terminal.
- CRLF checkouts made `poppr init` report that its own untouched workflow file
  "differs", and turned any local diff into a whole-file rewrite.

CI now runs the full matrix on ubuntu, windows and macos across Node 18, 20 and
22. Every one of the above was invisible until a job ran on Windows.

**The certify check is `poppr/quiz-passed` everywhere.** The rename landed in
0.3.1 but `action.yml`, the docs and the launch material still said
`poppr/certified`. A maintainer following those docs marked a check required
that is never posted, which blocks every PR in the repo on a status that stays
pending forever.

Also fixed:

- Ctrl+D, Ctrl+A and Ctrl+F silently answered the current question, in both the
  CLI and the browser version.
- A run with piped stdin repainted thousands of unanswerable frames instead of
  saying it needs a terminal.
- A failed history write took the whole run down with it, losing the score
  between the last answer and the review screen.
- Streaks rolled over at UTC midnight rather than yours, so players far enough
  east or west lost days they had played. `POPPR_HOME` now overrides where the
  history lives, which also lets WSL and native Windows share one streak.
- Two detection rules anchored `$` without the `m` flag, so their end-of-line
  case only ever matched the last line of a file.
- Files with non-ASCII names were dropped from the diff entirely.
- The call-site scan ran up to 25 `git grep` processes in series on every run,
  including runs that never used the result.

## 0.3.2

**The README now says that `--require` does not block a merge on its own.** It
posts a check that sits pending until the quiz is passed, and GitHub ignores
pending checks until you add the context to a branch protection rule. That
second step was one clause before and is now four numbered steps with a link to
GitHub's own guide, plus the gotcha that costs people twenty minutes: the search
box on that screen only lists checks it has already seen, so open one PR first.
`poppr init` prints the same warning.

**`docs/HOW-IT-WORKS.md` gains a full account of the check**: the two states it
has, the absence of a third, what happens on a push, and why a docs-only PR goes
green on its own.

Also trims the README further: no regex vocabulary in the four-step summary, and
the modes table says what it means.

## 0.3.1

**Two modes rather than three.** `--smart` and `--deep` were both "the AI one"
and nobody could tell them apart. `--deep` now does the concept classification
as well: it seeds instantly from the curated bank, widens the pool when
classification lands around twelve seconds in, then streams the written-for-you
questions. `--smart` still works and is no longer advertised.

**`poppr/certified` is now `poppr/quiz-passed`.** The old name did not say what
it meant, and it is the string a maintainer types into branch protection.
`poppr init --require` is the new spelling of `--certify`, which keeps working
because a workflow file in someone's repo already says `certify: true`.

**A README you can scan in two seconds.** It now leads with what the tool is,
then what it literally does in four steps, then where your code goes, then the
two ways to put it on a repo. The coverage measurement, the anti-cheating audit,
the scoring model and the fork-safety argument moved to `docs/HOW-IT-WORKS.md`.

## 0.3.0

**Eight languages, and a real answer for small PRs.** The bank went from 145
questions to 328 and from 47 concepts to 108, adding Rust, Java, Ruby and C/C++
and deepening Go, Python and TypeScript. Every concept was chosen by measuring
candidate rules against merged PRs and keeping only the ones that fired on real
diffs, then verified on 487 held-out PRs from 28 repos that no rule was designed
from. Code PRs matching at least one concept went from 46% to 60%, and Go, Rust
and Java each roughly doubled.

**No PR with code in it comes back empty.** About 40% of code PRs are one guard,
one renamed field or one new branch, and the detection rules are right to stay
quiet on those. Twenty-four general engineering questions now top a thin run up
to eight, never displacing a question about your own diff, and the review screen
says plainly when a question came from nowhere in particular. A PR that adds no
code at all still gets nothing, which is the behaviour worth keeping.

**`--deep` plays immediately.** It used to block for up to four minutes before
showing a question, then start a three-minute clock. It now seeds from the
curated bank in milliseconds and streams the written-for-you questions into the
live pool as each batch lands, so time to first question went from 228 seconds
to about two. A missing AI backend now costs you the deep questions rather than
the run.

**The bank audit grew two floors and a mirror.** Correct-is-longest and
correct-is-shortest both read 0%, which sounds healthy and meant "drop both
extremes and guess between the survivors" was worth 56%. Both checks now have a
floor as well as a ceiling, and the audit fails on a detection rule with no
questions behind it as well as a question with no rule. A player who never reads
the question now scores 24% against a 25% chance baseline, down from 45%. The
same bug was in the `--deep` prompt at 53% and is fixed there too.

**Two detection bugs found while measuring.** `#` was read as a comment in C
files, which discarded 4.5% of every added C line and blanked 30 files whose
entire content was preprocessor directives. And the code-file check used a
blocklist, so a hardware database, a `VERSION.dat` and a directory of `.pod`
manpages counted as code; a copyright-year bump would have been quizzed. It is
an allowlist now. Vue and Svelte single-file components reach the JavaScript
rules for the first time.

## 0.1.3

**The clock stops while you read a wrong answer.** A miss used to flash the bare
letter of the correct option for half a second, which is unreadable once the
options have scrolled away. It now names the option and waits for a keypress,
with the countdown paused. The timer is there to measure whether you know the
answer, not how fast you read. The browser version got this first; this brings
the terminal in line.

## 0.1.2

**A second pass over what you missed.** Reading an explanation is recognition;
answering the question again is retrieval, and retrieval is what encodes. One
keypress at the end of a run re-asks the ones you got wrong, with no clock and
no points. Bank questions are precomputed, so it costs nothing at runtime.

**A browser version, for public repositories.** One click from the PR comment,
no install and no account: https://quokkapride.github.io/PopPR/. Detection,
question selection, the staircase, scoring and the scorecard are imported
unchanged from the same modules the CLI runs. Private repositories keep the
terminal path, where `gh` already holds the credentials.

**A GitHub Action** that comments what a PR touches, with a link to play it. It
reports and never gates: the job always succeeds, it is not a required check,
and fork PRs are skipped rather than failed on a read-only token.

**`--detect`** prints the concepts in a diff and exits, `--json` for machines.
CI has nobody at the keyboard, so the workflow reports and a human plays.

### Fixed

- Questions rendered as `Qbank7`. The label was `"Q" + bank id`, so the number
  looked random and never counted up. It is the position in the run now.
- The brief said `180s on the clock` above a timer reading `3:00`.
- `--help` carried the pre-merge-gate tagline and advertised `--smart` at ~10s
  and `--deep` at ~60s. Measured: 12s and 176s.
- Concept detection matched prose and config. A docs-only PR was quizzing on
  caching because the README says "a cache with no eviction", and on retries
  because HANDOFF.md contains the word "retry". Markdown and YAML are not code,
  so no pattern tuning makes matching them correct.
- The scorecard said `PopPR` while all four on-screen headers said `POPPR`.
- `npm run demo` was broken on macOS: the font path was hardcoded to a Linux
  DejaVu location. It tries candidates now, and substitutes the spinner glyph
  when a font has no braille block.

## 0.1.1

Rewrote every document and all question text: no em dashes, no throat-clearing,
no passive voice. Corrected two false claims in the marketing, where `--deep`
was advertised at ~60s against a measured 176s, and a run was described as 60
seconds against a 180s default clock.

## 0.1.0

First release. Quick, smart and deep modes, 109 curated questions across 35
concepts, adaptive difficulty, spaced repetition and the shareable scorecard.
