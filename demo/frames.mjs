/**
 * Emits the exact frames of a PopPR run as JSON, for the README GIF.
 *
 * Frames are built from the real question bank and the real scoring functions,
 * so the demo cannot drift from the product — if the scoring changes, the
 * numbers in the GIF change with it.
 */
import { bankQuestions } from "../dist/core/bank.js";
import { scoreAnswer, liveValue, comboMultiplier } from "../dist/core/score.js";
import { formatDuration } from "../dist/core/scorecard.js";

const W = 78;
const frames = [];

// Tiny markup: {c:text} where c is a style key. Parsed by the renderer.
const push = (lines, ms) => frames.push({ lines, ms });

function bar(fraction, width = 24) {
  const filled = Math.max(0, Math.min(width, Math.round(fraction * width)));
  const color = fraction > 0.5 ? "g" : fraction > 0.2 ? "y" : "r";
  return `{${color}:${"█".repeat(filled)}}{k:${"█".repeat(width - filled)}}`;
}

function wrap(text, width = 68, indent = "  ") {
  const words = text.split(/\s+/);
  const out = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) {
      out.push(indent + line.trim());
      line = w;
    } else line += " " + w;
  }
  if (line.trim()) out.push(indent + line.trim());
  return out;
}

const diffTag = (d) => `{${d === "hard" ? "r" : d === "medium" ? "y" : "g"}:${d}}`;

function header(remainingMs, totalMs, points, combo) {
  const streak = combo > 0 ? `   {y:combo x${comboMultiplier(combo).toFixed(1)}}` : "";
  return (
    `  {M:PopPR}  ${bar(remainingMs / totalMs)}  {W:${formatDuration(remainingMs)}}` +
    `     {c:${points.toLocaleString()} pts}${streak}`
  );
}

function questionFrame(q, remainingMs, totalMs, points, combo, elapsed, highlight) {
  const value = liveValue(q.difficulty, elapsed, combo);
  const pad = " ".repeat(Math.max(1, 42 - q.concept.length));
  const lines = [
    "",
    header(remainingMs, totalMs, points, combo),
    "",
    `  {d:Q${q.n}} ${diffTag(q.difficulty)} {d:· ${q.concept}}${pad}{d:+${value}}`,
    "",
    ...wrap(q.prompt),
    "",
  ];
  for (const o of q.options) {
    const on = highlight === o.key;
    const parts = wrap(o.text, 62, "").map((l) => l.trim());
    parts.forEach((part, i) => {
      if (i === 0) {
        lines.push(
          on
            ? `  {C:>}  {C:${o.key}}   {W:${part}}`
            : `     {c:${o.key}}   ${part}`,
        );
      } else {
        lines.push(on ? `         {W:${part}}` : `         {d:${part}}`);
      }
    });
  }
  lines.push("");
  lines.push(`  {d:press ${q.options.map((o) => o.key).join("/")}}`);
  return lines;
}

// ── build the run ──────────────────────────────────────────────────────────
const TOTAL = 180_000;
const pool = bankQuestions(
  [
    { concept: "promise-all", files: ["src/checkout.ts"] },
    { concept: "retry-backoff", files: ["src/checkout.ts"] },
    { concept: "unbounded-growth", files: ["src/checkout.ts"] },
  ],
  40,
);

const pick = (concept, difficulty) =>
  pool.find((q) => q.concept === concept && q.difficulty === difficulty) ??
  pool.find((q) => q.concept === concept);

const script = [
  { q: pick("promise-all", "medium"), right: true, ms: 7400, n: 1 },
  { q: pick("unbounded-growth", "medium"), right: false, ms: 9100, n: 2 },
  { q: pick("retry-backoff", "hard"), right: true, ms: 8800, n: 3 },
];

// 1. the command
push(["", "  {d:~/acme/shop}{W: $ }"], 500);
const cmd = "npx poppr";
for (let i = 1; i <= cmd.length; i++) {
  push(["", `  {d:~/acme/shop}{W: $ ${cmd.slice(0, i)}}`], 55);
}
push(["", `  {d:~/acme/shop}{W: $ ${cmd}}`], 450);

// 2. spinner
const spinnerSteps = [
  ["Finding your PR", 3],
  ["Reading the diff", 3],
  ["Building your quiz", 3],
];
const dots = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧"];
let si = 0;
for (const [text, reps] of spinnerSteps) {
  for (let i = 0; i < reps; i++) {
    push(["", `  {d:~/acme/shop}{W: $ ${cmd}}`, "", `  {M:${dots[si++ % 8]}} {d:${text}}`], 130);
  }
}

// 3. the brief + countdown
const brief = [
  "",
  "  {M:PopPR}  {d:PR #142 · acme/shop}  {d:quick}",
  "  {d:3:00 on the clock · answer as many as you can}",
  "  {d:hard questions are worth 3.5x. speed and streaks multiply.}",
  "",
];
push(brief, 900);
for (const n of ["3", "2", "1"]) push([...brief, `  {C:${n}}`], 480);

// 4. play
let points = 0;
let combo = 0;
let remaining = TOTAL;
const answered = [];

for (const step of script) {
  const q = { ...step.q, n: step.n };
  const chosen = step.right
    ? q.correct
    : q.options.find((o) => o.key !== q.correct).key;

  // reading the question — clock visibly moving, points visibly draining
  for (let t = 0; t < step.ms; t += 1200) {
    remaining -= 1200;
    push(questionFrame(q, remaining, TOTAL, points, combo, t, null), 190);
  }
  // selection highlight
  push(questionFrame(q, remaining, TOTAL, points, combo, step.ms, chosen), 330);

  const ev = step.right
    ? scoreAnswer(q.difficulty, step.ms, combo)
    : { points: 0 };
  points += ev.points;
  combo = step.right ? combo + 1 : 0;
  answered.push({ ...step, q, chosen, points: ev.points });

  // flash — no text to read, so the run never loses momentum
  if (step.right) {
    push(["", "", `  {P:✓}`, "", `        {c:+${ev.points}}`, combo >= 2 ? `        {y:${combo} in a row}` : ""], 700);
  } else {
    push(["", "", `  {F:✗}`, "", `        {d:answer was ${q.correct}}`], 850);
  }
}

// 5. review
const rule = "[rule]";
const correct = answered.filter((a) => a.right).length;
const review = [
  "",
  rule,
  `  {M:PopPR}  {W:${correct}/3}   {c:${points.toLocaleString()} pts}   {d:0:25}   {y:best combo 1}`,
  `  {d:You can describe the change but not its failure modes.}`,
  rule,
  "",
  "  {W:What you missed (1)}",
  "",
];
const miss = answered.find((a) => !a.right);
const missChosen = miss.q.options.find((o) => o.key === miss.chosen);
const missCorrect = miss.q.options.find((o) => o.key === miss.q.correct);
review.push(`  {d:·} {W:${miss.q.concept}} {d:(${miss.q.difficulty})}`);
review.push(...wrap(miss.q.prompt, 66, "     "));
review.push("");
review.push(`     {R:✗ you said}  ${missChosen.text.slice(0, 52)}`);
if (missChosen.whyTempting) {
  review.push(
    ...wrap(missChosen.whyTempting, 60, "").map((l) => `       {d:${l.trim()}}`),
  );
}
review.push(`     {G:✓ answer}    ${missCorrect.text.slice(0, 52)}`);
review.push("");
review.push(...wrap(miss.q.explanation, 64, "").map((l) => `     ${l.trim()}`));
review.push(`     {d:→ src/checkout.ts}`);
review.push("");
push(review, 4200);

// 6. the shareable card
const card = [
  "",
  rule,
  `  {M:PopPR}  {W:${correct}/3}   {c:${points.toLocaleString()} pts}   {d:0:25}`,
  rule,
  "",
  "  {W:Getting better}",
  "     {d:async/concurrency}        {d:61%} {d:→} {G:79%}",
  "     {d:retry-backoff}            {d:55%} {d:→} {G:72%}",
  "",
  rule,
  "",
  "  {d:share:}",
  "",
  `  {W:PopPR #142 · 2/3 · 0:25 · }{y:12 day streak}`,
  "  [green][red][green]",
  "  {d:weakest: unbounded-growth}",
  "",
  "  {d:These come back in a future run, on a different PR.}",
  "",
  "  {C:r}{d: to retry the 1 you missed, any other key to finish}",
  "",
];
push(card, 4200);

// 7. the second pass. Retrieval is what encodes, so the miss gets asked again:
// no clock, no points, and the explanation shows immediately this time.
const second = [
  "",
  "  {M:PopPR}  {d:second pass  1/1}",
  "",
  `  {d:${miss.q.concept}}`,
  "",
  ...wrap(miss.q.prompt, 66, "  "),
  "",
];
for (const o of miss.q.options) {
  second.push(`    {c:${o.key}}   ${o.text.slice(0, 58)}`);
}
second.push("", "  {d:no clock, no points}");
push(second, 3200);

const secondPicked = second.map((l) =>
  l.includes(missCorrect.text.slice(0, 58))
    ? `    {C:>}  {C:${miss.q.correct}}   {W:${missCorrect.text.slice(0, 58)}}`
    : l,
);
push(secondPicked, 700);

push(
  [
    "",
    // {P:} is the hero/flash style. The second pass is a quiet screen, so this
    // stays a normal-size green line.
    "  {G:✓ right}",
    "",
    ...wrap(miss.q.explanation, 64, "  "),
    "",
    "  {M:PopPR}  {W:1/1} on the second pass",
    "  {d:All of them. These still come back on a future PR.}",
    "",
  ],
  4200,
);

process.stdout.write(JSON.stringify({ width: W, frames }, null, 0));
