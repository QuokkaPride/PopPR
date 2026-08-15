import type { DiffFile, Evidence, PrContext } from "./types.js";

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
  { concept: "floating-promise", pattern: /^\s*(?!return|await|void|const|let|var)[\w.]+\([^)]*\)\.then\s*\(/m, extensions: [".js", ".ts"] },
  { concept: "shallow-copy", pattern: /\{\s*\.\.\.[\w$]+\s*[,}]|Object\.assign\s*\(\s*\{\s*\}/, extensions: [".js", ".ts", ".jsx", ".tsx"] },
  { concept: "array-sort-mutation", pattern: /(?<![)\]]\s*)\b[\w$]+\.(sort|reverse)\s*\(/, extensions: [".js", ".ts", ".jsx", ".tsx"] },
  { concept: "loose-equality", pattern: /[^=!<>]==[^=]|!=[^=]/, extensions: [".js", ".jsx"] },
  { concept: "number-precision", pattern: /\b(parseFloat|toFixed)\s*\(/, extensions: [".js", ".ts"] },
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
  { concept: "sql-null", pattern: /(?:=|!=|<>)\s*NULL\b|\bIS\s+(NOT\s+)?NULL\b|\bNOT\s+IN\s*\(/, extensions: [".sql", ".ts", ".js", ".py", ".rb"] },
  { concept: "sql-index", pattern: /CREATE\s+(UNIQUE\s+)?INDEX|\.createIndex\s*\(/i },
  { concept: "n-plus-one", pattern: /for\s*\([^)]*\)\s*\{[^}]*\b(query|findOne|findBy|select|get)\b/is },
  { concept: "transaction-isolation", pattern: /BEGIN\s+TRANSACTION|\.transaction\s*\(|SERIALIZABLE|READ\s+COMMITTED/i },

  // ── Systems / cross-language ─────────────────────────────────────────────
  { concept: "retry-backoff", pattern: /\bbackoff\b|\bretries\b|\bretrying\b|\bretry\s*\(|\bmax_?retr(y|ies)\b|\bretry_?(count|limit|delay|after)\b|\battempts?\s*[<>+]/i },
  { concept: "cache-invalidation", pattern: /\bcache\b|\bmemo(ize)?\b|\bttl\b/i },
  { concept: "missing-timeout", pattern: /\bfetch\s*\(|axios\.|http\.(get|post)|requests\.(get|post)/ },
  { concept: "unbounded-growth", pattern: /new\s+(Map|Set)\s*\(\s*\)|=\s*\{\s*\}\s*;?\s*$|defaultdict/ },
  { concept: "env-secrets", pattern: /process\.env\.|os\.environ|getenv\(/ },
  { concept: "auth-check", pattern: /\b(isAuthenticated|requireAuth|checkPermission|authorize|jwt|bearer)\b/i },
  { concept: "float-money", pattern: /\b(price|amount|total|cost|balance)\b\s*[:=]\s*[\d.]*\.\d/i },
];

function extensionOf(path: string): string {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i).toLowerCase();
}

/**
 * Text that merely mentions a concept is not a use of it. Both halves of this
 * were found by running PopPR on its own PRs:
 *
 *   - Prose: `retry-backoff` matched the word "retry" in HANDOFF.md, and
 *     `cache-invalidation` matched "a cache with no eviction" in the README, so
 *     a pure documentation change produced a quiz about caching.
 *   - Config: `cache-invalidation` matched `cache: npm` in a GitHub Actions
 *     workflow.
 *
 * This is not the loose-regex problem that `--smart` exists to solve. Every
 * bank question is about code semantics, so no question can apply to a
 * changelog or a YAML key no matter how the pattern is tuned.
 */
const NON_CODE_EXTENSIONS = new Set([
  // prose
  ".md", ".mdx", ".markdown", ".txt", ".rst", ".adoc", ".org",
  // config and data
  ".yml", ".yaml", ".json", ".toml", ".ini", ".cfg", ".conf",
  ".lock", ".csv", ".xml", ".plist",
]);

/**
 * Lines the diff ADDS, each with its line number in the file afterwards.
 *
 * We quiz on what you introduced, not what was there. The numbers come from
 * walking the hunk headers, so a question can point at `checkout.ts:42` rather
 * than just naming the file: "somewhere in this 300 line diff" is not evidence
 * anyone can act on at a glance.
 */
interface AddedLine {
  line: number;
  text: string;
}

function addedLines(file: DiffFile): AddedLine[] {
  const out: AddedLine[] = [];
  let lineNo = 0;

  for (const raw of file.patch.split("\n")) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      lineNo = Number(hunk[1]);
      continue;
    }
    if (raw.startsWith("+++") || raw.startsWith("---")) continue;
    // "\ No newline at end of file" describes the previous line, and consumes
    // no line of its own.
    if (raw.startsWith("\\")) continue;

    if (raw.startsWith("+")) {
      out.push({ line: lineNo, text: raw.slice(1) });
      lineNo++;
    } else if (raw.startsWith("-")) {
      // A removed line occupies no line in the new file.
    } else {
      lineNo++;
    }
  }

  return out;
}

/**
 * A comment mentioning a concept is not a use of it.
 *
 * Skipping prose FILES was only half the problem: prose inside code files was
 * still matched, so a `.py` file's comment about caching produced a caching
 * question, and this very file's comment about a false positive produced one.
 * Found the moment questions started showing the line that triggered them,
 * which is the argument for showing it.
 *
 * Line-level and deliberately crude. A trailing comment after real code still
 * counts, because the code on that line is real.
 */
const COMMENT_ONLY = /^\s*(\/\/|#|\*|\/\*|<!--|--\s|"""|''')/;

function isCode(text: string): boolean {
  return text.trim().length > 0 && !COMMENT_ONLY.test(text);
}

/** Where in the joined text each line begins, for mapping a match back. */
function joinWithOffsets(lines: AddedLine[]): { text: string; starts: number[] } {
  const starts: number[] = [];
  let offset = 0;
  for (const l of lines) {
    starts.push(offset);
    offset += l.text.length + 1; // the "\n" the join adds
  }
  return { text: lines.map((l) => l.text).join("\n"), starts };
}

function lineAt(starts: number[], index: number): number {
  // Last line whose start is at or before the match. Linear is fine: diffs are
  // capped at 120k characters long before this matters.
  let found = 0;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= index) found = i;
    else break;
  }
  return found;
}

const EVIDENCE_MAX_CHARS = 120;
/** Two files is enough to show a pattern without turning into a file listing. */
const EVIDENCE_PER_CONCEPT = 2;

export interface DetectedConcept {
  concept: string;
  /** Files where it appeared, for the "where" hint on the review screen. */
  files: string[];
  /** How many distinct files matched — used to rank relevance. */
  weight: number;
  /** Only set in smart mode: why the model thinks this concept matters here. */
  why?: string;
  /** The actual added lines that triggered this concept. */
  evidence?: Evidence[];
}

/**
 * Which concepts does this diff actually exercise? Runs in single-digit
 * milliseconds, which is the whole point.
 *
 * Each hit also records the line that caused it. Detection knows exactly which
 * line matched, and throwing that away was why a bank question could look like
 * trivia bolted onto a PR rather than a question about the PR.
 */
export function detectConcepts(ctx: PrContext): DetectedConcept[] {
  const files = new Map<string, Set<string>>();
  const evidence = new Map<string, Evidence[]>();

  for (const file of ctx.files) {
    const ext = extensionOf(file.path);
    if (NON_CODE_EXTENSIONS.has(ext)) continue;

    // Comment lines keep their real line numbers but are excluded from what the
    // patterns see, so evidence still points at the right place in the file.
    const lines = addedLines(file).filter((l) => isCode(l.text));
    if (!lines.length) continue;
    const { text, starts } = joinWithOffsets(lines);
    if (!text.trim()) continue;

    for (const rule of RULES) {
      if (rule.extensions && !rule.extensions.includes(ext)) continue;

      // exec rather than test: the match index is what identifies the line.
      // No rule carries /g, so there is no lastIndex to reset between files.
      const match = rule.pattern.exec(text);
      if (!match) continue;

      const set = files.get(rule.concept) ?? new Set<string>();
      set.add(file.path);
      files.set(rule.concept, set);

      const found = lines[lineAt(starts, match.index)];
      const seen = evidence.get(rule.concept) ?? [];
      if (found && seen.length < EVIDENCE_PER_CONCEPT) {
        seen.push({
          file: file.path,
          line: found.line || undefined,
          text: found.text.trim().slice(0, EVIDENCE_MAX_CHARS),
        });
        evidence.set(rule.concept, seen);
      }
    }
  }

  return [...files.entries()]
    .map(([concept, paths]) => ({
      concept,
      files: [...paths],
      weight: paths.size,
      evidence: evidence.get(concept),
    }))
    .sort((a, b) => b.weight - a.weight);
}
