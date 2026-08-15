import type { BankEntry } from "./types.js";

export const JS_BINDINGS_ENTRIES: BankEntry[] = [
  // ── const-mutation ───────────────────────────────────────────────────────
  {
    concept: "const-mutation",
    difficulty: "easy",
    prompt:
      "A config module holds `const LIMITS = { retries: 3 }`. A handler runs `LIMITS.retries = 5`, and it compiles, lints and ships. What does `const` guarantee here?",
    options: [
      {
        text: "Nothing: `const` is erased at runtime, so it only constrains what TypeScript accepts",
        whyTempting:
          "TypeScript does erase most of what it checks, but `const` is a JavaScript binding that survives into the emitted code.",
      },
      {
        text: "The write is dropped: assignment to a property of a `const` object fails but raises no error",
        whyTempting:
          "Silent write failures are real on frozen objects outside strict mode, and const gets filed under the same protection.",
      },
      { text: "That `LIMITS` keeps naming this object: rebinding it fails but writing to its keys does not" },
      {
        text: "The object is deeply immutable, so the write throws a TypeError once the module is in strict mode",
        whyTempting:
          "Modules are strict and a write to a frozen object does throw there, but const freezes nothing.",
      },
    ],
    correct: 2,
    explanation:
      "`const` fixes the binding, not the value, so the object it names can gain, lose and change properties for its whole life. Object.freeze or a readonly type is what stops the write.",
  },
  {
    concept: "const-mutation",
    difficulty: "medium",
    prompt:
      "A helper builds options with `const opts = Object.assign(DEFAULTS, overrides)` against a module-level `const DEFAULTS`. The first request is correct. Every later request behaves as if it inherited the first one's overrides. Why?",
    options: [
      { text: "DEFAULTS keeps each request's overrides because Object.assign writes into its first argument" },
      {
        text: "Module constants are rebuilt per import, so every caller gets a different DEFAULTS",
        whyTempting:
          "A module body runs once and all importers share the one object, so there is no per-caller copy that could diverge.",
      },
      {
        text: "`Object.assign` returns a fresh object holding a live link to its sources, so reads follow DEFAULTS",
        whyTempting:
          "The return value is an object you can hold, but assign copies once and sets up no ongoing link.",
      },
      {
        text: "Requests share one event loop turn; the assign calls interleave and overwrite each other's options",
        whyTempting:
          "Interleaving explains cross-request bleed in general, though assign is synchronous and cannot be cut in half.",
      },
    ],
    correct: 0,
    explanation:
      "The first argument to Object.assign is the target and it is mutated in place, so a shared default accumulates every caller's overrides. Assign into a fresh `{}` and leave DEFAULTS alone.",
  },
  {
    concept: "const-mutation",
    difficulty: "hard",
    prompt:
      "A helper takes `const queue = state.pending` and has to empty it. `queue = []` is a TypeError, so the author writes `queue.length = 0`. The unread badge on the other side of the app drops to zero. Which explanation fits?",
    options: [
      {
        text: "The store's selector returns a fresh array per call, so the helper emptied a copy",
        whyTempting:
          "Selectors often do hand back new arrays, which would make this mutation harmless: the badge says otherwise.",
      },
      {
        text: "Setting `length` to zero marks the array empty, and the elements it holds survive for other readers",
        whyTempting:
          "length reads like bookkeeping the engine maintains, but writing a smaller value truncates the array for real.",
      },
      {
        text: "The badge memoises on array identity, which an in-place write leaves alone, so it never refreshed",
        whyTempting:
          "Identity-based memos do miss in-place mutations, though that would freeze the badge rather than zero it.",
      },
      { text: "`queue` and `state.pending` name one array: the badge counts it, so the truncation zeroed both" },
    ],
    correct: 3,
    explanation:
      "A const binding blocks rebinding and leaves in-place mutation wide open, which is what pushes people toward `length = 0` and `splice`. Put a new array into the store instead of editing the one the store owns.",
  },

  // ── destructuring-defaults ───────────────────────────────────────────────
  {
    concept: "destructuring-defaults",
    difficulty: "easy",
    prompt:
      "A boot script reads `const { limits: { retries = 3 } } = config`. On a box whose config file has no `limits` section, boot dies with a TypeError. Why?",
    options: [
      {
        text: "Defaults do not reach inside a nested pattern, so `retries` binds to undefined, and a later read throws",
        whyTempting:
          "Nested patterns are rarer, so the default gets filed as a top-level feature: it works at any depth.",
      },
      {
        text: "The leaf default fires, so `retries` is 3 but the TypeError lands further down the boot path",
        whyTempting:
          "The default sits right there on the line, and it does look like cover for the whole path it walks.",
      },
      { text: "The pattern reads `config.limits` before it reaches `retries`, so a read on undefined throws" },
      {
        text: "A destructure never throws: a missing key reads as undefined, so the loader threw",
        whyTempting:
          "Absent keys really do read as undefined, though the object holding them has to exist first.",
      },
    ],
    correct: 2,
    explanation:
      "A default guards the property it sits on and nothing above it, so the outer read happens first and throws on undefined. Give every level that can go missing its own default: `{ limits: { retries = 3 } = {} }`.",
  },
  {
    concept: "destructuring-defaults",
    difficulty: "medium",
    prompt:
      "A logger is `function log(msg, { tags = DEFAULT_TAGS } = {})` over `const DEFAULT_TAGS = []`, and the body does `tags.push(service)`. Within an hour every line carries hundreds of tags. Which explanation fits?",
    options: [
      {
        text: "The default expression is evaluated once at definition time, but each call reuses the array it built",
        whyTempting:
          "This is Python's rule and it predicts the same symptom, but JavaScript evaluates a default on every call.",
      },
      {
        text: "The `= {}` options default is built once and hangs off the function, holding tags",
        whyTempting:
          "The outer default looks like the shared piece, yet it is rebuilt per call: the named const is what persists.",
      },
      {
        text: "The push lands on a copy because destructuring copies the array it binds",
        whyTempting:
          "Binding by copy would make this safe, though a destructure binds the same reference the property held.",
      },
      { text: "The default expression runs on every call; each run resolves to the same module-level array" },
    ],
    correct: 3,
    explanation:
      "The default expression runs per call but evaluates to the same shared array each time, so the pushes pile up. Write the literal inline as `tags = []`, or copy before mutating.",
  },
  {
    concept: "destructuring-defaults",
    difficulty: "hard",
    prompt:
      "`function send(body, { retries = 3 } = {})` is fine when called as `send(body)`. The config loader sets any section it cannot find to null, so on a box with no `http` block `config.http` is null and `send(body, config.http)` throws before a byte leaves. Why?",
    options: [
      { text: "`= {}` substitutes for undefined but not for null, so the key read on the null argument throws" },
      {
        text: "Destructuring `null` yields an empty object, so the throw comes from the retry loop instead",
        whyTempting:
          "`{ ...null }` really is fine, so null feels like it degrades to an empty object wherever it is unpacked.",
      },
      {
        text: "A parameter default cannot be combined with destructuring in one slot, so the binding stays undefined",
        whyTempting:
          "The syntax is dense enough to read as illegal, though a destructuring pattern takes a default like any parameter.",
      },
      {
        text: "Strict mode makes a destructure throw when a listed property is absent, and retries is absent here",
        whyTempting:
          "An absent property is the case defaults exist for, and strict mode changes nothing about how a destructure reads.",
      },
    ],
    correct: 0,
    explanation:
      "`= {}` substitutes only when the argument is undefined, so an explicit null reaches the pattern and reading a property of null throws. Coalesce with `?? {}` at the call site or on the way in.",
  },

  // ── nullish-vs-or ────────────────────────────────────────────────────────
  {
    concept: "nullish-vs-or",
    difficulty: "easy",
    prompt:
      "A settings form saves `retries: form.retries || 3`. A user sets retries to 0 to turn retrying off, and the job still retries three times. Why?",
    options: [
      {
        text: "Numeric inputs arrive as strings, and '0' is truthy: a later parse floors it to 3",
        whyTempting:
          "Numeric inputs do arrive as strings, but the string '0' is truthy and would have survived the `||` intact.",
      },
      {
        text: "The 0 arrived and was reset later because `||` keeps its left side unless it is null or undefined",
        whyTempting:
          "That is the rule for `??`, and the two operators get filed as one fallback with two spellings.",
      },
      { text: "0 is falsy, so the fallback drops the saved 0, and each save stores its own default of 3" },
      {
        text: "0 is stored, and the retry loop reads a falsy limit as unset, so it applies its built-in default",
        whyTempting:
          "The bug could live a layer down, and reading further is a fair instinct: the value never arrives as 0.",
      },
    ],
    correct: 2,
    explanation:
      "`||` falls back on every falsy value, so 0, the empty string and false are all replaced by the default. Use `??` wherever those three are legitimate input.",
  },
  {
    concept: "nullish-vs-or",
    difficulty: "medium",
    prompt:
      "A codemod replaced every `||` with `??`. One regression gets through review: users who clear their display name now render as a blank label instead of their email. Which change caused it?",
    options: [
      { text: "`??` falls back for null and undefined alone, and a cleared name survives where `||` gave the email" },
      {
        text: "`??` falls back only when both sides are nullish: a present user skips the email",
        whyTempting:
          "A stricter operator invites an invented symmetric rule, though only the left operand decides the fallback.",
      },
      {
        text: "The cleared field holds a space, which is truthy under either operator, but the label was always blank",
        whyTempting:
          "Whitespace in a cleared field is a real cause of blank labels, but it would have rendered blank before the codemod.",
      },
      {
        text: "`??` evaluates its right side first, so the email was read from a user record not yet loaded",
        whyTempting:
          "`??` short-circuits exactly as `||` does, and it never touches the right side when the left one is present.",
      },
    ],
    correct: 0,
    explanation:
      "`??` falls back for null and undefined alone, so an empty string now survives where `||` used to replace it. A blanket codemod shifts behaviour everywhere the empty string, 0 or false was a value the fallback caught.",
  },
  {
    concept: "nullish-vs-or",
    difficulty: "hard",
    prompt:
      "A permission memo is `cache[key] ||= isAllowed(user, key)`. Allowed users get faster after their first check and denied users never do. Which explanation fits?",
    options: [
      {
        text: "The cost sits inside isAllowed because a denied check takes the slower path there",
        whyTempting:
          "The symptom splits by outcome, which points at the check itself rather than at the line storing its result.",
      },
      { text: "false is falsy, so `||=` never reads a stored denial as a hit and runs the check again" },
      {
        text: "Logical assignment writes on every call, so the extra property store shows up as the added latency",
        whyTempting:
          "Logical assignment reads like sugar for `x = x || y`, which does always write; `||=` skips the write instead.",
      },
      {
        text: "Computed-key writes tip the cache object into dictionary mode, so lookups slow as it fills up",
        whyTempting:
          "Dictionary-mode degradation is real for objects used as dynamic maps, but it would slow allowed lookups too.",
      },
    ],
    correct: 1,
    explanation:
      "`||=` assigns whenever the current value is falsy, so a cached `false` is indistinguishable from a miss. `??=` stores false and keeps it, which is what a boolean cache needs.",
  },
];
