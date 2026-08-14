import type { PrContext, Provider } from "./types.js";
import type { DetectedConcept } from "./concepts.js";
import { renderDiff } from "./diff.js";
import { bankConcepts } from "./bank.js";

/**
 * Smart mode: use a model to decide WHICH concepts this diff exercises, then
 * serve curated bank questions for them.
 *
 * This is the middle tier, and it exists because pattern matching answers
 * "does the text `Promise.all` appear?" when the question you actually want
 * answered is "is concurrency a real risk in this change?". A regex flags
 * `.sort()` in a two-line test fixture; it misses an N+1 spread across a
 * service and a repository file.
 *
 * The reason this is fast where full question generation is slow: the output is
 * a short list of slugs, not eighteen written questions. The model reads the
 * diff once and emits a few dozen tokens, so it runs in seconds rather than
 * minutes — and the questions the user then sees were still hand-written.
 */
export async function classifyConcepts(
  ctx: PrContext,
  provider: Provider,
): Promise<DetectedConcept[]> {
  const available = bankConcepts();

  const prompt = `You are triaging a pull request to decide which engineering concepts the
author should be quizzed on.

Below is a list of concept slugs. Pick ONLY the ones this diff genuinely
exercises in a way that could bite in production. Judge the change on substance,
not on whether a keyword appears:

- Include a concept if the change actually depends on that behaviour being
  understood — a Promise.all whose rejection semantics matter, a query inside a
  loop, a cache with no eviction, a nullable column in a filter.
- EXCLUDE a concept if it only appears incidentally: in a test fixture, in a
  comment, in generated code, or in a form where the risk plainly does not
  apply. A .sort() on a freshly built local array is not an aliasing risk.
- Prefer 3 to 6 concepts. Never pad the list to fill a quota — a short accurate
  list produces a better quiz than a long speculative one.

Available concepts:
${available.join(", ")}

For each concept you pick, give the files where it matters and one short reason.

Return ONLY JSON, no prose and no markdown fences:
{"concepts":[{"concept":"promise-all","files":["src/checkout.ts"],"why":"two provider charges run concurrently and partial failure is unhandled"}]}

Here is the pull request:

${renderDiff(ctx)}`;

  const raw = await provider.generate(prompt, { maxTokens: 1500 });
  return parse(raw, available);
}

function parse(raw: string, available: string[]): DetectedConcept[] {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return [];

  let parsed: { concepts?: Array<{ concept?: string; files?: string[]; why?: string }> };
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return [];
  }

  const valid = new Set(available);
  const out: DetectedConcept[] = [];

  for (const item of parsed.concepts ?? []) {
    const concept = item?.concept?.toLowerCase().trim();
    // Silently drop hallucinated slugs — a concept with no bank entries would
    // just produce an empty quiz section.
    if (!concept || !valid.has(concept)) continue;
    out.push({
      concept,
      files: Array.isArray(item.files) ? item.files.slice(0, 4) : [],
      weight: 1,
      why: item.why,
    });
  }
  return out;
}
