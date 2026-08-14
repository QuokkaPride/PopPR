# Changelog

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
