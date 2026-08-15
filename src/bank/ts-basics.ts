import type { BankEntry } from "./types.js";

export const TS_BASICS_ENTRIES: BankEntry[] = [
  // ── ts-as-cast ───────────────────────────────────────────────────────────
  {
    concept: "ts-as-cast",
    difficulty: "easy",
    prompt:
      "A route does `const user = (await res.json()) as User`, then reads `user.profile.email`. The build is green and a malformed payload throws in production. What did the cast do for you?",
    options: [
      {
        text: "It checked the body against the User shape on arrival and always threw a clearer error higher up the stack",
        whyTempting:
          "Casts in C# and Java do check and throw, and the keyword carried over to TypeScript without that behaviour.",
      },
      {
        text: "It reshaped the parsed body into User, leaving absent properties present but undefined",
        whyTempting:
          "`as` reads like a conversion, so people expect the object to be reconciled with the target shape somehow.",
      },
      {
        text: "It narrowed the type for that expression only, so `user` was still `any` on the next line",
        whyTempting:
          "Narrowing is expression-scoped for type guards, but an assertion on a const fixes its declared type.",
      },
      { text: "Nothing at runtime: the assertion is erased before emit, so the JavaScript that runs is unchanged" },
    ],
    correct: 3,
    explanation:
      "Type assertions are erased before emit, so `as User` is a claim to the checker rather than a parse. Run the body through a schema and use the validator's output as the typed value.",
  },
  {
    concept: "ts-as-cast",
    difficulty: "medium",
    prompt:
      "`const LEVELS = ['debug', 'info', 'warn'] as const` compiles, and `LEVELS.sort()` on the next line does not. The same array without the assertion sorted fine. What did `as const` change?",
    options: [
      {
        text: "It typed the array as a fixed tuple, and a tuple refuses any call that reorders its slots",
        whyTempting:
          "`as const` does produce a tuple, and fixed positions are the part of that most people carry away from it.",
      },
      { text: "It asked for the narrowest literal type, and readonly comes with that at every level, so sort is gone" },
      {
        text: "It collapsed the elements into the union 'debug' | 'info' | 'warn', and sort always refuses a union-typed array",
        whyTempting:
          "Reading that union back out with `typeof LEVELS[number]` is the usual next step, so it gets filed as what the assertion made.",
      },
      {
        text: "It emitted an `Object.freeze` around the literal, and the checker refuses `sort` because the value is frozen",
        whyTempting:
          "Deep readonly and Object.freeze guard the same mistake, and an assertion of any kind emits no runtime code.",
      },
    ],
    correct: 1,
    explanation:
      "`as const` is a different operator from `as T`: it asks the checker for the narrowest type a literal can carry, which means literal element types and readonly at every level. Drop the assertion when you need to mutate, or sort a copy with `[...LEVELS].sort()`.",
  },
  {
    concept: "ts-as-cast",
    difficulty: "hard",
    prompt:
      "A test factory returns `{ id, name } as unknown as Account`. Someone renames `name` to `displayName` across the codebase. The build stays green and the suite fails on undefined. Why did the checker miss it?",
    options: [
      {
        text: "Rename refactors follow declaration files, and a factory in a test file sits outside that scope",
        whyTempting:
          "Editor renames do miss files the tsconfig excludes, which is a separate failure worth ruling out.",
      },
      {
        text: "Structural typing matches on property types rather than names, so a renamed string still fits Account",
        whyTempting:
          "Structural typing does ignore the name of the type, and people extend that to property names, which match exactly.",
      },
      {
        text: "Test files are excluded from checking by default: no error was available in that file",
        whyTempting:
          "skipLibCheck sounds like it covers this, but it relaxes .d.ts files only and tests are checked like any source.",
      },
      { text: "The hop through `unknown` erases the relationship, so no shape is ever compared with Account" },
    ],
    correct: 3,
    explanation:
      "`as unknown as T` breaks the relationship between value and target, leaving the checker nothing to compare when either side changes. Annotate the factory's return as `Account` so the error lands at the definition.",
  },

  // ── ts-non-null-assertion ────────────────────────────────────────────────
  {
    concept: "ts-non-null-assertion",
    difficulty: "easy",
    prompt:
      "`document.querySelector('#toast')!.classList.add('show')` runs on a page where the toast markup was never rendered. What happens?",
    options: [
      {
        text: "The statement is skipped, since `!` always compiles to the same guard `?.` uses before a member access",
        whyTempting:
          "`!` and `?.` sit in the same position on the line and get filed together, but only one of them emits code.",
      },
      { text: "A TypeError on classList: `!` quiets the checker but emits no code, so the null returned still runs" },
      {
        text: "Nothing visible: querySelector hands back an empty node list, so add is a no-op on zero elements",
        whyTempting:
          "querySelectorAll returns an empty NodeList for no match, and the singular form inherits that expectation.",
      },
      {
        text: "A thrown assertion reading 'value is null' at the `!`, which is the reason for writing it",
        whyTempting:
          "The name 'non-null assertion' suggests an assert call, and assertions in other languages do check at runtime.",
      },
    ],
    correct: 1,
    explanation:
      "The `!` is erased with the types, so the emitted line is `querySelector('#toast').classList.add('show')`. It moves the compiler's complaint and leaves the null in place.",
  },
  {
    concept: "ts-non-null-assertion",
    difficulty: "medium",
    prompt:
      "A billing job does `const plan = plansById.get(row.planId)!` and hands `plan` onward. Production throws `Cannot read properties of undefined (reading 'price')` inside a formatter three calls away. What follows about the `!`?",
    options: [
      {
        text: "The formatter mutated plan to undefined because a Map hands out its values by reference",
        whyTempting:
          "Map values are shared references, but rebinding a parameter inside a callee cannot reach back into the Map.",
      },
      {
        text: "The lookup found a plan but the formatter got some other argument, since `!` would have thrown at the lookup",
        whyTempting:
          "If the assertion checked anything the stack would start there, and that is the assumption to give up.",
      },
      { text: "The lookup missed, and `!` let that undefined travel on until something read a property off it" },
      {
        text: "Map.get returns null rather than undefined for a missing key, so this error points somewhere else",
        whyTempting:
          "Map.get returns undefined; null comes from JSON and from DOM lookups, and the two blur together in review.",
      },
    ],
    correct: 2,
    explanation:
      "The assertion is erased, so a missed lookup produces undefined that flows on until a property read fails. The stack points at the first use of the value and never at the claim about it.",
  },
  {
    concept: "ts-non-null-assertion",
    difficulty: "hard",
    prompt:
      "`if (this.pending.has(id)) { await this.flush(); this.pending.get(id)!.retry(); }` throws roughly once a day under load and never in staging. What is the defect?",
    options: [
      {
        text: "`has` and `get` use different equality, so an object key can satisfy one and miss the other",
        whyTempting:
          "Both use SameValueZero, so a key `has` finds is a key `get` finds when they run at the same instant.",
      },
      { text: "The `has` check goes stale because the await hands control to another task that deletes the entry" },
      {
        text: "The await discards the narrowing TypeScript took from `has`, which is why the `!` is needed and correct here",
        whyTempting:
          "Control flow narrowing is real, but `has` never narrows `get`, so there was no narrowing to lose.",
      },
      {
        text: "Code after an await resumes in a fresh microtask: `this` is rebound there, so a different Map is read",
        whyTempting:
          "Await preserves `this` in the resumed body; losing `this` is a callback problem rather than an await one.",
      },
    ],
    correct: 1,
    explanation:
      "Every await is a yield point where other work runs, so a check made before it is stale after it. Read the value into a local before awaiting, or check again on resume.",
  },

  // ── async-return-value ───────────────────────────────────────────────────
  {
    concept: "async-return-value",
    difficulty: "easy",
    prompt:
      "`async function currentUser() { return session.user }`, and a caller writes `const u = currentUser(); log(u.email)`. The log prints undefined and nothing throws. Why?",
    options: [
      { text: "async wraps whatever the body returns in a promise. `u` is that promise, with no email on it" },
      {
        text: "`return` in an async function settles the promise but hands back no value, so `u` holds undefined",
        whyTempting:
          "It fits the symptom, and 'the value lives in the promise, not in u' is half right: u is that promise.",
      },
      {
        text: "`session.user` is read before the body runs, since an async body is queued onto a microtask",
        whyTempting:
          "An async body runs at once up to its first await, and this one has no await to suspend at.",
      },
      {
        text: "An async function wraps its result only when the body contains an await, and this one returns bare",
        whyTempting:
          "The rule 'async is only real once you await' sounds economical, but every async function wraps its return.",
      },
    ],
    correct: 0,
    explanation:
      "async wraps the returned value in a promise whatever the body does, so `u` is that promise and `email` is a property it lacks. Await the call, or read the value in a `.then`.",
  },
  {
    concept: "async-return-value",
    difficulty: "medium",
    prompt:
      "A rollout guard reads `if (isBetaEnabled(user)) { renderBeta() }`. isBetaEnabled is async and resolves false for all but 40 accounts. Every account sees the beta. Why?",
    options: [
      {
        text: "A promise coerces to its settled value in a boolean test, and this one settles as true for everyone",
        whyTempting:
          "Resolution by coercion is the model that makes un-awaited code look safe: a promise never unwraps itself.",
      },
      {
        text: "`if` awaits a promise before testing it, so the guard reads a value that is one tick stale",
        whyTempting:
          "Top-level await makes it feel as if the language sometimes awaits for you, and nothing ever does.",
      },
      {
        text: "Truthiness of an object runs through valueOf, and a promise reports true there because it has not settled",
        whyTempting:
          "valueOf drives coercion for Date and for arithmetic, but a boolean test never consults it.",
      },
      { text: "The call hands back a promise object, and every object is truthy whichever way it later settles" },
    ],
    correct: 3,
    explanation:
      "An un-awaited async call evaluates to a promise, and any object is true in a boolean position, so the branch runs for everyone. Await the guard, or make it synchronous.",
  },
  {
    concept: "async-return-value",
    difficulty: "hard",
    prompt:
      "A cleanup removed `async` from `function loadPage(n) { if (n < 1) throw new RangeError('page starts at 1'); return fetchPage(n) }`, since the body never awaits. Callers still write `loadPage(n).catch(showError)`. Page 0 now takes the process down and showError never runs. What changed?",
    options: [
      {
        text: "A throw hands back no value: `.catch` is then a property read on undefined",
        whyTempting:
          "A throw does end the call with no value, and no value at all is easy to read as a returned undefined.",
      },
      {
        text: "Removing `async` returns fetchPage's own promise, and a promise that already settled always drops a later `.catch`",
        whyTempting:
          "Attaching a handler to a promise that already settled is a common worry, and it still runs the handler.",
      },
      { text: "Without `async` the guard throws on the caller's stack; there is no promise for `.catch` to attach to" },
      {
        text: "The guard's error becomes a rejection on a promise that `.catch` was never attached to, which Node makes fatal",
        whyTempting:
          "A throw inside a `.then` callback does become a rejection on the derived promise, and the habit carries over to the body.",
      },
    ],
    correct: 2,
    explanation:
      "`async` turns every exit from the body into a settled promise, so a guard that throws before the first await still reaches a `.catch` on the result. A plain function throws at the call site, where the result expression has not been evaluated yet. Keep `async` on anything that validates its arguments.",
  },
];
