import type { BankEntry } from "./types.js";

export const JS_ARRAYS_ENTRIES: BankEntry[] = [
  // ── array-map-return ─────────────────────────────────────────────────────
  {
    concept: "array-map-return",
    difficulty: "easy",
    prompt:
      "A refactor gives the callback a block body so a log line fits: `const ids = rows.map(r => { r.id })`. On 40 rows, the next line `ids.filter(Boolean)` returns an empty array. Why?",
    options: [
      {
        text: "The callback returns no value, but map drops those rows, so `ids.filter(Boolean)` is handed an empty array",
        whyTempting:
          "filter_map in Rust and compactMap in Swift work this way, and the habit carries over to map.",
      },
      {
        text: "map kept 40 rows, but the block body has no return, so each entry is undefined and Boolean gives false",
      },
      {
        text: "`filter(Boolean)` hands Boolean two arguments: the entry and its index, so the index decides",
        whyTempting:
          "Extra arguments do break parseInt in this position, but Boolean reads only its first one.",
      },
      {
        text: "The undefined entries are holes rather than values, and filter skips holes without a call",
        whyTempting:
          "filter does skip holes in a sparse array, but a block body with no return stores a real undefined.",
      },
    ],
    correct: 1,
    explanation:
      "A block-bodied arrow evaluates to undefined unless the body says return, and map stores whatever the callback returns. Drop the braces, or add the return.",
  },
  {
    concept: "array-map-return",
    difficulty: "medium",
    prompt:
      "`const ids = req.query.ids.split(',').map(parseInt)` turns '10,20,30' into [10, NaN, NaN]. What is the mechanism?",
    options: [
      {
        text: "parseInt stops at the first character it cannot read, and split leaves whitespace behind",
        whyTempting:
          "parseInt does stop at junk input, but it skips leading whitespace, so padded numbers still parse.",
      },
      {
        text: "map always hands the callback the whole array second, so `parseInt('20', arr)` rejects an array as a radix",
        whyTempting:
          "The extra arguments are the culprit, but the index arrives second and the array third.",
      },
      {
        text: "split leaves an empty string between the ids, which parses to NaN because it holds no digits",
        whyTempting:
          "An empty segment does parse to NaN, which is why a trailing comma in a query string bites.",
      },
      {
        text: "The NaNs appear because map passes the index second, and parseInt reads a second argument as a radix",
      },
    ],
    correct: 3,
    explanation:
      "map calls its callback with (value, index, array), so the later calls run as parseInt('20', 1) and parseInt('30', 2), and both radixes are invalid. Wrap it: `.map(s => parseInt(s, 10))`.",
  },
  {
    concept: "array-map-return",
    difficulty: "hard",
    prompt:
      "`users.map(u => u.active && u.name).join(', ')` prints the word false between names, so a colleague rewrites it as `users.map(u => u.active).map(u => u.name)`. What does the rewrite produce?",
    options: [
      {
        text: "An array of undefined, since the first map yields booleans and `false.name` is undefined",
      },
      {
        text: "The names of the active users: the second map sees only what the first map kept",
        whyTempting:
          "Chaining reads like a pipeline that narrows at every stage, and map is the stage that never does.",
      },
      {
        text: "A TypeError on the inactive users, because reading a property off the boolean false throws",
        whyTempting:
          "Only null and undefined throw on property access; false is boxed and answers undefined.",
      },
      {
        text: "The same output as before, but split across two passes that short-circuit per user in the same way",
        whyTempting:
          "The && form does short-circuit per user, but splitting it throws the name half of it away.",
      },
    ],
    correct: 0,
    explanation:
      "map is one to one, so the first pass replaces each user with a boolean and the second reads name off that boolean. Dropping elements is filter's job, or flatMap's when you also transform.",
  },

  // ── array-find-undefined ─────────────────────────────────────────────────
  {
    concept: "array-find-undefined",
    difficulty: "easy",
    prompt:
      "A route handler in plain JS guards with `const u = users.find(p => p.id === id); if (u === null) return notFound();` and still throws on the next line for unknown ids. Why does the guard miss?",
    options: [
      {
        text: "find reports a miss with -1, and a guard written against null cannot see that",
        whyTempting:
          "-1 is how indexOf and findIndex report a miss, and the two families get merged in memory.",
      },
      {
        text: "The guard misses because find reports a miss with an empty array, which is never equal to null",
        whyTempting:
          "filter is the method that hands back an empty array; find hands back one element or nothing.",
      },
      {
        text: "find reports a miss with undefined rather than null: strict equality holds the two apart",
      },
      {
        text: "find is lazy, so the predicate has not run by the time the guard reads u",
        whyTempting:
          "Java streams and Rust iterators are lazy, but every array method here runs to completion first.",
      },
    ],
    correct: 2,
    explanation:
      "A missing element comes back as undefined, and `=== null` is false for undefined. Use `== null` when you want both, or `=== undefined` when you want one.",
  },
  {
    concept: "array-find-undefined",
    difficulty: "medium",
    prompt:
      "A dedupe guard reads `if (items.findIndex(i => i.sku === sku)) return;` before the push. What does it do at runtime?",
    options: [
      {
        text: "It returns on each call, since findIndex hands back a number, and numbers are truthy in a condition",
        whyTempting:
          "Numbers feel uniformly truthy until 0 turns up, and 0 is the index this guard depends on.",
      },
      {
        text: "It never returns, since a miss gives -1, and negatives are falsy in a condition",
        whyTempting:
          "Negative numbers are as truthy as positive ones; among numbers only 0 and NaN are falsy.",
      },
      {
        text: "It returns on a real match but falls through on a miss, which is what the author wanted from `findIndex`",
        whyTempting:
          "That is the shape the code reads as, and it holds whenever the item sits somewhere in the middle.",
      },
      {
        text: "It returns unless the match sits at index 0, since every other index and -1 are truthy",
      },
    ],
    correct: 3,
    explanation:
      "findIndex answers -1 for a miss, which is truthy, and 0 for a first-position match, which is falsy. Compare against -1, or reach for some when a yes or no is all you need.",
  },
  {
    concept: "array-find-undefined",
    difficulty: "hard",
    prompt:
      "Retry delays are read with `const delay = delays.find(d => d <= budget); if (!delay) return DEFAULT_DELAY;`. The list starts with 0, meaning retry at once, and that immediate retry never happens. Why?",
    options: [
      {
        text: "0 is a real match, so `!0` is true and the guard hands back DEFAULT_DELAY instead of it",
      },
      {
        text: "find always skips falsy elements, so the 0 in the list is never offered to the predicate",
        whyTempting:
          "The predicate's own return decides a match; the element's truthiness is never consulted.",
      },
      {
        text: "`d <= budget` is false for each d when budget is undefined, so find misses each time",
        whyTempting:
          "Comparisons against undefined do come back false, but that would lose every delay, not the 0.",
      },
      {
        text: "find hands back the position of the match, but position 0 fails the same guard",
        whyTempting:
          "findIndex is the method that reports a position; find reports the element it matched.",
      },
    ],
    correct: 0,
    explanation:
      "find signals absence with undefined, so `=== undefined` is the only test that separates absence from a falsy match. `!x` also swallows 0, '' and false.",
  },

  // ── array-membership ─────────────────────────────────────────────────────
  {
    concept: "array-membership",
    difficulty: "easy",
    prompt:
      "A table draws its checkmarks with `selected.includes(row)`. After a background refetch every checkmark disappears, while `selected` still holds the same records. What happened?",
    options: [
      {
        text: "includes compares with SameValueZero, which always walks both objects and matches them field by field",
        whyTempting:
          "SameValueZero is the right algorithm name, and it differs from === only in how it treats NaN.",
      },
      {
        text: "The refetched rows are plain objects: includes rejects a prototype mismatch",
        whyTempting:
          "Prototypes take no part in an equality check; two identical plain objects are still unequal.",
      },
      {
        text: "The refetch built new row objects with the same fields, and includes always matches by reference",
      },
      {
        text: "indexOf would still match them, because it coerces both operands to strings before comparing",
        whyTempting:
          "== does coerce an object when the other side is a primitive, but indexOf compares with ===.",
      },
    ],
    correct: 2,
    explanation:
      "Every equality an array search can use compares objects by reference, so a structurally identical record from a second fetch is a different value. Track the selection by id instead.",
  },
  {
    concept: "array-membership",
    difficulty: "medium",
    prompt:
      "`if (!ADMIN_IDS.includes(req.params.userId)) return res.sendStatus(403)` locks out every admin. ADMIN_IDS is `[7, 12, 40]`. What is the mechanism?",
    options: [
      {
        text: "includes compares loosely: '7' does match 7, so the 403 comes from somewhere else",
        whyTempting:
          "== would match here, and includes is the array method people most often assume is loose.",
      },
      {
        text: "It fails because a route param arrives as a string: includes matches strictly, so '7' is not 7",
      },
      {
        text: "includes coerces both sides to strings, so a stray space makes `' 7'` miss the 7",
        whyTempting:
          "A stray space is a real route-param hazard, but includes coerces neither side of the check.",
      },
      {
        text: "Express always coerces numeric route params, so userId is already 7 and the 403 has another cause",
        whyTempting:
          "Express leaves every param a string; a schema layer such as zod is what turns it into a number.",
      },
    ],
    correct: 1,
    explanation:
      "Array.prototype.includes uses SameValueZero, which is strict equality apart from NaN, so no coercion happens. Parse the param with Number at the edge before comparing.",
  },
  {
    concept: "array-membership",
    difficulty: "hard",
    prompt:
      "A guard on freshly computed samples reads `if (samples.indexOf(NaN) !== -1) throw new Error('bad sample')`. NaNs keep reaching the chart and the guard has never fired. Why?",
    options: [
      {
        text: "The samples come from parseFloat, so the bad ones are undefined rather than NaN",
        whyTempting:
          "parseFloat and Number both answer NaN for junk input, so the array does hold NaN values.",
      },
      {
        text: "Neither indexOf nor includes can find a NaN, and a loop with Number.isNaN is the fix",
        whyTempting:
          "The indexOf half is right, so the includes half rides along; SameValueZero does match NaN.",
      },
      {
        text: "indexOf compares with ===, but NaN is never equal to itself, so the scan ends at -1",
      },
      {
        text: "indexOf stops at the first element that is not a finite number, so it returns early",
        whyTempting:
          "indexOf scans the whole array and stops on a match alone; a value's type never ends the scan.",
      },
    ],
    correct: 2,
    explanation:
      "indexOf uses strict equality, where NaN === NaN is false, while includes uses SameValueZero and does find NaN. Write `samples.some(Number.isNaN)` when a NaN check is the intent.",
  },
];
