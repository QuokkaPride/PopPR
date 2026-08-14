import type { BankEntry } from "./types.js";

export const DATA_ENTRIES: BankEntry[] = [
  // ── shallow-copy ─────────────────────────────────────────────────────────
  {
    concept: "shallow-copy",
    difficulty: "easy",
    prompt:
      "`const copy = [...rows]` and then `copy[0].status = 'done'`. What is true of `rows` afterwards?",
    options: [
      { text: "rows[0].status is 'done' too: both arrays hold the same element objects" },
      {
        text: "rows is untouched; spreading an array clones every element it copies into it",
        whyTempting:
          "The new array really is new, and people extend that newness one level down to the elements.",
      },
      {
        text: "rows is untouched, because arrays of objects are copy-on-write until written",
        whyTempting:
          "V8 does have copy-on-write array internals, but that never protects the objects you stored.",
      },
      {
        text: "rows[0] is untouched but rows.length changed, since spread shares the backing store",
        whyTempting:
          "Sharing the backing store is the one thing spread does not do: the array itself is genuinely new.",
      },
    ],
    correct: 0,
    explanation:
      "Array spread copies element references, so both arrays point at the same objects. Mutating an element is visible through every array that holds it.",
  },
  {
    concept: "shallow-copy",
    difficulty: "medium",
    prompt:
      "An undo stack does `history.push({ ...form })` before each edit. Edits to `form.address.city` turn out not to be undoable. Why?",
    options: [
      {
        text: "push stores a reference to form itself, so every snapshot is the same object",
        whyTempting:
          "That is exactly the bug if you push `form` directly, but the spread does give each snapshot its own top-level object.",
      },
      {
        text: "Object spread skips properties holding objects, so address was never captured",
        whyTempting:
          "Spread copies every own enumerable property, object-valued ones included: it just copies the reference.",
      },
      { text: "Every snapshot shares one address object, so an edit rewrites the whole history" },
      {
        text: "Snapshots are frozen on push, so later writes to them fail silently outside strict mode",
        whyTempting:
          "Silent write failures on frozen objects are real, but nothing here ever calls Object.freeze.",
      },
    ],
    correct: 2,
    explanation:
      "The spread copies `address` by reference, so all snapshots and the live form share one nested object. Snapshot nested state with structuredClone, or keep the nested value immutable.",
  },
  {
    concept: "shallow-copy",
    difficulty: "hard",
    prompt:
      "A service hands callers `{ ...config }` so they cannot mutate its cached config. A caller sets `cfg.flags.beta = true` and every other caller sees it. Smallest correct fix?",
    options: [
      {
        text: "Freeze the copy with Object.freeze({ ...config }) before returning it",
        whyTempting:
          "Object.freeze is shallow too: it blocks writes to top-level keys while cfg.flags stays fully writable.",
      },
      {
        text: "Return Object.assign({}, config), which copies own properties recursively",
        whyTempting:
          "Object.assign behaves exactly like spread, one level deep, so it changes nothing here.",
      },
      {
        text: "Memoise the getter so callers share one copy instead of allocating a new one",
        whyTempting:
          "Fewer copies is the opposite of what is needed; sharing is what caused the leak of the mutation.",
      },
      { text: "Return structuredClone(config) so the nested objects are copied too" },
    ],
    correct: 3,
    explanation:
      "Only a deep copy stops a caller reaching shared nested state; structuredClone is built into Node and browsers. Freezing deeply, or storing config as immutable data, works equally well.",
  },

  // ── array-sort-mutation ──────────────────────────────────────────────────
  {
    concept: "array-sort-mutation",
    difficulty: "easy",
    prompt:
      "A module exports `const MONTHS = [...]` and a helper returns `MONTHS.reverse()`. What does the second call return?",
    options: [
      {
        text: "The reversed order again, since reverse builds a fresh array on each call",
        whyTempting:
          "reverse does return an array, and returning something feels like producing something new: but it is the same array.",
      },
      { text: "The original order, because each call flips the shared module array" },
      {
        text: "It throws, because module exports are read-only bindings that cannot be mutated",
        whyTempting:
          "The binding is indeed read-only, but the array object it points at is completely mutable.",
      },
      {
        text: "The reversed order, but only for the first importer, since each import re-evaluates the module",
        whyTempting:
          "A module is evaluated once and every importer shares that one instance, so there is nothing per-importer here.",
      },
    ],
    correct: 1,
    explanation:
      "`reverse()` mutates in place and returns the same array, so calls alternate between the two orders and every importer sees the damage. Use `[...MONTHS].reverse()` or `toReversed()`.",
  },
  {
    concept: "array-sort-mutation",
    difficulty: "medium",
    prompt: "`const top = scores.sort().slice(0, 3)` where scores is `[9, 80, 100, 25]`. What is `top`?",
    options: [
      {
        text: "[9, 25, 80]: sort defaults to ascending numeric order for numeric arrays",
        whyTempting:
          "Ascending numeric is what a comparator would give, and the default looks numeric on single-digit fixtures.",
      },
      { text: "[100, 25, 80]: the default sort compares stringified values" },
      {
        text: "[100, 80, 25]: sort defaults to descending, so slice takes the largest three",
        whyTempting:
          "'Top 3' idiom trains people to expect descending, but no sort anywhere defaults to descending.",
      },
      {
        text: "[9, 80, 100]: .sort() returns a copy, so slice still sees the original order",
        whyTempting:
          "sort returns the same array it mutated, so slice always sees the sorted order, never the input order.",
      },
    ],
    correct: 1,
    explanation:
      "With no comparator, sort converts elements to strings, so the order is '100' < '25' < '80' < '9'. Always pass a comparator for numbers.",
  },
  {
    concept: "array-sort-mutation",
    difficulty: "hard",
    prompt:
      "`rows.sort((a, b) => a.date > b.date)` passes review and works on an 8-row fixture, then orders 400 rows wrongly in production. What is the defect?",
    options: [
      {
        text: "Date objects compare by reference, so > is false between two distinct dates",
        whyTempting:
          "Relational operators coerce Dates through valueOf to timestamps, so `>` genuinely works on them.",
      },
      {
        text: "sort is unstable above a size threshold, so big arrays lose their input order",
        whyTempting:
          "Engines really did switch algorithms by size, but sort has been required to be stable since ES2019.",
      },
      { text: "The comparator never returns a negative value, so 'a before b' is never said" },
      {
        text: "The returned boolean coerces to NaN, which the engine then treats as 'equal'",
        whyTempting:
          "Booleans coerce to 1 and 0, not NaN: and the 0 for false is exactly what makes this read as 'equal'.",
      },
    ],
    correct: 2,
    explanation:
      "A comparator must return negative, zero and positive; `true`/`false` give only 1 and 0, so the algorithm never learns that a precedes b. Small inputs can look right by luck, which is why fixtures miss it.",
  },

  // ── loose-equality ───────────────────────────────────────────────────────
  {
    concept: "loose-equality",
    difficulty: "easy",
    prompt:
      "A lint rule bans `==` everywhere. A reviewer defends one use: `if (opts.timeout == null)`. Is that defensible?",
    options: [
      {
        text: "No: it also matches 0 and the empty string, which are valid timeouts",
        whyTempting:
          "Those values are falsy, and `== null` gets mentally merged with a plain `if (!opts.timeout)` check.",
      },
      { text: "Yes: `== null` matches null and undefined, and nothing else" },
      {
        text: "No: `== null` is true for any object whose valueOf returns null",
        whyTempting:
          "valueOf is consulted when comparing objects to primitives, but null and undefined skip that path entirely.",
      },
      {
        text: "Yes, but only because TypeScript narrows it; in plain JS it matches NaN too",
        whyTempting:
          "Narrowing is a pleasant side effect, but the runtime semantics are identical in plain JS and NaN is not involved.",
      },
    ],
    correct: 1,
    explanation:
      "`x == null` is the one loose comparison with a tight, memorable rule: it is true for exactly null and undefined. Most lint configs exempt it for that reason.",
  },
  {
    concept: "loose-equality",
    difficulty: "medium",
    prompt:
      "A validator rejects blank input with `if (value == '') return 'required'`. Which incoming value is wrongly rejected?",
    options: [
      { text: "The number 0, which coerces to the same primitive as the empty string" },
      {
        text: "The string '0', because numeric coercion turns both sides into zero",
        whyTempting:
          "Both sides are strings here, so `==` compares them directly and no numeric coercion ever happens.",
      },
      {
        text: "null, since null is loosely equal to every empty or absent value",
        whyTempting:
          "null is loosely equal only to undefined; it is never coerced to '' or to 0.",
      },
      {
        text: "undefined, which the spec converts to the empty string before comparing",
        whyTempting:
          "undefined is loosely equal only to null, and it is never converted to a string for `==`.",
      },
    ],
    correct: 0,
    explanation:
      "When a number meets a string, `==` converts the string to a number, and `Number('')` is 0. A legitimate 0 gets rejected as blank.",
  },
  {
    concept: "loose-equality",
    difficulty: "hard",
    prompt:
      "`if (row.id == id)` matched a numeric column against a string route param and worked. Rewritten as `switch (id) { case row.id: ... }` it stops matching. Why?",
    options: [
      {
        text: "switch coerces its discriminant to a string once, so numeric cases never match",
        whyTempting:
          "It sounds like the mirror image of the real rule and it would explain the symptom, but switch performs no coercion at all.",
      },
      {
        text: "case expressions must be constants, so row.id is evaluated as undefined",
        whyTempting:
          "That is C and Java's rule; in JavaScript a case expression is an ordinary expression evaluated at runtime.",
      },
      {
        text: "switch falls through without break, so a later case overwrote the match",
        whyTempting:
          "Fallthrough is a genuine switch hazard, but it changes what runs after a match, not whether one occurs.",
      },
      { text: "switch matches with ===, so the string '7' no longer equals the number 7" },
    ],
    correct: 3,
    explanation:
      "`switch` uses strict equality, so a rewrite that looks purely syntactic silently changes the comparison. Parse the param to a number at the edge instead of relying on coercion.",
  },

  // ── number-precision ─────────────────────────────────────────────────────
  {
    concept: "number-precision",
    difficulty: "easy",
    prompt: "A test asserts `expect(0.1 + 0.2).toBe(0.3)` and fails. What is the right fix?",
    options: [
      {
        text: "Round both sides with toFixed(2) and compare the resulting strings",
        whyTempting:
          "It usually passes, but you are now asserting on formatting, and toFixed brings its own rounding edges.",
      },
      { text: "Compare with a tolerance, e.g. `toBeCloseTo(0.3)`" },
      {
        text: "Use toEqual, which compares numbers structurally instead of bit by bit",
        whyTempting:
          "toEqual exists for deep structural comparison; on two plain numbers it is the very same comparison.",
      },
      {
        text: "Raise the float precision in the runtime config so doubles carry more digits",
        whyTempting:
          "There is no such setting: JavaScript numbers are always IEEE-754 doubles, with no configurable precision.",
      },
    ],
    correct: 1,
    explanation:
      "0.1 and 0.2 have no exact binary representation, so their sum is 0.30000000000000004. Assert within an epsilon rather than on exact equality.",
  },
  {
    concept: "number-precision",
    difficulty: "medium",
    prompt:
      "An upstream returns `{ \"id\": 9007199254740993 }`. Your Node service parses it, stores it and passes it on: and support reports two accounts merging. What happened?",
    options: [
      { text: "JSON.parse produced the nearest double, silently changing the id" },
      {
        text: "Node truncates integers above 2^53 to 32 bits when parsing JSON numbers",
        whyTempting:
          "32-bit truncation is real in JavaScript, but it applies to bitwise operators, never to number parsing.",
      },
      {
        text: "The id survives in memory, but JSON.stringify writes it back in exponent form",
        whyTempting:
          "stringify does use exponent notation for extreme magnitudes, yet the precision was already lost at parse time.",
      },
      {
        text: "The id overflows into a negative number, the usual signed 64-bit wraparound",
        whyTempting:
          "Doubles do not wrap; they drop low-order bits and stay positive, which is why the corruption is so quiet.",
      },
    ],
    correct: 0,
    explanation:
      "JSON numbers are parsed into doubles, which are exact only up to 2^53-1, so 9007199254740993 becomes ...992 and collides with a neighbouring id. Carry 64-bit ids as strings end to end.",
  },
  {
    concept: "number-precision",
    difficulty: "hard",
    prompt:
      "A helper floors a division with `const page = offset / limit | 0`. It is correct for years, then goes wrong once offset passes about 2.1 billion. Why?",
    options: [
      {
        text: "`| 0` truncates toward zero, so negative offsets round the wrong way",
        whyTempting:
          "True, and a real bug for negatives: but it would have failed from day one rather than at a 2.1 billion threshold.",
      },
      {
        text: "Division past Number.MAX_SAFE_INTEGER starts returning a non-integer double",
        whyTempting:
          "MAX_SAFE_INTEGER is about 9e15, thousands of times larger than the boundary that actually bites here.",
      },
      { text: "Bitwise operators convert operands to 32-bit ints, so the result wraps" },
      {
        text: "`|` on a non-integer operand throws a RangeError in strict mode",
        whyTempting:
          "Bitwise operators never throw; they coerce silently, which is precisely what makes this failure so hard to spot.",
      },
    ],
    correct: 2,
    explanation:
      "Every bitwise operator coerces to a signed 32-bit integer, so values above 2^31-1 wrap to negatives. Use Math.floor or Math.trunc when the input can exceed 32 bits.",
  },

  // ── json-deep-clone ──────────────────────────────────────────────────────
  {
    concept: "json-deep-clone",
    difficulty: "easy",
    prompt:
      "Two requests with identical filters produce different cache keys from `JSON.stringify(filters)`. What is the likeliest cause?",
    options: [
      {
        text: "stringify sorts keys alphabetically, so one object must carry an extra key",
        whyTempting:
          "Sorted output is what you want from a cache key and some libraries do it, but JSON.stringify never sorts.",
      },
      {
        text: "Numbers are serialised with locale-dependent separators across regions",
        whyTempting:
          "JSON number formatting is locale-independent; toLocaleString is the API that varies by region.",
      },
      { text: "Key order follows insertion, so { a, b } and { b, a } stringify differently" },
      {
        text: "undefined values serialise as null, and that varies with property order",
        whyTempting:
          "undefined properties are dropped from objects entirely (they become null only inside arrays), and that behaviour is deterministic.",
      },
    ],
    correct: 2,
    explanation:
      "JSON.stringify emits string keys in insertion order, so two equal filter objects built in different orders produce different strings. Use a canonical serialiser that sorts keys for cache keys.",
  },
  {
    concept: "json-deep-clone",
    difficulty: "medium",
    prompt:
      "You deep-clone with `JSON.parse(JSON.stringify(node))` on a tree whose children each hold a `parent` back-reference. What happens?",
    options: [
      { text: "stringify throws a TypeError on the cycle before anything is cloned" },
      {
        text: "The parent links are dropped and the rest of the tree clones cleanly",
        whyTempting:
          "JSON really does silently drop functions and undefined, so people expect the same leniency for cycles.",
      },
      {
        text: "It recurses until the call stack overflows, hanging the request",
        whyTempting:
          "A hand-rolled recursive clone would blow the stack, but stringify detects the cycle and fails fast instead.",
      },
      {
        text: "It clones fine, since JSON.stringify tracks seen objects and emits a $ref marker",
        whyTempting:
          "$ref cycle encoding is a convention in libraries such as flatted, not anything JSON.stringify does.",
      },
    ],
    correct: 0,
    explanation:
      "A cycle makes JSON.stringify throw 'Converting circular structure to JSON', so the clone never happens. structuredClone handles cycles correctly.",
  },
  {
    concept: "json-deep-clone",
    difficulty: "hard",
    prompt:
      "You replace a JSON round-trip with `structuredClone(entity)`. Dates now survive, but `clone instanceof User` is false and a later call throws DataCloneError. Why?",
    options: [
      { text: "structuredClone copies data, not prototypes, and refuses to clone functions" },
      {
        text: "structuredClone only copies enumerable own properties, so instance methods are skipped",
        whyTempting:
          "It does copy own enumerable data properties, but the lost instanceof is about the prototype link, not about enumerability.",
      },
      {
        text: "DataCloneError means the object exceeded the structured-clone size limit",
        whyTempting:
          "DataCloneError signals an unclonable value such as a function or a DOM node, not an object that is too big.",
      },
      {
        text: "You must list the class in the transfer option for its prototype to survive",
        whyTempting:
          "The transfer list moves ArrayBuffers and similar; there is no way to register a class with the algorithm.",
      },
    ],
    correct: 0,
    explanation:
      "The structured clone algorithm reproduces data and built-ins but attaches plain Object.prototype, and it throws DataCloneError on functions. Rehydrate with `new User(cloned)` if you need behaviour back.",
  },

  // ── unbounded-growth ─────────────────────────────────────────────────────
  {
    concept: "unbounded-growth",
    difficulty: "easy",
    prompt:
      "A websocket handler does `messages.push(msg)` into a module-level array so the UI can 'replay recent messages'. What is the failure mode?",
    options: [
      {
        text: "The array hits the engine's maximum length and pushes start throwing",
        whyTempting:
          "There is a maximum array length near 2^32, but the process dies of memory pressure long before reaching it.",
      },
      {
        text: "Older entries are collected once nothing references them individually",
        whyTempting:
          "The array itself is a reference to every entry, so no message ever becomes unreachable.",
      },
      {
        text: "It is fine, because V8 compacts the array during major GC and reclaims the space",
        whyTempting:
          "Compaction moves live objects to reduce fragmentation; it never deletes data that is still reachable.",
      },
      { text: "The array grows for the life of the process until it exhausts the heap" },
    ],
    correct: 3,
    explanation:
      "An append-only buffer with no eviction is a memory leak on a slow fuse, usually surfacing as an OOM restart days later. Bound it: keep the last N with a ring buffer or splice on push.",
  },
  {
    concept: "unbounded-growth",
    difficulty: "medium",
    prompt:
      "You add a Prometheus counter labelled with `userId`. Process memory climbs steadily and scrapes get slower. Why?",
    options: [
      {
        text: "Counters are stored per request, so the client library never reuses instances",
        whyTempting:
          "The client does reuse the counter object; it is the set of distinct label combinations that multiplies.",
      },
      { text: "Each distinct label value creates a new time series that is kept forever" },
      {
        text: "High-cardinality labels are rejected by the server, so the client retries the scrape",
        whyTempting:
          "A server may reject an oversized scrape, but the memory has already been spent on the client side.",
      },
      {
        text: "Counters retain a full history of increments so that rate() can be computed locally",
        whyTempting:
          "rate() is computed by the server from scraped samples; the client keeps only a current value per series.",
      },
    ],
    correct: 1,
    explanation:
      "A metric label with unbounded cardinality (user id, request id, URL) creates one in-memory series per value and none are ever evicted. Label only with low-cardinality dimensions.",
  },
  {
    concept: "unbounded-growth",
    difficulty: "hard",
    prompt:
      "You bound a cache at 10,000 entries by deleting the oldest key whenever size exceeds the cap. Memory still grows without limit in production. Which explanation fits best?",
    options: [
      { text: "Entries are bounded in count but not in size, and values vary hugely" },
      {
        text: "Map.delete leaves the key slot allocated, so the internal table never shrinks",
        whyTempting:
          "A Map does not eagerly shrink its bucket array, but that overhead is itself bounded by the entry cap.",
      },
      {
        text: "Deleting during iteration skips entries, so eviction quietly stops running",
        whyTempting:
          "Map iteration copes with deletion, and even skipped evictions would leave the entry count bounded.",
      },
      {
        text: "The cap counts only top-level keys, so nested objects are exempt from collection",
        whyTempting:
          "Nesting exempts nothing from GC; a value is collected once unreachable, whatever its depth.",
      },
    ],
    correct: 0,
    explanation:
      "Counting entries is not the same as bounding bytes: 10,000 cached 5 MB responses is 50 GB. Bound the cache by weight, or cap the size of what you are willing to store.",
  },

  // ── float-money ──────────────────────────────────────────────────────────
  {
    concept: "float-money",
    difficulty: "easy",
    prompt:
      "Your team agrees to store all money as integer cents. Which operation still needs a deliberate decision?",
    options: [
      {
        text: "Adding two amounts, which overflows once totals pass 2^31 cents",
        whyTempting:
          "JavaScript numbers are doubles and stay exact to 2^53, roughly $90 trillion, so ordinary sums are safe.",
      },
      {
        text: "Comparing two amounts, since integer equality still goes through float rules",
        whyTempting:
          "Integers below 2^53 compare exactly; the float rules only bite once a fractional part appears.",
      },
      {
        text: "Serialising to JSON, which converts integers above 999999 to exponent notation",
        whyTempting:
          "stringify only uses exponent form for extreme magnitudes, far beyond any realistic cents value.",
      },
      { text: "Applying a percentage tax or discount, which reintroduces a fraction" },
    ],
    correct: 3,
    explanation:
      "Integer cents make storage and addition exact, but any percentage produces a fraction of a cent that someone must round explicitly. Decide the rounding rule and where the remainder goes.",
  },
  {
    concept: "float-money",
    difficulty: "medium",
    prompt:
      "`(1.005).toFixed(2)` returns '1.00' rather than '1.01', and an invoice line comes out a cent short. What is going on?",
    options: [
      {
        text: "toFixed uses banker's rounding, so exact halves go to the even digit",
        whyTempting:
          "Banker's rounding would also yield 1.00 here, so the answer looks confirmed: but toFixed rounds half away from zero.",
      },
      {
        text: "toFixed truncates rather than rounds, dropping every digit past the requested precision",
        whyTempting:
          "Truncation predicts 1.00 too, which makes it hard to rule out without a second example such as (1.006).toFixed(2).",
      },
      { text: "The nearest double to 1.005 is just below it, so rounding down is right" },
      {
        text: "toFixed returns a string, and the string comparison hides the missing cent",
        whyTempting:
          "The string return type is a real trap elsewhere, but the missing cent is decided before any formatting happens.",
      },
    ],
    correct: 2,
    explanation:
      "1.005 is stored as roughly 1.00499999999999989, so rounding to two places correctly gives 1.00. Round money in integer minor units or with a decimal library, never with toFixed on a float.",
  },
  {
    concept: "float-money",
    difficulty: "hard",
    prompt:
      "A $100.00 charge is split three ways with `Math.round((total / 3) * 100)` cents per share. What is the defect?",
    options: [
      {
        text: "Math.round uses banker's rounding, so .5 cases go to the even cent",
        whyTempting:
          "Many languages do round half to even, but JS Math.round rounds half toward +Infinity.",
      },
      { text: "The three shares add up to 9999 or 10001 cents, not 10000" },
      {
        text: "total / 3 loses precision past MAX_SAFE_INTEGER, corrupting large charges",
        whyTempting:
          "These values are nowhere near 2^53; the split is already wrong at $100, with no large numbers involved.",
      },
      {
        text: "Multiplying by 100 after dividing overflows the exponent for small shares",
        whyTempting:
          "Doubles have an enormous exponent range, so nothing overflows at money-sized magnitudes.",
      },
    ],
    correct: 1,
    explanation:
      "Rounding each share independently loses or invents cents, so the parts no longer reconcile with the whole. Allocate: compute floor shares, then distribute the remainder cent by cent.",
  },
];
