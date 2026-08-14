import type { DiffFile, PrContext } from "./types.js";

/**
 * A concept is a language or systems primitive that shows up in real diffs and
 * that people routinely misunderstand. Detection is deliberately pattern-based
 * rather than AI-driven: the semantics of Promise.all are identical in every
 * repo on earth, so paying a model to rediscover them per-run is pure waste.
 *
 * This is what makes Quick mode instant, free, offline, and usable with no
 * API key and no Claude Code install.
 */
export interface ConceptRule {
  concept: string;
  /** Matched against added lines only — we quiz on what you changed. */
  pattern: RegExp;
  /** Restrict to files with these extensions. Empty means any. */
  extensions?: string[];
}

export const RULES: ConceptRule[] = [
  // ── JavaScript / TypeScript ──────────────────────────────────────────────
  { concept: "promise-all", pattern: /\bPromise\.all\s*\(/, extensions: [".js", ".ts", ".jsx", ".tsx", ".mjs"] },
  { concept: "promise-race", pattern: /\bPromise\.(race|any)\s*\(/, extensions: [".js", ".ts", ".jsx", ".tsx"] },
  { concept: "await-in-loop", pattern: /for\s*\([^)]*\)\s*\{[^}]*\bawait\b/s, extensions: [".js", ".ts", ".jsx", ".tsx"] },
  { concept: "async-foreach", pattern: /\.forEach\s*\(\s*async\b/, extensions: [".js", ".ts", ".jsx", ".tsx"] },
  { concept: "floating-promise", pattern: /^\+\s*(?!return|await|void)[\w.]+\([^)]*\)\.then\s*\(/m, extensions: [".js", ".ts"] },
  { concept: "shallow-copy", pattern: /\{\s*\.\.\.[\w$]+\s*[,}]|Object\.assign\s*\(\s*\{\s*\}/, extensions: [".js", ".ts", ".jsx", ".tsx"] },
  { concept: "array-sort-mutation", pattern: /(?<!\[\s*\.\.\.[^\]]*\]\s*)\.sort\s*\(|\.reverse\s*\(\s*\)/, extensions: [".js", ".ts", ".jsx", ".tsx"] },
  { concept: "loose-equality", pattern: /[^=!<>]==[^=]|!=[^=]/, extensions: [".js", ".jsx"] },
  { concept: "number-precision", pattern: /\b(parseFloat|toFixed)\s*\(|\*\s*100\b|\/\s*100\b/, extensions: [".js", ".ts"] },
  { concept: "json-deep-clone", pattern: /JSON\.parse\s*\(\s*JSON\.stringify/, extensions: [".js", ".ts", ".jsx", ".tsx"] },
  { concept: "try-catch-async", pattern: /catch\s*\([^)]*\)\s*\{[^}]*\}/s, extensions: [".js", ".ts"] },

  // ── React ────────────────────────────────────────────────────────────────
  { concept: "useeffect-deps", pattern: /useEffect\s*\(/, extensions: [".jsx", ".tsx", ".js", ".ts"] },
  { concept: "usememo", pattern: /\buseMemo\s*\(|\buseCallback\s*\(/, extensions: [".jsx", ".tsx"] },
  { concept: "stale-closure", pattern: /set[A-Z]\w*\s*\(\s*(?!\()[\w$]+\s*[+\-]/, extensions: [".jsx", ".tsx"] },
  { concept: "react-key", pattern: /\.map\s*\(\s*\(?[\w$]+\)?\s*=>\s*[<(]/, extensions: [".jsx", ".tsx"] },

  // ── Python ───────────────────────────────────────────────────────────────
  { concept: "mutable-default-arg", pattern: /def\s+\w+\s*\([^)]*=\s*(\[\]|\{\}|set\(\))/, extensions: [".py"] },
  { concept: "python-identity", pattern: /\bis\s+(?!None|True|False|not\s+None)\w/, extensions: [".py"] },
  { concept: "bare-except", pattern: /except\s*:|except\s+Exception\s*:/, extensions: [".py"] },
  { concept: "python-shallow-copy", pattern: /\.copy\s*\(\s*\)|\blist\s*\(\s*\w+\s*\)/, extensions: [".py"] },
  { concept: "generator-exhaustion", pattern: /\byield\b|\(\s*\w+\s+for\s+\w+\s+in\s/, extensions: [".py"] },

  // ── Go ───────────────────────────────────────────────────────────────────
  { concept: "go-defer-loop", pattern: /for\s+[^{]*\{[^}]*\bdefer\b/s, extensions: [".go"] },
  { concept: "goroutine-leak", pattern: /\bgo\s+func\s*\(/, extensions: [".go"] },
  { concept: "go-nil-map", pattern: /var\s+\w+\s+map\[/, extensions: [".go"] },
  { concept: "go-slice-aliasing", pattern: /\bappend\s*\(/, extensions: [".go"] },

  // ── SQL / data ───────────────────────────────────────────────────────────
  { concept: "sql-null", pattern: /(?:=|!=|<>)\s*NULL|\bNOT\s+IN\s*\(/i, extensions: [".sql", ".ts", ".js", ".py", ".rb"] },
  { concept: "sql-index", pattern: /CREATE\s+(UNIQUE\s+)?INDEX|\.createIndex\s*\(/i },
  { concept: "n-plus-one", pattern: /for\s*\([^)]*\)\s*\{[^}]*\b(query|findOne|findBy|select|get)\b/is },
  { concept: "transaction-isolation", pattern: /BEGIN\s+TRANSACTION|\.transaction\s*\(|SERIALIZABLE|READ\s+COMMITTED/i },

  // ── Systems / cross-language ─────────────────────────────────────────────
  { concept: "retry-backoff", pattern: /\bretry|\battempt\b|backoff/i },
  { concept: "cache-invalidation", pattern: /\bcache\b|\bmemo(ize)?\b|\bttl\b/i },
  { concept: "missing-timeout", pattern: /\bfetch\s*\(|axios\.|http\.(get|post)|requests\.(get|post)/ },
  { concept: "unbounded-growth", pattern: /new\s+Map\s*\(|new\s+Set\s*\(|=\s*\{\s*\}\s*;?\s*$|defaultdict/ },
  { concept: "env-secrets", pattern: /process\.env\.|os\.environ|getenv\(/ },
  { concept: "auth-check", pattern: /\b(isAuthenticated|requireAuth|checkPermission|authorize|jwt|bearer)\b/i },
  { concept: "float-money", pattern: /\b(price|amount|total|cost|balance)\b\s*[:=]\s*[\d.]*\.\d/i },
];

function extensionOf(path: string): string {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i).toLowerCase();
}

/**
 * Prose that merely mentions a concept is not a use of it. Found by running
 * PopPR on its own docs PR: `retry-backoff` matched the word "retry" in
 * HANDOFF.md and `cache-invalidation` matched "a cache with no eviction" in the
 * README, so a pure documentation change produced a quiz about caching.
 *
 * This is not the loose-regex problem that `--smart` exists to solve. Markdown
 * is not code, so no amount of pattern tuning makes matching it correct.
 */
const PROSE_EXTENSIONS = new Set([
  ".md", ".mdx", ".markdown", ".txt", ".rst", ".adoc", ".org",
]);

/** Lines the diff ADDS. We quiz on what you introduced, not what was there. */
function addedLines(file: DiffFile): string {
  return file.patch
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1))
    .join("\n");
}

export interface DetectedConcept {
  concept: string;
  /** Files where it appeared, for the "where" hint on the review screen. */
  files: string[];
  /** How many distinct files matched — used to rank relevance. */
  weight: number;
  /** Only set in smart mode: why the model thinks this concept matters here. */
  why?: string;
}

/**
 * Which concepts does this diff actually exercise? Runs in single-digit
 * milliseconds, which is the whole point.
 */
export function detectConcepts(ctx: PrContext): DetectedConcept[] {
  const hits = new Map<string, Set<string>>();

  for (const file of ctx.files) {
    const ext = extensionOf(file.path);
    if (PROSE_EXTENSIONS.has(ext)) continue;
    const added = addedLines(file);
    if (!added.trim()) continue;

    for (const rule of RULES) {
      if (rule.extensions && !rule.extensions.includes(ext)) continue;
      if (!rule.pattern.test(added)) continue;
      const set = hits.get(rule.concept) ?? new Set<string>();
      set.add(file.path);
      hits.set(rule.concept, set);
    }
  }

  return [...hits.entries()]
    .map(([concept, files]) => ({
      concept,
      files: [...files],
      weight: files.size,
    }))
    .sort((a, b) => b.weight - a.weight);
}
