import type { BankEntry } from "./types.js";

/**
 * TypeScript, chosen for relevance rather than coverage.
 *
 * Measured over 131 merged PRs from vscode and next.js, TypeScript already had
 * 81% coverage before these landed. The problem was that a PR titled "fix
 * potential memory leak in terminal link hover" got asked about optional
 * chaining. Each concept here was picked so that when it fires, it fires on the
 * reason the PR exists.
 */
export const TS_RUNTIME_ENTRIES: BankEntry[] = [
  // ── array-every-vacuous ──────────────────────────────────────────────────
  {
    concept: "array-every-vacuous",
    difficulty: "easy",
    prompt:
      "A group is hidden when `group.models.every(m => m.hidden)`. A reviewer asks why the code is written as `group.models.length > 0 && group.models.every(...)`. What does the prefix defend against?",
    options: [
      {
        text: "An empty array, where `every` returns true and would hide a group containing nothing",
      },
      {
        text: "A null models array, where reading `.every` throws and the length check short-circuits first",
        whyTempting:
          "Guarding a possibly-absent array is a real reason to write a prefix like this, just not this one.",
      },
      {
        text: "A sparse array, where `every` skips holes and reports true for a partially filled list",
        whyTempting:
          "`every` genuinely does skip holes, so this is a true fact about arrays chosen for the wrong question.",
      },
      {
        text: "A large array, where the length check lets the engine skip the callback allocation on the hot path",
        whyTempting:
          "Avoiding a callback on a hot path is a real optimisation, and this is where you would write it.",
      },
    ],
    correct: 0,
    explanation:
      "`[].every(pred)` is true for any predicate, because there is no element that fails it. Any check phrased as all-items-satisfy needs to decide what it means on empty input, and say so.",
  },
  {
    concept: "array-every-vacuous",
    difficulty: "medium",
    prompt:
      "`const ok = items.every(async i => await validate(i));` What does `ok` hold?",
    options: [
      {
        text: "`true`, always, because each call returns a Promise and every Promise is truthy",
      },
      {
        text: "A Promise resolving to the combined result, since `every` awaits an async predicate",
        whyTempting:
          "It is what the code is reaching for, and what `Promise.all` plus `every` would actually give you.",
      },
      {
        text: "`false`, always, since a Promise is an object and the predicate's return is coerced with `Boolean` after settling",
        whyTempting:
          "It correctly identifies that coercion happens and then picks the wrong side of the truthiness table.",
      },
      {
        text: "`true` when every validate resolves and `false` when any rejects, since a rejection makes the Promise falsy",
        whyTempting:
          "Rejection handling is what you want to happen, and unhandled rejections do surface loudly enough to seem connected.",
      },
    ],
    correct: 0,
    explanation:
      "`every` is synchronous and only inspects the returned value, and a pending Promise is truthy. Use `(await Promise.all(items.map(validate))).every(Boolean)`, or a plain loop with `await` inside.",
  },
  {
    concept: "array-every-vacuous",
    difficulty: "hard",
    prompt:
      "A permission check is `requested.every(p => granted.includes(p))`. A request arrives with an empty `requested`. What does the check do, and is that right?",
    options: [
      {
        text: "It passes, which is correct if the request genuinely asks for nothing and wrong if empty means the parse failed",
      },
      {
        text: "It passes, and that is unconditionally correct: asking for no permissions needs no permissions",
        whyTempting:
          "It is the clean formal answer, and it is right whenever the empty case can only arrive on purpose.",
      },
      {
        text: "It fails, since `every` on an empty array returns undefined, which is falsy",
        whyTempting:
          "Several array methods do return undefined on empty input, so it is a reasonable thing to assume of this one.",
      },
      {
        text: "It passes, and the same expression with `some` would be the safe rewrite",
        whyTempting:
          "`some` does invert the empty case, and swapping the two is a real fix for a differently phrased check.",
      },
    ],
    correct: 0,
    explanation:
      "Vacuous truth is correct logic and often the wrong policy: the question is whether an empty list is a valid request or a signal that something upstream produced nothing. Decide explicitly, because `every` will not ask.",
  },

  // ── union-exhaustiveness ─────────────────────────────────────────────────
  {
    concept: "union-exhaustiveness",
    difficulty: "easy",
    prompt:
      "A discriminated union gains a fourth member. A `switch` over it in another file has three cases and no default. What does the compiler report?",
    options: [
      {
        text: "Nothing: the switch is valid, and the function returns undefined for the new variant at runtime",
      },
      {
        text: "An error on the switch, since TypeScript checks that every union member is handled",
        whyTempting:
          "It is the property people believe they are buying with a discriminated union, and it is one flag away.",
      },
      {
        text: "A warning under `strict`, which most projects have on, so the build fails on the new variant",
        whyTempting:
          "`strict` does turn on several related checks, which makes it plausible this is one of them.",
      },
      {
        text: "An error only if the switch is inside a function with an inferred return type, which is why annotations matter here",
        whyTempting:
          "The return type genuinely does change whether this is caught, so this is right about the mechanism and backwards about when.",
      },
    ],
    correct: 0,
    explanation:
      "TypeScript does not require a switch to be exhaustive. Assign the scrutinee to `never` in the default arm, or give the function an explicit return type that excludes undefined, and the compiler starts telling you.",
  },
  {
    concept: "union-exhaustiveness",
    difficulty: "medium",
    prompt:
      "Which line, added to a switch's default arm, makes the compiler flag every future union member?",
    options: [
      {
        text: "`const _exhaustive: never = value;`",
      },
      {
        text: "`throw new Error(\\`unhandled: ${value}\\`);`",
        whyTempting:
          "It is the right runtime behaviour and catches the bug in production rather than in the build.",
      },
      {
        text: "`assertUnreachable(value as never);`",
        whyTempting:
          "The cast is what breaks it: `as never` silences exactly the error the pattern exists to raise.",
      },
      {
        text: "`return value satisfies never;`",
        whyTempting:
          "`satisfies` is the modern operator for this family of check, and it reads like it should work here.",
      },
    ],
    correct: 0,
    explanation:
      "In the default arm a fully narrowed union is `never`, so assigning it to a `never`-typed variable compiles today and fails the moment a member is unhandled. The cast version defeats the check, which is why it is the dangerous one to copy.",
  },
  {
    concept: "union-exhaustiveness",
    difficulty: "hard",
    prompt:
      "A PR removes `'prerender-ppr'` from `export type Store = 'a' | 'b' | 'prerender-ppr'` and then hand-deletes `case 'prerender-ppr':` from eight files. Why was the hand-deletion necessary?",
    options: [
      {
        text: "A case for a removed member is a type error only in some positions, so the compiler flagged part of the work and not all of it",
      },
      {
        text: "Removing a union member is invisible to the compiler, so nothing was flagged and all eight were found by search",
        whyTempting:
          "It fits the manual-work story, and comparing against a removed literal really does compile in some configurations.",
      },
      {
        text: "The cases were on string literals rather than the union type, so they were never type-checked against it",
        whyTempting:
          "It correctly notices the cases are literals, then concludes they escape checking, which is the wrong half.",
      },
      {
        text: "The switches were exhaustive, so removing a member made the default arm unreachable and the compiler required its removal first",
        whyTempting:
          "Exhaustiveness and reachability are the right pair of ideas, arranged into a rule that does not exist.",
      },
    ],
    correct: 0,
    explanation:
      "Comparing a narrowed union against an impossible literal is an error, and the same case inside a broader-typed switch is not. Narrowing a union tells you about some call sites, and grep is what finds the rest.",
  },

  // ── identity-vs-value-equality ───────────────────────────────────────────
  {
    concept: "identity-vs-value-equality",
    difficulty: "easy",
    prompt:
      "A refresh rebuilds `servers` from the same source data and calls `this._servers.set(next)`. Subscribers fire on every refresh even when nothing changed. Why?",
    options: [
      {
        text: "`next` is a new array each time, and change detection compares references",
      },
      {
        text: "`set` always notifies, since an observable has no way to know whether the value is meaningful",
        whyTempting:
          "Some observables do notify unconditionally, so this is true of a different library and plausible of this one.",
      },
      {
        text: "The array contents are the same objects, and identical contents make the comparison fall back to a deep scan that times out",
        whyTempting:
          "Deep comparison is what people assume happens, and a timeout would explain a spurious notification.",
      },
      {
        text: "Subscribers fire on subscribe as well as on change, so what looks like a spurious notification is the initial one",
        whyTempting:
          "Replaying the current value on subscribe is a real behaviour, and it does produce confusing extra notifications.",
      },
    ],
    correct: 0,
    explanation:
      "`[1,2] !== [1,2]`, so a rebuilt array is always a change by reference. Compare contents before setting, or keep the old array when nothing differs.",
  },
  {
    concept: "identity-vs-value-equality",
    difficulty: "medium",
    prompt:
      "`const seen = new Set(); seen.add({id: 1}); seen.has({id: 1})`. What does `has` return, and what would make it work?",
    options: [
      {
        text: "`false`: Set uses SameValueZero, so store a key you can compare, such as the id itself",
      },
      {
        text: "`false`, and the fix is to freeze the objects, since frozen objects with identical shape are interned",
        whyTempting:
          "Freezing does change some engine behaviour, and interning is real for strings, so the pieces are all real.",
      },
      {
        text: "`true`: Set compares structurally for plain objects and by identity only for class instances",
        whyTempting:
          "Records and tuples would give exactly this, and the proposal has been discussed long enough to feel shipped.",
      },
      {
        text: "`true`, since both literals are created from the same source position and share a hidden class",
        whyTempting:
          "Hidden classes are a real engine optimisation, which makes an identity-by-shape story sound technical.",
      },
    ],
    correct: 0,
    explanation:
      "Set and Map key on SameValueZero, which is reference equality for objects. Key on a primitive you derive from the object, or hold the object identity you actually want to match.",
  },
  {
    concept: "identity-vs-value-equality",
    difficulty: "hard",
    prompt:
      "`useEffect(() => { setRows(rows.filter(r => r.active)); }, [rows]);` renders forever even when every row is already active. What is the cycle?",
    options: [
      {
        text: "`filter` returns a new array each run, the dep changes, the effect runs again, and identity never converges",
      },
      {
        text: "`setRows` inside an effect always schedules another render, regardless of the value it is given",
        whyTempting:
          "Setting state in an effect is the shape of the bug, and React does bail out on an identical value, which is the missing half.",
      },
      {
        text: "The dep array compares deeply, so the loop only ends when the arrays are structurally identical, which filtering prevents",
        whyTempting:
          "It gets the convergence framing right and inverts the comparison: deep comparison would end the loop, not sustain it.",
      },
      {
        text: "`rows` is captured by the closure from the first render, so the effect filters a stale array forever",
        whyTempting:
          "Stale closures are the other famous useEffect bug, and it is exactly what a missing dep would give you.",
      },
    ],
    correct: 0,
    explanation:
      "Dependency comparison is `Object.is`, so an effect that writes a freshly built value into its own dependency can never settle. Derive the filtered list during render instead of storing it.",
  },

  // ── cache-key-completeness ───────────────────────────────────────────────
  {
    concept: "cache-key-completeness",
    difficulty: "easy",
    prompt:
      "A route cache is keyed on pathname. The rendered value also depends on the `locale` cookie. What is the first symptom in production?",
    options: [
      {
        text: "Whichever locale rendered first is served to everyone requesting that path",
      },
      {
        text: "A cache miss on every request, since the cookie varies and the entry is invalidated each time",
        whyTempting:
          "Over-keying does cause exactly this, and it is the failure people are usually trying to avoid.",
      },
      {
        text: "Intermittent staleness that resolves on its own, since the entry expires and the next render picks up the right locale",
        whyTempting:
          "TTL expiry does mask the problem periodically, which is why this bug often gets reported as flaky.",
      },
      {
        text: "A crash on the second request, because the stored value carries locale-specific bindings the new request cannot resolve",
        whyTempting:
          "Serving the wrong bindings would be the loud version of this bug, and loud failures are easier to imagine.",
      },
    ],
    correct: 0,
    explanation:
      "A key that omits an input the value depends on makes two different requests collide, and the first writer wins for everyone. Every input that changes the value belongs in the key, or the value must not depend on it.",
  },
  {
    concept: "cache-key-completeness",
    difficulty: "medium",
    prompt:
      "A memoization helper keys on `JSON.stringify(args)`. Which argument shapes make the key wrong?",
    options: [
      {
        text: "Objects whose key order differs, plus anything stringify drops: functions, undefined values and symbols",
      },
      {
        text: "Only circular structures, since stringify throws on those and everything else round-trips faithfully",
        whyTempting:
          "The throw is real and loud, so it is the failure mode people have actually seen from this helper.",
      },
      {
        text: "Only very large arguments, where the stringify cost exceeds the call it is caching",
        whyTempting:
          "The cost concern is legitimate and is the usual review comment on this pattern.",
      },
      {
        text: "Objects containing dates, since stringify emits an ISO string and two different Dates can share one",
        whyTempting:
          "Date serialisation genuinely is lossy in the other direction, so it is a real limitation of the approach.",
      },
    ],
    correct: 0,
    explanation:
      "`{a:1,b:2}` and `{b:2,a:1}` stringify differently and behave identically, so equal inputs get separate entries. Values stringify drops go the other way, and two different calls collide on one key.",
  },
  {
    concept: "cache-key-completeness",
    difficulty: "hard",
    prompt:
      "A segment cache derives its key from a report of which params the response varies on, and falls back to a comment reading \"without that report, assume every param varies\". Why is that the safe fallback?",
    options: [
      {
        text: "Assuming everything varies over-keys, which costs cache misses, and assuming nothing varies serves one response for every input",
      },
      {
        text: "Assuming everything varies keeps the key stable across deploys, which is what makes the cache warm on restart",
        whyTempting:
          "Key stability across deploys is a genuine concern, and it does argue for deriving keys from fixed inputs.",
      },
      {
        text: "It matches what the CDN does, so the two layers stay consistent and cannot disagree about a hit",
        whyTempting:
          "Layer consistency is a real design pressure, and disagreeing cache layers cause genuinely awful bugs.",
      },
      {
        text: "Over-keying lets the eviction policy do the work, so an unbounded key space is safe under LRU",
        whyTempting:
          "LRU does bound memory, which makes an unbounded key space feel like a solved problem.",
      },
    ],
    correct: 0,
    explanation:
      "The two failure modes are not symmetric: an unnecessarily specific key wastes work, and an insufficiently specific key serves wrong data. Default to the one whose worst case is a miss.",
  },

  // ── stale-state-after-await ──────────────────────────────────────────────
  {
    concept: "stale-state-after-await",
    difficulty: "easy",
    prompt:
      "A handler reads `const target = this._groups.find(g => g.id === id);`, awaits an open call, then writes to `target`. Why does the fixed version re-run the find after the await?",
    options: [
      {
        text: "The await yields to the event loop, so the groups may have changed and the captured object may be gone",
      },
      {
        text: "The find result is a copy, so mutating it after an await writes to a detached object",
        whyTempting:
          "`find` returning a copy would explain lost writes, and it is true of methods like `slice` on the same array.",
      },
      {
        text: "Awaiting invalidates closures over `this`, so the pre-await lookup binds to the wrong instance",
        whyTempting:
          "`this` binding across async boundaries is a real hazard in other constructs, which keeps this plausible.",
      },
      {
        text: "The find runs before the microtask queue drains, so it sees the state from before the current tick's updates",
        whyTempting:
          "Microtask timing is exactly the right domain, and the sentence is precise enough to sound authoritative.",
      },
    ],
    correct: 0,
    explanation:
      "An `await` is a suspension point, and anything can run while you are suspended: another call, a disposal, a user switching context. Re-check identity after every resume point, not just the first.",
  },
  {
    concept: "stale-state-after-await",
    difficulty: "medium",
    prompt:
      "A method has three awaits and a `if (this._session !== session) return;` guard after the first. What is still wrong?",
    options: [
      {
        text: "The second and third awaits are unguarded, so the session can change after the check that passed",
      },
      {
        text: "The guard compares by reference, so a session object rebuilt with the same contents fails it spuriously",
        whyTempting:
          "Reference comparison is real and is usually what you want here, which is why it looks like a candidate bug.",
      },
      {
        text: "The guard returns rather than throwing, so callers cannot distinguish a cancelled run from a completed one",
        whyTempting:
          "It is a legitimate API criticism and worth raising, and it is not what makes the code incorrect.",
      },
      {
        text: "`this._session` is read twice, so the guard races with itself and can pass with a torn value",
        whyTempting:
          "Torn reads are a real concept, and single-threaded JavaScript is exactly where they cannot happen.",
      },
    ],
    correct: 0,
    explanation:
      "A guard protects the code between it and the next suspension, and nothing beyond. Every resume point needs its own check, or the work needs a generation counter tested at each one.",
  },
  {
    concept: "stale-state-after-await",
    difficulty: "hard",
    prompt:
      "A loader uses `const loadId = ++this._loadId;` before an await and `if (loadId !== this._loadId) return;` after. How does that differ from re-checking an object identity?",
    options: [
      {
        text: "It detects a newer call even when the object is unchanged, so an overtaking second call cannot have its result clobbered by the first",
      },
      {
        text: "It avoids holding a reference to the object, which is what lets the old one be garbage collected during the await",
        whyTempting:
          "Not retaining the object is a genuine secondary benefit, so this is a true statement of the lesser reason.",
      },
      {
        text: "It works across instances, since the counter is shared and identity checks are per object",
        whyTempting:
          "Counters often are instance fields, and cross-instance coordination is a real problem it could solve.",
      },
      {
        text: "It is monotonic, so it cannot be defeated by an object being disposed and recreated at the same address",
        whyTempting:
          "Address reuse is a real hazard in languages with manual memory, and the reasoning transfers convincingly.",
      },
    ],
    correct: 0,
    explanation:
      "Identity checks catch a switch to something else, and a generation counter also catches a second run of the same thing. Overlapping calls to one method are the case identity comparison cannot see.",
  },

  // ── type-predicate-lie ───────────────────────────────────────────────────
  {
    concept: "type-predicate-lie",
    difficulty: "easy",
    prompt:
      "`function isUser(x: unknown): x is User { return typeof x === \"object\"; }` compiles with no complaint. What did TypeScript check?",
    options: [
      {
        text: "That the body returns a boolean, and nothing about whether the boolean means what the signature claims",
      },
      {
        text: "That the body narrows to User, which it does, since `typeof x === \"object\"` excludes every primitive",
        whyTempting:
          "The typeof check does narrow, so it is doing real work, just not enough of it to justify the claim.",
      },
      {
        text: "That every property of User is tested, which passes here because User has no required properties",
        whyTempting:
          "A structural check on the type would be the useful behaviour, and it sounds like something TypeScript would do.",
      },
      {
        text: "Nothing at all, since a predicate signature suppresses all checking of the function body",
        whyTempting:
          "It overstates the right answer, which is why it is the hardest of the wrong ones to rule out.",
      },
    ],
    correct: 0,
    explanation:
      "A type predicate is an unchecked assertion: the compiler trusts the claim and verifies only the return type. `null` is an object, and so is an array, and every caller downstream now believes both are Users.",
  },
  {
    concept: "type-predicate-lie",
    difficulty: "medium",
    prompt:
      "`known.filter((c): c is Metadata => c !== undefined)` narrows `(Metadata | undefined)[]` to `Metadata[]`. Which part of that is doing the work?",
    options: [
      {
        text: "The annotation: without it `filter` returns the same union type, since it cannot infer narrowing from the body",
      },
      {
        text: "The `!== undefined` comparison, which `filter` recognises as a narrowing predicate through control flow analysis",
        whyTempting:
          "TypeScript 5.5 did add inferred predicates for exactly this shape, so it is true on new enough versions.",
      },
      {
        text: "The array's declared element type, since filter narrows to the non-nullable form of whatever it holds",
        whyTempting:
          "`NonNullable` is a real utility type, and a filter that applied it automatically would be a sensible feature.",
      },
      {
        text: "`strictNullChecks`, which makes filter's overload resolve to the non-undefined signature",
        whyTempting:
          "strictNullChecks genuinely is what makes undefined visible in the type, so it is a necessary condition.",
      },
    ],
    correct: 0,
    explanation:
      "The predicate annotation is what changes filter's return type, and it is a promise the compiler takes on trust. That makes it both the useful tool and the one that lets `c !== null` accidentally claim more than it checked.",
  },
  {
    concept: "type-predicate-lie",
    difficulty: "hard",
    prompt:
      "A predicate `x is Config` checks two of Config's three required fields. Where does the failure appear?",
    options: [
      {
        text: "At the first access of the third field, which the compiler declared safe and which is undefined at runtime",
      },
      {
        text: "At the predicate itself, since TypeScript verifies a predicate's body against the asserted type when the type is a plain interface",
        whyTempting:
          "Verification is what the feature ought to do, and interfaces are exactly where a structural check would be easiest.",
      },
      {
        text: "At the next assignment into a Config-typed variable, since assignability is rechecked after narrowing",
        whyTempting:
          "Assignability checks are real and frequent, which makes a recheck at the boundary sound like the natural place.",
      },
      {
        text: "Nowhere in TypeScript, since a missing property is typed as optional once narrowing has occurred",
        whyTempting:
          "Narrowing does change property types in some flows, and optionality is exactly what would silence the error.",
      },
    ],
    correct: 0,
    explanation:
      "Once the predicate returns true, downstream code has the full type and no reason to check anything. Keep predicates exhaustive, or use a parse function that returns the value or undefined and lets the type follow the check.",
  },
];
