# Changelog

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
