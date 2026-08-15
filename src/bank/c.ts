import type { BankEntry } from "./types.js";

/**
 * C and C++.
 *
 * Four concepts rather than twelve, on purpose. Measured over 77 C-touching PRs
 * in redis and curl, the transferable surface of C is arithmetic, lifetime,
 * error paths and bounds, and that is close to all of it. The genuinely deep C
 * PRs are deep in ways no general bank can reach.
 */
export const C_ENTRIES: BankEntry[] = [
  // ── c-int-truncation ─────────────────────────────────────────────────────
  {
    concept: "c-int-truncation",
    difficulty: "easy",
    prompt:
      "A timeout is validated as a `long`, then stored in a struct field declared `int`. On a 64-bit Linux build, which values survive the assignment unchanged?",
    options: [
      {
        text: "Values up to INT_MAX, and anything larger keeps only its low 32 bits",
      },
      {
        text: "All of them, since the compiler promotes the field to the wider type on assignment",
        whyTempting:
          "Integer promotion is real and does widen, which is the opposite direction from what an assignment does.",
      },
      {
        text: "All of them, because a narrowing assignment without a cast is a constraint violation the compiler rejects",
        whyTempting:
          "C++ does reject narrowing in brace initialization, so the rule exists somewhere close by.",
      },
      {
        text: "Values up to INT_MAX, and anything larger saturates to INT_MAX rather than wrapping",
        whyTempting:
          "Saturation is what DSP intrinsics and some languages do, and it is the behaviour you would want.",
      },
    ],
    correct: 0,
    explanation:
      "Assigning a wider integer to a narrower one discards the high bits, and the range check that ran on the wide value no longer holds. Compilers warn under `-Wconversion`, which most projects do not enable.",
  },
  {
    concept: "c-int-truncation",
    difficulty: "medium",
    prompt:
      "`if (len - 1 < max)` where `len` is `size_t` and `max` is an `int`. `len` is 0. Does the branch run?",
    options: [
      {
        text: "No: `len - 1` wraps to SIZE_MAX, and `max` converts to the unsigned type before the comparison",
      },
      {
        text: "Yes, because `len - 1` on an unsigned zero is clamped at zero rather than wrapping",
        whyTempting:
          "Clamping is what the code clearly intends, and it is what a saturating type would do.",
      },
      {
        text: "Yes, since the usual arithmetic conversions widen both operands to a signed type large enough to hold either",
        whyTempting:
          "The conversion rules do go to the larger rank first, so this states half the rule and stops before the sign step.",
      },
      {
        text: "No, and the compiler rejects a signed and unsigned comparison without an explicit cast",
        whyTempting:
          "`-Wsign-compare` exists and fires here, which makes an outright rejection feel like the natural strong form.",
      },
    ],
    correct: 0,
    explanation:
      "Unsigned arithmetic wraps by definition, and mixing signed with unsigned converts the signed operand to unsigned. Compare before subtracting, or do the arithmetic in a signed type wide enough for both.",
  },
  {
    concept: "c-int-truncation",
    difficulty: "hard",
    prompt:
      "Code computes `*ms += now_ms();` then checks `if (*ms <= 0) return OVERFLOW;` where `*ms` is a signed 64-bit value. The check passes review and fails at -O2. Why?",
    options: [
      {
        text: "Signed overflow is undefined, so the optimiser may assume the sum stayed positive and delete the check",
      },
      {
        text: "The addition is done in a wider register and truncated only on store, so the sign is correct when it is tested",
        whyTempting:
          "Wider intermediate registers really are used, and x87 excess precision made this a genuine issue for floats.",
      },
      {
        text: "`now_ms()` is not const, so the compiler reloads it and compares against a second, later reading",
        whyTempting:
          "Repeated calls to a non-const function really are a hazard, and it is a bug of the right family.",
      },
      {
        text: "The comparison against a literal 0 promotes to int, which truncates the 64-bit value before the test",
        whyTempting:
          "Promotion truncating a value is exactly the neighbouring concept, applied to a case where it does not happen.",
      },
    ],
    correct: 0,
    explanation:
      "A post-hoc sign check for signed overflow assumes wrapping, and the standard says overflow cannot happen, so the compiler is entitled to remove the branch. Do the arithmetic in unsigned, or use `__builtin_add_overflow`.",
  },

  // ── c-iteration-invalidation ─────────────────────────────────────────────
  {
    concept: "c-iteration-invalidation",
    difficulty: "easy",
    prompt:
      "A loop walks a linked list with `for (n = head; n; n = n->next) { handle(n); }` and `handle` may free `n`. What is wrong?",
    options: [
      {
        text: "`n->next` is read after the node is freed, so the loop follows a pointer into released memory",
      },
      {
        text: "Nothing, because `n->next` was evaluated at the top of the iteration and cached in the register",
        whyTempting:
          "It looks that way from the syntax, and the increment expression really is written before the body.",
      },
      {
        text: "`handle` cannot free `n` while the loop holds a pointer to it, so the free is the bug",
        whyTempting:
          "Ownership discipline is the right lens, and the free may well be the thing to change.",
      },
      {
        text: "The loop leaks, since freeing inside the body skips the list's own teardown for that node",
        whyTempting:
          "Leaks and use-after-free are the two outcomes here, and picking the wrong one is a coin flip under pressure.",
      },
    ],
    correct: 0,
    explanation:
      "The increment runs after the body, so it dereferences whatever `handle` left behind. Save `next` before calling into the body, which is what the safe iteration macros in most C codebases do for you.",
  },
  {
    concept: "c-iteration-invalidation",
    difficulty: "medium",
    prompt:
      "A fix re-runs `de = dictFind(db->blocking_keys, key);` at the top of every iteration rather than hoisting it, with a comment that processing a client may have removed all blocked clients and freed the list. What class of bug is that avoiding?",
    options: [
      {
        text: "Use after free: the hoisted lookup would hold a pointer to a list the body can destroy",
      },
      {
        text: "A performance regression, since the hoisted version keeps a stale hash slot warm and defeats the cache",
        whyTempting:
          "Re-lookup per iteration usually is the slow choice, so justifying it on performance grounds is backwards and tempting.",
      },
      {
        text: "A rehash race, since dictFind is only valid while no other thread inserts into the dict",
        whyTempting:
          "Rehashing genuinely does invalidate iterators in this data structure, so the vocabulary is right.",
      },
      {
        text: "An ABA problem, where the list is freed and a new one allocated at the same address between iterations",
        whyTempting:
          "ABA is real and the allocator does reuse addresses, which makes this the sophisticated-sounding wrong answer.",
      },
    ],
    correct: 0,
    explanation:
      "Any callback that can remove elements can invalidate a pointer you cached before calling it. Re-looking-up costs a hash probe and buys a guarantee the hoisted version cannot make.",
  },
  {
    concept: "c-iteration-invalidation",
    difficulty: "hard",
    prompt:
      "C++: `for (auto& x : v) { if (pred(x)) v.push_back(transform(x)); }`. It works on small inputs and crashes on large ones. What decides which?",
    options: [
      {
        text: "Whether a push_back reallocates: within the existing capacity the iterators survive, and past it every one dangles",
      },
      {
        text: "Whether the vector holds trivially copyable elements, since only those are moved on growth",
        whyTempting:
          "Move-versus-copy on reallocation really does depend on the type, which makes it a genuine variable here.",
      },
      {
        text: "Whether the loop reads `x` after the push_back, since the reference is refreshed at the top of each iteration",
        whyTempting:
          "Refreshing at the top is how the range-for reads, so it sounds like it would recover from the invalidation.",
      },
      {
        text: "Whether the compiler is in debug mode, since the iterator debugging checks add the bounds test that catches it",
        whyTempting:
          "Debug iterators do catch this, which is why the crash pattern often looks mode-dependent in practice.",
      },
    ],
    correct: 0,
    explanation:
      "`push_back` invalidates every iterator and reference into the vector when it grows the buffer, and leaves them valid when it does not. That is why the bug hides until the input outgrows the initial capacity.",
  },

  // ── c-error-path-cleanup ─────────────────────────────────────────────────
  {
    concept: "c-error-path-cleanup",
    difficulty: "easy",
    prompt:
      "A function opens an fd, allocates a buffer, then returns early with an error code when a later call fails. What is the cost per failure?",
    options: [
      {
        text: "One leaked descriptor and one leaked allocation, which accumulate for as long as the process runs",
      },
      {
        text: "Nothing, since the descriptor is released when the function's stack frame is torn down",
        whyTempting:
          "It is exactly true for the local variable holding the number, which is the part you can see going away.",
      },
      {
        text: "One leaked allocation, since the kernel reclaims descriptors on any error return from a syscall boundary",
        whyTempting:
          "The kernel does clean up at process exit, and a partial-cleanup model sits plausibly between the two.",
      },
      {
        text: "Nothing on Linux, where the allocator returns the block to the OS as soon as the pointer goes out of scope",
        whyTempting:
          "Scope-based release is real in C++ with RAII, and habits from there carry into C without warning.",
      },
    ],
    correct: 0,
    explanation:
      "C has no destructors: an early return releases nothing you acquired. This is the reason for the `goto cleanup` pattern, which gives every failure path one exit that unwinds in reverse order.",
  },
  {
    concept: "c-error-path-cleanup",
    difficulty: "medium",
    prompt:
      "A cleanup block runs `close(fd); free(buf);` before `return -1`, and the caller reports the wrong reason in `strerror(errno)`. What happened?",
    options: [
      {
        text: "`close` failed and overwrote errno, so the value reported belongs to the cleanup rather than the original failure",
      },
      {
        text: "`free` clears errno on success, so the caller reads a zero and formats it as an unknown error",
        whyTempting:
          "Library functions are allowed to set errno on success, so a clearing story is not far from the real rule.",
      },
      {
        text: "errno is thread-local, and the cleanup ran on the caller's thread while the failure was on a worker",
        whyTempting:
          "errno being thread-local is true and important, which makes it a satisfying explanation for a wrong value.",
      },
      {
        text: "`return -1` resets errno to zero, since a negative return is the signal to reset it",
        whyTempting:
          "The -1-plus-errno convention is so ingrained that inventing a matching reset rule feels natural.",
      },
    ],
    correct: 0,
    explanation:
      "Any library call in the cleanup path may set errno, including successful ones. Save it into a local before cleaning up and restore it just before returning, which is what careful C code does around every cleanup block.",
  },
  {
    concept: "c-error-path-cleanup",
    difficulty: "hard",
    prompt:
      "A `goto cleanup;` is added from a fifth failure point, above the existing four. The cleanup label frees three pointers unconditionally. What must hold for the new jump to be safe?",
    options: [
      {
        text: "All three pointers must already be initialised to NULL at declaration, since free on an uninitialised pointer is undefined",
      },
      {
        text: "The new goto must be below the last allocation, since C forbids jumping over an initialisation",
        whyTempting:
          "C++ genuinely does reject jumps that skip a non-trivial initialisation, so the rule exists one language over.",
      },
      {
        text: "The cleanup must check each pointer for NULL, since `free(NULL)` is undefined behaviour",
        whyTempting:
          "It is the defensive habit everyone has seen written, and the redundant check is harmless enough to survive review.",
      },
      {
        text: "The label must sit after the return of the success path, or the success path will fall through into the frees",
        whyTempting:
          "Fallthrough into a cleanup label is a real bug in exactly this pattern, and worth checking every time.",
      },
    ],
    correct: 0,
    explanation:
      "`free(NULL)` is defined and does nothing, so the discipline is initialising every owned pointer to NULL at declaration. Jumping from earlier in the function then reaches a cleanup block that is correct for every partial state.",
  },

  // ── c-buffer-bounds ──────────────────────────────────────────────────────
  {
    concept: "c-buffer-bounds",
    difficulty: "easy",
    prompt:
      "`strncpy(dst, src, sizeof(dst));` where `src` is exactly as long as `dst`. What is the state of `dst` afterwards?",
    options: [
      {
        text: "Full of the source bytes with no terminating NUL, so every later string function reads past the end",
      },
      {
        text: "Truncated by one byte and NUL-terminated, since strncpy reserves space for the terminator",
        whyTempting:
          "It is what the function ought to do and what `strlcpy` actually does, which is why the two get confused.",
      },
      {
        text: "Unchanged, because strncpy refuses a copy that would not fit and returns NULL",
        whyTempting:
          "Returning a failure would be the safe design, and several of the `_s` variants do exactly that.",
      },
      {
        text: "Full of the source bytes and NUL-padded to the buffer size, which is what the n in strncpy bounds",
        whyTempting:
          "strncpy really does NUL-pad when the source is shorter, so this is right for every case except this one.",
      },
    ],
    correct: 0,
    explanation:
      "`strncpy` writes exactly n bytes, padding with NUL when the source is shorter and terminating nothing when it is not. Use `snprintf` or `strlcpy`, or write the terminator yourself.",
  },
  {
    concept: "c-buffer-bounds",
    difficulty: "medium",
    prompt:
      "A cursor is advanced with `p += snprintf(p, end - p, \"%s\", name);` in a loop. With a long name the loop starts writing outside the buffer. Why?",
    options: [
      {
        text: "`snprintf` returns the length it would have written, so on truncation the cursor jumps past the end of the buffer",
      },
      {
        text: "`snprintf` returns the number of bytes written including the NUL, so the cursor drifts one byte per call",
        whyTempting:
          "An off-by-one on the terminator is real in this pattern, and it is the smaller bug hiding behind this one.",
      },
      {
        text: "`end - p` goes negative once the buffer fills, and snprintf treats a negative size as unlimited",
        whyTempting:
          "The size argument is `size_t`, so a negative difference really does become enormous, which is a genuine second bug here.",
      },
      {
        text: "`%s` with no precision copies the whole source regardless of the size argument, which only bounds the format expansion",
        whyTempting:
          "Precision on `%s` is the right tool for a different version of this problem, so the topic is on point.",
      },
    ],
    correct: 0,
    explanation:
      "`snprintf` returns the length the full output would have required, which is what lets you size a buffer in one pass. Clamp the advance to the remaining space, and treat a return greater than the size as truncation.",
  },
  {
    concept: "c-buffer-bounds",
    difficulty: "hard",
    prompt:
      "A guard `if (len)` is added before `memcpy(dst, src, len);` to silence a sanitizer warning, where `src` may be NULL when `len` is 0. Was that necessary?",
    options: [
      {
        text: "Yes: passing a NULL pointer to memcpy is undefined even with a length of zero, and the sanitizer is reporting real UB",
      },
      {
        text: "No: memcpy with a zero length is a no-op by definition, so the sanitizer is reporting a false positive",
        whyTempting:
          "Every implementation does return immediately, so the code works everywhere and the standard still forbids it.",
      },
      {
        text: "Yes, but only because `dst` might also be NULL, and the guard happens to cover both",
        whyTempting:
          "It covers both and the reasoning is sound, which makes the narrower justification easy to accept.",
      },
      {
        text: "No: the warning comes from the sanitizer's own instrumentation, and the fix is to annotate the call rather than branch on it",
        whyTempting:
          "Suppressing a checker rather than changing code is sometimes right, and it is a real option here.",
      },
    ],
    correct: 0,
    explanation:
      "The standard requires valid pointers for the string and memory functions regardless of length, so the compiler may infer `src` is non-NULL and delete a later NULL check. The guard is a real fix, not appeasement.",
  },

  // ── c-flag-bitmask ───────────────────────────────────────────────────────
  {
    concept: "c-flag-bitmask",
    difficulty: "easy",
    prompt:
      "A flags parameter is tested with `if (flags == O_THREAD)`. Callers pass `O_THREAD | O_NONBLOCK`. What does the test do?",
    options: [
      {
        text: "Fails for every caller that sets a second flag, because it compares the whole set rather than testing one bit",
      },
      {
        text: "Works, since `|` on distinct flags yields the flag with the lowest bit and the comparison sees that",
        whyTempting:
          "Flags are usually defined lowest-bit-first, so an ordering story fits the values people see in a debugger.",
      },
      {
        text: "Fails only when O_NONBLOCK is numerically larger, since a wider value truncates on comparison",
        whyTempting:
          "Truncation is a real C hazard and the neighbouring concept, so it is a fair thing to reach for here.",
      },
      {
        text: "Works for one flag and warns for two, since comparing an enum against a combined value is diagnosed",
        whyTempting:
          "`-Wswitch` and enum diagnostics are real, and some compilers do warn about out-of-range enum values.",
      },
    ],
    correct: 0,
    explanation:
      "A flags word is a set, so membership is `flags & O_THREAD` and equality asks whether the set is exactly that one flag. The bug hides until a caller passes a second flag, which is usually after the code has shipped.",
  },
  {
    concept: "c-flag-bitmask",
    difficulty: "medium",
    prompt:
      "Which expression clears a single flag from `flags` and leaves the others alone?",
    options: [
      {
        text: "`flags &= ~F`",
      },
      {
        text: "`flags ^= F`",
        whyTempting:
          "It clears the flag when the flag is set and sets it when it is not, so it works until it silently does the opposite.",
      },
      {
        text: "`flags -= F`",
        whyTempting:
          "Arithmetic gives the right answer whenever the flag is set, and corrupts unrelated bits when it is not.",
      },
      {
        text: "`flags &= !F`",
        whyTempting:
          "One character from the correct answer, and `!F` is 0 for any non-zero flag, so this clears everything.",
      },
    ],
    correct: 0,
    explanation:
      "`~` inverts every bit and `!` yields 0 or 1, so `&= ~F` clears one flag and `&= !F` clears the whole word. That single character is one of the most durable C typos there is.",
  },
  {
    concept: "c-flag-bitmask",
    difficulty: "hard",
    prompt:
      "A header defines `#define F_LAST (1 << 31)` where the macro is used in `int flags`. What is the problem?",
    options: [
      {
        text: "`1` is a signed int, so shifting into the sign bit is undefined and the constant is not portably the value intended",
      },
      {
        text: "The macro needs parentheses around `1`, since the shift binds looser than the surrounding expression",
        whyTempting:
          "Macro parenthesisation is a real discipline and this macro is genuinely missing some of it elsewhere.",
      },
      {
        text: "31 exceeds the guaranteed width of an int, which the standard fixes at 16 bits minimum",
        whyTempting:
          "The 16-bit minimum is a genuine standard guarantee, which makes this the most defensible wrong answer.",
      },
      {
        text: "The result is fine but `flags & F_LAST` is truthy for the wrong bit, since `&` promotes to unsigned first",
        whyTempting:
          "Integer promotion really does happen in `&`, so a promotion-based explanation sounds structurally right.",
      },
    ],
    correct: 0,
    explanation:
      "`1 << 31` shifts into the sign bit of a signed int, which the standard leaves undefined. Write `1u << 31` and store flags in an `unsigned`, which is why kernel and library headers spell their flags that way.",
  },

  // ── c-macro-hygiene ──────────────────────────────────────────────────────
  {
    concept: "c-macro-hygiene",
    difficulty: "easy",
    prompt:
      "`#define DOUBLE(x) x * 2`. What does `DOUBLE(a + b)` expand to, and what is the value?",
    options: [
      {
        text: "`a + b * 2`, so `b` is doubled and `a` is not",
      },
      {
        text: "`(a + b) * 2`, since the preprocessor parenthesises each argument as it substitutes",
        whyTempting:
          "It is what the macro was written to mean, and what an inline function of the same shape would give you.",
      },
      {
        text: "A compile error, because a macro argument containing an operator needs explicit parentheses at the call site",
        whyTempting:
          "The fix really is parentheses, so believing the compiler demands them is a small and comforting step.",
      },
      {
        text: "`a + b * 2`, and the same macro with an inline function would produce the same result",
        whyTempting:
          "The first half is right, which makes it easy to accept the second half without checking it.",
      },
    ],
    correct: 0,
    explanation:
      "The preprocessor pastes text and knows nothing about precedence, so the expansion is `a + b * 2`. Parenthesise every argument and the whole body: `#define DOUBLE(x) ((x) * 2)`.",
  },
  {
    concept: "c-macro-hygiene",
    difficulty: "medium",
    prompt:
      "`#define MAX(a, b) ((a) > (b) ? (a) : (b))` is fully parenthesised. What still goes wrong with `MAX(i++, limit)`?",
    options: [
      {
        text: "`i++` appears twice in the expansion, so it increments twice whenever it wins the comparison",
      },
      {
        text: "The ternary yields an lvalue in C, so `i++` on the result is a second modification without a sequence point",
        whyTempting:
          "The ternary really is not an lvalue in C, and sequence-point reasoning is exactly the right neighbourhood.",
      },
      {
        text: "The comparison forces both operands to a common type, so a signed and unsigned mix flips the result",
        whyTempting:
          "That is a genuine second defect in this macro, and it bites on `MAX(len, -1)` in real code.",
      },
      {
        text: "Nothing: full parenthesisation makes a macro behave exactly as a function of the same signature would",
        whyTempting:
          "Parenthesisation is presented as the fix everywhere, which makes it easy to believe it is the whole fix.",
      },
    ],
    correct: 0,
    explanation:
      "Parentheses fix precedence and do nothing about repeated evaluation, so any argument with a side effect runs once per appearance. Use a statement expression with local copies, or an inline function.",
  },
  {
    concept: "c-macro-hygiene",
    difficulty: "hard",
    prompt:
      "`#define LOG(fmt, ...) if (debug) fprintf(stderr, fmt, __VA_ARGS__)` is used as `if (x) LOG(\"a\"); else handle();`. What does the else bind to?",
    options: [
      {
        text: "The macro's own `if`, so `handle()` runs when debug is off rather than when `x` is false",
      },
      {
        text: "The outer `if`, since the macro expands inside a statement and the preprocessor inserts a block around it",
        whyTempting:
          "It is the behaviour you want, and the `do { } while (0)` idiom exists precisely to provide it.",
      },
      {
        text: "Nothing: the trailing semicolon after the macro terminates the statement, so the else is a syntax error",
        whyTempting:
          "Stray-semicolon syntax errors are a real symptom of this family of bug, just not for this expansion.",
      },
      {
        text: "The outer `if`, but only because `__VA_ARGS__` is empty here, which changes how the expansion is parsed",
        whyTempting:
          "Empty `__VA_ARGS__` genuinely is a portability problem in this macro, so the detail is real and unrelated.",
      },
    ],
    correct: 0,
    explanation:
      "An `else` binds to the nearest unmatched `if`, which after expansion is the one inside the macro. Wrap multi-statement or conditional macro bodies in `do { ... } while (0)` so they behave as one statement.",
  },
];
