import type { BankEntry } from "./types.js";

export const ASYNC_ENTRIES: BankEntry[] = [
  // ── promise-all ──────────────────────────────────────────────────────────
  {
    concept: "promise-all",
    difficulty: "easy",
    prompt:
      "`const users = await Promise.all(ids.map(id => fetchUser(id)))`. The requests finish in wildly different times. What order are the entries in `users`?",
    options: [
      {
        text: "Completion order: the fastest response lands in `users[0]`, so you re-sort by id",
        whyTempting:
          "Event-style fan-out APIs do deliver in completion order; Promise.all does not work that way.",
      },
      {
        text: "Input order, but only when every request succeeds: a rejection compacts around the gap",
        whyTempting:
          "On rejection there is no array at all, so there is nothing left to compact or reorder.",
      },
      {
        text: "Input order, and `users[i]` is always the result of `ids[i]` whoever finished first",
      },
      {
        text: "Whatever order the microtask queue drains in, which the spec leaves unspecified",
        whyTempting:
          "Microtask draining is deterministic, and irrelevant here: results are written by index, not appended.",
      },
    ],
    correct: 2,
    explanation:
      "Promise.all fills each slot by position, so results always line up with the inputs even though execution is concurrent. Only the timing is nondeterministic, never the ordering.",
  },
  {
    concept: "promise-all",
    difficulty: "medium",
    prompt:
      "Two of the five promises you passed to `Promise.all` reject, half a second apart. Your `catch` block runs once. Where did the second rejection go?",
    options: [
      {
        text: "It surfaces as an `unhandledRejection` a moment later, killing Node 15+ by default",
        whyTempting:
          "Rejections nobody subscribes to do fire that event, but Promise.all subscribed to every input, so this one counts as handled.",
      },
      {
        text: "It reaches your catch as an `AggregateError` carrying both of the failures",
        whyTempting:
          "AggregateError is Promise.any's contract, where errors are collected because failure needs every input to reject.",
      },
      {
        text: "It replaces the first error, so `catch` reports whichever rejection arrived last",
        whyTempting:
          "A settled promise is immutable: the first rejection wins and later ones cannot overwrite it.",
      },
      {
        text: "It is dropped because the `Promise.all` promise had already settled and rejected",
      },
    ],
    correct: 3,
    explanation:
      "Promise.all attaches a handler to every input, so later rejections are considered handled and then thrown away; only the first one is ever reported. Use Promise.allSettled when you need to see all failures.",
  },
  {
    concept: "promise-all",
    difficulty: "hard",
    prompt:
      "`const a = loadA(); const b = loadB();` then `const ra = await a; const rb = await b;`. `loadB` rejects after 10ms; `loadA` resolves after 2s. What does this do that `await Promise.all([a, b])` would not?",
    options: [
      {
        text: "Nothing: both forms start the work eagerly and `await` it, so they are equivalent",
        whyTempting:
          "The timing is identical; the difference is only in when each rejection acquires a handler.",
      },
      {
        text: "It leaves b's rejection with no handler for 2s, which Node can report and act on",
      },
      {
        text: "It never runs loadB, because `await a` suspends before b's call is evaluated",
        whyTempting:
          "Both calls were evaluated on the previous lines already; awaiting cannot un-start work that has begun.",
      },
      {
        text: "It assigns `undefined` to rb and continues, because b settled while a was pending",
        whyTempting:
          "Awaiting an already-rejected promise still throws; it does not quietly hand back undefined.",
      },
    ],
    correct: 1,
    explanation:
      "A rejection with no handler attached in that turn triggers Node's unhandled-rejection path, which is fatal by default. Promise.all subscribes to both promises immediately, so neither can go unobserved.",
  },

  // ── promise-race ─────────────────────────────────────────────────────────
  {
    concept: "promise-race",
    difficulty: "easy",
    prompt:
      "`await Promise.race([fetchReport(), timeout(5000)])` throws your timeout error. What is `fetchReport()` doing one second later?",
    options: [
      {
        text: "Still running, still holding its socket, but nothing will read its result",
      },
      {
        text: "Aborted: losing the race rejects the promise, which unwinds the async function",
        whyTempting:
          "Rejecting the race's own promise does nothing to the loser, and an async function cannot be unwound from outside.",
      },
      {
        text: "Suspended until you race it again, since a promise memoises its progress",
        whyTempting:
          "Promises do memoise their eventual result, but they never pause: there is no suspended-promise state.",
      },
      {
        text: "Collected by GC once the race settled, and that closed the underlying connection",
        whyTempting:
          "In-flight I/O keeps the promise reachable, and closing sockets was never the collector's job.",
      },
    ],
    correct: 0,
    explanation:
      "Promise.race picks a winner; it has no way to cancel the loser, which runs to completion with its work discarded. Timeouts bound how long you wait, not how long the work takes. Pair them with an AbortSignal.",
  },
  {
    concept: "promise-race",
    difficulty: "medium",
    prompt:
      "You race reads against three replicas and take the first answer. The nearest replica errors after 5ms; the other two would have answered in 40ms. What do you get?",
    options: [
      {
        text: "The first successful value, since `Promise.race` skips rejections until every input fails",
        whyTempting:
          "That is exactly Promise.any: it ignores rejections and only fails once all inputs have rejected.",
      },
      {
        text: "An `AggregateError` once all three have settled, listing the failure and the successes",
        whyTempting:
          "AggregateError belongs to Promise.any, and only in the case where every single input rejected.",
      },
      {
        text: "The 5ms rejection, but only because that replica is first in the array you passed",
        whyTempting:
          "Array position has no effect: the race is decided purely by which promise settles soonest.",
      },
      {
        text: "The 5ms rejection: `Promise.race` settles on the first input to settle, pass or fail",
      },
    ],
    correct: 3,
    explanation:
      "Race is about settling first, not succeeding first, so your fastest failure becomes the answer and the healthy replicas are ignored. Promise.any is the primitive for first success.",
  },
  {
    concept: "promise-race",
    difficulty: "hard",
    prompt:
      "Every request runs `Promise.race([work(), shutdownSignal])`, where `shutdownSignal` is a single promise created at boot that settles only on shutdown. After a few million requests, what have you accumulated?",
    options: [
      {
        text: "Nothing unusual: race detaches its reactions from the losers once a winner settles",
        whyTempting:
          "There is no detach step anywhere in the spec: reactions stay on a promise until that promise itself settles.",
      },
      {
        text: "Millions of timers pinned in the event loop, and the timer heap grows unbounded",
        whyTempting:
          "Uncleared setTimeout does grow the timer heap, but this pattern schedules no timers at all.",
      },
      {
        text: "Millions of reactions retained on `shutdownSignal`; the heap grows until shutdown",
      },
      {
        text: "Handlers that fire twice when shutdownSignal at last settles, throwing during exit",
        whyTempting:
          "A promise reaction runs at most once; the damage here is retained memory, not repeated execution.",
      },
    ],
    correct: 2,
    explanation:
      "Each race attaches a reaction to every input, and reactions on a pending promise are held for that promise's whole lifetime. Racing many short-lived promises against one long-lived promise leaks a closure per race.",
  },

  // ── await-in-loop ────────────────────────────────────────────────────────
  {
    concept: "await-in-loop",
    difficulty: "easy",
    prompt:
      "You speed up `for (const row of rows) await upsert(row)` by rewriting it as `await Promise.all(rows.map(upsert))`. Which property did you give up?",
    options: [
      {
        text: "Type safety: Promise.all widens every result to `any[]` for dynamically sized arrays",
        whyTempting:
          "Promise.all is precisely typed for both tuples and arrays; nothing about it degrades to any.",
      },
      {
        text: "Serialisation: the upserts all start at once, so the database gets no backpressure",
      },
      {
        text: "Error propagation: a rejection inside map is swallowed instead of reaching the caller",
        whyTempting:
          "That is forEach with an async callback; map plus Promise.all propagates the first rejection fine.",
      },
      {
        text: "Result ordering: Promise.all returns values in completion order, not row order",
        whyTempting:
          "Promise.all preserves input order; it is the execution that becomes concurrent, not the results.",
      },
    ],
    correct: 1,
    explanation:
      "Sequential awaits are slow but they rate-limit you for free, and the concurrent version removes that limit entirely. Keep the loop, or bound the fan-out with a concurrency pool.",
  },
  {
    concept: "await-in-loop",
    difficulty: "medium",
    prompt:
      "A request handler checks out one pooled DB connection, then loops over 500 ids awaiting a query for each. Load testing exhausts the pool at fairly modest RPS. What is the mechanism?",
    options: [
      {
        text: "One request pins its connection across 500 sequential round trips, so few fit at once",
      },
      {
        text: "Each awaited query checks out a connection of its own, so a request holds 500 of them",
        whyTempting:
          "The checkout happens once, outside the loop: every query in the loop reuses that same connection.",
      },
      {
        text: "await inside a loop blocks the event loop, so the pool's release callbacks never run",
        whyTempting:
          "await yields to the event loop rather than blocking it; other callbacks, releases included, keep running.",
      },
      {
        text: "The pool leaks connections because an await between checkout and release skips `finally`",
        whyTempting:
          "finally still runs after an await; leaking needs a missing cleanup path, not the presence of an await.",
      },
    ],
    correct: 0,
    explanation:
      "Hold time, not leak rate, is what exhausts a pool: 500 × 4ms is two seconds of occupancy per request. Batch the ids into one query, or check the connection out per query instead of per request.",
  },
  {
    concept: "await-in-loop",
    difficulty: "hard",
    prompt:
      "A worker drains an in-memory queue with `while (q.length) { await handle(q.pop()) }`. `handle` is async but resolves from a local cache without ever touching I/O. The process stops answering health checks. Why?",
    options: [
      {
        text: "`await` on an already-resolved value is elided by the engine, so the loop is synchronous",
        whyTempting:
          "The await is not optimised away, and it does suspend, but suspending onto the microtask queue changes nothing for I/O.",
      },
      {
        text: "Each iteration schedules a timer, and the timer queue starves the server's socket callbacks",
        whyTempting:
          "await schedules microtasks rather than timers, and timers would at least let I/O interleave between them.",
      },
      {
        text: "The loop retains each popped item until it exits, so GC pauses fail the health check",
        whyTempting:
          "Nothing accumulates here: the queue is shrinking, and popped items become garbage immediately.",
      },
      {
        text: "`await` only yields to the microtask queue, which drains fully before every I/O callback",
      },
    ],
    correct: 3,
    explanation:
      "Awaiting a value that is already available resumes on the microtask queue, and that queue is drained to empty before the event loop moves on. A CPU-bound loop of such awaits starves timers and sockets exactly like a synchronous one.",
  },

  // ── async-foreach ────────────────────────────────────────────────────────
  {
    concept: "async-foreach",
    difficulty: "easy",
    prompt:
      "You need `items.forEach(async i => await send(i))` to send one item at a time and to surface any failure to the caller. Which rewrite does that?",
    options: [
      {
        text: "`await Promise.all(items.map(i => send(i)))`, which awaits every send before returning",
        whyTempting:
          "It does await all of them and does propagate the first error, but it fires every send at once.",
      },
      {
        text: "`items.forEach(async i => { try { await send(i) } catch (e) { throw e } })`",
        whyTempting:
          "Rethrowing inside the callback rejects a promise that forEach already discarded, so the throw goes nowhere.",
      },
      {
        text: "`for (const i of items) { await send(i) }`, awaiting each send before the next",
      },
      {
        text: "`items.map(async i => await send(i))`, since map keeps the promises instead of dropping them",
        whyTempting:
          "map does return the promises, but nobody awaits the returned array, so it fails the same way forEach does.",
      },
    ],
    correct: 2,
    explanation:
      "Only a `for…of` loop with await suspends the enclosing function between items and lets a rejection propagate normally. Promise.all is the right fix when you want concurrency.",
  },
  {
    concept: "async-foreach",
    difficulty: "medium",
    prompt:
      "`const active = users.filter(async u => await isActive(u))`. `isActive` resolves false for most users. What ends up in `active`?",
    options: [
      {
        text: "Only the active users, because filter awaits the predicate before it decides",
        whyTempting:
          "filter has no await in it; it coerces whatever the callback returned to a boolean.",
      },
      {
        text: "Every user, because each `isActive(u)` hands back a promise; promises are truthy",
      },
      {
        text: "An empty array, since a pending promise is not a boolean and filter rejects non-booleans",
        whyTempting:
          "filter never validates the return type; it applies plain truthiness, and objects are always truthy.",
      },
      {
        text: "An array of promises, one per user, which you can pass to Promise.all for the survivors",
        whyTempting:
          "filter returns elements taken from the source array, never the values the callback produced: that is map.",
      },
    ],
    correct: 1,
    explanation:
      "An async callback always returns a promise, and a promise is truthy, so the predicate is effectively `() => true`. Resolve the flags first with Promise.all, then filter on the resolved booleans.",
  },
  {
    concept: "async-foreach",
    difficulty: "hard",
    prompt:
      "`await Promise.all(items.map(async i => { total += await score(i) }))` over 1,000 items. `total` comes out lower than the true sum, and the shortfall varies per run. Why?",
    options: [
      {
        text: "`total` is read before each await suspends but written back after, so updates vanish",
      },
      {
        text: "score receives a stale index, because map's callback closes over the shared loop variable",
        whyTempting:
          "map passes each element in as an argument: there is no shared loop variable for a closure to capture.",
      },
      {
        text: "`+=` on a number is not atomic, and these callbacks run on separate worker threads",
        whyTempting:
          "There is one thread here; the interleaving is cooperative at await points, not preemptive.",
      },
      {
        text: "Promise.all drops entries once the input array leaves the engine's fast element kind",
        whyTempting:
          "No such limit exists: Promise.all returns exactly one slot per input no matter how large it is.",
      },
    ],
    correct: 0,
    explanation:
      "`total += await score(i)` reads total, suspends, then writes back the stale sum it captured, so overlapping callbacks lose updates. Collect the scores and sum them after the Promise.all.",
  },

  // ── floating-promise ─────────────────────────────────────────────────────
  {
    concept: "floating-promise",
    difficulty: "easy",
    prompt:
      "A request handler calls the async `auditLog(event)` with no await and no catch. The audit service is down, so the call rejects. What happens on Node 18?",
    options: [
      {
        text: "It is logged as an UnhandledPromiseRejectionWarning and the process keeps on serving",
        whyTempting:
          "That was the Node 14 behaviour, and plenty of production wisdom still assumes it; since Node 15 the default is fatal.",
      },
      {
        text: "Nothing at all: a promise nobody observes never runs its body, so no call is made",
        whyTempting:
          "Promises are eager: the function body starts running the moment you call it, observed or not.",
      },
      {
        text: "The surrounding `try`/`catch` catches it, so this one request fails with a 500",
        whyTempting:
          "try/catch only sees what you await; an unobserved rejection escapes the block completely.",
      },
      {
        text: "The unhandled rejection terminates the process, and in-flight requests die with it",
      },
    ],
    correct: 3,
    explanation:
      "Since Node 15 the default `--unhandled-rejections=throw` turns an unobserved rejection into a fatal error. A fire-and-forget call still needs a `.catch`, even when you do not care about the result.",
  },
  {
    concept: "floating-promise",
    difficulty: "medium",
    prompt:
      "A CLI fires `uploadMetrics()` without awaiting it and then falls off the end of `main`. The upload sometimes arrives and sometimes does not. What decides?",
    options: [
      {
        text: "Whether the promise was created before or after the last await in `main`, which orders exit",
        whyTempting:
          "Creation order is irrelevant; what matters is whether a live handle is still holding the loop open.",
      },
      {
        text: "Whether it rejects: Node drains pending promises on exit but abandons rejected ones",
        whyTempting:
          "Node does not drain pending promises at all; a promise is not something the event loop waits on.",
      },
      {
        text: "Whether a socket still holds the event loop open, because nothing awaits the promise",
      },
      {
        text: "Whether stdout is a TTY, since Node always flushes writes asynchronously through a pipe",
        whyTempting:
          "TTY versus pipe changes stdout flushing on exit, but it has nothing to do with an HTTP upload.",
      },
    ],
    correct: 2,
    explanation:
      "Node exits when the event loop has no work left, and a pending promise is not work. Only the underlying handle, such as an open socket, counts. Await the upload, or the process may die mid-flight.",
  },
  {
    concept: "floating-promise",
    difficulty: "hard",
    prompt:
      "`sync()` rejects. Which of these call sites still ends up producing an unhandled rejection?",
    options: [
      {
        text: "`await sync().catch(err => metrics.increment('sync_failed'))`",
        whyTempting:
          "It reads like fire-and-forget, but `.catch` attaches a rejection handler, which is precisely what makes it safe.",
      },
      {
        text: "`void sync().finally(() => { releaseLock(); log.info('sync done') })`",
      },
      {
        text: "`sync().then(onOk, err => log.error({ err }, 'sync failed'))`",
        whyTempting:
          "The second argument to `then` is easy to miss, but it handles rejection exactly as `.catch` does.",
      },
      {
        text: "`try { await sync() } catch (err) { log.error({ err }, 'sync failed') }`",
        whyTempting:
          "Nothing here is floating: the await ties the rejection to the try block, which handles it.",
      },
    ],
    correct: 1,
    explanation:
      "`finally` does not handle anything; it returns a new promise that rejects with the same error, and `void` only silences the lint rule. The derived promise is what goes unhandled.",
  },

  // ── try-catch-async ──────────────────────────────────────────────────────
  {
    concept: "try-catch-async",
    difficulty: "easy",
    prompt:
      "`try { saveDraft(doc) } catch (e) { toast('save failed') }`, where `saveDraft` is async and rejects 200ms later. Does the toast appear?",
    options: [
      {
        text: "No: the try block finished long before, and the rejection escapes it entirely",
      },
      {
        text: "Yes: the rejection propagates straight out of the call and into the catch",
        whyTempting:
          "Calling an async function returns instantly; the rejection lands in a later microtask, after the block is gone.",
      },
      {
        text: "Yes, but only once the promise settles, since a `catch` stays armed until then",
        whyTempting:
          "A catch block is not a subscription: it is finished the instant control leaves the try block.",
      },
      {
        text: "No, and TypeScript refuses to compile it because a floating promise is a type error",
        whyTempting:
          "no-floating-promises is a lint rule, not a type rule; tsc compiles this without a complaint.",
      },
    ],
    correct: 0,
    explanation:
      "try/catch is scoped to the synchronous execution of its block, and an unawaited call hands back a value immediately. Only `await` routes a rejection into the catch.",
  },
  {
    concept: "try-catch-async",
    difficulty: "medium",
    prompt:
      "Inside an async function: `try { return fetchProfile(id) } catch { return CACHED }`. `fetchProfile` rejects. What does the caller receive?",
    options: [
      {
        text: "CACHED, because returning a promise from a `try` block keeps it under that block's scope",
        whyTempting:
          "Returning does not extend the block; the try is over as soon as the promise value is returned.",
      },
      {
        text: "CACHED, but only on engines that implement return-await elision; older ones rethrow",
        whyTempting:
          "There is no engine variation in this behaviour: every implementation does the same thing here.",
      },
      {
        text: "A rejected promise, and the catch also runs, so CACHED is discarded afterwards",
        whyTempting:
          "The catch never runs at all; one exit path cannot execute two returns from the same function.",
      },
      {
        text: "A rejected promise, but the catch never sees it: nothing inside the try awaited",
      },
    ],
    correct: 3,
    explanation:
      "Without `await`, the promise leaves the try block unobserved and the catch becomes dead code. `return await fetchProfile(id)` is what makes the local handler fire.",
  },
  {
    concept: "try-catch-async",
    difficulty: "hard",
    prompt:
      "Inside an async function wrapped in try/catch you call `setTimeout(() => { throw new Error('late') }, 100)`. Where does that error surface?",
    options: [
      {
        text: "In the enclosing catch, because the arrow function closes over the try block's scope",
        whyTempting:
          "Closures capture variables, not exception handlers; the callback runs later on a brand-new stack.",
      },
      {
        text: "In `unhandledRejection`, because throwing inside a callback rejects the enclosing promise",
        whyTempting:
          "Nothing converted this callback into a promise, so a throw from a timer is an ordinary exception.",
      },
      {
        text: "In `uncaughtException`, taking the process down: the try block returned 100ms earlier",
      },
      {
        text: "Nowhere: timer callbacks always run detached, so Node discards whatever they throw",
        whyTempting:
          "Node discards nothing: an uncaught exception in a timer callback crashes the process by default.",
      },
    ],
    correct: 2,
    explanation:
      "A timer callback runs on a fresh stack after the async function has already returned, so no lexically enclosing try/catch is on it. Put the try/catch inside the callback, or promisify the timer and await it.",
  },
];
