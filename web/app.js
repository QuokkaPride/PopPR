/**
 * PopPR in the browser, for public repositories.
 *
 * The point of this file is how little of it there is. Detection, question
 * selection, the difficulty staircase, scoring and the scorecard are all
 * imported unchanged from the same modules the CLI uses, because `src/core/`
 * was kept free of terminal concerns. What is written here is only the parts
 * that differ: fetching a diff over HTTP instead of shelling out to
 * git, and drawing to the DOM instead of to a terminal.
 *
 * Public repos only, and that is a positioning choice rather than a limitation.
 * Open source is public by definition, so the GitHub API needs no token, which
 * means no login, no account and no backend. Private repositories keep the
 * terminal path, where `gh` already holds the credentials.
 *
 * Certify mode (`&certify=1`) is the same run with a different ending: the
 * timed pass still only scores you, and afterwards `MasteryLoop` re-asks
 * whatever is not yet right until all of it is. The rules of that ending are
 * core's, not this file's, so the browser and the terminal cannot drift.
 */
import { codeFiles, detectConcepts } from "./vendor/core/concepts.js";
import { bankQuestions, certifySet } from "./vendor/core/bank.js";
import { UNIVERSAL_CONCEPTS } from "./vendor/bank/index.js";
import { Staircase } from "./vendor/core/adaptive.js";
import { MasteryLoop } from "./vendor/core/mastery.js";
import { certifyComment, MAX_CERTIFY_QUESTIONS } from "./vendor/core/certify.js";
import { scoreAnswer, liveValue } from "./vendor/core/score.js";
import { scorecard, verdictLine, formatDuration } from "./vendor/core/scorecard.js";

/** Default clock. A certify link can override it with `&t=` seconds. */
const RUN_MS = 180_000;
/** Input ignored for this long after a question appears, so a late keypress
 *  from the previous one cannot answer this one. */
const GUARD_MS = 500;
/** A correct answer has nothing to read, so it only needs a beat. A miss waits
 *  for you instead, with the clock stopped. */
const HIT_MS = 900;
const $ = (id) => document.getElementById(id);
const screens = [...document.querySelectorAll(".screen")];

function show(id) {
  for (const s of screens) s.hidden = s.id !== id;
}

// ── loading a PR ───────────────────────────────────────────────────────────

const PR_URL = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

function parseTarget(raw) {
  const m = PR_URL.exec(raw.trim());
  if (m) return { owner: m[1], repo: m[2], number: Number(m[3]) };
  // Also accept "owner/repo#123" and "owner/repo/123", which is what people
  // type when they are not pasting.
  const short = /^([^/\s]+)\/([^/#\s]+)[#/](\d+)$/.exec(raw.trim());
  if (short) return { owner: short[1], repo: short[2], number: Number(short[3]) };
  return null;
}

/**
 * The run options a certify link carries: `?pr=owner/repo/N&certify=1&n=8&t=120`,
 * exactly what `quizUrl` in core emits.
 *
 * Presence of `certify` is the switch rather than its value, because the link
 * builder only ever writes `certify=1` and a value nobody writes is a value
 * nobody has to agree on. `n` and `t` are hints from a maintainer's workflow
 * config, so they arrive from a repo the player does not control: anything that
 * is not a sane positive integer is dropped and the defaults stand.
 */
function readOptions(params) {
  return {
    certify: params.has("certify"),
    questions: positiveInt(params.get("n"), MAX_CERTIFY_QUESTIONS),
    time: positiveInt(params.get("t"), 3600),
  };
}

function positiveInt(raw, max) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 0;
  return Math.min(n, max);
}

/**
 * Built by hand rather than with core's `quizUrl`, which returns the canonical
 * hosted URL. Rewriting the address bar to another origin mid-run would reload
 * the page for anyone running this locally or from a fork.
 */
function queryFor(target, opts) {
  let q = `?pr=${target.owner}/${target.repo}/${target.number}`;
  if (opts.certify) {
    q += "&certify=1";
    if (opts.questions) q += `&n=${opts.questions}`;
    if (opts.time) q += `&t=${opts.time}`;
  }
  return q;
}

async function fetchPr({ owner, repo, number }) {
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = { Accept: "application/vnd.github+json" };

  const [prRes, filesRes] = await Promise.all([
    fetch(`${base}/pulls/${number}`, { headers }),
    fetch(`${base}/pulls/${number}/files?per_page=100`, { headers }),
  ]);

  if (prRes.status === 404) {
    throw new Error(
      "Not found. This works on public repositories only; for a private one, run `npx @quokkapride/poppr` in your terminal.",
    );
  }
  if (prRes.status === 403) {
    throw new Error(
      "GitHub rate-limited this browser (60 requests an hour without a token). Try again shortly, or run it in your terminal.",
    );
  }
  if (!prRes.ok || !filesRes.ok) {
    throw new Error(`GitHub returned ${prRes.status}. Check the URL and try again.`);
  }

  const pr = await prRes.json();
  const files = await filesRes.json();

  // The GitHub API already hands back exactly the shape `PrContext` wants, so
  // this is a rename rather than a translation.
  return {
    label: `PR #${number}`,
    repo: `${owner}/${repo}`,
    base: pr.base?.ref ?? "",
    head: pr.head?.ref ?? "",
    // Certification binds to a commit: a push invalidates it, the same way it
    // invalidates a review approval. Without this the comment cannot say which
    // diff was answered for.
    headSha: pr.head?.sha ?? "",
    title: pr.title,
    body: pr.body ?? "",
    url: pr.html_url,
    files: files
      .filter((f) => f.patch)
      .map((f) => ({
        path: f.filename,
        status: f.status === "removed" ? "deleted" : f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      })),
  };
}

// ── history, the localStorage version of ~/.poppr/history.json ─────────────

const STORE = "poppr.history.v1";

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORE)) ?? { runs: [] };
  } catch {
    return { runs: [] };
  }
}

function recordRun(result) {
  const h = loadHistory();
  h.runs.push({
    at: new Date().toISOString(),
    correct: result.correctCount,
    total: result.answered.length,
    points: result.points,
    concepts: result.answered.map((a) => ({ c: a.question.concept, ok: a.correct })),
  });
  try {
    localStorage.setItem(STORE, JSON.stringify(h));
  } catch {
    // Private browsing. Losing the streak is not worth breaking the run over.
  }
  return h;
}

/**
 * Core's `currentStreak`, over localStorage.
 *
 * Keyed on UTC days rather than local ones, unlike core/history.ts, which moved
 * to local components because a late-evening run is already tomorrow in UTC and
 * players far east or west lost days they had played. This copy still has that
 * bug: it cannot import the fixed version because history.ts touches node:fs
 * and build-web.mjs skips it.
 */
function currentStreak(history) {
  const days = new Set(history.runs.map((r) => r.at.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) streak++;
    else if (streak > 0 || days.size === 0) break;
    else if (streak === 0 && key !== new Date().toISOString().slice(0, 10)) break;
    cursor.setDate(cursor.getDate() - 1);
    if (streak > 400) break;
  }
  return streak;
}

// ── the run ────────────────────────────────────────────────────────────────

const state = {
  ctx: null,
  staircase: null,
  certify: false,
  /** The certify set, kept whole: the mastery loop and the comment both need
   *  every question, not just the ones the clock reached. */
  pool: [],
  runMs: RUN_MS,
  answered: [],
  points: 0,
  combo: 0,
  bestCombo: 0,
  question: null,
  deadline: 0,
  askedAt: 0,
  readyAt: 0,
  pausedAt: 0,
  ticker: null,
  locked: false,
};

async function load(target, opts) {
  show("loading");
  $("loading-text").textContent = "Reading the diff";
  const ctx = await fetchPr(target);

  $("loading-text").textContent = "Choosing questions";
  const detected = detectConcepts(ctx);
  // A certify set is smaller and round-robins across concepts, because every
  // question in it has to be answered correctly before merging and one concept
  // must not be able to monopolise that.
  const topUp = { codeFiles: codeFiles(ctx) };
  const questions = opts.certify
    ? certifySet(detected, { limit: opts.questions || 10, topUp })
    : bankQuestions(detected, 20, topUp);

  if (!questions.length) {
    throw new Error(
      `Nothing to ask about ${ctx.label}: it adds no lines of code that PopPR can read. Documentation, lockfile and generated-code changes come up empty on purpose.`,
    );
  }

  state.ctx = ctx;
  state.certify = opts.certify;
  state.pool = questions;
  state.runMs = opts.time ? opts.time * 1000 : RUN_MS;
  state.staircase = new Staircase();
  state.staircase.add(questions);

  $("brief-label").textContent = `${ctx.repo} ${ctx.label}`;
  $("brief-detail").textContent =
    `${detected.length} concept${detected.length === 1 ? "" : "s"} in this diff · ` +
    `${questions.length} questions · ${formatDuration(state.runMs)} on the clock`;
  $("brief-certify").hidden = !state.certify;
  show("brief");
}

function start() {
  $("clock").textContent = formatDuration(state.runMs);
  state.deadline = Date.now() + state.runMs;
  state.ticker = setInterval(tick, 200);
  show("game");
  next();
}

function tick() {
  if (state.pausedAt) return; // reading a miss; the clock is stopped
  const remaining = Math.max(0, state.deadline - Date.now());
  $("clock").textContent = formatDuration(remaining);
  $("track-fill").style.width = `${(remaining / state.runMs) * 100}%`;
  if (state.question && !state.locked) {
    const value = liveValue(state.question.difficulty, Date.now() - state.askedAt, state.combo);
    $("q-value").textContent = `+${value}`;
  }

  if (remaining > 0) return;

  // Time is up, but taking the question away while someone is halfway through
  // reading it is the worst moment to end on. Stop issuing new questions and
  // let this one be finished; the flash handler ends the run afterwards.
  if (!$("game").hidden && state.question && !state.locked) {
    $("clock").textContent = "0:00";
    $("clock").classList.add("expired");
    $("q-value").textContent = "last one";
    return;
  }
  if (!$("flash").hidden) return;
  finish();
}

/** Freeze the countdown. `deadline` is absolute, so resuming shifts it by the
 *  time spent paused rather than trying to track remaining time separately. */
function pauseClock() {
  state.pausedAt = Date.now();
}

function resumeClock() {
  if (!state.pausedAt) return;
  state.deadline += Date.now() - state.pausedAt;
  state.pausedAt = 0;
}

/** Any key or click continues. No specific key to hunt for, and no button to
 *  aim at, because the run should stay playable from the keyboard alone. */
function waitForContinue() {
  return new Promise((resolve) => {
    const done = () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("click", onClick, true);
      resolve();
    };
    const onKey = (e) => {
      if (e.repeat) return;
      e.stopPropagation(); // never let this keypress answer the next question
      e.preventDefault();
      done();
    };
    const onClick = () => done();
    // Capture phase, so the global answer handler cannot see this one.
    document.addEventListener("keydown", onKey, true);
    // A click on the very same tick that opened this would dismiss it instantly.
    setTimeout(() => document.addEventListener("click", onClick, true), 60);
  });
}

/**
 * The line in your own diff that caused this question.
 *
 * A bank question with only a concept tag reads as trivia bolted onto a PR:
 * "promise-all" does not tell you that YOU wrote one in checkout.ts an hour
 * ago. One line closes that, and it links straight into the PR's Files tab so
 * the answer to "where?" is a click rather than a search.
 */
function showWhy(question) {
  const row = $("why");
  const ev = question.evidence && question.evidence[0];
  if (!ev) {
    // A topped-up general question was not triggered by anything, and saying so
    // beats a blank row: "why am I being asked this" is what this row is for.
    if (UNIVERSAL_CONCEPTS.has(question.concept)) {
      const link = $("why-where");
      link.textContent = "general engineering";
      link.removeAttribute("href");
      $("why-code").textContent = "not from a line in this diff";
      row.hidden = false;
      return;
    }
    row.hidden = true;
    return;
  }

  const where = ev.line ? `${ev.file}:${ev.line}` : ev.file;
  const link = $("why-where");
  link.textContent = where;
  // GitHub anchors a diff line by the SHA-256 of the file path, which we cannot
  // compute here, so link to the Files tab and let the browser's find do the
  // rest. A link that lands on the right file beats no link.
  link.setAttribute("href", state.ctx?.url ? `${state.ctx.url}/files` : "#");
  $("why-code").textContent = ev.text;
  row.hidden = false;
}

function next() {
  const q = state.staircase.next();
  if (!q) return finish();

  state.question = q;
  state.askedAt = Date.now();
  state.locked = false;
  // A key pressed while the previous answer was still on screen used to land on
  // this question the instant it rendered, which reads as the quiz answering
  // for you. Ignore input until the question has been up long enough to read a
  // word of it.
  state.readyAt = Date.now() + GUARD_MS;

  $("q-number").textContent = `Q${state.answered.length + 1}`;
  $("q-difficulty").textContent = q.difficulty;
  $("q-difficulty").className = `diff ${q.difficulty}`;
  $("q-concept").textContent = q.concept;
  showWhy(q);
  rich($("prompt"), q.prompt);

  const list = $("options");
  list.replaceChildren();
  for (const o of q.options) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "option";
    btn.dataset.key = o.key;
    const kbd = document.createElement("span");
    kbd.className = "key";
    kbd.textContent = o.key;
    const text = document.createElement("span");
    rich(text, o.text);
    btn.append(kbd, text);
    btn.addEventListener("click", () => answer(o.key));
    li.append(btn);
    list.append(li);
  }
  show("game");
}

function answer(key) {
  if (state.locked || !state.question) return;
  if (Date.now() < state.readyAt) return;
  state.locked = true;

  const q = state.question;
  const ms = Date.now() - state.askedAt;
  const correct = key === q.correct;
  const event = correct
    ? scoreAnswer(q.difficulty, ms, state.combo)
    : { points: 0 };

  state.points += event.points;
  state.combo = correct ? state.combo + 1 : 0;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.answered.push({
    question: q,
    chosen: key,
    correct,
    ms,
    points: event.points,
    comboAt: state.combo,
  });

  $("points").textContent = state.points.toLocaleString();
  $("combo").hidden = state.combo < 1;
  $("combo").textContent = `x${(1 + 0.1 * Math.min(state.combo, 10)).toFixed(1)}`;

  $("flash-mark").textContent = correct ? "✓" : "✗";
  $("flash-mark").className = correct ? "hit" : "miss";

  if (correct) {
    $("flash-sub").textContent = `+${event.points}`;
    $("flash-cont").hidden = true;
    show("flash");
    setTimeout(() => {
      if (Date.now() >= state.deadline) return finish();
      next();
    }, HIT_MS);
    return;
  }

  // A miss is the only moment in the run with something to read, and reading
  // under a running clock is exactly the trade this game should never ask for:
  // the timer is meant to measure whether you know it, not how fast you read.
  // So the clock stops, and you decide when to move on.
  const right = q.options.find((o) => o.key === q.correct);
  rich($("flash-sub"), right ? right.text : `answer was ${q.correct}`);
  $("flash-cont").hidden = false;
  show("flash");
  pauseClock();
  waitForContinue().then(() => {
    resumeClock();
    if (Date.now() >= state.deadline) return finish();
    next();
  });
}

function buildResult() {
  const missed = {};
  for (const a of state.answered) {
    if (!a.correct) missed[a.question.concept] = (missed[a.question.concept] ?? 0) + 1;
  }
  return {
    prLabel: state.ctx.label,
    repo: state.ctx.repo,
    answered: state.answered,
    correctCount: state.answered.filter((a) => a.correct).length,
    totalMs: state.runMs - Math.max(0, state.deadline - Date.now()),
    points: state.points,
    bestCombo: state.bestCombo,
    weakConcepts: Object.keys(missed).sort((a, b) => missed[b] - missed[a]),
    streak: 0,
  };
}

function finish() {
  clearInterval(state.ticker);
  state.ticker = null;
  if (!state.answered.length) {
    // A certify run that answered nothing still has the whole set to master,
    // and there is no review worth showing for zero answers, so skip to it.
    if (state.certify) return startMastery();
    show("landing");
    return;
  }

  const result = buildResult();
  const history = recordRun(result);
  result.streak = currentStreak(history);

  $("final-score").textContent = `${result.correctCount}/${result.answered.length}`;
  $("final-points").textContent = `${result.points.toLocaleString()} pts`;
  $("final-time").textContent = formatDuration(result.totalMs);
  rich($("verdict"), verdictLine(result));
  $("scorecard").textContent = scorecard(result, history.runs.length);
  $("pr-link").href = state.ctx.url ?? "#";

  const misses = state.answered.filter((a) => !a.correct);
  renderMisses(misses);

  if (state.certify) {
    // The retry offer is an invitation you can decline. Certification is the
    // rest of the run, so it takes that slot rather than sitting beside it.
    // The review screen still comes first: reading what you missed is the part
    // that makes the next pass shorter.
    $("retry-offer").hidden = true;
    // Built only to word the button. The loop has no side effects until next()
    // is called, and asking it what is left beats recomputing that out here.
    const left = new MasteryLoop(state.pool, state.answered).progress.remaining;
    $("certify-go").textContent = left
      ? `Answer the remaining ${left} until every one is right`
      : "Get your certify comment";
    $("certify-offer").hidden = false;
  } else {
    $("retry-offer").hidden = misses.length === 0;
  }
  show("review");
}

function renderMisses(misses) {
  const host = $("misses");
  host.replaceChildren();
  if (!misses.length) {
    const p = document.createElement("p");
    p.className = "clean";
    p.textContent = "Clean run. Nothing to review.";
    host.append(p);
    return;
  }

  const h = document.createElement("h3");
  h.textContent = `What you missed (${misses.length})`;
  host.append(h);

  for (const m of misses) {
    const q = m.question;
    const picked = q.options.find((o) => o.key === m.chosen);
    const right = q.options.find((o) => o.key === q.correct);

    const box = document.createElement("article");
    box.className = "miss";
    box.append(el("p", "concept", q.concept), el("p", "prompt", q.prompt));
    if (picked) box.append(el("p", "wrong", `✗ you said  ${picked.text}`));
    // The line that names the misconception is the most useful thing on this
    // screen, so it is not tucked away.
    if (picked?.whyTempting) box.append(el("p", "why", picked.whyTempting));
    if (right) box.append(el("p", "right", `✓ answer  ${right.text}`));
    if (q.explanation) box.append(el("p", "explain", q.explanation));
    if (q.anchors?.length) box.append(el("p", "anchors", q.anchors.slice(0, 3).join(", ")));
    host.append(box);
  }
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  n.className = cls;
  rich(n, text);
  return n;
}

/**
 * Bank text uses `backticks` for code, which the terminal renders as-is because
 * a terminal has no other way to mark a span. On a page they showed up as
 * literal backtick characters in the middle of a sentence, which is a real
 * readability cost on prompts that are mostly identifiers. Split on the ticks
 * and emit <code> instead. Text nodes throughout, so nothing here can inject
 * markup from a question.
 */
function rich(node, text) {
  node.replaceChildren();
  const parts = String(text ?? "").split("`");
  parts.forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 1) {
      const code = document.createElement("code");
      code.textContent = part;
      node.append(code);
    } else {
      node.append(document.createTextNode(part));
    }
  });
}

// ── second pass, and the mastery loop that borrows its screen ──────────────

const second = {
  queue: [],
  index: 0,
  correct: 0,
  /** The question on screen. In mastery mode it is the loop's own re-shuffled
   *  copy, so nothing may read options or `correct` off the original. */
  current: null,
  /** A `MasteryLoop` in certify mode, null for the ordinary retry. */
  loop: null,
  readyAt: 0,
};

/** The optional retry after an ordinary run: one untimed sweep of the misses. */
function startSecondPass() {
  second.loop = null;
  second.queue = state.answered.filter((a) => !a.correct).map((a) => a.question);
  second.index = 0;
  second.correct = 0;
  askSecond();
}

/**
 * Certify's ending, on the same screen.
 *
 * Nothing here tracks a queue or an index: which question comes next, when a
 * miss comes back and what counts as finished are `MasteryLoop`'s to decide, so
 * the browser and the CLI cannot disagree about when someone is done. The
 * timed pass is handed over as the first pass, so anything already answered
 * correctly under the clock is not asked again.
 */
function startMastery() {
  second.queue = [];
  second.index = 0;
  second.correct = 0;
  second.loop = new MasteryLoop(state.pool, state.answered);
  askSecond();
}

function askSecond() {
  if (second.loop) {
    const q = second.loop.next();
    if (!q) return showCertified();
    // Read after next(), which is where the pass number turns over.
    const p = second.loop.progress;
    renderSecond(q, `mastery · pass ${p.pass} · ${p.remaining} left`);
    return;
  }

  if (second.index >= second.queue.length) {
    $("verdict").textContent =
      `${second.correct}/${second.queue.length} on the second pass. ` +
      (second.correct === second.queue.length
        ? "These still come back on a future PR."
        : "The rest come back on a future PR.");
    $("retry-offer").hidden = true;
    show("review");
    return;
  }

  renderSecond(
    second.queue[second.index],
    `second pass  ${second.index + 1}/${second.queue.length}`,
  );
}

function renderSecond(q, progress) {
  second.current = q;
  // The same guard the timed screen uses. It matters more here: mastery asks
  // question after question, so a key still travelling from the last reveal
  // would otherwise land on the one that just rendered.
  second.readyAt = Date.now() + GUARD_MS;

  $("second-progress").textContent = progress;
  $("second-concept").textContent = q.concept;
  rich($("second-prompt"), q.prompt);
  $("second-reveal").hidden = true;

  const list = $("second-options");
  list.replaceChildren();
  for (const o of q.options) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "option";
    btn.dataset.key = o.key;
    const kbd = document.createElement("span");
    kbd.className = "key";
    kbd.textContent = o.key;
    const text = document.createElement("span");
    rich(text, o.text);
    btn.append(kbd, text);
    btn.addEventListener("click", () => revealSecond(o.key));
    li.append(btn);
    list.append(li);
  }
  show("second");
}

function revealSecond(key) {
  const q = second.current;
  if (!q || !$("second-reveal").hidden) return; // already graded this one
  if (Date.now() < second.readyAt) return;

  const ok = key === q.correct;
  if (second.loop) second.loop.record(ok);
  else if (ok) second.correct++;

  const picked = q.options.find((o) => o.key === key);
  const right = q.options.find((o) => o.key === q.correct);

  $("second-mark").textContent = ok ? "✓ right" : "✗ still wrong";
  $("second-mark").className = ok ? "right" : "wrong";
  rich($("second-why"), !ok && picked?.whyTempting ? picked.whyTempting : "");
  rich($("second-answer"), ok ? "" : `answer  ${right?.text ?? ""}`);
  rich($("second-explain"), q.explanation ?? "");
  $("second-reveal").hidden = false;
  $("second-options").replaceChildren();
}

// ── certified ──────────────────────────────────────────────────────────────

/**
 * The end of a certify run: a comment to paste, and nothing about how it went.
 *
 * The loop's attempt count never leaves core, so there is nothing on this
 * screen that could publish how many tries it took. That is the whole deal the
 * gate rests on: finishing is public, struggling is not.
 */
function showCertified() {
  const sha = state.ctx?.headSha ?? "";
  const n = state.pool.length;

  $("certified-detail").textContent =
    `${n} question${n === 1 ? "" : "s"}${sha ? ` on ${sha.slice(0, 7)}` : ""}`;
  $("certify-pr").href = state.ctx?.url ?? "#";

  // A marker with no sha in it is ignored in silence by the verifier, so
  // offering the comment anyway would look like certifying and do nothing.
  // Say what happened instead and point at the terminal, which reads the sha
  // from git rather than from the API. The link to the PR stays either way.
  const bound = Boolean(sha);
  $("certify-how").hidden = !bound;
  $("certify-comment").hidden = !bound;
  $("certify-copy").hidden = !bound;
  $("certify-warning").hidden = bound;
  if (bound) {
    $("certify-comment").textContent = certifyComment({ headSha: sha, questions: state.pool });
  }
  show("certified");
}

// ── wiring ─────────────────────────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  if (e.repeat) return; // holding a key must not answer question after question
  // Ctrl+F and friends: without this the browser opened find AND the run
  // answered F, burning the question. Any modifier means the key was not ours.
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toUpperCase();
  if (!["A", "B", "C", "D", "E", "F"].includes(key)) return;
  if (!$("game").hidden) answer(key);
  else if (!$("second").hidden && $("second-reveal").hidden) revealSecond(key);
});

$("load-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const target = parseTarget($("pr-url").value);
  const err = $("landing-error");
  err.hidden = true;
  if (!target) {
    err.textContent = "That does not look like a pull request URL.";
    err.hidden = false;
    return;
  }
  // Certify options survive a hand-typed PR: someone typing here arrived on a
  // certify link and hit an error, so the repo's rules still apply.
  const opts = readOptions(new URLSearchParams(location.search));
  try {
    history.replaceState(null, "", queryFor(target, opts));
    await load(target, opts);
  } catch (e2) {
    err.textContent = e2.message;
    err.hidden = false;
    show("landing");
  }
});

$("start").addEventListener("click", start);
$("retry").addEventListener("click", startSecondPass);
$("certify-go").addEventListener("click", startMastery);
$("second-next").addEventListener("click", () => {
  // Mastery keeps its own place in the set; the plain second pass does not.
  if (!second.loop) second.index++;
  askSecond();
});

$("copy").addEventListener("click", () => {
  copyInto($("copy"), $("scorecard").textContent, "Copy scorecard");
});

/**
 * Clipboard writes reject on an unfocused document, a denied permission or a
 * non-secure context. Swallowing that leaves the button dead with no
 * explanation, which matters most for the certify comment: it is the only
 * handoff of the contributor's proof. The text is selectable either way, so
 * failure just has to say so.
 */
async function copyInto(button, text, label) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Select it above and copy";
  }
  setTimeout(() => (button.textContent = label), 2000);
}

$("certify-copy").addEventListener("click", async () => {
  await copyInto($("certify-copy"), $("certify-comment").textContent, "Copy comment");
  // Revealed after the copy attempt, not beside it: two calls to action at once
  // make the reader choose, and pasting is the step that opens the check.
  const open = $("certify-pr");
  if (open.href && open.href !== "#") open.hidden = false;
});

// Deep link: ?pr=owner/repo/123 plays immediately, which is the whole point of
// putting a link in the PR comment.
(async function boot() {
  const params = new URLSearchParams(location.search);
  const raw = params.get("pr");
  if (!raw) return show("landing");
  const target = parseTarget(raw);
  if (!target) return show("landing");
  try {
    await load(target, readOptions(params));
  } catch (e) {
    $("landing-error").textContent = e.message;
    $("landing-error").hidden = false;
    show("landing");
  }
})();
