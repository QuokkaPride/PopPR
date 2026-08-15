import type { BankEntry } from "./types.js";

/**
 * Rust.
 *
 * Every concept here was chosen by measuring candidate rules against 319 merged
 * PRs across tokio, hyper, axum, rust-lang/rust, ripgrep, serde, clap and rayon,
 * then keeping only the ones that fired on real diffs. Borrow-checker and
 * lifetime questions are deliberately absent: the compiler rejects those before
 * a PR exists, so they are not misconceptions that ship.
 */
export const RUST_ENTRIES: BankEntry[] = [
  // ── rust-panic-propagation ───────────────────────────────────────────────
  {
    concept: "rust-panic-propagation",
    difficulty: "easy",
    prompt:
      "A worker loop runs `tokio::spawn(async move { handle(job).await.unwrap(); });` and never joins the handle. One malformed job makes `handle` return `Err`. What does the service do next?",
    options: [
      {
        text: "The spawned task dies alone, the process keeps serving, and the panic sits unread inside the JoinHandle",
      },
      {
        text: "The panic unwinds into the loop that called spawn, so the whole worker stops on the first bad job",
        whyTempting:
          "Panics do unwind, but only through the panicking task's own frames, and a spawned task owns its stack.",
      },
      {
        text: "The runtime aborts the process, since a panic inside an async task has nowhere to unwind to",
        whyTempting:
          "This is what `panic = \"abort\"` does, and what a panic during a Drop in an unwind does.",
      },
      {
        text: "`.unwrap()` yields the default value for the type, so the bad job is skipped",
        whyTempting:
          "`unwrap_or_default` behaves this way, and the two method names read alike at a glance.",
      },
    ],
    correct: 0,
    explanation:
      "A panic terminates the task it happened in and is stored in the JoinHandle as an Err. Drop the handle and the failure vanishes: your health check stays green while the work silently stops.",
  },
  {
    concept: "rust-panic-propagation",
    difficulty: "medium",
    prompt:
      "A parser is hardened with `let value = std::panic::catch_unwind(|| parse(input)).unwrap_or(Fallback);`. It works in tests. In production one input still takes the process down. Which explanation fits?",
    options: [
      {
        text: "`catch_unwind` needs the closure to be `UnwindSafe`, so the compiler already rejected the shared state case",
        whyTempting:
          "`UnwindSafe` is a real bound here, but `AssertUnwindSafe` is what people reach for, and it silences the check.",
      },
      {
        text: "The release profile sets `panic = \"abort\"`, which unwinds nothing and gives catch_unwind nothing to catch",
      },
      {
        text: "`catch_unwind` catches the first panic per thread, and later panics on that thread go straight to the abort handler",
        whyTempting:
          "The panic hook does run once per panic, but it does not disarm catching, and a thread can catch repeatedly.",
      },
      {
        text: "The panic happened while a value was being dropped, so it escaped the closure body",
        whyTempting:
          "A panic during unwinding really does abort, so this is the right shape of answer for a different input.",
      },
    ],
    correct: 1,
    explanation:
      "`catch_unwind` only works when panics unwind, and `panic = \"abort\"` in a release profile turns every panic into an immediate process abort. Test binaries usually keep the default unwind strategy, which is why the test passes.",
  },
  {
    concept: "rust-panic-propagation",
    difficulty: "hard",
    prompt:
      "A cache holds `Mutex<HashMap<K, V>>`. One request panics while holding the guard. Every later request on that mutex gets `Err(PoisonError)` from `.lock()`, and the code does `.lock().unwrap()`. What is the outcome, and what does poisoning actually guarantee?",
    options: [
      {
        text: "Every later request panics too, and poisoning guarantees nothing about the map beyond flagging that a panic happened mid-guard",
      },
      {
        text: "Only requests that write panic, because poisoning is checked on the write path",
        whyTempting:
          "RwLock does distinguish read and write guards, but poisoning is a property of the lock, not of the guard kind.",
      },
      {
        text: "Later requests succeed and the map is rolled back to its last consistent state",
        whyTempting:
          "Transactional rollback is what people assume poisoning buys, and it is what a database would do.",
      },
      {
        text: "Later requests block until the poisoned guard is cleared by another thread",
        whyTempting:
          "A held guard does block, so this is what you would see if the panic had leaked the guard rather than dropped it.",
      },
    ],
    correct: 0,
    explanation:
      "Poisoning is a flag, not a repair: the map keeps whatever half-finished state the panic left behind, and `.unwrap()` on the PoisonError turns one panic into every later request panicking. Use `into_inner()` and reconcile deliberately, or make the guarded section panic-free.",
  },

  // ── rust-iterator-lazy ───────────────────────────────────────────────────
  {
    concept: "rust-iterator-lazy",
    difficulty: "easy",
    prompt:
      "`paths.iter().map(|p| { println!(\"checking {p}\"); load(p) }).find(|r| r.is_ok());` prints two lines for a 500-element vector. Why so few?",
    options: [
      {
        text: "`find` short-circuits, and each element is pulled through map one at a time, so map ran twice",
      },
      {
        text: "`println!` is buffered per iterator stage and only the last two lines were flushed before the value was returned",
        whyTempting:
          "stdout really is line-buffered behind a lock, which makes lost output a plausible first guess.",
      },
      {
        text: "`map` runs over the whole vector first, and `find` then reads two of the results",
        whyTempting:
          "This is how a collect-then-search rewrite behaves, and how the same code reads in most other languages.",
      },
      {
        text: "`iter()` yields references, so map only borrows and the closure body is deferred to `find`",
        whyTempting:
          "iter does yield `&T`, but borrowing has nothing to do with when the closure body runs.",
      },
    ],
    correct: 0,
    explanation:
      "Adapters build a pipeline and nothing runs until a consumer pulls. `find` stops at the first match, so map executed exactly twice, side effect and all.",
  },
  {
    concept: "rust-iterator-lazy",
    difficulty: "medium",
    prompt:
      "`let ids: Result<Vec<Id>, ParseError> = rows.iter().map(parse_id).collect();` on 10,000 rows where row 3 is malformed. What does the caller receive?",
    options: [
      {
        text: "`Ok(Vec)` holding the 9,999 rows that parsed, since collect skips the failures",
        whyTempting:
          "`filter_map` does exactly this, and the two are close enough in shape to swap by accident.",
      },
      {
        text: "A `Vec<Result<Id, ParseError>>` of length 10,000, because collect cannot flip the nesting on its own",
        whyTempting:
          "That is the annotation-free result, and it is what you get the moment the type on the left changes.",
      },
      {
        text: "`Err(ParseError)` for row 3, and the 9,998 rows after it were never parsed",
      },
      {
        text: "`Err(ParseError)` naming the last malformed row, since collect runs to the end and keeps the final error",
        whyTempting:
          "Aggregating every error is what a validation library does, and it is often what you actually want.",
      },
    ],
    correct: 2,
    explanation:
      "`collect::<Result<Vec<_>, _>>()` stops at the first Err and discards everything already built. To keep the good rows and the failures, collect into `(Vec<_>, Vec<_>)` with partition, or map into a Vec of Results first.",
  },
  {
    concept: "rust-iterator-lazy",
    difficulty: "hard",
    prompt:
      "A reviewer sees `let n = items.iter().filter(|i| i.active).count(); let first = items.iter().filter(|i| i.active).next();` and rewrites it as one chain reusing a single `let active = items.iter().filter(|i| i.active);`. The rewrite does not compile. What is the reason?",
    options: [
      {
        text: "`count` takes the iterator by value and consumes it, so `active` is moved and unavailable for `next`",
      },
      {
        text: "The closure borrows `items` immutably twice at once, which the borrow checker rejects",
        whyTempting:
          "Two overlapping borrows is the classic Rust compile error, but both of these are shared borrows and stack fine.",
      },
      {
        text: "`Filter` is not `Clone` unless its closure is, so the second use needs an explicit clone",
        whyTempting:
          "Filter is Clone when the closure is, and cloning is a real fix here, so the reasoning is half right.",
      },
      {
        text: "`next` needs `&mut self`, and `active` was bound without `mut`",
        whyTempting:
          "This is a genuine second error you hit right after fixing the first, so the compiler shows it eventually.",
      },
    ],
    correct: 0,
    explanation:
      "Consumers like `count`, `sum` and `collect` take `self`, so the iterator is gone afterwards. Rebuild the chain, or collect once into a Vec and read length and first element from that.",
  },

  // ── rust-clone-shared ────────────────────────────────────────────────────
  {
    concept: "rust-clone-shared",
    difficulty: "easy",
    prompt:
      "A test does `let sem = Arc::new(Semaphore::new(0)); let sem2 = sem.clone();`, moves `sem2` into a thread that blocks on `sem2.acquire()`, then calls `sem.add_permits(1)` from the parent. Does the thread wake?",
    options: [
      {
        text: "No, because each Arc clone holds its own copy of the semaphore's permit counter",
        whyTempting:
          "This is exactly what `#[derive(Clone)]` on a plain struct does, which is most of what people meet first.",
      },
      {
        text: "Yes: the clone bumps a reference count and both names reach the same Semaphore",
      },
      {
        text: "Yes, but only because Semaphore is internally an Arc already, so the outer Arc is redundant",
        whyTempting:
          "Some tokio handles really are cheap clonable handles over shared state, so the habit transfers.",
      },
      {
        text: "No, since `add_permits` on an Arc with a strong count above one is a no-op that returns an error",
        whyTempting:
          "Arc does gate mutation on the strong count, but that is `get_mut` and `try_unwrap`, not interior mutability.",
      },
    ],
    correct: 1,
    explanation:
      "`Arc::clone` copies a pointer and increments a refcount: there is still one Semaphore. That is why the pattern works, and also why an Arc handed to a task is never isolated state.",
  },
  {
    concept: "rust-clone-shared",
    difficulty: "medium",
    prompt:
      "Profiling shows a hot loop spending most of its time in `memcpy`. The loop body is `for row in rows.clone() { ... }` where `rows: Arc<Vec<Row>>` and Row is 200 bytes. What is happening?",
    options: [
      {
        text: "Auto-deref makes `rows.clone()` resolve to `Vec::clone`, so every iteration deep-copies all the rows",
      },
      {
        text: "`Arc::clone` copies the pointee whenever the strong count is one, to avoid aliasing a uniquely owned value",
        whyTempting:
          "`Arc::make_mut` really does copy on write, and the optimisation it skips is exactly a count of one.",
      },
      {
        text: "`for` takes the Arc by value, so the Vec is moved out and rebuilt on each pass",
        whyTempting:
          "The loop does consume its argument, so ownership is the right thing to be suspicious of.",
      },
      {
        text: "Row is not Copy, so IntoIterator clones each element as it yields",
        whyTempting:
          "Iterating `&Vec<Row>` and then cloning per element is a real pattern that produces the same profile.",
      },
    ],
    correct: 0,
    explanation:
      "Method lookup derefs through the Arc and finds `Vec::clone` before it would consider `Arc::clone`, so the cheap-looking call is O(n). Write `Arc::clone(&rows)` when you mean the refcount bump, which also makes the intent visible at the call site.",
  },
  {
    concept: "rust-clone-shared",
    difficulty: "hard",
    prompt:
      "`Arc<Mutex<Vec<Job>>>` is cloned into eight workers. One worker holds the guard while it awaits a network call. The runtime is multi-threaded, and the code compiles. What does this cost you?",
    options: [
      {
        text: "Nothing at runtime, since the compiler rejects a std MutexGuard held across an await and would not have built this",
        whyTempting:
          "The `!Send` guard error is real and common, but it only fires when the future itself has to be Send.",
      },
      {
        text: "The other seven workers block on `.lock()` for the whole network call, and the pool can deadlock if that call needs the same mutex",
      },
      {
        text: "Nothing beyond throughput: the executor parks the guard with the task and hands the lock to the next worker",
        whyTempting:
          "Async runtimes do park suspended tasks, which makes it easy to assume the lock is parked too.",
      },
      {
        text: "The guard is released at the await point and reacquired on resume, so the Vec can change underneath",
        whyTempting:
          "This is how a condition variable behaves, and it is the semantics an async-aware mutex would need.",
      },
    ],
    correct: 1,
    explanation:
      "A held lock is held across the suspension: the task keeps the mutex while it waits on IO, and every other worker stalls behind it. Take what you need, drop the guard before the await, or use an async mutex when the critical section genuinely spans one.",
  },

  // ── rust-await-cancellation ──────────────────────────────────────────────
  {
    concept: "rust-await-cancellation",
    difficulty: "easy",
    prompt:
      "`let fut = fetch_rows(&db); do_other_work(); let rows = fut.await;` The team expects the fetch to overlap with `do_other_work`. Does it?",
    options: [
      {
        text: "No: calling an async fn builds a future and runs none of its body until something polls it",
      },
      {
        text: "Yes, since the async fn body starts on a runtime thread as soon as the future is constructed",
        whyTempting:
          "This is how JavaScript promises and C# tasks behave, and the syntax is close enough to carry the habit over.",
      },
      {
        text: "Yes, because the borrow of `db` is taken at call time and the runtime begins driving the future then",
        whyTempting:
          "The borrow really is captured at call time, so half of this sentence is true and the conclusion is not.",
      },
      {
        text: "Only on a multi-threaded runtime, where an idle worker can steal the unpolled future",
        whyTempting:
          "Work stealing is real, but it moves tasks the runtime already owns, and a local future is not one.",
      },
    ],
    correct: 0,
    explanation:
      "Rust futures are inert: nothing happens until `.await` or a spawn drives them. To get real overlap use `tokio::spawn` or `join!`, which is why that distinction matters more here than in most languages.",
  },
  {
    concept: "rust-await-cancellation",
    difficulty: "medium",
    prompt:
      "A handler runs `timeout(Duration::from_secs(1), socket.read_exact(&mut buf)).await`. On timeout it logs and retries the read on the same socket. Reads after that return misaligned frames. What went wrong?",
    options: [
      {
        text: "The timeout dropped the read future partway through, and the bytes it had already consumed are gone from the socket",
      },
      {
        text: "`read_exact` returns an error on timeout without touching the socket, so the misalignment is upstream",
        whyTempting:
          "`read_exact` does leave the buffer unspecified on error, so blaming the buffer rather than the socket is close.",
      },
      {
        text: "`timeout` cancels the socket at the OS level, so the retry reads from a half-closed connection",
        whyTempting:
          "Cancelling the syscall would explain it, but timeout only drops a future and never touches the fd.",
      },
      {
        text: "The retry needs `&mut buf` again, and the second borrow starts reading at the old cursor position",
        whyTempting:
          "Buffer cursors are a genuine source of misalignment in framed protocols, just not this one.",
      },
    ],
    correct: 0,
    explanation:
      "Dropping a future stops it at its current await point and keeps everything it already did. `read_exact` is not cancel-safe: bytes pulled off the socket before the timeout are lost, so the stream is now offset.",
  },
  {
    concept: "rust-await-cancellation",
    difficulty: "hard",
    prompt:
      "`select! { _ = tx.send(item) => {}, _ = shutdown.recv() => return }` sits inside a loop over a queue. During shutdown some items go missing from the receiving end, with nothing logged. What is the mechanism?",
    options: [
      {
        text: "`select!` polls the branches in a random order, so on shutdown the send branch is sometimes skipped entirely",
        whyTempting:
          "The random poll order is real and is exactly what stops one branch starving another.",
      },
      {
        text: "When shutdown wins, the send future is dropped mid-flight and the item it had taken never reaches the channel",
      },
      {
        text: "The channel closes when the receiver drops, so `send` resolves to Err and the ignored result hides the loss",
        whyTempting:
          "Ignoring a send error is a genuine bug of exactly this shape, and it belongs in the same review.",
      },
      {
        text: "`select!` requires every branch to be cancel-safe and the macro would not have compiled otherwise",
        whyTempting:
          "Cancel safety is the property that matters here, but nothing in the type system checks or enforces it.",
      },
    ],
    correct: 1,
    explanation:
      "Every losing branch in a `select!` is dropped, so anything a branch does before its final await is discarded silently. Take the item out of the queue only after the send resolves, or keep the send future alive across iterations.",
  },

  // ── rust-unsafe-invariant ────────────────────────────────────────────────
  {
    concept: "rust-unsafe-invariant",
    difficulty: "easy",
    prompt:
      "A hot loop replaces `v[i]` with `unsafe { *v.get_unchecked(i) }`. A later refactor lets `i` reach `v.len()`. What happens on that iteration?",
    options: [
      {
        text: "It reads whatever bytes follow the buffer and hands them back as a valid-looking value",
      },
      {
        text: "It panics with the usual index-out-of-bounds message, because the bound check moved into the unsafe block",
        whyTempting:
          "This is what the safe `v[i]` does, and the two lines are meant to be interchangeable in the happy case.",
      },
      {
        text: "It returns the element type's default value, since the slice has no element at that offset",
        whyTempting:
          "`get(i)` returning None and a later `unwrap_or_default` produce this, and the names are one word apart.",
      },
      {
        text: "It aborts the process, because reading past the end of a slice trips the allocator's guard page",
        whyTempting:
          "Guard pages catch some overruns, which is why the bug seems to disappear under a debug allocator.",
      },
    ],
    correct: 0,
    explanation:
      "`unsafe` turns off no checks: it moves the obligation to prove the index is in bounds onto you. The read is undefined behaviour, and the usual symptom is a plausible wrong value surfacing somewhere unrelated.",
  },
  {
    concept: "rust-unsafe-invariant",
    difficulty: "medium",
    prompt:
      "A parser builds a String with `unsafe { String::from_utf8_unchecked(bytes) }` because the bytes came from a source the author knows is UTF-8. One day the source ships a lone 0xFF byte. Where does the program break?",
    options: [
      {
        text: "At the `from_utf8_unchecked` call, which still validates in debug builds and only skips the check when optimised",
        whyTempting:
          "Several unchecked APIs do carry a debug assertion, so expecting one here is reasonable.",
      },
      {
        text: "Nowhere: the invalid byte round-trips as a replacement character on the next display",
        whyTempting:
          "`from_utf8_lossy` does exactly this substitution, and it is the safe function people reach for instead.",
      },
      {
        text: "Somewhere later and unrelated, because every str operation on that value is now undefined",
      },
      {
        text: "At the first `.len()` call, since the length is recomputed by scanning for character boundaries",
        whyTempting:
          "`chars().count()` does scan, and mixing it up with `len()` is one of the first things Rust teaches you.",
      },
    ],
    correct: 2,
    explanation:
      "Every `str` method assumes the invariant `from_utf8_unchecked` promised, so slicing, iteration and comparison all become undefined the moment it is false. The cost of `from_utf8` is one linear scan, which is cheaper than a class of bug with no reliable failure point.",
  },
  {
    concept: "rust-unsafe-invariant",
    difficulty: "hard",
    prompt:
      "A module exposes `pub fn from_parts(ptr: *mut u8, len: usize) -> Buffer` with no `unsafe` keyword, because everything inside the function body that needs it is wrapped in an `unsafe` block. Why is the signature wrong?",
    options: [
      {
        text: "Safe callers can pass any pointer and any length, so soundness now depends on a contract the type system does not state",
      },
      {
        text: "A function containing an unsafe block must itself be unsafe, and this would fail to compile",
        whyTempting:
          "Wrapping unsafe in a safe function is the standard way to build an abstraction, so the rule sounds plausible.",
      },
      {
        text: "Raw pointer parameters are not FFI-safe unless the function is `extern`, so this needs a repr attribute",
        whyTempting:
          "`improper_ctypes` is a real lint, but it fires on `extern` boundaries and has nothing to say here.",
      },
      {
        text: "The pointer's lifetime is unbound, so the compiler infers `'static` and rejects any shorter borrow",
        whyTempting:
          "Unbounded lifetimes from raw pointers are a genuine hazard, and you have to pick one by hand.",
      },
    ],
    correct: 0,
    explanation:
      "`unsafe fn` is how a signature says the caller has obligations. Hiding the unsafety inside makes a function that can cause undefined behaviour from entirely safe code, which is the definition of unsound.",
  },

  // ── rust-capacity-vs-len ─────────────────────────────────────────────────
  {
    concept: "rust-capacity-vs-len",
    difficulty: "easy",
    prompt:
      "`let mut out = Vec::with_capacity(n); out[0] = first;` panics. The author expected a vector of n slots. What does `with_capacity` build?",
    options: [
      {
        text: "An empty vector with room for n elements: `len()` is 0 and indexing any position panics",
      },
      {
        text: "A vector of n default values, which panics only when the element type has no Default",
        whyTempting:
          "`vec![Default::default(); n]` gives you that, and it is the constructor people actually wanted.",
      },
      {
        text: "A vector whose length grows lazily to n on first write, so index 0 is valid and index 1 is not",
        whyTempting:
          "Sparse arrays in other languages behave this way, and it fits the observed panic on a later index.",
      },
      {
        text: "A vector of n uninitialised slots, so reading is a panic and writing is fine",
        whyTempting:
          "`MaybeUninit` allocation is exactly this, and it is what the underlying allocation really looks like.",
      },
    ],
    correct: 0,
    explanation:
      "Capacity is allocated space and length is how many elements exist. Push into it, or build with `vec![value; n]` when you want n live elements.",
  },
  {
    concept: "rust-capacity-vs-len",
    difficulty: "medium",
    prompt:
      "A codec writes `dst.reserve(header_len + n)` before each frame, where `n` is the adjusted length-field value rather than the payload size. Payloads are larger than `n`. What is the effect?",
    options: [
      {
        text: "The frame is truncated to the reserved size, since reserve caps how much the buffer will accept",
        whyTempting:
          "`truncate` and fixed-size buffers do cap writes, and a codec is exactly where you would expect that.",
      },
      {
        text: "Correct output, with an extra reallocation partway through the write when the reserve falls short",
      },
      {
        text: "A panic on the first byte past the reservation, because reserve sets an upper bound on len",
        whyTempting:
          "Arrays and slices do panic past their end, so carrying that model to Vec is a small step.",
      },
      {
        text: "Silent corruption of the next frame, since the writer keeps going past the reserved region",
        whyTempting:
          "This is the C answer, and it is what the same mistake would cost you with a raw buffer.",
      },
    ],
    correct: 1,
    explanation:
      "`reserve` is a hint: too small and the Vec grows itself, so the only cost is the allocation you were trying to avoid. That is why this bug is a performance regression nobody notices rather than a crash.",
  },
  {
    concept: "rust-capacity-vs-len",
    difficulty: "hard",
    prompt:
      "A batching loop runs `buf.reserve(batch.len()); buf.extend_from_slice(batch); flush(&mut buf); buf.clear();` millions of times. Memory climbs and never comes back after a burst of huge batches. What holds it?",
    options: [
      {
        text: "`clear` drops the elements and keeps the allocation, so the Vec stays at the largest capacity it ever reached",
      },
      {
        text: "`reserve` grows capacity by the requested amount every call rather than to it, so capacity accumulates",
        whyTempting:
          "`reserve` really is additional-beyond-len, which is a genuine trap, but len is zero here after each clear.",
      },
      {
        text: "`extend_from_slice` leaks the previous allocation when it reallocates mid-extend",
        whyTempting:
          "Reallocation is where growth happens, so pointing at it is the right instinct with the wrong mechanism.",
      },
      {
        text: "`flush` takes `&mut Vec` and the borrow keeps the old buffer alive until the loop ends",
        whyTempting:
          "Borrows extending lifetimes is a real Rust behaviour, though not one that survives past the call.",
      },
    ],
    correct: 0,
    explanation:
      "`clear` sets length to zero and leaves capacity untouched, which is what makes buffer reuse fast and what makes the high-water mark permanent. Call `shrink_to_fit` after an outsized batch, or cap the buffer and rebuild it.",
  },

  // ── rust-mem-take-replace ────────────────────────────────────────────────
  {
    concept: "rust-mem-take-replace",
    difficulty: "easy",
    prompt:
      "`let hooks = self.hooks.take(); register(&hooks)?; self.hooks.set(hooks);` where `hooks` is a `Cell<Option<Vec<Hook>>>`. `register` returns Err once. What is the state of `self.hooks` afterwards?",
    options: [
      {
        text: "Empty: `take` left None behind, and the `?` returned before the value was put back",
      },
      {
        text: "Unchanged, since `take` on a Cell copies the value out and leaves the original in place",
        whyTempting:
          "`Cell::get` does copy and leave the original, and the two methods sit next to each other in the docs.",
      },
      {
        text: "Restored, because the Cell's Drop runs on early return and writes the taken value back",
        whyTempting:
          "A guard type would do this, and it is the pattern you would reach for to fix the bug.",
      },
      {
        text: "Holding an empty Vec rather than None, which later reads treat as no hooks registered",
        whyTempting:
          "`mem::take` does leave `Default::default()`, and for a Vec that really is an empty Vec.",
      },
    ],
    correct: 0,
    explanation:
      "`take` hands you the only copy and leaves the default in its place. Any early return between the take and the put-back loses the value for good, which is why the fix is to do the fallible work before the take.",
  },
  {
    concept: "rust-mem-take-replace",
    difficulty: "medium",
    prompt:
      "A struct method needs to consume `self.pending` (a `Vec<Job>`) while `self` is only borrowed as `&mut`. Which line does that without cloning?",
    options: [
      {
        text: "`let jobs = self.pending.clone(); self.pending.clear();`",
        whyTempting:
          "It is correct and obvious, which is why it survives review, and it copies every job for nothing.",
      },
      {
        text: "`let jobs = std::mem::take(&mut self.pending);`",
      },
      {
        text: "`let jobs = self.pending;`",
        whyTempting:
          "This is the line you want to write, and the compiler rejects it: you cannot move out of a borrow.",
      },
      {
        text: "`let jobs = &mut self.pending;`",
        whyTempting:
          "It compiles and looks like it works, then fails the moment the consumer needs an owned Vec.",
      },
    ],
    correct: 1,
    explanation:
      "`mem::take` swaps in `Default::default()` and hands you the original, which for a Vec means an empty Vec costing no allocation. `mem::replace` is the same move when the type has no Default or you want a specific placeholder.",
  },
  {
    concept: "rust-mem-take-replace",
    difficulty: "hard",
    prompt:
      "`std::mem::forget(guard)` is added to skip an expensive teardown in a benchmark. `guard` is a `MutexGuard`. What has this done?",
    options: [
      {
        text: "Leaked the guard and left the mutex locked forever, so the next `lock()` on it blocks with no owner to release it",
      },
      {
        text: "Introduced undefined behaviour, since forgetting a value that borrows another is unsound",
        whyTempting:
          "Leaking used to be considered unsound and there is a famous history here, but `forget` is safe by design.",
      },
      {
        text: "Nothing measurable, because the guard is zero-sized and its Drop is a compiler-inserted no-op",
        whyTempting:
          "Guards are close to zero-sized, and it is easy to conclude the Drop is equally free.",
      },
      {
        text: "Deferred the unlock to the end of the enclosing scope rather than the end of the statement",
        whyTempting:
          "This is what binding the guard to a named variable does, and it is a real difference worth knowing.",
      },
    ],
    correct: 0,
    explanation:
      "`mem::forget` is safe and never runs Drop, and for a guard the unlock lives in Drop. Leaking is allowed by the language and still ends the program's ability to use that mutex.",
  },

  // ── rust-atomic-ordering ─────────────────────────────────────────────────
  {
    concept: "rust-atomic-ordering",
    difficulty: "easy",
    prompt:
      "A counter is bumped with `hits.fetch_add(1, Ordering::Relaxed)` from many threads, and the total is read once at shutdown. A reviewer asks for `SeqCst`. Is the reviewer right?",
    options: [
      {
        text: "No: the increment is atomic under any ordering, and this counter has no other memory to order against",
      },
      {
        text: "Yes, since Relaxed lets two threads read the same value and both write back the same total",
        whyTempting:
          "Lost updates are the classic counter bug, and it is exactly what a non-atomic `+= 1` would do.",
      },
      {
        text: "Yes, because Relaxed permits the CPU to drop increments under contention in favour of throughput",
        whyTempting:
          "The name suggests the operation itself is weakened, which is the single most common misreading.",
      },
      {
        text: "No, but only because the final read is on one thread, and a concurrent read would need Acquire",
        whyTempting:
          "Acquire matters when you are reading a flag that guards other data, so the rule is right and misapplied.",
      },
    ],
    correct: 0,
    explanation:
      "Ordering constrains how surrounding memory operations may be reordered around the atomic, and never whether the atomic itself is atomic. A standalone counter is the textbook case for Relaxed.",
  },
  {
    concept: "rust-atomic-ordering",
    difficulty: "medium",
    prompt:
      "A thread writes `data.set(payload)` then `ready.store(true, Ordering::Relaxed)`. Another spins on `ready.load(Ordering::Relaxed)` then reads `data`. It passes CI on x86 and fails on ARM. What is the fix?",
    options: [
      {
        text: "Store with Release and load with Acquire, which pairs the two and publishes the write to data",
      },
      {
        text: "Make `data` an atomic as well, since a non-atomic write beside an atomic one is a data race",
        whyTempting:
          "It is a data race today, and this fix removes it, at the cost of an atomic on every field.",
      },
      {
        text: "Store with SeqCst and keep the load Relaxed, because the ordering only has to be established once",
        whyTempting:
          "One SeqCst does look like the stronger half of the pair, but ordering is a property of both sides.",
      },
      {
        text: "Insert a `spin_loop()` hint in the reader, which flushes the store buffer between polls",
        whyTempting:
          "`spin_loop` is the right thing to add to a spin wait, and it does nothing at all for ordering.",
      },
    ],
    correct: 0,
    explanation:
      "Release on the store and Acquire on the load create the happens-before edge that makes the earlier write to `data` visible. x86 gives you most of that for free in hardware, which is why the bug only appears on a weaker model.",
  },
  {
    concept: "rust-atomic-ordering",
    difficulty: "hard",
    prompt:
      "`if !init.load(Acquire) { let v = build(); shared.store(v); init.store(true, Release); }` runs on several threads at once. What does this ship?",
    options: [
      {
        text: "Several threads pass the check together, each builds and stores, and the last store wins while earlier values leak",
      },
      {
        text: "Correct behaviour, since the Acquire load and Release store pair to make the whole block mutually exclusive",
        whyTempting:
          "Acquire and Release are exactly the right orderings here, which makes the block look properly synchronised.",
      },
      {
        text: "A deadlock once two threads observe each other's partial writes and both spin on `init`",
        whyTempting:
          "Lock-free code does deadlock in real ways, so it is a fair guess for what goes wrong.",
      },
      {
        text: "Correct behaviour on x86 and a torn read of `shared` on ARM, since only the flag was ordered",
        whyTempting:
          "Ordering-only-the-flag really is the bug in the neighbouring question, and the shape is nearly identical.",
      },
    ],
    correct: 0,
    explanation:
      "Ordering says when writes become visible and never makes a read-then-write sequence exclusive. Use `compare_exchange` so exactly one thread wins the transition, or a `OnceLock` and let the standard library hold the invariant.",
  },

  // ── rust-option-combinators ──────────────────────────────────────────────
  {
    concept: "rust-option-combinators",
    difficulty: "easy",
    prompt:
      "`config.timeout.unwrap_or(default_timeout())` where `default_timeout` reads a file. The config has a timeout set. Does the file get read?",
    options: [
      {
        text: "Yes: `unwrap_or` takes a value, so the argument is evaluated before the call whatever the Option holds",
      },
      {
        text: "No, since `unwrap_or` is short-circuiting in the same way `||` is",
        whyTempting:
          "Short-circuiting is what the code is clearly reaching for, and `unwrap_or_else` provides exactly it.",
      },
      {
        text: "No, because the compiler moves an argument with side effects into the Drop path when it is unused",
        whyTempting:
          "Rust does elide unused work in optimised builds, but never in a way that changes observable side effects.",
      },
      {
        text: "Yes, and `unwrap_or_default` would have the same cost since it also builds a value first",
        whyTempting:
          "`unwrap_or_default` really does construct one, though only on the None path, which is the difference.",
      },
    ],
    correct: 0,
    explanation:
      "Rust evaluates arguments before the call, so `unwrap_or` always pays for its fallback. Use `unwrap_or_else(|| ...)` whenever the fallback costs anything.",
  },
  {
    concept: "rust-option-combinators",
    difficulty: "medium",
    prompt:
      "What is the difference between `opt.map(f)` and `opt.and_then(f)`?",
    options: [
      {
        text: "`map` wraps f's result in Some and `and_then` expects f to return an Option already, so it does not double-wrap",
      },
      {
        text: "`map` borrows the Option and `and_then` consumes it, which is why chaining needs and_then",
        whyTempting:
          "Ownership is genuinely the difference between several Option method pairs, so it is a reasonable guess.",
      },
      {
        text: "`map` is lazy and `and_then` runs immediately, which matters when f has a side effect",
        whyTempting:
          "Laziness distinguishes plenty of Rust APIs, and iterator adapters really do behave this way.",
      },
      {
        text: "`and_then` short-circuits on None and `map` calls f with the unit value, so map always runs f",
        whyTempting:
          "Both actually short-circuit on None, and this states a real difference that does not exist between them.",
      },
    ],
    correct: 0,
    explanation:
      "`map` is for a function returning a plain value and `and_then` is for one returning another Option, which is why `and_then` is the flat-mapping one. Using `map` where `and_then` belongs gives you `Option<Option<T>>` and a compile error that names the real mistake.",
  },
  {
    concept: "rust-option-combinators",
    difficulty: "hard",
    prompt:
      "`entry.kind.is_some_and(|k| k == Reftable)` replaces `entry.kind == Some(Reftable)`. Beyond style, what does the rewrite change?",
    options: [
      {
        text: "It drops the `PartialEq` requirement on the Option itself and compares only the inner value, which matters once kind stops being comparable",
      },
      {
        text: "It makes None compare equal rather than unequal, which is why the two forms disagree on an absent kind",
        whyTempting:
          "The None case is the right thing to check, and both forms give false there, so this inverts a real concern.",
      },
      {
        text: "It borrows rather than moving, so `entry` stays usable afterwards where the comparison consumed it",
        whyTempting:
          "`is_some_and` genuinely takes self by value, which makes the ownership story sound like the answer.",
      },
      {
        text: "It evaluates the closure even on None, so a side effect inside it now runs unconditionally",
        whyTempting:
          "Unconditional evaluation is exactly the `unwrap_or` trap one question earlier, applied where it does not hold.",
      },
    ],
    correct: 0,
    explanation:
      "Both forms give the same answer for every input, including None. The difference is what they require of the types: comparing Options needs `PartialEq` on the Option, and the closure form only needs it on what is inside.",
  },

  // ── rust-match-exhaustive ────────────────────────────────────────────────
  {
    concept: "rust-match-exhaustive",
    difficulty: "easy",
    prompt:
      "A match over an enum ends with `_ => {}`. A colleague adds a fifth variant to the enum. What does the compiler say about this match?",
    options: [
      {
        text: "Nothing: the catch-all arm covers the new variant, so the match compiles and silently does nothing for it",
      },
      {
        text: "An error, since exhaustiveness is checked against the enum's variant list rather than the arms present",
        whyTempting:
          "It is the guarantee people rely on Rust for, and it holds for every match that has no catch-all.",
      },
      {
        text: "A warning about an unreachable pattern, because the catch-all now shadows a variant that could be named",
        whyTempting:
          "Unreachable-pattern warnings are real, and they fire when a catch-all sits above a specific arm.",
      },
      {
        text: "Nothing, and the new variant takes the first arm instead, since `_` binds only after all others fail to parse",
        whyTempting:
          "Arm order does matter and the first-match rule is real, so the mechanism named here is half correct.",
      },
    ],
    correct: 0,
    explanation:
      "`_` makes a match exhaustive by definition, which turns off the check that would have found every place needing an update. List the variants when adding one should break the build.",
  },
  {
    concept: "rust-match-exhaustive",
    difficulty: "medium",
    prompt:
      "You want a match to keep compiling for the variants you handle and fail the build when a new one appears. Which arm gives you that?",
    options: [
      {
        text: "No catch-all arm at all, listing every variant you handle by name",
      },
      {
        text: "`_ => unreachable!()`, which turns the unhandled case into a loud failure",
        whyTempting:
          "It is loud, and it moves the failure from silence to a panic, which feels like the safe version.",
      },
      {
        text: "`other => panic!(\"unhandled {other:?}\")`, which names the variant in the message",
        whyTempting:
          "Naming the variant is a genuine improvement over `unreachable!()` and is worth doing where a catch-all is needed.",
      },
      {
        text: "`_ => Default::default()`, which is total and keeps the return type honest",
        whyTempting:
          "Totality is the goal, and a default really does keep every path returning something valid.",
      },
    ],
    correct: 0,
    explanation:
      "Exhaustiveness checking is the feature, and every form of catch-all disables it. The panicking arms move the failure from compile time to whenever that variant first shows up in production.",
  },
  {
    concept: "rust-match-exhaustive",
    difficulty: "hard",
    prompt:
      "A public enum in a library is marked `#[non_exhaustive]`. What does that do to a downstream crate's match on it?",
    options: [
      {
        text: "It forces the downstream match to include a catch-all, so adding a variant later is no longer a breaking change",
      },
      {
        text: "It stops the downstream crate matching on it at all, so the enum has to be inspected through accessor methods",
        whyTempting:
          "It is the stricter design that would achieve the same goal, and some libraries do use opaque types for this.",
      },
      {
        text: "It makes the exhaustiveness check advisory, so an incomplete match warns rather than failing",
        whyTempting:
          "A warning-not-error escape hatch is a plausible-sounding design and matches how some lints are staged.",
      },
      {
        text: "Nothing across crates: it only affects construction, since a match reads a value that already exists",
        whyTempting:
          "`#[non_exhaustive]` does restrict struct literal construction, so half of what it does is exactly this.",
      },
    ],
    correct: 0,
    explanation:
      "`#[non_exhaustive]` moves the cost of a new variant from downstream compile errors to a catch-all everyone has to write. It is the library author choosing their own freedom to extend over their users' exhaustiveness guarantee.",
  },
];
