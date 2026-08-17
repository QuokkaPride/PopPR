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

/**
 * Flags every `git diff` here needs, for reasons that only show up off macOS.
 *
 * `core.quotepath=false` stops git C-escaping any path with a byte over 0x7f,
 * so `café.ts` arrives as itself rather than as `"caf\303\251.ts"`. The quoted
 * form did not match the header pattern in splitPatch, so those files were
 * dropped from the context entirely and a PR touching only them got quizzed on
 * nothing it contained. Non-ASCII paths are ordinary on a Windows machine whose
 * owner has an accent in their name.
 *
 * `--ignore-cr-at-eol` keeps a CRLF checkout from reading as a rewrite of every
 * line. Windows git installs default to core.autocrlf=true, and without this a
 * one-line change in a file with LF in the index came back as a whole-file diff
 * that swamped concept detection with lines nobody touched.
 */
const GIT_DIFF_FLAGS = ["-c", "core.quotepath=false"];
const DIFF_OPTS = ["--ignore-cr-at-eol"];

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
    const path = decodePath(rest.join("\t"));
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
    const header = (chunk.split("\n", 1)[0] ?? "").replace(/\r$/, "");
    const path = headerPath(header);
    if (path) out.set(path, "diff --git " + chunk);
  }
  return out;
}

/**
 * The new-side path out of a `diff --git` header.
 *
 * core.quotepath=false covers non-ASCII, but git still quotes a path holding a
 * quote, a backslash or a control character. An unhandled one is invisible
 * rather than loud: the file is simply absent from the context, and nothing
 * anywhere says so.
 */
function headerPath(header: string): string | null {
  const quoted = header.match(/ "b\/((?:[^"\\]|\\.)*)"\s*$/);
  if (quoted?.[1] !== undefined) return unescapeGitPath(quoted[1]);
  // "a/src/foo.ts b/src/foo.ts" -> src/foo.ts (prefer the b/ side, it is the new name)
  return header.match(/\s+b\/(.+)$/)?.[1]?.trim() ?? null;
}

/**
 * One git-emitted path, unquoted if it needs it.
 *
 * Every git surface has to agree on the spelling. The patch header decodes its
 * own quoting, so numstat and name-status have to as well: otherwise a quoted
 * path keys the stats map as `"a\303\251.ts"` and the patch map as `aé.ts`, and
 * one file becomes two DiffFile entries, one with no patch and one with no
 * line counts.
 */
function decodePath(field: string): string {
  const s = field.trim();
  if (!s.startsWith('"') || !s.endsWith('"') || s.length < 2) return s;
  return unescapeGitPath(s.slice(1, -1));
}

const SIMPLE_ESCAPES: Record<string, number> = {
  '"': 0x22, "\\": 0x5c, a: 0x07, b: 0x08, f: 0x0c, n: 0x0a, r: 0x0d, t: 0x09, v: 0x0b,
};

/** git's C-style quoting: \\ and \" for literals, \nnn octal for raw bytes. */
function unescapeGitPath(s: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "\\") {
      for (const b of Buffer.from(s[i], "utf8")) bytes.push(b);
      continue;
    }
    const next = s[++i] ?? "";
    if (/^[0-7]{3}$/.test(s.slice(i, i + 3))) {
      bytes.push(parseInt(s.slice(i, i + 3), 8));
      i += 2;
    } else {
      bytes.push(SIMPLE_ESCAPES[next] ?? next.charCodeAt(0));
    }
  }
  return Buffer.from(bytes).toString("utf8");
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

  const numstat = await run("git", [...GIT_DIFF_FLAGS, "diff", ...DIFF_OPTS, "--numstat", range], cwd);
  const nameStatus = await run("git", [...GIT_DIFF_FLAGS, "diff", ...DIFF_OPTS, "--name-status", range], cwd);
  const fullPatch = await run("git", [...GIT_DIFF_FLAGS, "diff", ...DIFF_OPTS, "--unified=8", range], cwd);

  const stats = parseNumstat(numstat);
  const patches = splitPatch(fullPatch);

  const statuses = new Map<string, DiffFile["status"]>();
  for (const line of nameStatus.split("\n")) {
    if (!line.trim()) continue;
    const [letter, ...rest] = line.split("\t");
    const path = decodePath(rest[rest.length - 1] ?? "");
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
    // tryRun swallows the cause, and on a CI runner the advice below is always
    // wrong: gh is preinstalled and the token comes from the workflow. Ask
    // again without swallowing so a 403 from a missing `pull-requests`
    // permission says so, instead of sending a maintainer to `gh auth login`.
    let detail = "";
    try {
      await run("gh", ["pr", "diff", pr], cwd);
    } catch (err) {
      const e = err as { stderr?: string; code?: string };
      if (e.code === "ENOENT") {
        throw new Error(
          `Could not read PR ${pr}. The GitHub CLI is not installed (\`gh\`).`,
        );
      }
      detail = (e.stderr ?? "").trim();
    }
    throw new Error(
      `Could not read PR ${pr}.${detail ? ` gh said: ${detail}` : ""}`.trim(),
    );
  }
  const metaRaw = await tryRun(
    "gh",
    ["pr", "view", pr, "--json", "title,body,baseRefName,headRefName,number,headRefOid,url"],
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
    url: meta.url,
    // Certification binds to this commit, so a push has to invalidate it.
    headSha: meta.headRefOid,
    files,
  };
}

/**
 * Merge the three git views into DiffFile[], drop generated noise, and budget
 * the character cap across files, biggest change first, since that is where the
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

  // Concurrently, in bounded batches. This used to be a sequential loop of up to
  // 25 `git grep` calls, and process creation on Windows costs roughly an order
  // of magnitude more than it does on POSIX, so the serial version added seconds
  // to a path whose whole selling point is that it starts instantly. The cap
  // exists so a large repo does not answer with 25 simultaneous greps.
  const wanted = [...symbols].slice(0, 25);
  const BATCH = 8;

  for (let i = 0; i < wanted.length; i += BATCH) {
    const found = await Promise.all(
      wanted.slice(i, i + BATCH).map(async (symbol) => {
        const out = await tryRun("git", ["grep", "-l", "-w", "--", symbol], cwd);
        if (!out) return null;
        const callers = out
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((p) => p && !changedPaths.has(p) && !isNoise(p))
          .slice(0, 6);
        return callers.length ? ([symbol, callers] as const) : null;
      }),
    );
    for (const hit of found) if (hit) result[hit[0]] = hit[1];
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
