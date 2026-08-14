import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DiffFile, PrContext } from "./types.js";

const exec = promisify(execFile);

async function run(cmd: string, args: string[], cwd: string): Promise<string> {
  const { stdout } = await exec(cmd, args, {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

async function tryRun(cmd: string, args: string[], cwd: string): Promise<string | null> {
  try {
    return await run(cmd, args, cwd);
  } catch {
    return null;
  }
}

/**
 * Files that are technically part of the diff but that nobody should be quizzed
 * on. Keeping these out matters more than it sounds: a 4000-line lockfile change
 * will crowd out the 30 lines that actually matter when we build the prompt.
 */
const NOISE = [
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock|go\.sum)$/,
  /(^|\/)(dist|build|out|vendor|node_modules|\.next|\.nuxt|coverage)\//,
  /\.(min\.js|min\.css|map|snap|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|pdf)$/i,
  /(^|\/).*\.generated\.[a-z]+$/i,
  /(^|\/)__snapshots__\//,
];

function isNoise(path: string): boolean {
  return NOISE.some((r) => r.test(path));
}

/** Find the branch this work forked from, without assuming it's called "main". */
export async function detectBase(cwd: string): Promise<string> {
  // The remote's own idea of its default branch is the most reliable source.
  const originHead = await tryRun("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], cwd);
  if (originHead) {
    const ref = originHead.trim().replace("refs/remotes/", "");
    if (ref) return ref;
  }
  for (const candidate of ["origin/main", "origin/master", "origin/develop", "main", "master"]) {
    const ok = await tryRun("git", ["rev-parse", "--verify", "--quiet", candidate], cwd);
    if (ok && ok.trim()) return candidate;
  }
  throw new Error(
    "Could not work out the base branch. Pass one explicitly with --base <ref>.",
  );
}

async function currentBranch(cwd: string): Promise<string> {
  const out = await tryRun("git", ["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  return out?.trim() || "HEAD";
}

function parseNumstat(numstat: string): Map<string, { additions: number; deletions: number }> {
  const map = new Map<string, { additions: number; deletions: number }>();
  for (const line of numstat.split("\n")) {
    if (!line.trim()) continue;
    const [add, del, ...rest] = line.split("\t");
    const path = rest.join("\t");
    if (!path) continue;
    map.set(path, {
      // Binary files report "-" rather than a count.
      additions: add === "-" ? 0 : Number(add),
      deletions: del === "-" ? 0 : Number(del),
    });
  }
  return map;
}

function statusFromLetter(letter: string): DiffFile["status"] {
  if (letter.startsWith("A")) return "added";
  if (letter.startsWith("D")) return "deleted";
  if (letter.startsWith("R")) return "renamed";
  return "modified";
}

/** Split a unified diff into one entry per file. */
function splitPatch(fullPatch: string): Map<string, string> {
  const out = new Map<string, string>();
  const chunks = fullPatch.split(/^diff --git /m).filter(Boolean);
  for (const chunk of chunks) {
    const header = chunk.split("\n", 1)[0] ?? "";
    // "a/src/foo.ts b/src/foo.ts" -> src/foo.ts (prefer the b/ side; it's the new name)
    const match = header.match(/\s+b\/(.+)$/);
    const path = match?.[1]?.trim();
    if (path) out.set(path, "diff --git " + chunk);
  }
  return out;
}

export interface ReadDiffOptions {
  cwd?: string;
  base?: string;
  /** Read a specific GitHub PR via the gh CLI instead of the local branch. */
  pr?: string;
  /** Hard cap on characters of patch text handed to the model. */
  maxPatchChars?: number;
}

export async function readDiff(opts: ReadDiffOptions = {}): Promise<PrContext> {
  const cwd = opts.cwd ?? process.cwd();
  const maxChars = opts.maxPatchChars ?? 120_000;

  if (opts.pr) return readFromGh(opts.pr, cwd, maxChars);

  const base = opts.base ?? (await detectBase(cwd));
  const head = await currentBranch(cwd);

  // Three dots: compare against the merge base, so we only see *this* branch's
  // work and not everything that landed on main since it forked.
  const range = `${base}...HEAD`;

  const numstat = await run("git", ["diff", "--numstat", range], cwd);
  const nameStatus = await run("git", ["diff", "--name-status", range], cwd);
  const fullPatch = await run("git", ["diff", "--unified=8", range], cwd);

  const stats = parseNumstat(numstat);
  const patches = splitPatch(fullPatch);

  const statuses = new Map<string, DiffFile["status"]>();
  for (const line of nameStatus.split("\n")) {
    if (!line.trim()) continue;
    const [letter, ...rest] = line.split("\t");
    const path = rest[rest.length - 1];
    if (path) statuses.set(path, statusFromLetter(letter));
  }

  const files = assembleFiles(stats, statuses, patches, maxChars);

  if (files.length === 0) {
    throw new Error(
      `No reviewable changes between ${base} and ${head}. ` +
        `Either the branch is empty or everything in it was filtered as generated code.`,
    );
  }

  return { label: `${head} vs ${base}`, repo: "local", base, head, files };
}

async function readFromGh(pr: string, cwd: string, maxChars: number): Promise<PrContext> {
  const fullPatch = await tryRun("gh", ["pr", "diff", pr], cwd);
  if (fullPatch === null) {
    throw new Error(
      `Could not read PR ${pr}. Make sure the GitHub CLI is installed and authenticated (\`gh auth login\`).`,
    );
  }
  const metaRaw = await tryRun(
    "gh",
    ["pr", "view", pr, "--json", "title,body,baseRefName,headRefName,number"],
    cwd,
  );
  const meta = metaRaw ? JSON.parse(metaRaw) : {};

  const patches = splitPatch(fullPatch);
  const stats = new Map<string, { additions: number; deletions: number }>();
  const statuses = new Map<string, DiffFile["status"]>();
  for (const [path, patch] of patches) {
    const additions = (patch.match(/^\+(?!\+\+)/gm) || []).length;
    const deletions = (patch.match(/^-(?!--)/gm) || []).length;
    stats.set(path, { additions, deletions });
    statuses.set(
      path,
      /^new file mode/m.test(patch)
        ? "added"
        : /^deleted file mode/m.test(patch)
          ? "deleted"
          : "modified",
    );
  }

  const files = assembleFiles(stats, statuses, patches, maxChars);
  if (files.length === 0) throw new Error(`PR ${pr} has no reviewable (non-generated) changes.`);

  return {
    label: `PR #${meta.number ?? pr}`,
    repo: "",
    base: meta.baseRefName ?? "base",
    head: meta.headRefName ?? "head",
    title: meta.title,
    body: meta.body,
    files,
  };
}

/**
 * Merge the three git views into DiffFile[], drop generated noise, and budget
 * the character cap across files — biggest change first, since that's where the
 * interesting questions live.
 */
function assembleFiles(
  stats: Map<string, { additions: number; deletions: number }>,
  statuses: Map<string, DiffFile["status"]>,
  patches: Map<string, string>,
  maxChars: number,
): DiffFile[] {
  const paths = [...new Set([...stats.keys(), ...patches.keys()])].filter((p) => !isNoise(p));

  const ranked = paths
    .map((path) => {
      const s = stats.get(path) ?? { additions: 0, deletions: 0 };
      return {
        path,
        status: statuses.get(path) ?? "modified",
        additions: s.additions,
        deletions: s.deletions,
        patch: patches.get(path) ?? "",
      } satisfies DiffFile;
    })
    .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions));

  const out: DiffFile[] = [];
  let used = 0;
  for (const f of ranked) {
    if (used >= maxChars) break;
    const room = maxChars - used;
    const patch =
      f.patch.length > room
        ? f.patch.slice(0, room) + "\n... [patch truncated by poppr]\n"
        : f.patch;
    out.push({ ...f, patch });
    used += patch.length;
  }
  return out;
}

/**
 * Grep the repo for references to symbols introduced in the diff. This is what
 * makes blast-radius questions possible: the model can ask "who calls this?"
 * only if we hand it the callers, which are by definition outside the diff.
 */
export async function findCallSites(
  ctx: PrContext,
  cwd: string = process.cwd(),
): Promise<Record<string, string[]>> {
  const symbols = new Set<string>();
  for (const file of ctx.files) {
    const declared = file.patch.matchAll(
      /^\+.*?\b(?:function|class|const|let|var|def|type|interface|struct|fn)\s+([A-Za-z_$][\w$]*)/gm,
    );
    for (const m of declared) if (m[1]) symbols.add(m[1]);
  }

  const changedPaths = new Set(ctx.files.map((f) => f.path));
  const result: Record<string, string[]> = {};

  for (const symbol of [...symbols].slice(0, 25)) {
    const out = await tryRun(
      "git",
      ["grep", "-l", "-w", "--", symbol],
      cwd,
    );
    if (!out) continue;
    const callers = out
      .split("\n")
      .map((s) => s.trim())
      .filter((p) => p && !changedPaths.has(p) && !isNoise(p))
      .slice(0, 6);
    if (callers.length) result[symbol] = callers;
  }
  return result;
}

/** A compact rendering of the diff for the prompt. */
export function renderDiff(ctx: PrContext): string {
  const parts: string[] = [];
  if (ctx.title) parts.push(`PR title: ${ctx.title}`);
  if (ctx.body?.trim()) parts.push(`PR description:\n${ctx.body.trim().slice(0, 2000)}`);

  parts.push(
    `Changed files (${ctx.files.length}):\n` +
      ctx.files.map((f) => `  ${f.status.padEnd(8)} +${f.additions} -${f.deletions}  ${f.path}`).join("\n"),
  );

  if (ctx.callSites && Object.keys(ctx.callSites).length) {
    parts.push(
      "Existing references to symbols touched by this change (files OUTSIDE the diff):\n" +
        Object.entries(ctx.callSites)
          .map(([sym, files]) => `  ${sym}: ${files.join(", ")}`)
          .join("\n"),
    );
  }

  parts.push("Full diff:\n" + ctx.files.map((f) => f.patch).join("\n"));
  return parts.join("\n\n");
}
