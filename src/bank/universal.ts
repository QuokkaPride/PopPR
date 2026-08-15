import type { BankEntry } from "./types.js";

/**
 * Questions that apply to any diff in any language.
 *
 * These exist because of a measured gap rather than a wish. Roughly a third of
 * merged PRs in large repos are small: a one-line guard, a renamed field, a new
 * branch in an existing function. Pattern detection finds one concept or none
 * on those, so a contributor got a two-question run for a five-file change and
 * concluded the tool had nothing to say.
 *
 * They are never DETECTED. Nothing in `concepts.ts` matches them, and nothing
 * should: they are not a property of a line. `bankQuestions` tops up with them
 * when the diff contains code and the concept rules found too little, which is
 * the only situation where a question with no evidence line is honest.
 *
 * The bar for adding one is higher than for a language concept, not lower.
 * "Best practice" trivia and style opinions do not belong here. Each of these
 * names a decision the author of the diff actually made, and has a defensible
 * right answer that does not depend on the repo, the language or the team.
 */
export const UNIVERSAL_ENTRIES: BankEntry[] = [
  // ── general-error-path ───────────────────────────────────────────────────
  {
    concept: "general-error-path",
    difficulty: "easy",
    prompt:
      "A function acquires a resource, does three steps, and returns an error from step two. What has to be true for that early return to be safe?",
    options: [
      {
        text: "Everything acquired before step two is released, and nothing step one wrote is left half-applied",
      },
      {
        text: "The caller checks the returned error, since an unchecked error is what turns a handled failure into a silent one",
        whyTempting:
          "Unchecked errors are a real and common defect, and this is the thing most reviewers say first.",
      },
      {
        text: "The error carries enough context to identify which step failed, so the failure is diagnosable from a log",
        whyTempting:
          "Diagnosability genuinely matters and belongs in the same review, one rung below correctness.",
      },
      {
        text: "Step two is retryable, since a failure partway through a sequence has to be safe to run a second time",
        whyTempting:
          "Retry safety is the right question for an idempotent operation, which this may or may not be.",
      },
    ],
    correct: 0,
    explanation:
      "An early return skips whatever comes after it, including cleanup and including the second half of a two-part write. That is what makes the error path the one least covered by tests and most likely to leak.",
  },
  {
    concept: "general-error-path",
    difficulty: "medium",
    prompt:
      "A catch block logs the exception and continues with a default value. Under what condition is that the right call?",
    options: [
      {
        text: "When the failure is expected for some inputs and the default is a correct answer for them, rather than a way to keep going",
      },
      {
        text: "When the operation is not on the critical path, so degrading is better than failing the whole request",
        whyTempting:
          "Graceful degradation is real and often right, and this is how the decision is usually justified out loud.",
      },
      {
        text: "When the log line includes the stack trace, which is what makes a swallowed error recoverable after the fact",
        whyTempting:
          "A missing stack trace is a genuine defect, and adding it is the most common fix applied to code like this.",
      },
      {
        text: "When the default is documented, since a caller reading the signature can then account for it",
        whyTempting:
          "Documenting behaviour is good practice and does not change whether the behaviour is correct.",
      },
    ],
    correct: 0,
    explanation:
      "Catch-and-default is a claim that the failure is one of the expected outcomes and the default is the right answer to it. When the real reason is that failing is inconvenient, the default becomes wrong data flowing into everything downstream.",
  },
  {
    concept: "general-error-path",
    difficulty: "hard",
    prompt:
      "A write path updates a database row and then publishes an event. The publish fails. What is the actual decision the code has to make?",
    options: [
      {
        text: "Which of the two is the source of truth, since the write is already committed and cannot be undone by a failed publish",
      },
      {
        text: "Whether to retry the publish, with a bounded backoff so a broker outage does not stall the request",
        whyTempting:
          "Retry is the fix people reach for, and it is part of the answer once the ownership question is settled.",
      },
      {
        text: "Whether to roll back the row, since leaving the two stores disagreeing is the failure to avoid",
        whyTempting:
          "Consistency really is the goal, and a rollback would achieve it if it were available at this point.",
      },
      {
        text: "Whether to publish first, so a failure happens before anything is committed",
        whyTempting:
          "Reordering does move the failure, and it trades one inconsistency for the opposite one.",
      },
    ],
    correct: 0,
    explanation:
      "Two writes without a shared transaction cannot both be atomic, so the design has to name which one is authoritative and how the other catches up. Outbox tables and change-data-capture exist because the ordering question has no local answer.",
  },

  // ── general-boundary-conditions ──────────────────────────────────────────
  {
    concept: "general-boundary-conditions",
    difficulty: "easy",
    prompt:
      "A new function takes a list and returns a summary. Which inputs are worth testing before anything else?",
    options: [
      {
        text: "Empty, exactly one, and the largest size the caller can supply",
      },
      {
        text: "A typical list, a list with duplicates, and a list in a surprising order",
        whyTempting:
          "These are useful cases and they exercise the logic, which makes them feel like the higher-value set.",
      },
      {
        text: "Null, a list containing nulls, and a list of the wrong element type",
        whyTempting:
          "Defensive input testing is real, and in an untyped language this set moves much closer to correct.",
      },
      {
        text: "The values the bug report mentioned, plus a regression case for the previous fix in this function",
        whyTempting:
          "Regression coverage matters and is exactly what a bug-fix PR should carry.",
      },
    ],
    correct: 0,
    explanation:
      "Almost every off-by-one lives at zero, one, or the limit, and almost every typical case exercises the same code path as every other typical case. Test where the behaviour changes, not where it is representative.",
  },
  {
    concept: "general-boundary-conditions",
    difficulty: "medium",
    prompt:
      "A pagination change replaces `offset + limit >= total` with `offset + limit > total`. What did that change?",
    options: [
      {
        text: "Whether the exactly-full final page is treated as the last one, which is one request either way",
      },
      {
        text: "Whether the last page can be empty, since the old form allowed an offset past the end",
        whyTempting:
          "Empty final pages are a genuine artifact of pagination and the two symptoms look alike from the client.",
      },
      {
        text: "Nothing observable, since both forms stop at the same place once the total is not an exact multiple",
        whyTempting:
          "It is true for every total that is not a multiple of the page size, which is most of the tests anyone writes.",
      },
      {
        text: "Whether the total is inclusive, which matters only when the count query and the page query disagree",
        whyTempting:
          "Count-versus-page skew is a real pagination bug, and it produces symptoms in the same neighbourhood.",
      },
    ],
    correct: 0,
    explanation:
      "The two forms differ on exactly one input: a total that is an exact multiple of the page size. That is the case a random test fixture almost never produces and a real dataset produces constantly.",
  },
  {
    concept: "general-boundary-conditions",
    difficulty: "hard",
    prompt:
      "A timestamp comparison uses `>=` on one side of a range and `>=` on the other. What is the consequence, and why is it hard to see in review?",
    options: [
      {
        text: "Records on the boundary appear in two adjacent windows, and no single window looks wrong on its own",
      },
      {
        text: "Records on the boundary appear in neither window, which shows up as a small but permanent undercount",
        whyTempting:
          "It is the mirror bug from mismatched exclusive bounds, and the undercount is equally hard to spot.",
      },
      {
        text: "The comparison is ambiguous when the two timestamps have different precision, which is the real defect",
        whyTempting:
          "Precision mismatch is a genuine timestamp hazard and often coexists with this one.",
      },
      {
        text: "Nothing, since timestamps are effectively continuous and an exact boundary hit has probability zero",
        whyTempting:
          "It is nearly true for microsecond timestamps and completely false for anything truncated to a day or an hour.",
      },
    ],
    correct: 0,
    explanation:
      "Half-open intervals compose and closed ones do not: `[a, b)` then `[b, c)` covers everything once, and `[a, b]` then `[b, c]` double-counts b. Reviewing one window in isolation cannot show you the overlap.",
  },

  // ── general-backward-compatibility ───────────────────────────────────────
  {
    concept: "general-backward-compatibility",
    difficulty: "easy",
    prompt:
      "A field is renamed in a struct that is serialised to JSON and stored. What still has to work after deploy?",
    options: [
      {
        text: "Reading every record written under the old name, since stored data does not redeploy with the code",
      },
      {
        text: "Every caller that constructs the struct, which the compiler will point at during the build",
        whyTempting:
          "It is the work you actually do, and it is the part a rename tool handles for you.",
      },
      {
        text: "The API documentation, which now describes a field name the service no longer accepts",
        whyTempting:
          "Stale docs are a real cost of a rename and worth fixing in the same PR.",
      },
      {
        text: "Any test fixture using the old name, which will fail loudly and be corrected as part of the change",
        whyTempting:
          "Fixtures do break and do get fixed, which is exactly why they give false confidence about the stored data.",
      },
    ],
    correct: 0,
    explanation:
      "A rename is compile-time-safe for code and silent for data, so old records deserialise into a zero value with no error. Accept both names for one release, or migrate the data before the field disappears.",
  },
  {
    concept: "general-backward-compatibility",
    difficulty: "medium",
    prompt:
      "A required parameter is added to a public function in a library. What is the compatibility consequence?",
    options: [
      {
        text: "Every existing caller breaks, so it is a major version change unless the parameter has a default",
      },
      {
        text: "Callers break only if they are recompiled, so a patch release is safe for anyone pinning a binary",
        whyTempting:
          "Binary versus source compatibility is a real distinction and matters a great deal in some ecosystems.",
      },
      {
        text: "Nothing breaks, since a new parameter is purely additive and additive changes are minor by definition",
        whyTempting:
          "Additive changes usually are minor, which is what makes required-versus-optional the load-bearing detail.",
      },
      {
        text: "Only dynamic callers break, since a static language reports it at build time and it never reaches a user",
        whyTempting:
          "Catching it at build time is genuinely better, and a build failure is still a break for whoever hits it.",
      },
    ],
    correct: 0,
    explanation:
      "Adding a required parameter changes the contract every existing call site satisfied. An optional parameter with a default, or a new overload, keeps the old contract valid and is why those exist.",
  },
  {
    concept: "general-backward-compatibility",
    difficulty: "hard",
    prompt:
      "A rolling deploy runs old and new code at once for ten minutes. A change adds a new enum value that the new code writes and the old code reads. What breaks?",
    options: [
      {
        text: "The old instances, which receive a value they have no case for, during the window when both versions are live",
      },
      {
        text: "Nothing, provided the new value is only written after every instance has been upgraded",
        whyTempting:
          "It is the correct fix, stated as though it were the current behaviour rather than the thing to change.",
      },
      {
        text: "The new instances, which read rows written by old code that lack the field the new value implies",
        whyTempting:
          "Forward compatibility is the other half of this problem and fails in a genuinely similar way.",
      },
      {
        text: "Nothing during the deploy, and the failure appears at the next restart when caches are rebuilt",
        whyTempting:
          "Deferred failures via caches are real and do make rollout bugs look unrelated to the rollout.",
      },
    ],
    correct: 0,
    explanation:
      "A rolling deploy means both versions read each other's writes, so a new value has to be readable before anything writes it. Ship the reader first, deploy fully, then ship the writer.",
  },

  // ── general-test-intent ──────────────────────────────────────────────────
  {
    concept: "general-test-intent",
    difficulty: "easy",
    prompt:
      "A new test passes on the first run, before the fix it accompanies is applied. What does that tell you?",
    options: [
      {
        text: "It does not exercise the bug, so it will not catch a regression of it either",
      },
      {
        text: "The bug is environment-dependent, so the test needs the same conditions the report described",
        whyTempting:
          "Environment-dependent bugs are real and are the usual explanation offered when this happens.",
      },
      {
        text: "The fix was already partly applied by an earlier commit on the branch, which is worth checking first",
        whyTempting:
          "It is a reasonable thing to check and occasionally the true explanation.",
      },
      {
        text: "The test is asserting on a stronger property than the bug, which is fine as long as it fails for something",
        whyTempting:
          "Stronger properties are good, and this sounds like an argument for keeping the test as written.",
      },
    ],
    correct: 0,
    explanation:
      "A regression test earns its place by failing before the fix and passing after. Watching it fail once is the only evidence that it is connected to the behaviour at all.",
  },
  {
    concept: "general-test-intent",
    difficulty: "medium",
    prompt:
      "A test mocks the function under test's only collaborator and asserts the collaborator was called with specific arguments. What can that test not tell you?",
    options: [
      {
        text: "Whether the collaborator accepts those arguments, so the test keeps passing after the real signature changes",
      },
      {
        text: "Whether the function handles the collaborator failing, since the mock is configured to succeed",
        whyTempting:
          "It is a real gap and a good thing to add, and a second test with a failing mock closes it.",
      },
      {
        text: "Whether the arguments are correct, since asserting on them is circular against the implementation",
        whyTempting:
          "Change-detector tests are a real anti-pattern, and this one is close to being one.",
      },
      {
        text: "Whether the call happens in the right order relative to other work, which needs an ordered assertion",
        whyTempting:
          "Ordering is genuinely untested here and mocking frameworks offer exactly that assertion.",
      },
    ],
    correct: 0,
    explanation:
      "A mock encodes your belief about an interface and never checks it, so the test and the real collaborator can drift apart silently. That is what contract tests and one integration test per boundary are for.",
  },
  {
    concept: "general-test-intent",
    difficulty: "hard",
    prompt:
      "A flaky test is fixed by adding a retry wrapper. It stops failing in CI. What is the cost?",
    options: [
      {
        text: "The underlying race is still shipped, and the test no longer reports it, so the next symptom appears in production",
      },
      {
        text: "CI gets slower on the failing path, which compounds as more tests get the same treatment",
        whyTempting:
          "It is a genuine cost and the one that eventually forces the conversation.",
      },
      {
        text: "The retry masks ordering dependencies between tests, which is usually what flakiness in a suite means",
        whyTempting:
          "Inter-test dependence is one real cause of flakiness, and retries do hide it.",
      },
      {
        text: "Nothing, provided the retry count is bounded and the failure is logged for later analysis",
        whyTempting:
          "It is the pragmatic position, and it is defensible when the flake is genuinely in the test harness.",
      },
    ],
    correct: 0,
    explanation:
      "A flaky test is usually a real race observed through a narrow window, so retrying converts a signal into silence. Retry when the flakiness is in the test infrastructure, and investigate when it is in the code under test.",
  },

  // ── general-idempotency ──────────────────────────────────────────────────
  {
    concept: "general-idempotency",
    difficulty: "easy",
    prompt:
      "A client times out and retries a request that had already succeeded server-side. What has to be true for the retry to be harmless?",
    options: [
      {
        text: "The server recognises the repeat and produces the same outcome rather than performing the work twice",
      },
      {
        text: "The client uses exponential backoff, so the retry arrives after the first request has finished",
        whyTempting:
          "Backoff is essential for load and does nothing about the duplicate, which is the point of the question.",
      },
      {
        text: "The operation is read-only, since only reads can safely be repeated",
        whyTempting:
          "Reads are trivially safe, which makes this true and far too narrow to be the answer.",
      },
      {
        text: "The timeout is longer than the server's worst-case latency, so a timeout implies a genuine failure",
        whyTempting:
          "Tuning the timeout does reduce spurious retries and cannot eliminate the ambiguity.",
      },
    ],
    correct: 0,
    explanation:
      "A timeout tells the client nothing about whether the work happened, so the server has to make repeating it safe. An idempotency key the client generates and the server records is the usual mechanism.",
  },
  {
    concept: "general-idempotency",
    difficulty: "medium",
    prompt:
      "Which of these operations is idempotent as written: `SET balance = 100`, `SET balance = balance + 10`, `INSERT INTO events`, `DELETE WHERE id = 5`?",
    options: [
      {
        text: "The first and the last, since both leave the same state however many times they run",
      },
      {
        text: "Only the first, since deleting a row that is already gone is a different outcome from deleting one that exists",
        whyTempting:
          "The affected-row count does differ, which makes this true of the return value and not of the state.",
      },
      {
        text: "The first, the third and the last, since an insert with a primary key conflicts rather than duplicating",
        whyTempting:
          "It is true for an insert with a unique constraint on natural keys, which is a common enough design to assume.",
      },
      {
        text: "All four, since idempotence is a property of the transaction rather than the statement",
        whyTempting:
          "Transactions do give you atomicity, and conflating the two guarantees is extremely common.",
      },
    ],
    correct: 0,
    explanation:
      "Idempotence means the state after n applications equals the state after one. Absolute assignment and delete-by-key qualify, and anything reading the current value or appending does not.",
  },
  {
    concept: "general-idempotency",
    difficulty: "hard",
    prompt:
      "A job is made idempotent by checking `if already_done(id): return` at the top. Two workers pick it up at the same moment. What is still possible?",
    options: [
      {
        text: "Both read not-done before either writes done, so the work runs twice and the guard never fires",
      },
      {
        text: "One worker returns early and the other runs, which is correct behaviour and needs no further change",
        whyTempting:
          "It is what happens most of the time, which is precisely why the race survives into production.",
      },
      {
        text: "Both run and the second overwrites the first, which is harmless when the operation is deterministic",
        whyTempting:
          "Determinism does make some double-runs harmless, and it is the argument used to defer fixing this.",
      },
      {
        text: "Neither runs, since both see the other's in-progress marker and defer to it",
        whyTempting:
          "Mutual deferral is a real failure mode of a badly designed lease, which is the fix people reach for next.",
      },
    ],
    correct: 0,
    explanation:
      "Check-then-act is not atomic across processes any more than it is across threads. Make the claim and the check one operation: a conditional insert, a compare-and-set, or a lease with an owner and an expiry.",
  },

  // ── general-config-and-secrets ───────────────────────────────────────────
  {
    concept: "general-config-and-secrets",
    difficulty: "easy",
    prompt:
      "A timeout is hardcoded as a literal in the function that uses it. When is that the right call?",
    options: [
      {
        text: "When no deployment needs a different value, since a configuration knob nobody turns is surface area for nothing",
      },
      {
        text: "Never: any tunable value belongs in configuration so it can be changed without a deploy",
        whyTempting:
          "It is the reflexive review comment, and it is right often enough to have become a rule of thumb.",
      },
      {
        text: "When the value is documented in a comment, which gives a reader the same information a config key would",
        whyTempting:
          "Documenting the reasoning is genuinely valuable and is the thing most often missing.",
      },
      {
        text: "When it is defined as a named constant at module scope, which is what separates a magic number from a decision",
        whyTempting:
          "Naming it is a real improvement and is a separate question from where the value should live.",
      },
    ],
    correct: 0,
    explanation:
      "Every configuration key is a value someone has to decide, document, validate and test at more than one setting. Make things configurable when there is a real second value, and name the constant either way.",
  },
  {
    concept: "general-config-and-secrets",
    difficulty: "medium",
    prompt:
      "An error message is changed to include the request payload so failures are easier to debug. What is the risk?",
    options: [
      {
        text: "Anything in the payload now lands in logs, error trackers and any response that renders the message",
      },
      {
        text: "The message becomes too long for structured log fields, so it gets truncated at an arbitrary point",
        whyTempting:
          "Truncation is a real annoyance and does destroy exactly the part you needed.",
      },
      {
        text: "Error messages become unstable, so any alerting that groups by message stops grouping",
        whyTempting:
          "Cardinality explosion in error grouping is a genuine operational problem caused by exactly this change.",
      },
      {
        text: "The payload is serialised twice, once for the message and once for the log, which doubles the cost on the error path",
        whyTempting:
          "Cost on the error path matters under a failure storm, and this is a real thing to check.",
      },
    ],
    correct: 0,
    explanation:
      "An error message travels further than the code that wrote it: to log aggregation, to a third-party tracker, and sometimes to the user. Log an identifier and keep the payload where access is controlled.",
  },
  {
    concept: "general-config-and-secrets",
    difficulty: "hard",
    prompt:
      "A secret is read from an environment variable at startup and held in a module-level variable. What does rotating that secret require?",
    options: [
      {
        text: "A restart, since the process captured the value once and nothing re-reads the environment",
      },
      {
        text: "Nothing, since the environment is read through to the process and a change is visible on next access",
        whyTempting:
          "It is how a config file with a watcher behaves, and it is what people expect from a secrets manager.",
      },
      {
        text: "A redeploy, since environment variables are baked into the image at build time",
        whyTempting:
          "Build-time baking is a real anti-pattern and does happen, which makes it a plausible reading of the setup.",
      },
      {
        text: "Clearing any cached credential derived from it, since the derived value outlives the source",
        whyTempting:
          "Derived caches are a real second-order problem, and they matter once the primary one is solved.",
      },
    ],
    correct: 0,
    explanation:
      "A value read once at startup is a snapshot, so rotation and restart become the same operation. Read through a function that can refresh when zero-downtime rotation is a requirement.",
  },

  // ── general-observability ────────────────────────────────────────────────
  {
    concept: "general-observability",
    difficulty: "easy",
    prompt:
      "A new branch handles a case the team believes is rare. What should it record?",
    options: [
      {
        text: "Enough to answer how often it is taken, since a rare branch that turns out to be common is the useful thing to learn",
      },
      {
        text: "A warning-level log line, so it surfaces in alerting if it starts happening",
        whyTempting:
          "It is the common implementation and works until the branch turns out to fire on every request.",
      },
      {
        text: "Nothing, since a handled case is expected behaviour and logging expected behaviour is noise",
        whyTempting:
          "Log noise is a genuine problem and this is the correct instinct pointed at the wrong branch.",
      },
      {
        text: "The full input that led to it, which is what makes the case reproducible when someone investigates",
        whyTempting:
          "Reproducibility is valuable, and it is also how payloads end up in log aggregation forever.",
      },
    ],
    correct: 0,
    explanation:
      "Every rare branch encodes an assumption about frequency, and that assumption is testable for the cost of a counter. Logging is the wrong tool when the branch might be hot.",
  },
  {
    concept: "general-observability",
    difficulty: "medium",
    prompt:
      "A retry loop logs one line per attempt at info level. Under a downstream outage the service handles 2,000 requests per second. What happens?",
    options: [
      {
        text: "Log volume multiplies exactly when the system is least healthy, and the logging itself competes for the resources needed to recover",
      },
      {
        text: "The logs become useless for diagnosis, since the signal is buried in repetition",
        whyTempting:
          "It is true and is the reason most people give, and it understates the problem by leaving out the load.",
      },
      {
        text: "Alerting fires correctly, since a spike in retry logs is exactly the signal an outage should produce",
        whyTempting:
          "Retries are a good signal, and this is the argument for logging them in the first place.",
      },
      {
        text: "Nothing operationally, since log writes are asynchronous and buffered away from the request path",
        whyTempting:
          "Async appenders are real and do help, right up until the buffer fills and the writer blocks.",
      },
    ],
    correct: 0,
    explanation:
      "Per-attempt logging scales with the failure, so the worst incident produces the largest bill and the most disk pressure. Count retries as a metric and log a sample or a summary.",
  },
  {
    concept: "general-observability",
    difficulty: "hard",
    prompt:
      "You are paged at 3am for this change failing in production. Which property of the code decides how long the diagnosis takes?",
    options: [
      {
        text: "Whether the failure identifies which input and which branch produced it, without needing to reproduce it",
      },
      {
        text: "Whether the code is covered by tests, since a failing test points straight at the broken behaviour",
        whyTempting:
          "Coverage is genuinely valuable and is exactly what tells you nothing at 3am about a case no test contains.",
      },
      {
        text: "Whether the change is small, since a small diff has few places the bug can hide",
        whyTempting:
          "Small diffs really are easier to revert and to reason about, which is a strong argument for shipping them.",
      },
      {
        text: "Whether it can be rolled back, since reverting first and diagnosing later is the correct incident response",
        whyTempting:
          "It is the right first move in an incident, and it is a different question from how long diagnosis takes.",
      },
    ],
    correct: 0,
    explanation:
      "At 3am you have the logs, the metrics and the diff, and no ability to reproduce. Code that says which input and which path it was on turns an investigation into a lookup.",
  },

  // ── general-change-blast-radius ──────────────────────────────────────────
  {
    concept: "general-change-blast-radius",
    difficulty: "easy",
    prompt:
      "A shared helper is changed to fix a bug in one caller. What is the first thing to establish?",
    options: [
      {
        text: "Whether the other callers depend on the behaviour being changed, since the bug may be load-bearing for one of them",
      },
      {
        text: "Whether the helper has tests, so the change is covered before it is made",
        whyTempting:
          "Tests are the right safety net and they only cover the behaviour someone already thought to encode.",
      },
      {
        text: "Whether the fix belongs in the caller instead, keeping the shared code untouched",
        whyTempting:
          "It is often the right answer and it is the decision you make after establishing who depends on what.",
      },
      {
        text: "Whether the helper is public API, since an internal helper can be changed freely",
        whyTempting:
          "Visibility does bound the search, and internal callers break just as thoroughly as external ones.",
      },
    ],
    correct: 0,
    explanation:
      "A shared function's behaviour is a contract with every call site, including the ones that adapted to the bug. Enumerate the callers before deciding where the fix goes.",
  },
  {
    concept: "general-change-blast-radius",
    difficulty: "medium",
    prompt:
      "A default value in a widely used function is changed. Tests pass. What class of caller is unprotected?",
    options: [
      {
        text: "Any caller relying on the old default and never passing the argument, which is invisible at every call site",
      },
      {
        text: "Any caller passing the argument explicitly, since the explicit value now conflicts with the new default",
        whyTempting:
          "It inverts the actual exposure, and explicit call sites are the ones you can actually find by searching.",
      },
      {
        text: "Callers in other repositories, since a cross-repo change is not covered by this repo's tests",
        whyTempting:
          "It is a real gap for a published library and is a subset of the answer rather than the answer.",
      },
      {
        text: "Callers that pass the argument through from their own default, which now double-applies the change",
        whyTempting:
          "Layered defaults are a genuine hazard and produce a confusing version of this same problem.",
      },
    ],
    correct: 0,
    explanation:
      "Omitting an argument leaves no trace at the call site, so the affected callers are exactly the ones grep cannot find. Changing a default is a behaviour change for every caller who never mentioned it.",
  },
  {
    concept: "general-change-blast-radius",
    difficulty: "hard",
    prompt:
      "A function's return type is widened from a concrete type to an interface. Nothing fails to compile. What became possible that was not before?",
    options: [
      {
        text: "A future implementation can be returned without any caller noticing, which is the point, and callers relying on the concrete type's extras have to be found by hand",
      },
      {
        text: "Nothing: widening a return type is always safe, since every existing value still satisfies the new type",
        whyTempting:
          "The values do all still satisfy it, which is why the build passes and why the risk is easy to dismiss.",
      },
      {
        text: "Callers must now handle a null implementation, since an interface-typed return can be absent where a concrete one could not",
        whyTempting:
          "Nullability and abstraction do get bundled together in practice, and in some languages this is genuinely true.",
      },
      {
        text: "Performance regresses through dynamic dispatch, which is the usual reason to keep a concrete return type",
        whyTempting:
          "Devirtualization is real and this is the standard performance argument, ranked far below the design one.",
      },
    ],
    correct: 0,
    explanation:
      "Widening a return type is a promise about the future rather than a change today, so it compiles cleanly and shifts the risk to whoever adds the second implementation. Anything a caller used beyond the interface is the list of places that will break then.",
  },
];

/**
 * The slugs above, for callers that need to tell a topped-up question from a
 * detected one. Derived rather than hand-listed, so it cannot drift.
 */
export const UNIVERSAL_CONCEPTS: ReadonlySet<string> = new Set(
  UNIVERSAL_ENTRIES.map((e) => e.concept),
);
