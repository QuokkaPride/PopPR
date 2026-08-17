/** Exercise --deep end to end without needing a TTY game loop. */
import { generateQuizStreaming } from "../dist/core/quiz.js";
import { auditDistractors } from "../dist/core/quiz.js";
import { detectProvider } from "../dist/core/providers/index.js";
import { readDiff } from "../dist/core/diff.js";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Was hardcoded to one machine's home directory, so this could only ever run
// for its author. Resolve from this file instead.
const REPO = dirname(dirname(fileURLToPath(import.meta.url)));

const t0 = Date.now();
const ctx = await readDiff({ cwd: REPO, base: process.argv[2] || "HEAD~1" });
console.log(`diff: ${ctx.label}, ${ctx.files.length} files, ${ctx.files.reduce((s,f)=>s+f.additions,0)} adds`);

const { provider, note } = await detectProvider();
console.log(`provider: ${note}`);

const batches = [];
const all = [];
try {
  await generateQuizStreaming(ctx, provider, {
    onBatch(batch) {
      const ms = Date.now() - t0;
      batches.push({ n: batch.length, ms });
      all.push(...batch);
      console.log(`  batch ${batches.length}: ${batch.length} questions at ${(ms/1000).toFixed(1)}s`);
    },
  });
} catch (err) {
  console.error(`\nFAILED after ${((Date.now()-t0)/1000).toFixed(1)}s`);
  console.error(err?.message ?? err);
  process.exit(1);
}

const total = (Date.now() - t0) / 1000;
console.log(`\ntotal ${total.toFixed(1)}s, ${all.length} questions`);

// ── quality ───────────────────────────────────────────────────────────────
const a = auditDistractors(all);
console.log(`\ncorrect-is-longest  ${(a.longestIsCorrect*100).toFixed(0)}%`);
console.log(`correct-is-shortest ${(a.shortestIsCorrect*100).toFixed(0)}%`);
console.log(`length ratio        ${a.lengthRatio.toFixed(2)}`);
const ranks = [0,0,0,0];
for (const q of all) {
  const sorted = [...q.options].sort((x,y)=>y.text.length-x.text.length);
  const r = sorted.findIndex(o=>o.key===q.correct);
  if (r>=0&&r<4) ranks[r]++;
}
console.log(`length rank         ` + ranks.map((n,i)=>`#${i+1} ${Math.round(100*n/all.length)}%`).join("  "));
const letters = {};
for (const q of all) letters[q.correct] = (letters[q.correct]??0)+1;
console.log(`letter spread       ` + Object.entries(letters).sort().map(([k,v])=>`${k} ${Math.round(100*v/all.length)}%`).join("  "));

const arche = {}, diffs = {};
for (const q of all) { arche[q.archetype]=(arche[q.archetype]??0)+1; diffs[q.difficulty]=(diffs[q.difficulty]??0)+1; }
console.log(`archetypes          ` + Object.entries(arche).map(([k,v])=>`${k} ${v}`).join(", "));
console.log(`difficulty          ` + Object.entries(diffs).map(([k,v])=>`${k} ${v}`).join(", "));

// ── structural validity ───────────────────────────────────────────────────
const problems = [];
for (const q of all) {
  if (!q.prompt) problems.push(`${q.id}: no prompt`);
  if (!q.options || q.options.length !== 4) problems.push(`${q.id}: ${q.options?.length} options`);
  if (!q.options?.some(o=>o.key===q.correct)) problems.push(`${q.id}: correct "${q.correct}" is not an option key`);
  if (!q.explanation) problems.push(`${q.id}: no explanation`);
  if (!q.concept) problems.push(`${q.id}: no concept`);
  const dupes = new Set(q.options?.map(o=>o.text)).size !== q.options?.length;
  if (dupes) problems.push(`${q.id}: duplicate option text`);
  if (/—|–/.test(q.prompt + q.explanation + q.options.map(o=>o.text).join(""))) problems.push(`${q.id}: em dash`);
}
const prompts = all.map(q=>q.prompt);
if (new Set(prompts).size !== prompts.length) problems.push(`duplicate prompts across batches`);
console.log(`\n${problems.length} structural problems`);
for (const p of problems.slice(0, 15)) console.log(`  - ${p}`);

console.log(`\n─── sample ───`);
for (const q of all.slice(0, 2)) {
  console.log(`\n[${q.difficulty}/${q.archetype}/${q.concept}]`);
  console.log(q.prompt);
  for (const o of q.options) console.log(`  ${o.key===q.correct?"✓":" "} ${o.key}. ${o.text}`);
  console.log(`  → ${q.explanation}`);
}
