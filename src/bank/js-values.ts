import type { BankEntry } from "./types.js";

export const JS_VALUES_ENTRIES: BankEntry[] = [
  // ── optional-chaining ────────────────────────────────────────────────────
  {
    concept: "optional-chaining",
    difficulty: "easy",
    prompt:
      "`const email = order.customer.email` crashed on orders imported without a customer. The fix rewrites it as `order.customer?.email`. The crash stops and those receipts now go nowhere. What is `email`?",
    options: [
      {
        text: "`null`, so the mailer's `=== undefined` guard on the address never fires",
        whyTempting:
          "Optional chaining is filed under 'handles missing values', and null is what people expect a missing value to become.",
      },
      {
        text: "the empty string, which fails the mailer's `if (to)` check but raises no error",
        whyTempting:
          "Missing string fields do arrive as '' from plenty of APIs, so the coercion looks like the house rule.",
      },
      { text: "`undefined`, which the mailer accepts as an address and delivers nowhere" },
      {
        text: "a caught TypeError: `?.` swallows the error and the send is skipped",
        whyTempting:
          "`?.` reads like a small try/catch around the read, and a swallowed error would also explain the silence.",
      },
    ],
    correct: 2,
    explanation:
      "`?.` short-circuits the chain to undefined instead of throwing, so a missing customer stops being a crash and starts being a bad argument. Guard where the value is used, not only where it is read.",
  },
  {
    concept: "optional-chaining",
    difficulty: "medium",
    prompt:
      "`user?.address.city` replaced a crash on logged-out requests. It ships, then throws for a signed-in user who never filled in an address. Why?",
    options: [
      { text: "`?.` guards the link it sits on, so `.address.city` is a plain read because `user` exists" },
      {
        text: "`?.` guards every link to its right, so the throw comes from a getter on `address`",
        whyTempting:
          "The chain reads as one protected unit, which is the model the syntax invites.",
      },
      {
        text: "`?.` short-circuits on null, and an address never filled in is undefined",
        whyTempting:
          "Optional chaining gets described as a null check, so null against undefined looks like the edge that bit.",
      },
      {
        text: "`?.` is TypeScript syntax that is erased on build, so the guard is gone in the shipped bundle",
        whyTempting:
          "TypeScript does erase its own annotations at build time, and `?.` landed while people were learning both at once.",
      },
    ],
    correct: 0,
    explanation:
      "Optional chaining short-circuits for the operand it is attached to, and every later `.` in the chain is unguarded. Write `user?.address?.city` when either link can be missing.",
  },
  {
    concept: "optional-chaining",
    difficulty: "hard",
    prompt:
      "A cast is added to satisfy the type checker: `(session?.user as User).name`. The line was safe for logged-out visitors before and now throws for them. What changed?",
    options: [
      {
        text: "`as User` is checked when the value flows through, and undefined fails that check",
        whyTempting:
          "A cast performs a checked conversion in most languages, and TypeScript borrows the keyword without the behaviour.",
      },
      {
        text: "The parentheses force eager evaluation: `session.user` is read even when `session` is null",
        whyTempting:
          "The parentheses are the real culprit, which makes any story about them feel right, but the inner guard still works.",
      },
      {
        text: "The checker sees a non-nullable type after the cast and drops the emitted `?.` as dead code",
        whyTempting:
          "Types steering the emitted output is a common model, and emit never depends on what the checker inferred.",
      },
      { text: "The parentheses end the chain, so `session?.user` yields undefined but `.name` reads it" },
    ],
    correct: 3,
    explanation:
      "Short-circuiting stops at the end of the parenthesised expression, so undefined comes out and the next `.` dereferences it. Keep the chain whole and cast the result instead.",
  },

  // ── string-replace-first ─────────────────────────────────────────────────
  {
    concept: "string-replace-first",
    difficulty: "easy",
    prompt:
      "A build script slugs a version with `const slug = version.replace('.', '')` and writes to `dist/<slug>`. The 1.2.3 artefact lands in a directory nobody expected. What is `slug`?",
    options: [
      {
        text: "`123`: a string pattern applies to every match it finds",
        whyTempting:
          "'Replace the dots' is how the line reads aloud, and nothing in it mentions a count.",
      },
      { text: "`12.3`: a string pattern replaces the first match and stops" },
      {
        text: "`.2.3`: the `.` is read as a regex wildcard and eats the leading character",
        whyTempting:
          "The dot is the character everyone escapes in a regex, so it looks dangerous even as a plain string.",
      },
      {
        text: "a TypeError: `replace` accepts the pattern but needs `/g` once there are repeats",
        whyTempting:
          "`replaceAll` does throw on a non-global regex, and the two rules get swapped in memory.",
      },
    ],
    correct: 1,
    explanation:
      "A string pattern matches one occurrence, so `replace` leaves every later one in place. `replaceAll`, or a regex carrying `/g`, covers the rest.",
  },
  {
    concept: "string-replace-first",
    difficulty: "medium",
    prompt:
      "A filter moved from `body.replace('damn', '***')` to `body.replace(/damn/i, '***')` to catch capitals. QA reports the second occurrence in a message still gets through. Why?",
    options: [
      {
        text: "String patterns replace every match, and only regex patterns stop at the first",
        whyTempting:
          "It inverts the real rule, and the migration looks like the moment coverage was lost.",
      },
      {
        text: "`lastIndex` sits past the second hit because the literal regex is reused across calls",
        whyTempting:
          "`lastIndex` on a shared global regex is a genuine hazard with `test` and `exec`, so it is a familiar suspect.",
      },
      {
        text: "`replace` covers one match unless the replacement is a function, which runs per match",
        whyTempting:
          "The function form is called once per match, which makes it look like the switch that turns on multi-match.",
      },
      { text: "The `g` flag alone sets how many get replaced, and `/i` changed which text matches" },
    ],
    correct: 3,
    explanation:
      "The `g` flag alone decides the count, so a non-global regex behaves exactly like a string pattern. `/damn/gi` fixes both halves of the problem.",
  },
  {
    concept: "string-replace-first",
    difficulty: "hard",
    prompt:
      "A template helper renders with `tpl.replace('{{body}}', userText)`. A ticket whose text contains `$&` renders with the literal `{{body}}` sitting in the middle of it. Why?",
    options: [
      { text: "`$&` in a replacement string always expands to the matched text before insertion" },
      {
        text: "`replace` rescans its output, so the placeholder returns from the inserted text",
        whyTempting:
          "Replacing in place feels iterative, and a rescan would explain a placeholder showing up after the fact.",
      },
      {
        text: "The replacement runs through template-literal interpolation, so `$` opens an expression",
        whyTempting:
          "`${}` in template literals trains the eye to read a `$` as the start of an interpolation.",
      },
      {
        text: "The pattern is compiled to a regex, and `{{body}}` reads as a repetition quantifier",
        whyTempting:
          "A string pattern is matched literally, and a regex would choke on the braces rather than reproduce them.",
      },
    ],
    correct: 0,
    explanation:
      "The replacement string carries its own syntax: `$&`, `$1` and their siblings are expanded before insertion. Pass a function, `() => userText`, whenever the replacement is user data.",
  },

  // ── number-parsing ───────────────────────────────────────────────────────
  {
    concept: "number-parsing",
    difficulty: "easy",
    prompt:
      "An order form runs `const qty = Number(field); if (Number.isNaN(qty)) return 'invalid'`. A blank field books zero items instead of being rejected. Why?",
    options: [
      {
        text: "the blank string is read as a number because `Number.isNaN` coerces its argument",
        whyTempting:
          "The global `isNaN` does coerce, and the two names get used as if they were one function.",
      },
      {
        text: "`Number(field)` is undefined for an empty input: `Number.isNaN(undefined)` is false",
        whyTempting:
          "Empty inputs arriving as undefined is a familiar shape, and it lands on the same silent pass.",
      },
      { text: "`Number('')` is 0, and 0 is not NaN, so the NaN guard never sees a value to reject" },
      {
        text: "`Number('')` is NaN, and NaN fails every equality check including the one in the guard",
        whyTempting:
          "NaN not equalling itself is real, and it explains a missed guard everywhere except here, where `Number.isNaN` does the checking.",
      },
    ],
    correct: 2,
    explanation:
      "The empty string converts to 0, and so do null, false and whitespace, so a NaN guard never sees them. Check for a blank value before converting.",
  },
  {
    concept: "number-parsing",
    difficulty: "medium",
    prompt:
      "A layout helper read a gutter with `parseInt(el.style.paddingLeft)` and got 12 from `'12px'`. A teammate switched it to `Number(...)` for strictness and every row collapsed. Why?",
    options: [
      {
        text: "`Number` returns 0 for a string with a unit suffix, and a zero gutter collapses the row",
        whyTempting:
          "Returning 0 on a failed parse is how atoi and many form libraries behave, so it is the expected shape of a bad parse.",
      },
      { text: "`Number('12px')` is NaN: the whole string converts or none of it does; NaN is not a width" },
      {
        text: "`Number` yields the numeric prefix but keeps it a string, so the arithmetic concatenates",
        whyTempting:
          "Concatenation from a stray `+` is a real layout bug, and it produces the same nonsense widths.",
      },
      {
        text: "`Number` handles `'12px'` the same way, and the collapse comes from dropping the radix argument",
        whyTempting:
          "The radix did disappear in that diff, which makes it the visible change to blame.",
      },
    ],
    correct: 1,
    explanation:
      "`parseInt` scans from the left and keeps the digits it can read, so `'12px'` is 12. `Number` converts the whole string or returns NaN, which suits input that carries no units.",
  },
  {
    concept: "number-parsing",
    difficulty: "hard",
    prompt:
      "An importer books CSV amounts with `parseInt(cell, 10)`. The export tool that wrote the file rendered one thousand as `1e3`, and the ledger takes that row as a single unit. What does `parseInt('1e3', 10)` return?",
    options: [
      {
        text: "1000: `parseInt` reads exponent notation the same way the literal `1e3` in source does",
        whyTempting:
          "The literal `1e3` and `Number('1e3')` are both 1000, so exponents look like something every numeric parser reads.",
      },
      {
        text: "a SyntaxError: `parseInt` rejects a string that does not spell out a plain integer",
        whyTempting:
          "`BigInt('1e3')` does throw on this exact string, and the two parsers get filed under one rule.",
      },
      { text: "1: `parseInt` stops at `e`, which is not a digit in base 10, and keeps the 1 it read" },
      {
        text: "0: `parseInt` falls back to zero because a digit glued to a letter is unreadable",
        whyTempting:
          "C's `atoi` returns 0 for a string it cannot read, and that expectation carries into JavaScript.",
      },
    ],
    correct: 2,
    explanation:
      "`parseInt` reads digits from the left and stops at the first character that is not one in the radix, so `1e3` is 1 and `1e21` is 1 as well. `parseFloat('1e3')` is 1000, and so is `Number('1e3')`: reach for those on a column an export tool wrote.",
  },
];
