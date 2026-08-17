import type { Difficulty, PrContext, Provider, Question, Speed } from "./types.js";
import { renderDiff } from "./diff.js";

const ARCHETYPE_GUIDE = `
ARCHETYPES: use a spread of these, never more than two of the same kind:

- blast-radius: name a caller outside the diff and what breaks for them. Only use
  this when the "references OUTSIDE the diff" section gives you real callers.
- why-this-line: quote ONE specific non-obvious line (a lock, an index, a
  useMemo, a retry, a guard clause, an await) and ask what happens if it is
  removed.
- language-concept: test the language primitive the code actually uses. Not
  trivia, but the semantics that bite in production. Promise.all rejection
  behaviour, Python default-arg mutability, Go loop-variable capture, SQL NULL
  comparison, JS number precision, React stale closures.
- failure-mode: describe a concrete production symptom (a real bug report, with
  a user and a behaviour) and ask which part of THIS diff causes it.
- rejected-alternative: the change picked approach X; ask what X buys over the
  obvious Y.
- trap: the premise is FALSE. Describe behaviour this code does NOT have. The
  correct option must be the one that rejects the premise. Exactly one of these
  per quiz, never more. This one catches bluffing, so make the false premise
  genuinely plausible.
`.trim();

const DISTRACTOR_RULES = `
DISTRACTOR QUALITY: this is the hard part, and a lazy job here makes the whole
quiz worthless because people will pattern-match instead of thinking.

Every wrong option MUST satisfy at least one of:
  (a) it is TRUE of very similar code but FALSE of this specific code, or
  (b) it is a real, common misconception about the primitive in play, or
  (c) it describes what the code LOOKS like it does on a fast skim.

Every wrong option MUST NOT:
  - be obviously absurd, or reference APIs that do not exist
  - be a paraphrase of another option
  - put qualifiers like "always"/"never"/"automatically" only in the wrong ones

LENGTH DISCIPLINE. Read this twice. It is the most commonly failed rule, and
failing it destroys the product, because a player who can pick the answer from
its shape never reads the code.

The rule is NOT "make the correct answer short". That is the trap, and it fails
in both directions:
  - Write the correct answer longest every time and "pick the wordiest" scores.
  - Overcorrect and "pick the shortest" scores, which is worse because it looks
    like the problem was fixed.
  - Make it never longest and never shortest, and "drop both extremes, guess
    between the two survivors" scores 50%.

What you are aiming for is that option length carries NO information at all. So
do this mechanically, per question:

  Before writing the options, pick a target rank R for the correct answer by
  cycling 1, 2, 3, 4, 1, 2, 3, 4 through the questions in this batch. R is where
  the correct answer must land when the four options are sorted longest first.
  R=1 means the correct answer IS the longest. R=4 means it IS the shortest.

  Then write the three distractors at full specificity, count their characters,
  and write the correct answer to land at rank R. Count again before you emit.

Every option carries real content whatever its rank. Never pad an option with
filler and never strip mechanism out of the correct answer to hit a number: move
detail between options instead, and give a shorter option a tighter sentence
rather than a vaguer one.

Vary which letter is correct. Do not favour A or C.
`.trim();

export interface GenerateOptions {
  /** Concepts the user has previously missed; bias generation toward them. */
  reviewConcepts?: string[];
  /** How many questions to put in the pool. Served adaptively, so over-generate. */
  poolSize?: number;
  /** Restrict this call to a subset of archetypes (used for parallel batching). */
  only?: string[];
  /** Which end of the speed/quality trade this call wants. See Speed. */
  speed?: Speed;
}

function buildPrompt(ctx: PrContext, opts: GenerateOptions): string {
  const poolSize = opts.poolSize ?? 16;
  const focus = opts.only?.length
    ? `\nFOR THIS BATCH, use ONLY these archetypes: ${opts.only.join(", ")}.\n`
    : "";

  const review = opts.reviewConcepts?.length
    ? `\nSPACED REPETITION: this developer has previously struggled with these\nconcepts: ${opts.reviewConcepts.join(", ")}.\nIf, and only if, this diff touches any of them, include one extra\nquestion on it. Do NOT force a question about a concept the diff does not use.\n`
    : "";

  return `You are writing a short, timed, multiple-choice quiz that a developer takes on
their OWN pull request, right after they shipped it. Much of this code was
written by an AI agent, and the point of the quiz is to find out whether the
human actually understands what they just merged.

Tone: a sharp colleague testing them at a whiteboard. Not a textbook, not a
linter. Every question should be one a thoughtful senior engineer would actually
ask in review.

${ARCHETYPE_GUIDE}

${DISTRACTOR_RULES}

DIFFICULTY:
- easy   (~35%): locate and recall. Answerable by someone who read the diff carefully.
- medium (~45%): causal. "What breaks if…", "why does X happen when Y…". Requires
                 understanding, not just reading.
- hard   (~20%): design trade-offs, concurrency, failure modes under load, subtle
                 semantics. A strong engineer should have to pause.

CONCEPT TAGS: tag each question with a short lowercase concept slug that is
transferable BEYOND this PR, because it is tracked across months to show the
developer what they are getting better at. Good: "async/concurrency",
"error-handling", "sql-indexes", "type-narrowing", "auth", "caching",
"react-hooks", "memory-safety". Bad: "the checkout function", "this file".

RULES:
- Ground every question in something concretely visible in the diff. Never invent
  code that is not there.
- Prefer questions whose answer requires understanding the change's CONSEQUENCES
  over questions about its surface.
- No questions about formatting, naming, or style.
- Explanations are at most two sentences and teach the underlying idea, not just
  "because line 12 says so".
${focus}${review}
Generate exactly ${poolSize} questions.

Return ONLY a JSON object, no prose and no markdown fences:

{
  "questions": [
    {
      "id": "q1",
      "difficulty": "easy" | "medium" | "hard",
      "archetype": "blast-radius" | "why-this-line" | "language-concept" | "failure-mode" | "rejected-alternative" | "trap",
      "concept": "async/concurrency",
      "prompt": "the question",
      "options": [
        { "key": "A", "text": "...", "whyTempting": "why someone picks this" },
        { "key": "B", "text": "...", "whyTempting": "..." },
        { "key": "C", "text": "...", "whyTempting": "..." },
        { "key": "D", "text": "...", "whyTempting": "..." }
      ],
      "correct": "B",
      "explanation": "at most two sentences",
      "anchors": ["src/checkout.ts"]
    }
  ]
}

Here is the pull request:

${renderDiff(ctx)}`;
}

/** Pull the JSON object out of a model response that may have prose around it. */
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return JSON.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

/**
 * Validate and repair what the model gave us. Being strict here is what keeps a
 * bad generation from producing a quiz that is unanswerable or trivially
 * gameable: we drop malformed questions rather than showing them.
 */
function coerce(parsed: unknown): Question[] {
  const raw = (parsed as { questions?: unknown[] })?.questions;
  if (!Array.isArray(raw)) throw new Error("Model response had no `questions` array.");

  const out: Question[] = [];
  for (const [i, item] of raw.entries()) {
    const q = item as Partial<Question>;
    if (!q?.prompt || !Array.isArray(q.options) || q.options.length < 2) continue;

    const options = q.options
      .filter((o) => o && typeof o.text === "string" && o.text.trim())
      .map((o, idx) => ({
        key: (o.key ?? String.fromCharCode(65 + idx)).toUpperCase().trim(),
        text: o.text.trim(),
        whyTempting: o.whyTempting,
      }));

    const correct = String(q.correct ?? "").toUpperCase().trim();
    // A question whose correct answer isn't among the options is worse than no
    // question at all, so drop it silently.
    if (!options.some((o) => o.key === correct)) continue;

    out.push({
      id: q.id || `q${i + 1}`,
      source: "ai" as const,
      difficulty: DIFFICULTIES.includes(q.difficulty as Difficulty)
        ? (q.difficulty as Difficulty)
        : "medium",
      archetype: (q.archetype as Question["archetype"]) ?? "language-concept",
      concept: (q.concept || "general").toLowerCase().trim(),
      prompt: q.prompt.trim(),
      options,
      correct,
      explanation: (q.explanation ?? "").trim(),
      anchors: Array.isArray(q.anchors) ? q.anchors : [],
    });
  }

  if (out.length === 0) throw new Error("No usable questions came back from the model.");
  return out;
}

export async function generateQuiz(
  ctx: PrContext,
  provider: Provider,
  opts: GenerateOptions = {},
): Promise<Question[]> {
  const raw = await provider.generate(buildPrompt(ctx, opts), { speed: opts.speed });
  return dedupe(coerce(extractJson(raw)));
}

/**
 * Archetype buckets for parallel generation. Splitting the work three ways cuts
 * wall-clock roughly threefold, and as a bonus each call produces a more
 * coherent set than one call juggling all six archetypes at once.
 */
const BATCHES: string[][] = [
  ["failure-mode", "blast-radius"],
  ["language-concept", "why-this-line"],
  ["rejected-alternative", "trap"],
];

/**
 * Generate in parallel batches, invoking `onBatch` the moment each lands.
 *
 * The caller plays the curated bank from the first millisecond and feeds each
 * batch into the live pool as it lands, so slow generation reaches a run
 * already in progress instead of holding one up.
 *
 * The first batch is deliberately tiny and asks the fastest model; the rest are
 * full size and ask the default one. That split is the difference between the
 * AI half existing and not, and it is built on one measurement: latency tracks
 * how much we ask the model to WRITE, not how big the diff is.
 *
 * Measured, same backend: 5 questions took 251s, 3 took 171s, 2 took 98s, while
 * trimming the diff from 32 files to 5 made it SLOWER at the same question
 * count. An 11-line diff still took 122s for 5 questions. So do not try to make
 * this faster by sending less code: ask for fewer questions.
 *
 * A question that lands after the game has ended is worth nothing however good
 * it is, so the opener trades depth for arriving, and the later batches spend
 * the rest of the clock being better.
 */
export async function generateQuizStreaming(
  ctx: PrContext,
  provider: Provider,
  opts: GenerateOptions & {
    /** `ms` is milliseconds since generation started, so a caller can report arrival. */
    onBatch?: (qs: Question[], index: number, ms: number) => void;
    onBatchError?: (err: unknown, index: number, ms: number) => void;
  } = {},
): Promise<Question[]> {
  // The opener is sized to arrive, not to fill the pool. The bank already has
  // the pool covered; this one exists so a generated question shows up while the
  // player is still playing.
  const OPENER_QUESTIONS = 2;
  const perBatch = Math.max(3, Math.ceil((opts.poolSize ?? 15) / BATCHES.length));

  const all: Question[] = [];
  const seen = new Set<string>();

  const startedAt = Date.now();

  const jobs = BATCHES.map(async (only, index) => {
    try {
      const raw = await provider.generate(
        buildPrompt(ctx, {
          ...opts,
          only,
          poolSize: index === 0 ? OPENER_QUESTIONS : perBatch,
        }),
        { speed: index === 0 ? "fast" : "best" },
      );
      const batch = coerce(extractJson(raw)).map((q, i) => ({
        ...q,
        id: `b${index}q${i + 1}`,
      }));
      // Batches run concurrently and can't see each other, so dedupe centrally.
      const fresh = batch.filter((q) => {
        const key = normalize(q.prompt);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      all.push(...fresh);
      opts.onBatch?.(fresh, index, Date.now() - startedAt);
      return fresh;
    } catch (err) {
      // One failed batch shouldn't sink the run: the other two still play. But
      // it must not look like a batch that returned nothing, which is what this
      // swallow used to do: a crashed backend and a slow one were the same
      // event to every caller, and the run could only report "no AI questions".
      opts.onBatchError?.(err, index, Date.now() - startedAt);
      opts.onBatch?.([], index, Date.now() - startedAt);
      return [];
    }
  });

  await Promise.all(jobs);
  if (all.length === 0) throw new Error("Could not generate any questions for this PR.");
  return all;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
}

function dedupe(qs: Question[]): Question[] {
  const seen = new Set<string>();
  return qs.filter((q) => {
    const key = normalize(q.prompt);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface DistractorAudit {
  /** Share of questions where the correct option is the longest. 0.25 is ideal. */
  longestIsCorrect: number;
  /**
   * Share of questions where the correct option is the shortest. 0.25 is ideal.
   *
   * The mirror of `longestIsCorrect`, and it exists because measuring only one
   * direction is how this bank drifted. Writing distractors "at full
   * specificity" and then matching the correct answer to them pushes the
   * correct answer terse, and the shipped bank reached 61% shortest while
   * reporting a healthy 3% longest. "Pick the shortest" was a better strategy
   * than "pick the longest" ever was, and nothing measured it.
   */
  shortestIsCorrect: number;
  /** Mean ratio of correct-option length to mean wrong-option length. ~1.0 ideal. */
  lengthRatio: number;
  /** Share of questions per correct letter. Should be roughly even. */
  letterSpread: Record<string, number>;
}

/**
 * Measures whether the quiz is gameable without reading the code.
 *
 * A high `longestIsCorrect` means people can score by picking the wordiest
 * option. A high `shortestIsCorrect` means the same trick works in reverse.
 * Either one makes the quiz stop measuring comprehension while still looking
 * fine, so both are gated.
 */
export function auditDistractors(qs: Question[]): DistractorAudit {
  if (qs.length === 0) {
    return { longestIsCorrect: 0, shortestIsCorrect: 0, lengthRatio: 1, letterSpread: {} };
  }

  let longestCount = 0;
  let shortestCount = 0;
  let ratioSum = 0;
  const letters: Record<string, number> = {};

  for (const q of qs) {
    const correct = q.options.find((o) => o.key === q.correct);
    const wrong = q.options.filter((o) => o.key !== q.correct);
    if (!correct || wrong.length === 0) continue;

    const wrongLengths = wrong.map((o) => o.text.length);
    if (correct.text.length > Math.max(...wrongLengths)) longestCount++;
    if (correct.text.length < Math.min(...wrongLengths)) shortestCount++;

    const meanWrong = wrong.reduce((s, o) => s + o.text.length, 0) / wrong.length;
    ratioSum += correct.text.length / meanWrong;

    letters[q.correct] = (letters[q.correct] ?? 0) + 1;
  }

  const spread: Record<string, number> = {};
  for (const [k, v] of Object.entries(letters)) spread[k] = v / qs.length;

  return {
    longestIsCorrect: longestCount / qs.length,
    shortestIsCorrect: shortestCount / qs.length,
    lengthRatio: ratioSum / qs.length,
    letterSpread: spread,
  };
}
