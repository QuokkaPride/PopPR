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
  /** Matched against added lines only: we quiz on what you changed. */
  pattern: RegExp;
  /** Restrict to files with these extensions. Empty means any. */
  extensions?: string[];
}

export const RULES: ConceptRule[] = [
  // ── JavaScript / TypeScript ──────────────────────────────────────────────
  { concept: "promise-all", pattern: /\bPromise\.all\s*\(/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx", ".mjs"] },
  { concept: "promise-race", pattern: /\bPromise\.(race|any)\s*\(/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx"] },
  { concept: "await-in-loop", pattern: /for\s*\([^)]*\)\s*\{[^}]*\bawait\b/s, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx"] },
  { concept: "async-foreach", pattern: /\.forEach\s*\(\s*async\b/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx"] },
  { concept: "floating-promise", pattern: /^\s*(?!return|await|void|const|let|var)[\w.]+\([^)]*\)\.then\s*\(/m, extensions: [".js", ".ts"] },
  { concept: "shallow-copy", pattern: /\{\s*\.\.\.[\w$]+\s*[,}]|Object\.assign\s*\(\s*\{\s*\}/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx"] },
  { concept: "array-sort-mutation", pattern: /(?<![)\]]\s*)\b[\w$]+\.(sort|reverse)\s*\(/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx"] },
  { concept: "loose-equality", pattern: /[^=!<>]==[^=]|!=[^=]/, extensions: [".js", ".jsx", ".vue", ".svelte"] },
  { concept: "number-precision", pattern: /\b(parseFloat|toFixed)\s*\(/, extensions: [".js", ".ts"] },
  { concept: "json-deep-clone", pattern: /JSON\.parse\s*\(\s*JSON\.stringify/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx"] },
  { concept: "try-catch-async", pattern: /catch\s*\([^)]*\)\s*\{[^}]*\}/s, extensions: [".js", ".ts"] },

  // ── Everyday JavaScript and TypeScript ───────────────────────────────────
  // The basics that appear in almost every diff. Added after measuring what a
  // mundane TypeScript file actually detected: one concept, and it was a false
  // positive. A destructuring default, .map, .find, ?., .replace("x",""),
  // parseInt, an `as` cast and a `|| fallback` all went unnoticed, so five
  // changed files produced two questions.
  { concept: "const-mutation", pattern: /\bconst\s+[\w$]+\s*=\s*(\{|\[)/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx", ".mjs"] },
  { concept: "destructuring-defaults", pattern: /(?:const|let|var)\s*\{[^}]*=[^}]*\}\s*=|\(\s*\{[^}]*=[^}]*\}\s*(?:=\s*\{\}\s*)?\)/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx", ".mjs"] },
  { concept: "nullish-vs-or", pattern: /\?\?|\|\|\s*(\[\]|\{\}|['"`]|\d)/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx", ".mjs"] },
  { concept: "array-map-return", pattern: /\.map\s*\(/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx", ".mjs"] },
  { concept: "array-find-undefined", pattern: /\.find(Index|Last)?\s*\(/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx", ".mjs"] },
  { concept: "array-membership", pattern: /\.includes\s*\(|\.indexOf\s*\(/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx", ".mjs"] },
  { concept: "optional-chaining", pattern: /\?\.[\w$([]/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx", ".mjs"] },
  { concept: "string-replace-first", pattern: /\.replace\s*\(\s*['"`]/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx", ".mjs"] },
  { concept: "number-parsing", pattern: /\b(parseInt|parseFloat)\s*\(|\bNumber\s*\(/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx", ".mjs"] },
  { concept: "async-return-value", pattern: /\basync\s+(function|\w+\s*\(|\([^)]*\)\s*=>)/, extensions: [".js", ".ts", ".jsx", ".vue", ".svelte", ".tsx", ".mjs"] },
  { concept: "ts-as-cast", pattern: /\bas\s+[A-Z][\w<>\[\]]*/, extensions: [".ts", ".tsx"] },
  { concept: "ts-non-null-assertion", pattern: /[\w\)\]]!\s*[.;,)\]]|[\w\)\]]!\s*$/, extensions: [".ts", ".tsx"] },

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
  // 6% of held-out code PRs, and the only rule that fires on 5 of them.
  { concept: "go-blank-identifier", pattern: /(?:^|[\s(])_\s*,\s*\w+\s*:?=|,\s*_\s*:?=\s*[\w.]+\(/m, extensions: [".go"] },


  // ── Rust ──────────────────────────────────────────────────────────────
  // Designed from real merged PRs and kept only if they fired on them.
  // 37% of substantive PRs, 95 files
  { concept: "rust-panic-propagation", pattern: /\.unwrap\s*\(\s*\)|\.expect\s*\(|\bpanic!\s*\(|\btodo!|\bunreachable!\s*\(|catch_unwind/, extensions: [".rs"] },
  // 29% of substantive PRs, 94 files
  { concept: "rust-iterator-lazy", pattern: /\.(iter|iter_mut|into_iter)\s*\(\s*\)|\.(map|filter|filter_map|flat_map|take_while|skip_while|inspect|scan)\s*\(\s*\|/, extensions: [".rs"] },
  // 25% of substantive PRs, 99 files
  { concept: "rust-clone-shared", pattern: /\b(Arc|Rc)::(new|clone|from|try_unwrap|get_mut|strong_count)\s*\(|\.to_(owned|vec)\s*\(\s*\)|\.clone\s*\(\s*\)/, extensions: [".rs"] },
  // 11% of substantive PRs, 21 files
  { concept: "rust-await-cancellation", pattern: /\.await\b|\basync\s+(fn\b|move\s*[\{|]|\{)|\bselect!\s*\{|\btimeout\s*\(/, extensions: [".rs"] },
  // 10% of substantive PRs, 44 files
  { concept: "rust-unsafe-invariant", pattern: /\bunsafe\s*(\{|fn\b|impl\b|trait\b)|_unchecked\s*\(|::from_raw|\btransmute\s*[:(<]|MaybeUninit/, extensions: [".rs"] },
  //  9% of substantive PRs, 18 files
  { concept: "rust-capacity-vs-len", pattern: /\b(with_capacity|reserve|reserve_exact|set_len|resize|truncate|extend_from_slice|copy_from_slice)\s*\(/, extensions: [".rs"] },
  //  9% of substantive PRs, 24 files
  { concept: "rust-mem-take-replace", pattern: /\bmem::(take|replace|swap|forget)\s*\(|\.take\s*\(\s*\)|ManuallyDrop|\bdrop\s*\(\s*\w+\s*\)/, extensions: [".rs"] },
  // 6% of held-out code PRs, the highest-yield Rust rule on data it never saw.
  { concept: "rust-option-combinators", pattern: /\.(is_some_and|is_none_or|map_or|map_or_else|unwrap_or|unwrap_or_else|unwrap_or_default|and_then|ok_or|ok_or_else|or_else|as_deref)\s*\(|\bmatches!\s*\(|\bif\s+let\s+(Some|Ok|Err|None)\b/, extensions: [".rs"] },
  // 5% of held-out code PRs.
  { concept: "rust-match-exhaustive", pattern: /^\s*_\s*=>|\bmatch\s+[\w&*.():?\[\]]+\s*\{/m, extensions: [".rs"] },
  //  7% of substantive PRs, 16 files
  { concept: "rust-atomic-ordering", pattern: /\bOrdering::(Relaxed|Acquire|Release|AcqRel|SeqCst)\b|\bAtomic(Bool|U8|U16|U32|U64|Usize|I8|I16|I32|I64|Isize|Ptr)\b|\bfetch_(add|sub|or|and|update)\s*\(|compare_exchange/, extensions: [".rs"] },

  // ── Go ────────────────────────────────────────────────────────────────
  // Designed from real merged PRs and kept only if they fired on them.
  // 40% of substantive PRs, 55 files
  { concept: "go-error-value-pair", pattern: /(?:^|[\s(,])[\w.\[\]]+\s*,\s*err\s*:?=\s*[\w.]+\(/m, extensions: [".go"] },
  // 31% of substantive PRs, 39 files
  { concept: "go-map-zero-value", pattern: /\bmake\s*\(\s*map\[|\bvar\s+\w+\s+map\[|\bmap\[[\w.\*\[\]]+\][\w.\*\[\]{}]*\{/, extensions: [".go"] },
  // 18% of substantive PRs, 18 files
  { concept: "go-error-wrapping", pattern: /\bfmt\.Errorf\s*\(|\berrors\.(?:Is|As|Join)\s*\(/, extensions: [".go"] },
  // 18% of substantive PRs, 21 files
  { concept: "go-optional-pointer", pattern: /(?:[=(,]|return)\s*\*[a-z]\w*(?:\.\w+)+|\bptr\.To\(|\bpointer\.[A-Z]\w*\(/, extensions: [".go"] },
  // 19% of substantive PRs, 23 files
  { concept: "go-type-assertion", pattern: /\.\(\s*\*?[\w.]+\s*\)|\.\(\s*type\s*\)/, extensions: [".go"] },
  //  7% of substantive PRs, 8 files
  { concept: "go-map-value-copy", pattern: /,\s*(?:ok|found|exists|has)\s*:?=\s*[\w.]+\[/, extensions: [".go"] },

  // ── Java ──────────────────────────────────────────────────────────────
  // Designed from real merged PRs and kept only if they fired on them.
  // 26% of substantive PRs, 49 files
  { concept: "java-collection-immutability", pattern: /\b(?:List|Set|Map)\.(?:of|copyOf)\s*\(|Collections\.(?:unmodifiable|singleton|empty)\w*\s*\(|Arrays\.asList\s*\(|\.toList\s*\(\s*\)|Collectors\.to(?:List|Set|Map)\s*\(/, extensions: [".java"] },
  // 21% of substantive PRs, 49 files
  { concept: "java-nullability-boundary", pattern: /@Nullable|\bOptional\s*<|\bOptional\.\w|\breturn\s+null\s*[;)]|Objects\.requireNonNull\s*\(|Assert\.(?:notNull|hasText)\s*\(|\.orElse\w*\s*\(|\.isPresent\s*\(\s*\)/, extensions: [".java"] },
  // 22% of substantive PRs, 82 files
  { concept: "java-cleanup-on-throw", pattern: /\bfinally\s*\{|\btry\s*\(\s*(?:final\s+)?[\w<>\[\], .]+\s+\w+\s*=/, extensions: [".java"] },
  // 16% of substantive PRs, 20 files
  { concept: "java-instanceof-narrowing", pattern: /\binstanceof\s+[A-Z]/, extensions: [".java"] },
  // 15% of substantive PRs, 19 files
  { concept: "java-exception-wrapping", pattern: /\bthrow\s+new\s+\w*(?:Exception|Error)\s*\(|\bcatch\s*\([^)]*\|[^)]*\)/, extensions: [".java"] },
  // 13% of substantive PRs, 14 files
  { concept: "java-object-equality", pattern: /\brecord\s+[A-Z]\w*\s*\(|\bpublic\s+boolean\s+equals\s*\(|\bpublic\s+int\s+hashCode\s*\(|\bObjects\.(?:equals|hash|hashCode)\s*\(|[\w\)\]]\s*[!=]=\s*"|"\s*[!=]=|[\w\)\]]\s*[!=]=\s*(?:[A-Za-z_$][\w$]*\.)+[A-Z][A-Z_0-9]{2,}\b/, extensions: [".java"] },
  //  8% of substantive PRs, 7 files
  { concept: "java-catch-broad-exception", pattern: /\bcatch\s*\(\s*(?:final\s+)?(?:Exception|Throwable|RuntimeException)\s+\w+\s*\)/, extensions: [".java"] },
  // 12% of substantive PRs, 13 files
  { concept: "java-shared-mutable-state", pattern: /\bAtomic(?:Integer|Long|Boolean|Reference|Array)\b|\bConcurrentHashMap\b|\bvolatile\s+|\bsynchronized\b|\bCountDownLatch\b|\bSemaphore\b|\bThreadLocal\b|\bLongAdder\b/, extensions: [".java"] },
  //  8% of substantive PRs, 7 files
  { concept: "java-executor-concurrency", pattern: /\bExecutorService\b|\bExecutor\s+\w+|\bExecutors\.new\w+|\bThreadPool\w*\b|\bCompletableFuture\b|\.submit\s*\(|\bForkJoinPool\b|\bthreadPool\s*\(\s*\)/, extensions: [".java"] },

  // ── Ruby ──────────────────────────────────────────────────────────────
  // Designed from real merged PRs and kept only if they fired on them.
  // 28% of substantive PRs, 56 files
  { concept: "ruby-blank-vs-nil", pattern: /\.(blank\?|present\?|presence|empty\?)/, extensions: [".rb",".rake",".gemspec"] },
  // 24% of substantive PRs, 56 files
  { concept: "ruby-frozen-shallow", pattern: /\.freeze\b|\.frozen\?|\bFrozenError\b|\bdeep_dup\b|\bmake_shareable\b/, extensions: [".rb",".rake",".gemspec"] },
  // 24% of substantive PRs, 41 files
  { concept: "ruby-proc-vs-lambda", pattern: /\blambda\b|->\s*[({]|\bProc\.new\b|&block\b|\byield\b|\bblock_given\?|\.to_proc\b/, extensions: [".rb",".rake",".gemspec"] },
  // 17% of substantive PRs, 30 files
  { concept: "ruby-safe-navigation", pattern: /&\.\w/, extensions: [".rb",".rake",".gemspec"] },
  // 15% of substantive PRs, 25 files
  { concept: "ruby-memoization", pattern: /\|\|=/, extensions: [".rb",".rake",".gemspec"] },
  // 14% of substantive PRs, 28 files
  { concept: "ruby-kwargs-separation", pattern: /\*\*[\w(]|\(\s*\*\w|,\s*\*\w+\s*[,)]|\bruby2_keywords\b/, extensions: [".rb",".rake",".gemspec"] },
  // 13% of substantive PRs, 20 files
  { concept: "ruby-mutating-shared", pattern: /\.(dup|clone)\b|\.(concat|prepend|replace|insert|push|unshift)\s*\(|\.(sub!|gsub!|uniq!|compact!|flatten!|reject!|select!|map!|sort!|sort_by!|strip!)/, extensions: [".rb",".rake",".gemspec"] },
  //  8% of substantive PRs, 20 files
  { concept: "ruby-relation-laziness", pattern: /\.(where|joins|includes|preload|eager_load|left_joins|left_outer_joins|order|limit|offset|group|having|distinct|unscope|references|pluck|find_each|find_in_batches|in_batches)\s*\(|\.exists\?|\.loaded\?/, extensions: [".rb",".rake",".gemspec"] },

  // ── C ─────────────────────────────────────────────────────────────────
  // Designed from real merged PRs and kept only if they fired on them.
  // 21% of substantive PRs, 33 files
  { concept: "c-int-truncation", pattern: /\(\s*(unsigned\s+|signed\s+)?(u?int(8|16|32|64)_t|char|short|int|long|long\s+long|size_t|ssize_t|off_t|curl_off_t|time_t)\s*\)\s*[\w(\-&]/, extensions: [".c",".h",".cc",".cpp",".hpp",".cxx",".hh"] },
  // 12% of substantive PRs, 12 files
  { concept: "c-iteration-invalidation", pattern: /\b\w*[Ii]ter(ator)?\w*\s*\(|\b\w+[Nn]ext\s*\(|while\s*\(\s*\(?\s*\w+\s*=\s*[\w>.\-]*[Nn]ext/, extensions: [".c",".h",".cc",".cpp",".hpp",".cxx",".hh"] },
  // 15% of substantive PRs, 30 files
  { concept: "c-error-path-cleanup", pattern: /\bgoto\s+\w+\s*;|^\s*[a-z_]*(err|fail|clean|out|done)[a-z_]*\s*:\s*$/m, extensions: [".c",".h",".cc",".cpp",".hpp",".cxx",".hh"] },
  // 10% of substantive PRs, 15 files
  // 20% of held-out C PRs, and the single biggest rescue for C.
  { concept: "c-flag-bitmask", pattern: /\bFLAGS_SET\s*\(|[\w)\]]\s*[&|]\s*[A-Z][A-Z_0-9]{2,}\b|\b1\s*<<\s*\w|\b\w+_MASK\b/, extensions: [".c",".h",".cc",".cpp",".hpp",".cxx",".hh"] },
  // 16% of held-out C PRs. Detectable only because `#` stopped being read as a
  // comment in C files, which is what made preprocessor concepts reachable.
  { concept: "c-macro-hygiene", pattern: /^\s*#\s*define\s+\w+\s*\(/m, extensions: [".c",".h",".cc",".cpp",".hpp",".cxx",".hh"] },
  { concept: "c-buffer-bounds", pattern: /\b(memcpy|memmove|memset|strcpy|strncpy|strcat|strncat|sprintf|snprintf|strlcpy|strlcat)\s*\(/, extensions: [".c",".h",".cc",".cpp",".hpp",".cxx",".hh"] },

  // ── Python ────────────────────────────────────────────────────────────
  // Designed from real merged PRs and kept only if they fired on them.
  // 31% of substantive PRs, 88 files
  { concept: "python-isinstance-dispatch", pattern: /\bisinstance\s*\(|\bissubclass\s*\(|\btype\s*\(\s*[\w.]+\s*\)|\bhasattr\s*\(|\bgetattr\s*\(/, extensions: [".py"] },
  // 31% of substantive PRs, 147 files
  { concept: "python-falsy-default", pattern: /\.(get|pop|setdefault)\s*\(|\bdefaultdict\s*\(|\bor\s+(\[\]|\{\}|\(\)|""|''|0\b|None\b|set\(\)|dict\(\)|list\(\))|^\s*(el)?if\s+(not\s+)?[\w.]+\s*:\s*$|:=/m, extensions: [".py"] },
  // 27% of substantive PRs, 129 files
  { concept: "python-short-circuit", pattern: /^\s*(and|or)\s+\S|\b(is\s+(not\s+)?None|!=\s*None)\s*(\)|:|and|or)|\breturn\s+[^#\n]+\s(and|or)\s/m, extensions: [".py"] },
  // 15% of substantive PRs, 176 files
  { concept: "torch-device-placement", pattern: /\.to\s*\(\s*[^)]*(device|["'](cuda|cpu|mps|xpu))|\.(cuda|cpu)\s*\(\s*\)|\bdevice_map\s*=|\btorch_device\b|\bmap_location\b|\bdevice\s*=\s*[\w"']/, extensions: [".py"] },
  //  9% of substantive PRs, 23 files
  { concept: "django-queryset-lazy", pattern: /\.objects\.\w+\s*\(|\b\w+\.(filter|exclude|annotate|alias|order_by|values_list|only|defer)\s*\(|\bassertNumQueries\s*\(|\bcaptured_queries\b|\b(select|prefetch)_related\s*\(/, extensions: [".py"] },
  //  6% of substantive PRs, 15 files
  { concept: "torch-no-grad", pattern: /\btorch\.(no_grad|inference_mode|enable_grad|set_grad_enabled)\b|\brequires_grad\w*\b|\.backward\s*\(|\.detach\s*\(|\.(eval|train)\s*\(\s*\)|\bgrad_fn\b|\bzero_grad\b/, extensions: [".py"] },
  //  6% of substantive PRs, 26 files
  { concept: "python-init-order", pattern: /\bsuper\(\s*\)\s*\.\s*__init__|^\s{4,}self\.\w+\s*\(\s*\)\s*$/m, extensions: [".py"] },

  // ── TypeScript, from real vscode and next.js PRs ──────────────────────
  // Designed from real merged PRs and kept only if they fired on them.
  // 21% of substantive PRs, 54 files
  { concept: "array-every-vacuous", pattern: /\.(every|some)\s*\(/, extensions: [".ts",".tsx",".js",".jsx", ".vue", ".svelte",".mjs"] },
  // 19% of substantive PRs, 69 files
  { concept: "union-exhaustiveness", pattern: /^\s*case\s+['"\w.]|\bswitch\s*\(|^\s*(export\s+)?type\s+[A-Z]\w*\s*=\s*[^;=]*\||^\s*\|\s*['"][\w-]+['"]/m, extensions: [".ts",".tsx"] },
  // 13% of substantive PRs, 30 files
  { concept: "identity-vs-value-equality", pattern: /\.(set|add|has|delete)\s*\(\s*(\{|\[|[\w$]+\.(map|filter|slice|concat)\s*\()|\bset[A-Z]\w*\s*\(\s*(\{|\[)|\b(deepEqual|isEqual|shallowEqual|arraysEqual|structuralEquals|equals)\s*\(/m, extensions: [".ts",".tsx",".js",".jsx", ".vue", ".svelte"] },
  // 13% of substantive PRs, 36 files
  { concept: "cache-key-completeness", pattern: /\b\w*(?:[Cc]ache|[Mm]emo)\w*\.(get|set|has|delete)\s*\(|\b\w*(?:[Cc]acheKey|[Vv]aryPath|[Kk]eyFor|makeKey|keyOf)\w*\b/m, extensions: [".ts",".tsx",".js"] },
  //  6% of substantive PRs, 15 files
  { concept: "stale-state-after-await", pattern: /\bawait\b[\s\S]{0,300}?(\b(this|self)\.[\w$]+\s*=[^=]|\bif\s*\([^)]*\b(this|self)\.[\w$]+[^)]*(===|!==)|\bif\s*\([^)]*(===|!==)[^)]*\b(this|self)\.[\w$]+)/, extensions: [".ts",".tsx"] },
  //  8% of substantive PRs, 22 files
  { concept: "type-predicate-lie", pattern: /\)\s*:\s*[\w$]+\s+is\s+[A-Za-z_$]/, extensions: [".ts",".tsx"] },

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
  /** Inside a triple-quoted string, so it is prose rather than code. */
  inString: boolean;
}

function addedLines(file: DiffFile): AddedLine[] {
  const out: AddedLine[] = [];
  let lineNo = 0;
  let inString = false;
  /** Last non-blank line seen, so a lone fence can be read in context. */
  let previousCode = "";

  for (const raw of file.patch.split("\n")) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      lineNo = Number(hunk[1]);
      // A hunk starts somewhere new in the file, so whatever string state the
      // previous hunk ended in says nothing about this one.
      inString = false;
      continue;
    }
    if (raw.startsWith("+++") || raw.startsWith("---")) continue;
    // "\ No newline at end of file" describes the previous line, and consumes
    // no line of its own.
    if (raw.startsWith("\\")) continue;

    const removed = raw.startsWith("-");
    const added = raw.startsWith("+");
    const text = added || removed ? raw.slice(1) : raw;

    // State is tracked across context lines too, not just added ones: a
    // docstring is usually opened in code the diff did not touch, so counting
    // only added lines would miss that we are inside one.
    if (!removed) {
      const opensHere = inString;
      inString = toggleTripleQuotes(text, inString, previousCode);
      if (added) {
        // A line carrying the opening """ is itself the start of prose.
        out.push({ line: lineNo, text, inString: opensHere || inString });
      }
      if (text.trim()) previousCode = text;
      lineNo++;
    }
  }

  return out;
}

/**
 * Track whether we are inside a triple-quoted string.
 *
 * Python docstrings are the case that matters: they are prose, they routinely
 * describe the very concepts detection looks for, and their continuation lines
 * carry no comment marker at all. Found because `python-identity` fired on a
 * sentence inside a docstring explaining an unrelated fix.
 */
function toggleTripleQuotes(
  text: string,
  inString: boolean,
  previousCode: string,
): boolean {
  const fences = text.match(/"""|'''/g);
  if (!fences) return inString;
  // An even count opens and closes on one line and changes nothing.
  if (fences.length % 2 === 0) return inString;

  // An odd count flips, with one exception that cost real coverage. A hunk can
  // begin part-way through a docstring, so the first fence it contains is the
  // one CLOSING that docstring. Flipping there switches suppression ON for the
  // rest of the hunk and hides every line the diff actually added: measured at
  // 7.6% of all changed Python files across 1,579 real PRs. A docstring opens
  // directly under a block header, so require one before believing a lone fence
  // opened anything.
  if (!inString) {
    // A docstring either sits under a block header, or carries content on the
    // same line as its fence. A fence alone on its line with neither is a
    // CLOSING fence whose opener is outside the hunk, and believing otherwise
    // suppresses everything after it. This is most often true at the very start
    // of a hunk, where there is no preceding line at all.
    // Only a fence directly under a block header opens a DOCSTRING. Everything
    // else assigned to a triple-quoted string is usually code someone wrote on
    // purpose: embedded SQL, a template, a shader. Suppressing those loses real
    // detections, and a `SQL = """ SELECT ... IS NOT NULL """` is exactly the
    // kind of line worth asking about.
    if (!/:\s*$/.test(previousCode)) return false;
  }
  return !inString;
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
const COMMENT_ONLY = /^\s*(\/\/|\*|\/\*|<!--|--\s|"""|''')/;

/**
 * `#` opens a comment in Python, Ruby and shell, and a preprocessor directive
 * in C. Treating it as a comment everywhere discarded 4.5% of every added C
 * line across 1,579 real PRs, and blanked 30 files whose entire added content
 * was directives. `#include` and `#ifdef` are code.
 */
const HASH_COMMENT = /^\s*#/;
const HASH_IS_DIRECTIVE = new Set([".c", ".h", ".cc", ".cpp", ".hpp", ".cxx", ".m", ".mm"]);

function isCode(text: string, ext: string): boolean {
  if (text.trim().length === 0) return false;
  if (COMMENT_ONLY.test(text)) return false;
  if (HASH_COMMENT.test(text) && !HASH_IS_DIRECTIVE.has(ext)) return false;
  return true;
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
  /** How many distinct files matched, used to rank relevance. */
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
/**
 * Added lines that are code: not prose, not a comment, not inside a docstring.
 *
 * Comment lines keep their real line numbers and are dropped from what the
 * patterns see, so evidence still points at the right place in the file.
 */
function codeLinesOf(file: DiffFile, ext: string): AddedLine[] {
  return addedLines(file).filter((l) => !l.inString && isCode(l.text, ext));
}

/**
 * Extensions that are a programming language someone writes by hand.
 *
 * An ALLOWLIST, unlike `NON_CODE_EXTENSIONS`, and the difference is load
 * bearing. Detection can afford a blocklist because a rule that matches nothing
 * costs nothing, and this list decides whether a diff is code at all. Measured
 * over 487 merged PRs, a blocklist called systemd's hardware database, an
 * OpenSSL `VERSION.dat` bump and a directory of `.pod` manpages "code", which
 * would have put eight engineering questions on a copyright-year change.
 *
 * Absent from the list is the honest answer for anything unrecognised: say
 * nothing rather than ask a general question about a file we cannot read.
 */
const CODE_EXTENSIONS = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts",
  ".py", ".pyi", ".rb", ".rake", ".gemspec",
  ".go", ".rs", ".java", ".kt", ".kts", ".scala", ".groovy",
  ".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh", ".hxx",
  ".m", ".mm", ".swift", ".cs", ".fs",
  ".php", ".pl", ".pm", ".lua", ".ex", ".exs", ".erl", ".clj", ".cljs",
  ".sh", ".bash", ".zsh", ".ps1",
  ".sql", ".vue", ".svelte", ".dart", ".zig", ".nim", ".hs", ".ml",
]);

/**
 * Files in this diff that add at least one line of code.
 *
 * "Does this PR contain code someone wrote" is a separate question from "which
 * concepts does it exercise", and only the first justifies asking a general
 * engineering question. A lockfile bump, a changelog entry, a vendor database
 * and a docs PR all return an empty list here, and PopPR stays quiet on them as
 * it always has.
 */
export function codeFiles(ctx: PrContext): string[] {
  const out: string[] = [];
  for (const file of ctx.files) {
    const ext = extensionOf(file.path);
    if (!CODE_EXTENSIONS.has(ext)) continue;
    if (codeLinesOf(file, ext).length) out.push(file.path);
  }
  return out;
}

export function detectConcepts(ctx: PrContext): DetectedConcept[] {
  const files = new Map<string, Set<string>>();
  const evidence = new Map<string, Evidence[]>();

  for (const file of ctx.files) {
    const ext = extensionOf(file.path);
    if (NON_CODE_EXTENSIONS.has(ext)) continue;

    const lines = codeLinesOf(file, ext);
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
