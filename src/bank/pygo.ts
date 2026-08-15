import type { BankEntry } from "./types.js";

export const PYGO_ENTRIES: BankEntry[] = [
  // ── mutable-default-arg ──────────────────────────────────────────────────
  {
    concept: "mutable-default-arg",
    difficulty: "easy",
    prompt:
      "A helper is written as `def add_tag(tag, tags=[]): tags.append(tag); return tags`. Callers invoke it three times passing only a tag. What does the third call return?",
    options: [
      {
        text: "A one-element list, because the default `[]` is always rebuilt on calls that omit it",
        whyTempting:
          "Defaults look like part of the call, but they are evaluated once, when the `def` statement runs.",
      },
      {
        text: "A one-element list, unless two threads happen to call the helper at the same moment",
        whyTempting:
          "Threading is a genuine hazard here, but the sharing already happens in a single-threaded program.",
      },
      { text: "A three-element list, because every defaulted call appends to the one list made at `def`" },
      {
        text: "An empty list, because the parameter is rebound to a fresh `[]` on entry, before the body runs",
        whyTempting:
          "Rebinding is what the None-sentinel fix does explicitly; nothing does it for you here.",
      },
    ],
    correct: 2,
    explanation:
      "The default list object is created once when the function is defined and is reused by every call that omits the argument. Each call appends to that same object, so results accumulate across calls.",
  },
  {
    concept: "mutable-default-arg",
    difficulty: "medium",
    prompt:
      "Someone fixes a mutable default by writing `def f(items=None): items = items or []`. A caller passes a list it expects f to fill in place, and the list is empty. What goes wrong?",
    options: [
      { text: "The caller's list is discarded, because `[]` is falsy, so f fills a throwaway" },
      {
        text: "Nothing; `or` substitutes only when the argument is None, so the caller's list survives",
        whyTempting:
          "`or` reads like a None check, but it fires on every falsy value: 0, '', [] and {} included.",
      },
      {
        text: "It raises TypeError: `None or []` evaluates to None rather than to a list",
        whyTempting:
          "`or` returns its right operand when the left one is falsy, so this expression is a list.",
      },
      {
        text: "The list is filled, but the changes are lost because `or` hands back a shallow copy",
        whyTempting:
          "`or` never copies anything; it returns one of its two operands, unchanged and unwrapped.",
      },
    ],
    correct: 0,
    explanation:
      "`items or []` replaces any falsy argument, and an empty list is falsy, so the caller's object is dropped and mutations go to a throwaway list. The correct guard is `if items is None`.",
  },
  {
    concept: "mutable-default-arg",
    difficulty: "hard",
    prompt:
      "A module defines `def report(rows, when=datetime.utcnow()):` and the service stays up for days. What do the `when` values look like across reports?",
    options: [
      {
        text: "The time of the very first call to report(), which the interpreter caches from then on",
        whyTempting:
          "Defaults really are computed once, but at definition time, not lazily on the first call.",
      },
      {
        text: "The current time on each call, because utcnow() re-runs whenever the default is needed",
        whyTempting:
          "The call syntax in the signature suggests per-call evaluation; the expression runs once, when `def` executes.",
      },
      {
        text: "The current time per call, then frozen per worker once the server forks its pool",
        whyTempting:
          "Forking does copy interpreter state, but that is not why the value is stale here.",
      },
      { text: "The moment the module was imported, repeated in every report for the process's life" },
    ],
    correct: 3,
    explanation:
      "Default expressions are evaluated once, when the `def` statement executes at import, and the resulting object is reused forever. Compute the timestamp inside the body with a None default instead.",
  },

  // ── python-identity ──────────────────────────────────────────────────────
  {
    concept: "python-identity",
    difficulty: "easy",
    prompt:
      "A handler does `if status is 404:` where `status = int(resp.headers['X-Code'])`. Tests pass, but production silently misses some 404s. What is happening?",
    options: [
      {
        text: "int() returns a subclass of int for which identity comparison is not implemented",
        whyTempting:
          "int() returns a plain int; the trouble is what `is` compares, not the type it produces.",
      },
      { text: "`is` asks whether it is the same object, and CPython interns ints only up to 256" },
      {
        text: "`is` compares values for ints, but the header has whitespace so the number differs",
        whyTempting:
          "int() tolerates surrounding whitespace, so the parsed number itself is perfectly fine.",
      },
      {
        text: "The comparison is fine: the real bug is a case-sensitive header lookup",
        whyTempting:
          "Header casing is a real class of bug, but it would fail in tests too, not only in production.",
      },
    ],
    correct: 1,
    explanation:
      "`is` tests object identity, and CPython only caches small integers (roughly -5 to 256), so a freshly computed 404 is a distinct object from the literal. Use `==` for value comparison.",
  },
  {
    concept: "python-identity",
    difficulty: "medium",
    prompt:
      "A validation helper written as `if value == None:` is now called with numpy arrays. What does that branch do?",
    options: [
      {
        text: "The same thing as `is None`, since == falls back to identity when one side is None",
        whyTempting:
          "== falls back to identity only when both __eq__ calls return NotImplemented, which ndarray never does.",
      },
      {
        text: "Raises TypeError, because numpy refuses to compare an array with None",
        whyTempting:
          "numpy happily compares elementwise against None; the error surfaces one step later.",
      },
      {
        text: "Returns False for every array, so arrays with no elements skip validation entirely",
        whyTempting:
          "An empty array is falsy, which is a real trap, but == None does not return a plain bool at all.",
      },
      { text: "Builds an elementwise array, and the `if` raises ValueError on its truth value" },
    ],
    correct: 3,
    explanation:
      "ndarray overrides __eq__ to broadcast, so `value == None` yields an array and `if` on it raises ValueError. `is None` cannot be overridden, which is exactly why it is the idiom.",
  },
  {
    concept: "python-identity",
    difficulty: "hard",
    prompt:
      "Code registers `bus.subscribe(self.on_event)` and later calls `bus.unsubscribe(self.on_event)`, where the bus removes handlers by identity. The handler is never removed. Why?",
    options: [
      { text: "Each attribute access builds a new bound method object, so the two are never identical" },
      {
        text: "Bound methods hash by identity: the lookup misses unless you store a weakref.WeakMethod",
        whyTempting:
          "WeakMethod solves handler lifetime, but bound methods compare and hash by value (__self__ and __func__).",
      },
      {
        text: "`self` is copied when the bound method is passed as an argument, changing the receiver",
        whyTempting:
          "Python passes references and never copies `self`; the receiver is the very same object.",
      },
      {
        text: "The decorator on on_event rewraps it, and the wrapper is regenerated on every import",
        whyTempting:
          "Decorators run once at class creation, so the wrapper is stable; the instability is per attribute access.",
      },
    ],
    correct: 0,
    explanation:
      "`self.on_event` creates a fresh bound method object on every access, so identity comparison always fails even though `==` would succeed. Store the bound method once, or have the registry compare with `==`.",
  },

  // ── bare-except ──────────────────────────────────────────────────────────
  {
    concept: "bare-except",
    difficulty: "easy",
    prompt:
      "A long-running loop wraps its body in `try: ... except: continue`. An operator hits Ctrl-C and the process keeps churning. What explains it?",
    options: [
      {
        text: "Ctrl-C arrives as a signal, and signals are never turned into exceptions in Python",
        whyTempting:
          "Python's default SIGINT handler does exactly that: it raises KeyboardInterrupt in the main thread.",
      },
      {
        text: "`except:` catches Exception, and KeyboardInterrupt subclasses Exception in Python 3",
        whyTempting:
          "KeyboardInterrupt was moved out of Exception back in Python 2.5; it derives from BaseException.",
      },
      { text: "`except:` catches BaseException, so KeyboardInterrupt is swallowed like anything else" },
      {
        text: "`continue` clears the pending interrupt, which would otherwise propagate when the loop ends",
        whyTempting:
          "`continue` does not interact with exception state; the exception was already handled by the bare except.",
      },
    ],
    correct: 2,
    explanation:
      "A bare `except:` is equivalent to `except BaseException:`, which includes KeyboardInterrupt, SystemExit and GeneratorExit. Catching `Exception` instead leaves control signals free to propagate.",
  },
  {
    concept: "bare-except",
    difficulty: "medium",
    prompt:
      "A cache-warm call was wrapped in `try: warm() except: pass` to make failures non-fatal. Months later the cache is always cold. What made this so hard to detect?",
    options: [
      {
        text: "Logging is unaffected, and the traceback still reaches the root logger, so the signal was there",
        whyTempting:
          "Nothing logs an exception you caught and discarded; `pass` is total silence by construction.",
      },
      { text: "Any error is discarded and nothing reaches a log: a typo raising NameError vanishes too" },
      {
        text: "The exception is re-raised at interpreter shutdown, where the traceback points at exit",
        whyTempting:
          "A handled exception is finished; nothing defers it to shutdown for a second appearance.",
      },
      {
        text: "`pass` suppresses it but leaves sys.last_traceback, which only a debugger session reads",
        whyTempting:
          "sys.last_traceback is set only for uncaught exceptions in the interactive interpreter.",
      },
    ],
    correct: 1,
    explanation:
      "`except: pass` erases every failure, including programming errors like NameError and AttributeError, and emits nothing. Catch the specific exception you expect and log it before continuing.",
  },
  {
    concept: "bare-except",
    difficulty: "hard",
    prompt:
      "An asyncio worker loops on `try: await step() except: log(); continue`. Callers wrapping it in `asyncio.wait_for` time out, yet the task keeps running. Why?",
    options: [
      {
        text: "wait_for can only cancel awaitables it created, so a task from create_task is untouched",
        whyTempting:
          "wait_for cancels whatever awaitable you hand it, including a task that already exists.",
      },
      {
        text: "Cancellation is delivered between awaits, and `continue` reaches the next await first",
        whyTempting:
          "Cancellation is delivered as an exception at the await point, not as a flag the loop can outrun.",
      },
      {
        text: "The task is cancelled, but a strong reference to it keeps the loop rescheduling it",
        whyTempting:
          "Strong references stop a task from being garbage-collected; they never restart a cancelled one.",
      },
      { text: "`except:` also catches CancelledError, a BaseException, so cancellation is swallowed" },
    ],
    correct: 3,
    explanation:
      "Since Python 3.8 asyncio.CancelledError inherits from BaseException, so a bare except (or `except BaseException`) absorbs it and the loop continues. Catch `Exception` and let cancellation propagate.",
  },

  // ── python-shallow-copy ──────────────────────────────────────────────────
  {
    concept: "python-shallow-copy",
    difficulty: "easy",
    prompt:
      "`defaults = {'flags': ['a']}` and `cfg = dict(defaults)`. Code then runs `cfg['flags'].append('b')`. What does `defaults['flags']` contain afterwards?",
    options: [
      { text: "['a', 'b'], because both dicts hold a reference to that one shared inner list" },
      {
        text: "['a'], because dict() copies the mapping and everything reachable from it",
        whyTempting:
          "dict() copies the mapping, but only one level deep: the values are shared references.",
      },
      {
        text: "['a'], because append on a copied dict's value rebinds instead of mutating",
        whyTempting:
          "append mutates in place; only assigning to cfg['flags'] would rebind the copy's entry.",
      },
      {
        text: "It raises RuntimeError, since mutating a shared list through a copy is detected",
        whyTempting:
          "Python detects concurrent modification during iteration for dicts, not sharing between copies.",
      },
    ],
    correct: 0,
    explanation:
      "dict(), d.copy() and {**d} all make shallow copies: the new dict has its own keys but the same value objects. Mutating a nested value is visible through every copy.",
  },
  {
    concept: "python-shallow-copy",
    difficulty: "medium",
    prompt: "A grid is built with `grid = [[0] * 3] * 3` and then `grid[0][0] = 1` runs. What does grid hold?",
    options: [
      {
        text: "Only grid[0][0] is 1, since the outer `*` copies every row into a fresh list",
        whyTempting:
          "The outer `*` repeats references to one row object rather than duplicating the row.",
      },
      {
        text: "An IndexError, because `[[0] * 3] * 3` builds one flat nine-element list",
        whyTempting:
          "It really does build three entries, each of which is itself a list of three zeros.",
      },
      { text: "Every row's first cell is 1, because the three entries are the same list object" },
      {
        text: "Only grid[0][0] is 1, and the rows begin sharing after the outer list is resized",
        whyTempting:
          "Resizing the outer list reallocates its pointer array; it has no effect on what the rows are.",
      },
    ],
    correct: 2,
    explanation:
      "List repetition copies references, so all three rows are the same object and writing through one is visible through all. Build rows with a comprehension: `[[0] * 3 for _ in range(3)]`.",
  },
  {
    concept: "python-shallow-copy",
    difficulty: "hard",
    prompt:
      "A worker does `job = copy.copy(template)` per request, where template is a dataclass with a `headers: dict` field declared using `field(default_factory=dict)`. Each job sets `job.headers['X-Req-Id']`. What happens?",
    options: [
      {
        text: "Each job gets its own headers, because copy.copy rebuilds the instance's __dict__ entries",
        whyTempting:
          "copy.copy does build a new instance dict, but it fills it with the very same value objects.",
      },
      { text: "Template and every job share one headers dict, so each request id overwrites the last" },
      {
        text: "The assignment raises FrozenInstanceError, since copies of a dataclass are frozen",
        whyTempting:
          "Dataclasses are frozen only when declared with frozen=True, and copying never adds that flag.",
      },
      {
        text: "Each job is isolated, because default_factory runs again whenever the instance is copied",
        whyTempting:
          "default_factory runs in __init__, and copy.copy bypasses __init__ entirely.",
      },
    ],
    correct: 1,
    explanation:
      "copy.copy duplicates the instance but not its attribute values, so the mutable dict is shared with the template and every other copy. Use copy.deepcopy, or construct a fresh instance per request.",
  },

  // ── generator-exhaustion ─────────────────────────────────────────────────
  {
    concept: "generator-exhaustion",
    difficulty: "easy",
    prompt:
      "A function builds `rows = (parse(l) for l in lines)`. The caller logs `sum(1 for _ in rows)` and then iterates `rows` to write the records out. How many records get written?",
    options: [
      {
        text: "All of them, because the counting expression uses its own iterator over rows",
        whyTempting:
          "The inner genexp is a new object, but it pulls its items from the same underlying generator.",
      },
      {
        text: "All of them, because a generator restarts from the beginning when re-entered",
        whyTempting:
          "Re-iterable containers like lists restart; a generator has one cursor and never rewinds.",
      },
      {
        text: "Half of them, since counting takes every other item, and the writer is left with the rest",
        whyTempting:
          "Nothing interleaves here: the count runs to completion before the second loop starts.",
      },
      { text: "None, because the count exhausted the generator and the second pass sees nothing" },
    ],
    correct: 3,
    explanation:
      "A generator is a one-shot iterator: once counting drives it to StopIteration it stays exhausted, and further iteration yields nothing. Materialise a list if you need two passes.",
  },
  {
    concept: "generator-exhaustion",
    difficulty: "medium",
    prompt:
      "Validation runs `if any(is_bad(r) for r in records): return error` where `records` is a generator, and otherwise falls through to process `records`. What does the processing loop see?",
    options: [
      {
        text: "Every record either way, since the genexp inside any() is a separate iterator object",
        whyTempting:
          "The genexp is a separate object, but each item it yields was pulled out of records for good.",
      },
      {
        text: "Every record when any() returns True, because short-circuiting rewinds what it read",
        whyTempting:
          "Short-circuiting stops the loop early; it cannot push already-consumed items back in.",
      },
      { text: "Nothing when no record is bad, but only the items after the first bad one otherwise" },
      {
        text: "Nothing either way, since any() must drain the whole iterable before it can answer",
        whyTempting:
          "any() stops at the first truthy result, which is exactly why the leftover state differs by branch.",
      },
    ],
    correct: 2,
    explanation:
      "any() consumes the generator until it finds a truthy item or hits the end, and what it consumed is gone. In the all-good case the generator is fully exhausted, so the processing loop is a no-op.",
  },
  {
    concept: "generator-exhaustion",
    difficulty: "hard",
    prompt:
      "A helper reads `def read_ids(path): with open(path) as f: return (line.strip() for line in f)`. Callers get ValueError: I/O operation on closed file. What is the cause?",
    options: [
      { text: "The `with` block closes the file at return, but the generator reads it at iteration" },
      {
        text: "The file object is garbage-collected when read_ids returns, closing it before use",
        whyTempting:
          "Refcounting would close an unreferenced file, but the generator still holds a reference to it.",
      },
      {
        text: "Generators cannot keep a file handle across a yield, so the handle is dropped there",
        whyTempting:
          "A generator frame can hold any object across a yield; file handles are not special.",
      },
      {
        text: "The return statement materialises the genexp into a list, forcing a read after close",
        whyTempting:
          "If it were materialised inside the function, the reads would happen before the with block exits.",
      },
    ],
    correct: 0,
    explanation:
      "The generator does no work until it is iterated, by which time the `with` block has already closed the file. Either yield inside the with block, or return a list.",
  },

  // ── go-defer-loop ────────────────────────────────────────────────────────
  {
    concept: "go-defer-loop",
    difficulty: "easy",
    prompt:
      "A function loops over 10,000 paths, calling os.Open and then `defer f.Close()` inside the loop body. What is the consequence?",
    options: [
      {
        text: "Each file closes when its iteration ends: only one handle is open at any moment",
        whyTempting:
          "defer is scoped to the enclosing function, not to the block; ending an iteration runs nothing.",
      },
      { text: "All 10,000 handles stay open until the function returns, and the process risks EMFILE" },
      {
        text: "The deferred closes run in loop order at return, so the earliest files stay open longest",
        whyTempting:
          "Deferred calls run last-in-first-out, so that ordering is backwards: but the leak is the real issue.",
      },
      {
        text: "The compiler hoists the defer to the end of the loop body when there is no return",
        whyTempting:
          "The compiler never changes defer's semantics; it only optimises how the record is stored.",
      },
    ],
    correct: 1,
    explanation:
      "Deferred calls run when the function returns, not when the loop iteration ends, so handles accumulate for the whole loop. Wrap the body in its own function, or close explicitly.",
  },
  {
    concept: "go-defer-loop",
    difficulty: "medium",
    prompt:
      "A handler opens with `start := time.Now()` followed by `defer log.Printf(\"took %s\", time.Since(start))`. The logged duration is always about zero. Why?",
    options: [
      {
        text: "log.Printf formats at return, but time.Since reads a monotonic clock that resets",
        whyTempting:
          "Go's monotonic clock never resets within a process; the timing is taken at the wrong moment.",
      },
      {
        text: "The deferred call runs before the body rather than after it, so nothing has elapsed",
        whyTempting:
          "Deferred calls run at return; it is their arguments that are computed up front.",
      },
      {
        text: "start is captured into the closure by value, and the log measures against a stale copy",
        whyTempting:
          "There is no closure here, and a copied time.Time would still measure from the same instant.",
      },
      { text: "Arguments to a deferred call are evaluated at the `defer` statement and stored there" },
    ],
    correct: 3,
    explanation:
      "`time.Since(start)` is evaluated when the defer statement executes, so the already-computed duration is what gets printed later. Wrap it: `defer func() { log.Printf(...) }()`.",
  },
  {
    concept: "go-defer-loop",
    difficulty: "hard",
    prompt:
      "A loop over shards does `mu.Lock(); defer mu.Unlock(); update(shard)` inside the body, with a plain sync.Mutex. What happens on the second iteration?",
    options: [
      {
        text: "It proceeds, because Go runs pending defers early when a statement is about to block on a lock",
        whyTempting:
          "The runtime never runs defers ahead of schedule; it cannot know that a Lock is about to block.",
      },
      {
        text: "It proceeds, because sync.Mutex is reentrant for a goroutine that already holds it",
        whyTempting:
          "sync.Mutex is deliberately not reentrant; relocking from the same goroutine self-deadlocks.",
      },
      { text: "It blocks forever on Lock, since the deferred Unlock only runs when the function returns" },
      {
        text: "It panics with 'sync: unlock of unlocked mutex' once the deferred calls unwind",
        whyTempting:
          "That panic comes from an extra Unlock, but here execution never reaches the return at all.",
      },
    ],
    correct: 2,
    explanation:
      "The deferred Unlock is queued for function return, so the second Lock deadlocks against the lock still held from the first iteration. Unlock explicitly, or move the body into a helper function.",
  },

  // ── goroutine-leak ───────────────────────────────────────────────────────
  {
    concept: "goroutine-leak",
    difficulty: "easy",
    prompt:
      "With `ch := make(chan Result)`, a function starts `go func(){ ch <- fetch() }()` and then selects on ch and ctx.Done(). The context fires first and the function returns. What becomes of the goroutine?",
    options: [
      {
        text: "It is garbage-collected once nothing else holds a reference to ch",
        whyTempting:
          "The GC never reclaims a live goroutine; a blocked one keeps itself and its stack reachable.",
      },
      {
        text: "It panics with 'all goroutines are asleep - deadlock!' and takes the process down",
        whyTempting:
          "That panic fires only when every goroutine in the process is blocked, not just one of them.",
      },
      { text: "It blocks forever on the send: its stack and everything it references leak" },
      {
        text: "It completes, because a send with no receiver is dropped once the context is cancelled",
        whyTempting:
          "Cancelling a context signals your own code; it has no effect on a pending channel operation.",
      },
    ],
    correct: 2,
    explanation:
      "The send on an unbuffered channel blocks until someone receives, and nobody ever will, so the goroutine parks permanently. Buffering the channel with capacity 1 lets the sender finish and exit.",
  },
  {
    concept: "goroutine-leak",
    difficulty: "medium",
    prompt:
      "A pipeline stage runs `for v := range in { ... }` while its producer returns early on error without ever closing `in`. What is the symptom under sustained load?",
    options: [
      { text: "One goroutine leaks per failed request, because the consumer parks on the receive forever" },
      {
        text: "The consumer receives a zero value and exits the `range` loop, so nothing leaks",
        whyTempting:
          "Ranging yields zero values from a closed channel; an open but idle channel blocks.",
      },
      {
        text: "The runtime notices the orphaned channel and closes it once the producer's stack has unwound",
        whyTempting:
          "Nothing closes channels automatically; they are only reclaimed when wholly unreachable.",
      },
      {
        text: "Both sides exit, and buffered items are lost, so the request returns partial data",
        whyTempting:
          "Partial data is what you would see if the consumer did exit, which is exactly what fails here.",
      },
    ],
    correct: 0,
    explanation:
      "`for range` over a channel only ends when the channel is closed, so an abandoned producer leaves the consumer blocked forever. Whoever sends should close, ideally in a defer on the error path too.",
  },
  {
    concept: "goroutine-leak",
    difficulty: "hard",
    prompt:
      "A Go service's memory climbs steadily and a restart always fixes it. Which observation most directly points at leaked goroutines rather than a plain heap leak?",
    options: [
      {
        text: "The heap profile shows inuse_space growing at one allocation site across snapshots",
        whyTempting:
          "A goroutine leak can produce that too, but the site alone does not distinguish it from retained data.",
      },
      {
        text: "GC pause times climb steadily while the goroutine count stays flat between deploys",
        whyTempting:
          "Rising pauses signal heap pressure, and a flat goroutine count argues against this diagnosis.",
      },
      {
        text: "Process RSS is well above the heap size reported by `runtime.MemStats.HeapAlloc`",
        whyTempting:
          "RSS above HeapAlloc is normal: it also covers stacks, spans and memory not yet returned to the OS.",
      },
      { text: "NumGoroutine climbs with no ceiling, and pprof shows thousands parked at one line" },
    ],
    correct: 3,
    explanation:
      "The goroutine profile is the direct evidence: a monotonically rising count with many stacks blocked at the same channel or lock names the leak site. Heap-side signals are consequences, not proof.",
  },

  // ── go-nil-map ───────────────────────────────────────────────────────────
  {
    concept: "go-nil-map",
    difficulty: "easy",
    prompt:
      "A struct has a `Tags map[string]string` field and is built as `s := &Session{}`. Code reads `s.Tags[\"a\"]`, then writes `s.Tags[\"a\"] = \"b\"`. What happens?",
    options: [
      {
        text: "Both fail, because touching a nil map dereferences a nil pointer",
        whyTempting:
          "Reads from a nil map are explicitly legal and return the zero value; only writes panic.",
      },
      { text: "The read yields the empty string, but the write panics on assignment to a nil map" },
      {
        text: "Both succeed, because the map is allocated lazily on first use, like append does for a nil slice",
        whyTempting:
          "append does allocate for a nil slice, but map assignment has no equivalent fallback.",
      },
      {
        text: "The read panics, while the write succeeds and allocates a map holding one entry",
        whyTempting:
          "This inverts the rule: it is the write, not the read, that requires an allocated map.",
      },
    ],
    correct: 1,
    explanation:
      "A nil map behaves like an empty map for reads but panics on assignment, since there is no hash table to write into. Initialise it in the constructor or with `make` before the first write.",
  },
  {
    concept: "go-nil-map",
    difficulty: "medium",
    prompt:
      "A function returns a nil map when it has nothing to report. Callers then use `len(m)`, `for range m`, `delete(m, k)` and `v, ok := m[k]`. Which of those panic?",
    options: [
      {
        text: "range and delete panic, since both need a live hash table to walk over",
        whyTempting:
          "Both are specified as no-ops on a nil map: range sees zero iterations and delete does nothing.",
      },
      {
        text: "delete panics, because removing a key from a nil map counts as a write",
        whyTempting:
          "delete looks like mutation, but the spec makes it a no-op when the map is nil.",
      },
      { text: "None of them: each read-shaped operation treats a nil map as an empty one" },
      {
        text: "len panics, and the rest operate on a shared empty map supplied by the runtime",
        whyTempting:
          "There is no shared empty map; nil maps are just a nil pointer the runtime special-cases on reads.",
      },
    ],
    correct: 2,
    explanation:
      "len, range, delete and indexing are all defined on a nil map and behave as if it were empty; only assignment panics. Returning nil instead of an empty map is therefore safe for read-only callers.",
  },
  {
    concept: "go-nil-map",
    difficulty: "hard",
    prompt:
      "Config is decoded into `type Cfg struct{ Limits map[string]int }`. For a payload containing `\"Limits\": null`, later code runs `cfg.Limits[\"rps\"] = 100`. What is the result?",
    options: [
      { text: "It panics, because null leaves the field nil and Unmarshal allocates no map for it" },
      {
        text: "It works, because encoding/json always allocates maps for declared map fields",
        whyTempting:
          "json allocates only when there is an object to fill; null and an absent key both leave nil.",
      },
      {
        text: "It works: assigning to a map field of an addressable struct allocates it first",
        whyTempting:
          "Addressability decides whether you may assign to the field, not whether a map exists behind it.",
      },
      {
        text: "It panics, but only because the struct was decoded by value rather than through a pointer",
        whyTempting:
          "Unmarshal rejects a non-pointer target outright, so that could not be the failure mode here.",
      },
    ],
    correct: 0,
    explanation:
      "JSON null decodes to the zero value, leaving the map field nil, and the first write then panics. Initialise map fields after decoding, or guard with `if cfg.Limits == nil`.",
  },

  // ── go-slice-aliasing ────────────────────────────────────────────────────
  {
    concept: "go-slice-aliasing",
    difficulty: "easy",
    prompt: "Given `a := []int{1, 2, 3, 4, 5}` and `b := a[1:3]`, code executes `b[0] = 99`. What is a[1]?",
    options: [
      {
        text: "Unchanged: slicing copies the selected elements into a new array",
        whyTempting:
          "Slicing does create a new slice header, but it points into the original backing array.",
      },
      {
        text: "Unchanged, unless b had been created with the three-index form `a[1:3:3]`",
        whyTempting:
          "The three-index form caps capacity to control appends; it never separates the elements.",
      },
      {
        text: "99, but only until a is passed to a function, which re-copies its elements",
        whyTempting:
          "Passing a slice copies the header, not the elements, so the sharing survives the call.",
      },
      { text: "99, because b's elements are a's elements seen through a different header" },
    ],
    correct: 3,
    explanation:
      "A slice expression yields a new header (pointer, length, capacity) over the same backing array, so writes through either name are visible through both. Copy explicitly if you need isolation.",
  },
  {
    concept: "go-slice-aliasing",
    difficulty: "medium",
    prompt: "Code runs `a := make([]int, 5, 10)`, then `b := a[:2]`, then `b = append(b, 7)`. What is a[2] afterwards?",
    options: [
      {
        text: "Still 0, because append always allocates a fresh array for its result slice",
        whyTempting:
          "append reuses the backing array whenever spare capacity exists; it only reallocates when forced.",
      },
      { text: "7, because b inherited a's capacity of 10 and append wrote into a's third slot" },
      {
        text: "Still 0, since b's capacity is 2, so append is obliged to grow into new storage",
        whyTempting:
          "Slicing keeps the original capacity, so b's cap is 10, not 2: length and capacity differ here.",
      },
      {
        text: "7, but only once a is re-sliced; until then the write lives in a's private copy",
        whyTempting:
          "There is no private copy: a and b address the same array from the moment b is created.",
      },
    ],
    correct: 1,
    explanation:
      "b keeps a's capacity, so append writes in place at index 2 of the shared array instead of reallocating. `a[:2:2]` caps the capacity and forces append to copy.",
  },
  {
    concept: "go-slice-aliasing",
    difficulty: "hard",
    prompt:
      "A parser reads 4 MB HTTP bodies and caches `body[begin:end]`, a 60-byte token, in a long-lived map. Memory grows far beyond what the cache should hold. Why?",
    options: [
      {
        text: "Map buckets over-allocate, so each 60-byte value ends up occupying a whole memory page",
        whyTempting:
          "Bucket overhead is real but small and bounded; it cannot account for megabytes per entry.",
      },
      {
        text: "Each subslice copies its 60 bytes but sets a finalizer on the parent, delaying collection",
        whyTempting:
          "Slicing never copies, and the runtime attaches no finalizers to slices or their arrays.",
      },
      { text: "The subslice points into the 4 MB backing array, so the map entry keeps all of it alive" },
      {
        text: "Strings converted from the subslice share its storage, so the two are retained together",
        whyTempting:
          "Converting []byte to string copies the bytes, which would actually break the retention chain.",
      },
    ],
    correct: 2,
    explanation:
      "A slice keeps its whole backing array reachable, so a 60-byte view pins all 4 MB for the cache's lifetime. Copy the token into a fresh slice or string before storing it.",
  },
];
