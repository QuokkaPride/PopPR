import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { RunResult } from "./types.js";

const HISTORY_PATH = join(homedir(), ".poppr", "history.json");

interface ConceptStat {
  seen: number;
  correct: number;
  /** ISO date of the last time this concept was asked. */
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
}

const EMPTY: History = { version: 1, runs: [], concepts: {} };

export async function loadHistory(): Promise<History> {
  try {
    const raw = await readFile(HISTORY_PATH, "utf8");
    const parsed = JSON.parse(raw) as History;
    return parsed?.version === 1 ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

export async function saveHistory(h: History): Promise<void> {
  await mkdir(dirname(HISTORY_PATH), { recursive: true });
  await writeFile(HISTORY_PATH, JSON.stringify(h, null, 2), "utf8");
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Consecutive days with at least one run, counting back from today. */
export function currentStreak(h: History, today = new Date()): number {
  const days = new Set(h.runs.map((r) => dayKey(r.date)));
  let streak = 0;
  const cursor = new Date(today);
  // Today not yet counted is fine — a streak survives until the day ends.
  if (!days.has(dayKey(cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(dayKey(cursor.toISOString()))) {
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
 * Improvement over time, per concept. This is the retention hook — "your
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

  await saveHistory(h);
  return h;
}
