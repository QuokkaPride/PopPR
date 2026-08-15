# Launch kit

Everything needed to ship PopPR publicly, in the order it should happen.

| file | what it is |
|---|---|
| [PRODUCT-HUNT.md](PRODUCT-HUNT.md) | Every field, the maker comment, the gallery shot list, and answers to the questions you will get |
| [LINKEDIN.md](LINKEDIN.md) | Three posts, pick one. Plus the reply for when a senior engineer pushes back |
| [HACKER-NEWS.md](HACKER-NEWS.md) | Show HN title and body, and the rules that get posts killed |
| [REDDIT.md](REDDIT.md) | r/programming and r/opensource, which need different posts |

## The one-line pitch, used everywhere

> Tests check the code. Linters check the style. Nothing checks the author.

Everything else is elaboration. If a channel gives you one sentence, use that one.

## Order of operations

**Before anything is public:**

1. `npm test` green
2. `npm publish` 0.3.0, and confirm the npm page renders the new README
3. Tag `v1` so `QuokkaPride/PopPR@v1` resolves for the Action
4. Screenshot the PR comment and the green `poppr/certified` check
5. Open https://quokkapride.github.io/PopPR/ and play one round, to be sure the
   hosted version is on the new bank

**Launch day:**

1. **12:01am PT** Product Hunt goes live, maker comment within a minute
2. **8am your time** LinkedIn, link in the first comment
3. **9am ET** Show HN, then do not touch it. No upvote asks, no early comment
4. **Midday** r/opensource. Leave r/programming for a separate day, since it
   punishes anything that reads as promotion

Do not do all four in one hour. Each one wants to be the place the conversation
is happening.

## What to say when it goes badly

If a thread turns hostile about gating contributors, do not defend the feature.
Say the true thing, which is that it is off by default, nobody can fail it, and
no score is ever published. Then ask what would make it useful to them. The
people arguing hardest about this are the maintainers you are building for.

## What to do with the first week

The most valuable thing launch produces is not signups. It is a list of questions
that are wrong on code you have never seen. Ask for that in every channel and
open an issue for each report.
