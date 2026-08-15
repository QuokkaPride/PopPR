import type { BankEntry } from "./types.js";

/**
 * Java.
 *
 * Measured against 82 merged PRs across spring-boot, spring-framework,
 * elasticsearch and kafka. The median Java file in a merged PR adds four lines,
 * so these lean on the constructs that appear in almost every diff: collection
 * factories, null boundaries, cleanup, exceptions and equality.
 */
export const JAVA_ENTRIES: BankEntry[] = [
  // ── java-collection-immutability ─────────────────────────────────────────
  {
    concept: "java-collection-immutability",
    difficulty: "easy",
    prompt:
      "A getter returns `List.of(a, b, c)`. A caller in another module does `result.add(d)`. What happens, and when do you find out?",
    options: [
      {
        text: "`UnsupportedOperationException` at runtime, on whichever code path first calls add",
      },
      {
        text: "A compile error, since `List.of` returns an `ImmutableList` type with no add method",
        whyTempting:
          "It is what the design would look like if immutability were in the type, and Guava's names suggest it.",
      },
      {
        text: "The add succeeds on a defensive copy, so the caller's list grows and the getter's does not",
        whyTempting:
          "Copy-on-write collections behave this way, and `List.copyOf` in the same family reinforces the idea.",
      },
      {
        text: "`IllegalStateException`, because the list is sealed after construction rather than unmodifiable",
        whyTempting:
          "The two exception names are interchangeable in most people's memory, and both signal a wrong-state call.",
      },
    ],
    correct: 0,
    explanation:
      "`List.of` returns an unmodifiable list that throws on every mutator, and the type is still `List`, so nothing is checked at compile time. Return `List.copyOf(mutable)` when you mean it, and document it, because the signature cannot.",
  },
  {
    concept: "java-collection-immutability",
    difficulty: "medium",
    prompt:
      "`Arrays.asList(a, b)` and `List.of(a, b)` are both described as fixed-size lists. Which statement separates them?",
    options: [
      {
        text: "`Arrays.asList` allows `set` and writes through to the array, and `List.of` rejects set and rejects null elements",
      },
      {
        text: "`Arrays.asList` copies the array and `List.of` wraps it, so mutating the array shows through only in List.of",
        whyTempting:
          "It gets the write-through relationship exactly backwards, which is what makes it read as a real distinction.",
      },
      {
        text: "`Arrays.asList` is unmodifiable and `List.of` is immutable, which differs only in whether the source can change",
        whyTempting:
          "That distinction is genuine and worth knowing, and it describes `unmodifiableList` rather than these two.",
      },
      {
        text: "`Arrays.asList` returns null for an empty input and `List.of` returns an empty list",
        whyTempting:
          "Null-versus-empty returns are a real API smell, so attributing one to an older API is an easy assumption.",
      },
    ],
    correct: 0,
    explanation:
      "`Arrays.asList` is a live view over the array: `set` works, `add` throws, and nulls are fine. `List.of` refuses every mutation and throws NPE on a null element, which turns a tolerated bug into a loud one at construction.",
  },
  {
    concept: "java-collection-immutability",
    difficulty: "hard",
    prompt:
      "A method returns `Collections.unmodifiableList(this.items)` and the caller stores that reference. Later `this.items.add(x)` runs. What does the caller see?",
    options: [
      {
        text: "The new element, since the wrapper is a view over the same list rather than a snapshot",
      },
      {
        text: "The original three elements, because the wrapper copied on construction",
        whyTempting:
          "`List.copyOf` does snapshot, and the two are close enough in purpose that people expect the same semantics.",
      },
      {
        text: "A `ConcurrentModificationException` on its next iteration, whether or not threads are involved",
        whyTempting:
          "A structural modification during iteration really does throw this, so it fires on a genuine neighbouring case.",
      },
      {
        text: "The new element only if the list was an ArrayList, since LinkedList views are detached",
        whyTempting:
          "Implementations do differ in iteration and copying costs, which makes an implementation-dependent answer feel safe.",
      },
    ],
    correct: 0,
    explanation:
      "`unmodifiableList` blocks mutation through the wrapper and leaves the backing list writable by anyone who holds it. For a real snapshot use `List.copyOf`, which copies once and cannot be changed from either side.",
  },

  // ── java-nullability-boundary ────────────────────────────────────────────
  {
    concept: "java-nullability-boundary",
    difficulty: "easy",
    prompt:
      "`long size = sizes.get(key);` where `sizes` is a `Map<String, Long>` and the key is absent. What is thrown, and what does the stack trace point at?",
    options: [
      {
        text: "NullPointerException on that line, with no null visible in the source, because unboxing a null Long dereferences it",
      },
      {
        text: "Nothing: the missing key unboxes to 0L, which is the zero value for a long",
        whyTempting:
          "It is what a primitive default suggests, and what `getOrDefault(key, 0L)` in the same file would do.",
      },
      {
        text: "NoSuchElementException, since a primitive target forces the map to treat absence as a failure",
        whyTempting:
          "`Optional.get` throws this on absence, and the two absence stories blur together under time pressure.",
      },
      {
        text: "ClassCastException, because the boxed Long cannot be narrowed to a primitive without a cast",
        whyTempting:
          "Boxing conversions are a real source of ClassCastException when generics erase, so the family is right.",
      },
    ],
    correct: 0,
    explanation:
      "Auto-unboxing compiles to `.longValue()`, so a missing key becomes an NPE on a line containing no literal null. Helpful modern JVMs name the expression, and older ones tell you only the line number.",
  },
  {
    concept: "java-nullability-boundary",
    difficulty: "medium",
    prompt:
      "A constructor adds `Objects.requireNonNull(appendable, \"'appendable' must not be null\")`. A colleague calls it redundant because the field would throw on first use anyway. What does the check actually buy?",
    options: [
      {
        text: "The failure names the caller that passed the null, rather than surfacing three layers and one thread later",
      },
      {
        text: "It converts the failure into a checked exception, so callers are forced to handle it",
        whyTempting:
          "Making null handling explicit is the goal, and checked exceptions are the language's usual way to force it.",
      },
      {
        text: "It lets the JIT elide later null checks on that field, which is where the performance argument comes from",
        whyTempting:
          "The JIT does eliminate redundant null checks, so this is a true fact recruited for the wrong purpose.",
      },
      {
        text: "It marks the parameter non-null for static analysis, which is what the message argument is read for",
        whyTempting:
          "Analysers really do learn from requireNonNull, and the message is genuinely used, just not for that.",
      },
    ],
    correct: 0,
    explanation:
      "Validating at the boundary turns a null into an exception at the point of the mistake, while a stored null shows up wherever it is finally dereferenced. Distance between cause and symptom is what makes null bugs expensive.",
  },
  {
    concept: "java-nullability-boundary",
    difficulty: "hard",
    prompt:
      "`Optional<Config> c = load(); return c.orElse(expensiveDefault());` Profiling shows `expensiveDefault` running on every call, including the ones where the config exists. Why?",
    options: [
      {
        text: "`orElse` takes a value, so its argument is evaluated before the call regardless of whether the Optional is present",
      },
      {
        text: "`orElse` unwraps eagerly and discards the Optional's own value, so both branches are computed and one is dropped",
        whyTempting:
          "It correctly predicts the observed cost, then explains it with a discard step that does not exist.",
      },
      {
        text: "`load()` returns `Optional.of(null)`, which is empty, so the default path always runs",
        whyTempting:
          "`Optional.of(null)` throwing versus `ofNullable` returning empty is a real distinction one step away.",
      },
      {
        text: "The JIT hoists the argument out of the branch once the call site is monomorphic, which is a known inlining hazard",
        whyTempting:
          "It sounds like a plausible optimisation story, and blaming the JIT is a comfortable landing spot.",
      },
    ],
    correct: 0,
    explanation:
      "Java evaluates arguments before the call, so `orElse` costs its argument every time. Use `orElseGet(this::expensiveDefault)`, which takes a supplier and runs it only when the Optional is empty.",
  },

  // ── java-cleanup-on-throw ────────────────────────────────────────────────
  {
    concept: "java-cleanup-on-throw",
    difficulty: "easy",
    prompt:
      "A thread-cached buffer is reset by the method that reads it, at the end of the happy path. An encode throws partway through. Which request sees the damage?",
    options: [
      {
        text: "The next unrelated request served by that same thread, which finds the buffer half-written",
      },
      {
        text: "The failing request, which retries against its own dirty buffer and produces truncated output",
        whyTempting:
          "The failing request is where attention goes, and a retry on the same thread would in fact see it.",
      },
      {
        text: "No request: the exception unwinds the thread's stack, and thread-local state is cleared with it",
        whyTempting:
          "Stack unwinding does discard locals, and a ThreadLocal sounds close enough to a local to inherit that.",
      },
      {
        text: "Every request afterwards, since a corrupt shared buffer is never reset once the reset path is skipped",
        whyTempting:
          "It is the right worry with the wrong blast radius, and it is what a truly shared buffer would give you.",
      },
    ],
    correct: 0,
    explanation:
      "Cleanup on the happy path only is cleanup that skips every failure, and a pooled thread carries the mess to whatever it serves next. Put the reset in a `finally` so the invariant holds on both exits.",
  },
  {
    concept: "java-cleanup-on-throw",
    difficulty: "medium",
    prompt:
      "`try (var in = open(a)) { var out = open(b); copy(in, out); }`. `copy` throws. Which resources are closed?",
    options: [
      {
        text: "Only `in`: try-with-resources closes what its header declares, and `out` was acquired in the body",
      },
      {
        text: "Both, because the block tracks every AutoCloseable created inside it and closes them in reverse order",
        whyTempting:
          "Reverse-order closing is exactly what it does for the header, so extending that to the body feels consistent.",
      },
      {
        text: "Neither, since an exception from the body suppresses the close calls and rethrows immediately",
        whyTempting:
          "Suppression is real and does appear here, but it works the other way: close throws are attached to the body's exception.",
      },
      {
        text: "Only `out`, because the most recently acquired resource is closed first and the header's close is skipped on throw",
        whyTempting:
          "Reverse order is right, so half the sentence describes the actual mechanism accurately.",
      },
    ],
    correct: 0,
    explanation:
      "Only resources declared in the try header are managed, so `out` leaks on every failure path and nowhere else. Declare both in the header: `try (var in = open(a); var out = open(b))`.",
  },
  {
    concept: "java-cleanup-on-throw",
    difficulty: "hard",
    prompt:
      "A method body throws `IOException`, and the `close()` of its try-with-resources then throws `SocketException`. What does the caller catch?",
    options: [
      {
        text: "The IOException, with the SocketException attached to it and readable through `getSuppressed()`",
      },
      {
        text: "The SocketException, since it was thrown last and replaces the in-flight exception",
        whyTempting:
          "A throw from a `finally` block really does replace the original, which is the behaviour this construct was built to avoid.",
      },
      {
        text: "Both, wrapped together in a `CompositeException` created by the compiler",
        whyTempting:
          "Some frameworks do aggregate exactly this way, and it is a reasonable design for the situation.",
      },
      {
        text: "The IOException, with the close failure discarded, which is why close-on-error should be logged by hand",
        whyTempting:
          "The primary exception surviving is correct, and losing the secondary is what plain try-finally would do.",
      },
    ],
    correct: 0,
    explanation:
      "Try-with-resources keeps the body's exception as primary and suppresses the close failure onto it, which is the reason to prefer it over a hand-written finally. Anything reading only `getMessage()` will never see the suppressed one.",
  },

  // ── java-instanceof-narrowing ────────────────────────────────────────────
  {
    concept: "java-instanceof-narrowing",
    difficulty: "easy",
    prompt:
      "An exception dispatcher checks `if (e instanceof Exception)` before `else if (e instanceof TimeoutException)`. Timeouts are logged as unknown rather than retried. What is the rule?",
    options: [
      {
        text: "`instanceof` matches subtypes, so the general branch swallows the specific one and the compiler flags nothing",
      },
      {
        text: "`instanceof` on a checked exception is evaluated against the declared type, so the runtime type is ignored",
        whyTempting:
          "Declared-versus-runtime type is a real distinction, and it does govern overload resolution.",
      },
      {
        text: "The second branch is unreachable code, so the compiler removed it and the log line is a fallback",
        whyTempting:
          "Unreachable code is a compile error in Java for some constructs, which makes this feel almost right.",
      },
      {
        text: "`TimeoutException` is unchecked, so it never reaches a chain that starts by testing `Exception`",
        whyTempting:
          "Checked versus unchecked genuinely changes what can arrive where, so it is a fair thing to reach for.",
      },
    ],
    correct: 0,
    explanation:
      "An `instanceof` chain is ordered, and every subtype answers true to its supertype's test. Order specific before general, and a `switch` over sealed types is what gets you a compiler check instead.",
  },
  {
    concept: "java-instanceof-narrowing",
    difficulty: "medium",
    prompt:
      "`if (value instanceof String s) { use(s); } else { throw new IllegalArgumentException(); }`. `value` is null. Which branch runs?",
    options: [
      {
        text: "The else branch, because `null instanceof String` is false rather than an NPE",
      },
      {
        text: "The if branch, with `s` bound to null, since the pattern binds before the test completes",
        whyTempting:
          "Binding and testing look like one operation in the syntax, so treating them as simultaneous is natural.",
      },
      {
        text: "Neither: evaluating `instanceof` on null throws NullPointerException",
        whyTempting:
          "Most operators do deref, so expecting instanceof to join them is the default assumption people carry in.",
      },
      {
        text: "The else branch, and the pattern variable stays in scope afterwards holding null",
        whyTempting:
          "Scoping of pattern variables really is unusual, and flow scoping is genuinely worth checking.",
      },
    ],
    correct: 0,
    explanation:
      "`null instanceof T` is false for every T, which is deliberate and often what you want. It also means a pattern branch silently skips nulls that the author expected to blow up loudly.",
  },
  {
    concept: "java-instanceof-narrowing",
    difficulty: "hard",
    prompt:
      "A codebase replaces an `instanceof` chain over a class hierarchy with `switch (shape) { case Circle c -> ...; case Square s -> ...; }` and gets a compile error about exhaustiveness. What changed?",
    options: [
      {
        text: "A pattern switch on a non-sealed type must handle every possibility, so it needs a default or the type must be sealed",
      },
      {
        text: "Pattern switches require the selector to be an enum or a sealed interface, so a class hierarchy cannot be switched on at all",
        whyTempting:
          "Enums and sealed types are the headline cases in the release notes, so the restriction sounds like the rule.",
      },
      {
        text: "Case labels must be constants, so a type pattern is only valid inside an `if` and never in a switch",
        whyTempting:
          "That was true before pattern matching landed, which makes it a correct answer to an older version of Java.",
      },
      {
        text: "Arrow cases do not fall through, so the compiler cannot prove the last case is reachable without a yield",
        whyTempting:
          "Arrow versus colon really does change fallthrough and reachability rules, so the vocabulary fits.",
      },
    ],
    correct: 0,
    explanation:
      "A pattern switch has to cover the selector type, and only a sealed hierarchy lets the compiler prove the listed cases are all of them. That check is the entire reason to prefer it: adding a subtype then breaks the build rather than silently taking a default.",
  },

  // ── java-exception-wrapping ──────────────────────────────────────────────
  {
    concept: "java-exception-wrapping",
    difficulty: "easy",
    prompt:
      "A helper catches `IOException` and rethrows `new IllegalStateException(ex.getMessage())`. What did the caller lose?",
    options: [
      {
        text: "The cause chain, so the stack frames identifying where the IO failed are gone from the trace",
      },
      {
        text: "Nothing beyond the type, since `getMessage` carries the original text and the frames are captured at throw",
        whyTempting:
          "The message really does survive, and a fresh throw does capture frames, just not the ones that matter.",
      },
      {
        text: "The ability to catch it at all, because an unchecked exception thrown from a checked-throwing method is not declarable",
        whyTempting:
          "Checked and unchecked declaration rules are fiddly enough that this sounds like a real constraint.",
      },
      {
        text: "Suppressed exceptions attached to the original, which do not transfer to a new instance",
        whyTempting:
          "Suppressed exceptions are indeed lost here, so this is a true consequence ranked below the main one.",
      },
    ],
    correct: 0,
    explanation:
      "`new X(ex.getMessage())` keeps the text and drops the cause, so the trace starts at the helper and says nothing about the socket or the file. Pass the exception itself: `new IllegalStateException(ex)`.",
  },
  {
    concept: "java-exception-wrapping",
    difficulty: "medium",
    prompt:
      "A utility is changed to wrap everything it catches in `RuntimeException`. A caller two frames up has `catch (IOException e) { retry(); }`. What happens to that retry?",
    options: [
      {
        text: "It stops firing, and the failure escapes as a 500 that no test covered",
      },
      {
        text: "It still fires, since the wrapped IOException is matched by cause when no direct handler applies",
        whyTempting:
          "Cause-based matching is what several frameworks add on top, so expecting it from the language is common.",
      },
      {
        text: "It fires for the first failure and then stops, because the rethrown RuntimeException is cached per call site",
        whyTempting:
          "The JVM does reuse pre-allocated stackless exceptions in hot paths, which is a real and surprising behaviour.",
      },
      {
        text: "It fires, but with an empty stack trace, which is why wrapping is discouraged in library code",
        whyTempting:
          "Stackless exceptions do appear under `-XX:-OmitStackTraceInFastThrow`, so the symptom is a real one.",
      },
    ],
    correct: 0,
    explanation:
      "`catch` matches on the thrown type and never inspects causes, so changing the wrapper type deletes a handler in code you did not edit. The compiler cannot see it either, which is what makes wrapping a public-API decision.",
  },
  {
    concept: "java-exception-wrapping",
    difficulty: "hard",
    prompt:
      "A method has `catch (IOException | RuntimeException ex) { throw ex; }` above `catch (Exception ex) { throw new IllegalStateException(ex); }`. What is the first clause for, given it appears to do nothing?",
    options: [
      {
        text: "It keeps those two types escaping unchanged, so callers that catch IOException still see it while everything else is wrapped",
      },
      {
        text: "It is required by the compiler, which rejects a broad catch that would shadow a narrower one declared by the method",
        whyTempting:
          "Java does reject unreachable catch clauses in some orders, so a compiler-driven explanation is plausible.",
      },
      {
        text: "It resets the exception's suppressed list, which the wrapping clause below would otherwise inherit",
        whyTempting:
          "Suppressed lists really do travel with an exception, so a clause that manages them is a coherent invention.",
      },
      {
        text: "It converts the multi-catch union to the least upper bound, which is what makes the rethrow declarable",
        whyTempting:
          "Precise rethrow really does infer from the union rather than the LUB, so the topic is exactly right.",
      },
    ],
    correct: 0,
    explanation:
      "A pass-through clause above a wrapping clause is how you say which exception types are part of your contract. Without it, an upstream `catch (IOException e)` stops matching the moment the helper starts wrapping.",
  },

  // ── java-object-equality ─────────────────────────────────────────────────
  {
    concept: "java-object-equality",
    difficulty: "easy",
    prompt:
      "`if (status == \"ACTIVE\")` passes every unit test and fails once the status arrives in a parsed request body. What is the difference between the two cases?",
    options: [
      {
        text: "Literals are interned to one shared instance, and a parsed string is a fresh object, so reference comparison fails",
      },
      {
        text: "The parsed string carries trailing whitespace, which `==` compares and `equals` would trim",
        whyTempting:
          "Whitespace really does cause this class of bug, and `equals` would fail on it too, which is the giveaway.",
      },
      {
        text: "`==` on strings compares by value up to 64 characters and by reference beyond, matching the interning cache limit",
        whyTempting:
          "The Integer cache genuinely has a 127 boundary, so a length threshold for strings sounds like the same idea.",
      },
      {
        text: "The parsed value is a `CharSequence` rather than a `String`, so `==` compares across unrelated types",
        whyTempting:
          "Parsers do hand back CharSequence in places, and mixing the two is a real source of comparison bugs.",
      },
    ],
    correct: 0,
    explanation:
      "`==` asks whether two references point at the same object, and the compiler interns literals so they do. Use `equals`, or `Objects.equals` when either side may be null.",
  },
  {
    concept: "java-object-equality",
    difficulty: "medium",
    prompt:
      "A `record Key(String name, byte[] salt)` is used as a `HashMap` key. Lookups with a freshly built, field-identical Key miss. Why?",
    options: [
      {
        text: "The generated equals compares the array by reference, so two arrays with the same bytes are not equal",
      },
      {
        text: "Records generate equals and not hashCode, so the default identity hash sends equal keys to different buckets",
        whyTempting:
          "The equals-without-hashCode failure is the classic version of this bug, and records do generate both.",
      },
      {
        text: "Byte arrays are mutable, so the record's hashCode is computed once at construction and goes stale",
        whyTempting:
          "Mutating a key after insertion really does break lookups, which is a genuine neighbouring hazard.",
      },
      {
        text: "Records are compared component by component with `==`, including the String, so only interned names match",
        whyTempting:
          "It correctly says components are compared individually, then applies `==` to every one of them.",
      },
    ],
    correct: 0,
    explanation:
      "A record's generated equals uses `equals` on reference components, and `byte[].equals` is identity. Wrap the bytes in a type with value semantics, or store a `List<Byte>` or a string encoding.",
  },
  {
    concept: "java-object-equality",
    difficulty: "hard",
    prompt:
      "`Integer a = 127, b = 127;` gives `a == b` true, and `Integer a = 128, b = 128;` gives false. What is the rule underneath?",
    options: [
      {
        text: "Autoboxing goes through a cache that covers -128 to 127, so small values share an instance and larger ones do not",
      },
      {
        text: "Values up to 127 fit a byte and are stored inline in the reference, so no object exists to compare",
        whyTempting:
          "Tagged pointers really are how some runtimes represent small integers, and the boundary matches a byte.",
      },
      {
        text: "`==` unboxes when both operands are Integer, and the JIT stops doing so above the byte range",
        whyTempting:
          "Mixed Integer and int comparison genuinely does unbox, so the rule is real and applied one case too widely.",
      },
      {
        text: "The compiler folds equal constants into one field when they fit an immediate operand, which stops at 127",
        whyTempting:
          "Constant folding is real, and the observation is genuinely compile-time visible in this example.",
      },
    ],
    correct: 0,
    explanation:
      "`Integer.valueOf` returns cached instances in a fixed low range, and allocates outside it, which makes `==` correct for exactly the values you test with. Compare boxed numbers with `equals` and let the cache be an implementation detail.",
  },

  // ── java-catch-broad-exception ───────────────────────────────────────────
  {
    concept: "java-catch-broad-exception",
    difficulty: "easy",
    prompt:
      "A loop body is wrapped in `catch (Exception e) { log.warn(\"item failed\", e); }` to make the batch robust. A null-pointer bug is introduced inside the loop. What does the batch report?",
    options: [
      {
        text: "Success, with one warning per item, since a defect and a legitimate item failure look identical here",
      },
      {
        text: "Failure, because a NullPointerException is an Error rather than an Exception and so escapes the catch",
        whyTempting:
          "The Error and Exception split is real, and NPE sits on the side people most often misremember.",
      },
      {
        text: "Success for the items before the bug and failure after, because the catch is consumed on first use",
        whyTempting:
          "It fits the symptom of a partially processed batch, which is what you often see for unrelated reasons.",
      },
      {
        text: "Failure on the first item, since logging with a cause rethrows once the logger's error handler runs",
        whyTempting:
          "Some logging configurations really do rethrow on error, so blaming the logger is not baseless.",
      },
    ],
    correct: 0,
    explanation:
      "A broad catch cannot distinguish an expected item-level failure from a defect in your own code, so the bug degrades into a warning nobody reads. Catch the specific exceptions you can handle and let the rest fail loudly.",
  },
  {
    concept: "java-catch-broad-exception",
    difficulty: "medium",
    prompt:
      "A worker's `catch (Exception e) { log.warn(e); }` catches an `InterruptedException` during shutdown. The pool then hangs on close. What was skipped?",
    options: [
      {
        text: "Restoring the interrupt flag, which the throw cleared, so nothing downstream can see that shutdown was requested",
      },
      {
        text: "Rethrowing as an unchecked exception, which is the only way to leave a blocking call on interrupt",
        whyTempting:
          "Rethrowing is often right, and it does end the task, so this fixes the symptom by the wrong mechanism.",
      },
      {
        text: "Calling `Thread.currentThread().stop()`, which is what actually terminates a thread that ignored an interrupt",
        whyTempting:
          "`stop()` did exist for this and is now removed, so it survives in a lot of remembered advice.",
      },
      {
        text: "Draining the queue, since an interrupt cancels the current task and leaves queued tasks pending forever",
        whyTempting:
          "Shutdown really does have a drain-versus-cancel decision, which is a genuine part of the same problem.",
      },
    ],
    correct: 0,
    explanation:
      "Throwing `InterruptedException` clears the interrupt status, so swallowing it hides shutdown from every later blocking call. Either rethrow it or call `Thread.currentThread().interrupt()` before continuing.",
  },
  {
    concept: "java-catch-broad-exception",
    difficulty: "hard",
    prompt:
      "Accounting code catches `CircuitBreakingException` to release a reservation, and separately catches `Exception` to log it as a bug and force the request through. Why is the second clause defensible when a blanket catch usually is not?",
    options: [
      {
        text: "The two clauses mean different things: one is an expected signal that is handled, and the other is documented as a defect that must not hang the request",
      },
      {
        text: "Catching Exception is safe whenever a narrower clause sits above it, since the narrow one takes every case that matters",
        whyTempting:
          "Ordering does matter and does help, which makes it sound like the ordering alone earns the broad catch.",
      },
      {
        text: "It rethrows after logging, so nothing is actually swallowed and the broad clause is a pure observer",
        whyTempting:
          "Log-and-rethrow is a legitimate pattern, and it would be a good answer if that were what this code did.",
      },
      {
        text: "Circuit breaker accounting runs off the request thread, so a swallowed exception there cannot affect correctness",
        whyTempting:
          "Thread boundaries do change what a swallowed exception costs, so the reasoning is sound in other contexts.",
      },
    ],
    correct: 0,
    explanation:
      "A broad catch is defensible when the code states what it believes reaching it means and what it does about it. Here reaching the second clause is a breaker bug, and hanging every multi-search is worse than continuing with a logged defect.",
  },

  // ── java-shared-mutable-state ────────────────────────────────────────────
  {
    concept: "java-shared-mutable-state",
    difficulty: "easy",
    prompt:
      "`if (pending.get() == 0) { finish(); }` where `pending` is an `AtomicInteger` decremented by each completing thread. How often does `finish` run?",
    options: [
      {
        text: "Zero, one or several times, since the read and the branch are separate steps that any thread can interleave with",
      },
      {
        text: "Exactly once, because reads of an AtomicInteger are linearised and only one thread can observe the zero",
        whyTempting:
          "Each read really is linearised, so the guarantee is real and just does not extend to the branch after it.",
      },
      {
        text: "Once per thread that reaches zero, which is at most the number of threads and never fewer than one",
        whyTempting:
          "It correctly senses the race and then assumes a floor of one, which nothing here provides.",
      },
      {
        text: "Exactly once, provided `finish` is synchronized, since the monitor serialises the whole check",
        whyTempting:
          "Synchronizing `finish` does serialise its body, and people reach for it as the fix without noticing the check is outside.",
      },
    ],
    correct: 0,
    explanation:
      "Atomic types make each operation atomic and say nothing about a sequence of them. `if (pending.decrementAndGet() == 0)` makes the decrement and the test one operation, which gives exactly one winner.",
  },
  {
    concept: "java-shared-mutable-state",
    difficulty: "medium",
    prompt:
      "A servlet stores per-request context in a `ThreadLocal` and clears it at the end of the handler. One handler returns early on a validation failure. What is the consequence in a pooled server?",
    options: [
      {
        text: "The next request on that thread inherits the previous user's context, because pooled threads outlive requests",
      },
      {
        text: "Nothing: a ThreadLocal is cleared when the request thread returns to the pool, which is what thread pooling means",
        whyTempting:
          "It is what pooling ought to do, and several frameworks add exactly this cleanup so people see it work.",
      },
      {
        text: "The entry is collected on the next GC, since ThreadLocalMap holds its keys weakly and the request object is gone",
        whyTempting:
          "The keys really are weak references, which makes this a precise statement about the wrong half of the entry.",
      },
      {
        text: "A memory leak with no correctness impact, since a stale context is overwritten by the next `set` before any read",
        whyTempting:
          "The leak is genuine, and an unconditional set at the top of every handler would make the rest true.",
      },
    ],
    correct: 0,
    explanation:
      "A ThreadLocal is scoped to the thread and not the request, so anything not cleared on every exit path leaks into unrelated work. Clear it in a `finally`, which is the only place that covers the early return.",
  },
  {
    concept: "java-shared-mutable-state",
    difficulty: "hard",
    prompt:
      "`if (!cache.containsKey(k)) { cache.put(k, build(k)); }` on a `ConcurrentHashMap` under load. `build` is expensive and registers a listener. What goes wrong?",
    options: [
      {
        text: "Several threads pass the check together, so `build` runs more than once and every extra listener stays registered",
      },
      {
        text: "`containsKey` on a ConcurrentHashMap takes a segment lock, so the threads serialise and throughput collapses",
        whyTempting:
          "Segment locking was the Java 7 implementation, and the performance story is convincing enough to accept.",
      },
      {
        text: "The map throws ConcurrentModificationException, since a put during another thread's read is a structural modification",
        whyTempting:
          "That exception is real for the non-concurrent maps, which is precisely the class this one exists to replace.",
      },
      {
        text: "Only the last `put` survives and the earlier values are dropped, so the listeners they registered leak",
        whyTempting:
          "The last put does win, and the leak is genuine, so this is the right damage attributed to the wrong step.",
      },
    ],
    correct: 0,
    explanation:
      "Each operation on a ConcurrentHashMap is atomic and check-then-act across two of them is not. `computeIfAbsent` runs the builder at most once per key, which is what the side effect requires.",
  },

  // ── java-executor-concurrency ────────────────────────────────────────────
  {
    concept: "java-executor-concurrency",
    difficulty: "easy",
    prompt:
      "A task runner is configured with concurrency 1 and an unbounded queue. Traffic bursts to ten times the drain rate for a minute. What is the failure?",
    options: [
      {
        text: "The queue grows until the heap runs out, turning a throughput shortfall into an out-of-memory kill",
      },
      {
        text: "Submissions are rejected with `RejectedExecutionException` once the runner is saturated",
        whyTempting:
          "That is what a bounded queue with an abort policy does, and it is the behaviour you actually want here.",
      },
      {
        text: "The runner raises its concurrency on its own, since a single-threaded executor grows under sustained backlog",
        whyTempting:
          "`ThreadPoolExecutor` genuinely does grow between core and max size, so the mechanism exists in the neighbourhood.",
      },
      {
        text: "Latency rises and then recovers, because tasks queued beyond the keepalive window are dropped",
        whyTempting:
          "Keepalive is a real setting on these pools, and it does govern reclamation, of idle threads rather than tasks.",
      },
    ],
    correct: 0,
    explanation:
      "An unbounded queue converts backpressure into memory growth, so the symptom arrives as a heap dump rather than a rejected request. Bound the queue and choose a rejection policy on purpose.",
  },
  {
    concept: "java-executor-concurrency",
    difficulty: "medium",
    prompt:
      "A drainer's concurrency is raised from 1 to `Math.max(1, processors / 2)`, running on the shared generic pool. Beyond the extra threads, what has changed for the code being drained?",
    options: [
      {
        text: "Tasks that used to run one at a time now overlap, so any ordering the drainer implied is gone",
      },
      {
        text: "Each task now sees a different ThreadLocal, so anything cached per thread is recomputed more often",
        whyTempting:
          "That is a genuine consequence of widening a pool, and it is a real cost, ranked below the correctness one.",
      },
      {
        text: "Task submission becomes non-blocking, since a pool with concurrency above one never makes the caller run the task",
        whyTempting:
          "`CallerRunsPolicy` is exactly this behaviour, and it is common enough to feel like a default.",
      },
      {
        text: "Exceptions now surface at submission rather than on the future, because a multi-threaded pool validates eagerly",
        whyTempting:
          "Where an exception surfaces genuinely does depend on submit versus execute, so the topic is on point.",
      },
    ],
    correct: 0,
    explanation:
      "Concurrency 1 is a serialisation guarantee that downstream code may be relying on without saying so. Raising it also borrows threads from a shared pool, which starves unrelated work using the same executor.",
  },
  {
    concept: "java-executor-concurrency",
    difficulty: "hard",
    prompt:
      "`CompletableFuture.supplyAsync(this::load).thenApply(this::transform)` with no executor argument. `load` blocks on IO for two seconds. What is the systemic risk?",
    options: [
      {
        text: "It runs on the common ForkJoinPool, sized to the core count, so blocking work there starves every other user of it",
      },
      {
        text: "`thenApply` runs on the caller's thread, so a blocking supplier makes the caller block despite the async name",
        whyTempting:
          "`thenApply` really can run on the completing or the calling thread, which is a genuine and under-known rule.",
      },
      {
        text: "Exceptions from `load` are swallowed unless a `whenComplete` is attached, so IO failures disappear",
        whyTempting:
          "An unobserved failed future really is silent, so this is a true hazard of the same API.",
      },
      {
        text: "The common pool creates a thread per submission when its workers block, so the risk is unbounded thread growth",
        whyTempting:
          "ManagedBlocker does compensate this way, which makes unbounded growth a real behaviour under other conditions.",
      },
    ],
    correct: 0,
    explanation:
      "The no-executor overloads use the common ForkJoinPool, which is sized for CPU-bound work and shared process-wide. Pass an executor you own for anything that blocks.",
  },
];
