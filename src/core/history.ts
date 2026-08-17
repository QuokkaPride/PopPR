import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { RunResult } from "./types.js";

/**
 * Where the streak lives, resolved per call rather than frozen at import.
 *
 * `POPPR_HOME` exists for two reasons. Tests need somewhere to write that is not
 * the developer's own history, and a module-level constant made that impossible:
 * the only way to exercise the save path was to overwrite the real file, which
 * is exactly what happened while writing these tests. It also gives WSL and
 * native Windows a way to share one streak, which they otherwise cannot, since
 * each sees a different home directory on the same machine.
 */
function historyPath(): string {
  const dir = process.env.POPPR_HOME || join(homedir(), ".poppr");
  return join(dir, "history.json");
}

interface ConceptStat {
  seen: number;
  correct: number;
  /** ISO timestamp of the last time this concept was asked. */
  lastSeen: string;
}

interface RunRecord {
  date: string; // ISO
  repo: string;
  prLabel: string;
  correct: number;
  total: number;
  ms: number;
  concepts: Record<string, { seen: number; correct: number }>;
}

export interface History {
  version: 1;
  runs: RunRecord[];
  concepts: Record<string, ConceptStat>;
  /** False when the last recordRun could not write to disk. Not persisted. */
  saved?: boolean;
}

const EMPTY: History = { version: 1, runs: [], concepts: {} };

export async function loadHistory(): Promise<History> {
  try {
    const raw = await readFile(historyPath(), "utf8");
    const parsed = JSON.parse(raw) as History;
    return parsed?.version === 1 ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

/**
 * Persist, or give up quietly. Returns false when the write failed.
 *
 * Never throws, because the caller is between the last answer and the review
 * screen. A read-only home directory, a roaming Windows profile or a locked
 * file used to take the whole run down with it: the player answered ten
 * questions and got a stack trace instead of their score. Losing a streak day
 * is a far smaller harm than losing the run.
 */
export async function saveHistory(h: History): Promise<boolean> {
  try {
    await mkdir(dirname(historyPath()), { recursive: true });
    await writeFile(historyPath(), JSON.stringify(h, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The local calendar day an instant falls on.
 *
 * Local components rather than toISOString(): a run at 9am in UTC+10 is still
 * *yesterday* in UTC, so keying off the ISO string rolled the streak over at an
 * hour that had nothing to do with the player's own midnight. Far enough east
 * or west, two runs on the same day counted as one and a day of play could
 * vanish from the streak entirely.
 */
function dayKey(when: string | Date): string {
  const d = typeof when === "string" ? new Date(when) : when;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Consecutive days with at least one run, counting back from today. */
export function currentStreak(h: History, today = new Date()): number {
  const days = new Set(h.runs.map((r) => dayKey(r.date)));
  let streak = 0;
  const cursor = new Date(today);
  // Today not yet counted is fine: a streak survives until the day ends.
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Concepts due for another look: previously below 70% and not asked in the last
 * 3 days. Passed into generation so a weak spot resurfaces against a *different*
 * PR later, which is what actually makes it stick.
 */
export function conceptsDueForReview(h: History, now = new Date()): string[] {
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  return Object.entries(h.concepts)
    .filter(([, s]) => s.seen >= 2 && s.correct / s.seen < 0.7)
    .filter(([, s]) => new Date(s.lastSeen) < threeDaysAgo)
    .sort((a, b) => a[1].correct / a[1].seen - b[1].correct / b[1].seen)
    .slice(0, 5)
    .map(([concept]) => concept);
}

export interface ConceptTrend {
  concept: string;
  overallPct: number;
  recentPct: number;
  seen: number;
  delta: number;
}

/**
 * Improvement over time, per concept. This is the retention hook: "your
 * async/concurrency went 40% -> 78%" is the thing people screenshot.
 */
export function conceptTrends(h: History, recentRuns = 5): ConceptTrend[] {
  const recent = h.runs.slice(-recentRuns);
  const recentAgg: Record<string, { seen: number; correct: number }> = {};
  for (const run of recent) {
    for (const [concept, s] of Object.entries(run.concepts)) {
      const acc = (recentAgg[concept] ??= { seen: 0, correct: 0 });
      acc.seen += s.seen;
      acc.correct += s.correct;
    }
  }

  return Object.entries(h.concepts)
    .map(([concept, s]) => {
      const overallPct = Math.round((s.correct / s.seen) * 100);
      const r = recentAgg[concept];
      const recentPct = r?.seen ? Math.round((r.correct / r.seen) * 100) : overallPct;
      return { concept, overallPct, recentPct, seen: s.seen, delta: recentPct - overallPct };
    })
    .sort((a, b) => b.seen - a.seen);
}

export async function recordRun(result: RunResult): Promise<History> {
  const h = await loadHistory();
  const now = new Date().toISOString();

  const concepts: RunRecord["concepts"] = {};
  for (const a of result.answered) {
    const c = (concepts[a.question.concept] ??= { seen: 0, correct: 0 });
    c.seen++;
    if (a.correct) c.correct++;

    const global = (h.concepts[a.question.concept] ??= {
      seen: 0,
      correct: 0,
      lastSeen: now,
    });
    global.seen++;
    if (a.correct) global.correct++;
    global.lastSeen = now;
  }

  h.runs.push({
    date: now,
    repo: result.repo,
    prLabel: result.prLabel,
    correct: result.correctCount,
    total: result.answered.length,
    ms: result.totalMs,
    concepts,
  });

  // The caller renders the review screen off this, and a run nobody could
  // persist is worth saying out loud once rather than silently discarding.
  h.saved = await saveHistory(h);
  return h;
}
