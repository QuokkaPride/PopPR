import type { BankEntry } from "./types.js";

export const SYSTEMS_ENTRIES: BankEntry[] = [
  {
    concept: "sql-null",
    difficulty: "easy",
    prompt:
      "The `status` column is nullable. `SELECT * FROM jobs WHERE status != 'archived'` returns fewer rows than the team expects. What is the cause?",
    options: [
      { text: "Rows where status is NULL drop out: the comparison is unknown and WHERE keeps only true rows" },
      {
        text: "Rows where status is NULL are kept by the engine, but the driver's row mapper discards them",
        whyTempting: "It blames the ORM layer for what is plain SQL three-valued logic in the database.",
      },
      {
        text: "NULL behaves like the empty string here: those rows compare equal to '' instead",
        whyTempting: "Oracle really does treat '' as NULL, which invites the reverse assumption everywhere else.",
      },
      {
        text: "The `!=` comparison is case sensitive, so rows storing 'Archived' or 'ARCHIVED' are filtered out",
        whyTempting: "Collation genuinely bites string comparisons, but that would add rows here, not remove them.",
      },
    ],
    correct: 0,
    explanation:
      "Any comparison with NULL yields unknown, and WHERE keeps only rows where the predicate is true. Nullable columns need `OR status IS NULL` (or a NOT NULL default) to be filtered the way people expect.",
  },
  {
    concept: "sql-null",
    difficulty: "medium",
    prompt:
      "A dashboard shows `AVG(rating)` for a product where half the rows have `rating` NULL. Compared with treating missing ratings as 0, what does it return?",
    options: [
      {
        text: "The same average, because `AVG` coerces NULL to 0 the way arithmetic does",
        whyTempting: "Arithmetic intuition says a missing number is zero, but SQL treats it as absent instead.",
      },
      {
        text: "NULL: a single NULL in the input propagates through the aggregate to the result",
        whyTempting: "NULL really does propagate through scalar arithmetic, so people extend the rule to aggregates.",
      },
      { text: "A higher average, because `AVG` skips the NULL rows and divides by the non-NULL count" },
      {
        text: "A lower average, because NULL sorts below every number and drags the computed mean down",
        whyTempting: "NULL does sort at one end in ORDER BY, which suggests it participates in aggregates too.",
      },
    ],
    correct: 2,
    explanation:
      "Aggregates skip NULL inputs, so AVG divides by the count of non-NULL rows only. If missing means zero in your domain, you must say so with COALESCE.",
  },
  {
    concept: "sql-null",
    difficulty: "hard",
    prompt:
      "`DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users)` deletes nothing, though orphan sessions exist. The subquery returns one NULL among its ids. Why?",
    options: [
      {
        text: "The NULL is skipped, and the remaining ids still filter rows normally",
        whyTempting: "That is how the positive IN case behaves; NOT IN is the asymmetric one.",
      },
      { text: "With a NULL present, `NOT IN` yields false or unknown for every row it tests" },
      {
        text: "Only sessions whose own user_id is NULL count as orphans, and NULL never matches",
        whyTempting: "It puts the NULL on the wrong side: the one that matters is inside the subquery.",
      },
      {
        text: "The subquery is materialised once, so rows inserted after it ran stay invisible",
        whyTempting: "Snapshot staleness is a real concern elsewhere, just not the cause of zero deletions.",
      },
    ],
    correct: 1,
    explanation:
      "`x NOT IN (a, NULL)` expands to `x <> a AND x <> NULL`, and the second term is always unknown, so the whole predicate is never true. Use NOT EXISTS, or filter NULLs out of the subquery.",
  },
  {
    concept: "sql-index",
    difficulty: "easy",
    prompt:
      "`email` carries a B-tree index, but `WHERE email LIKE '%@acme.com'` still full-scans the table. What explains it?",
    options: [
      {
        text: "`LIKE` never uses an index, so the predicate must become an equality test",
        whyTempting: "LIKE with a fixed prefix does use the index; only the leading wildcard breaks it.",
      },
      {
        text: "The index stores hashes of the values, and only exact equality can be served from a hash",
        whyTempting: "Hash indexes behave exactly like that, which makes the claim feel familiar.",
      },
      {
        text: "The planner skipped the index because the table fits in memory and a scan is cheaper",
        whyTempting: "Small-table scans are a genuinely common reason for ignored indexes, just not this one.",
      },
      { text: "A B-tree seeks only on a known prefix, so a leading wildcard leaves it unbounded" },
    ],
    correct: 3,
    explanation:
      "A B-tree orders values left to right, so a leading wildcard gives no contiguous range to descend into. Matching a suffix needs a reversed-string index, a trigram index, or a separate domain column.",
  },
  {
    concept: "sql-index",
    difficulty: "medium",
    prompt:
      "A table has a composite index on `(tenant_id, created_at)`. A new report filters only on `created_at`. Does that index help the report?",
    options: [
      {
        text: "Yes, because the index physically contains `created_at` and any indexed column can be seeked",
        whyTempting: "Presence in the index feels like coverage, but only the leading column defines the order.",
      },
      { text: "No, because index entries sort by tenant_id first, so matching created_at rows are scattered" },
      {
        text: "Yes, because the planner reorders index key columns to match the predicates in the `WHERE` clause",
        whyTempting: "Planners do reorder joins and predicates freely, which makes reordering keys sound plausible.",
      },
      {
        text: "No, but only because it is not covering; an `INCLUDE` column would make it seekable again",
        whyTempting: "Covering indexes remove heap lookups, a real win that does nothing about key order.",
      },
    ],
    correct: 1,
    explanation:
      "Composite index entries are sorted by the first key, then the second, so filtering on the second alone leaves the matching rows scattered across the whole index. You need created_at leading in its own index.",
  },
  {
    concept: "sql-index",
    difficulty: "hard",
    prompt:
      "An ingest table sustains 3,000 inserts per second. A PR adds four indexes to speed up an admin screen. What is the production risk?",
    options: [
      { text: "Each insert now updates four more B-trees inside its own transaction, and write latency rises" },
      {
        text: "The admin reads get slower instead, because the planner weighs far more candidate plans",
        whyTempting: "Planning cost does grow with index count, but it is microseconds against the write cost.",
      },
      {
        text: "Inserts begin deadlocking, since every index takes a table-level lock while it is maintained",
        whyTempting: "Index creation can lock the table, so people assume ongoing maintenance does too.",
      },
      {
        text: "Nothing at insert time, because index maintenance is deferred to the background `VACUUM` process",
        whyTempting: "Some engines batch merges asynchronously, but mainstream B-tree updates are synchronous.",
      },
    ],
    correct: 0,
    explanation:
      "Each index is a separate structure updated inside the insert's transaction, so write amplification scales with index count. On a hot ingest path that is paid three thousand times a second.",
  },
  {
    concept: "n-plus-one",
    difficulty: "easy",
    prompt:
      "An endpoint that renders 50 orders issues 51 queries. It feels instant locally and takes 800ms in production. What best explains the gap?",
    options: [
      {
        text: "Production data is larger, and each of the 51 queries has to scan many more rows",
        whyTempting: "Data volume is the usual suspect for prod-only slowness, and it hides the round-trip cost.",
      },
      {
        text: "The production pool is smaller, so the 51 queries spend most of their time queued",
        whyTempting: "Pool starvation is real, though these queries run sequentially on a single connection.",
      },
      { text: "A local socket hides it, but each of the 50 lazy loads pays a real network round trip" },
      {
        text: "The ORM turns off its identity map outside development: nothing is memoised in production",
        whyTempting: "Cache configuration does differ by environment, but 51 round trips are slow regardless.",
      },
    ],
    correct: 2,
    explanation:
      "N+1 is a latency bug, not a throughput bug: a loopback query costs microseconds while a cross-AZ query costs milliseconds. The same code multiplies that difference by N.",
  },
  {
    concept: "n-plus-one",
    difficulty: "medium",
    prompt:
      "A loop calls `getUser(order.user_id)` once per order. Which change removes the N+1 rather than masking it?",
    options: [
      {
        text: "Add an index on users.id so each of the N lookups becomes a fast primary-key seek",
        whyTempting: "Each query does get faster, yet you still pay N round trips to save microseconds each.",
      },
      {
        text: "Wrap the loop in a transaction: the N queries then share one snapshot and one connection",
        whyTempting: "A transaction trims per-statement overhead but leaves the number of round trips untouched.",
      },
      {
        text: "Run the N lookups concurrently with a parallel map so their latencies overlap",
        whyTempting: "It hides the wall-clock cost while multiplying load and connections on the database.",
      },
      { text: "Collect the ids and fetch them with one `WHERE id IN (...)`, then join in memory" },
    ],
    correct: 3,
    explanation:
      "Batching turns N+1 round trips into two, which is the only change that reduces the work rather than reshaping it. Most ORMs expose this as eager loading or a dataloader.",
  },
  {
    concept: "n-plus-one",
    difficulty: "hard",
    prompt:
      "You add `include: [User]` to the order query, yet the profiler still shows one extra query per order. The serializer reads `order.user.company.name`. What is happening?",
    options: [
      { text: "`company` was never eager-loaded: reading it triggers one lazy load for each order" },
      {
        text: "The `include` is ignored, since the association is declared lazy on the model itself",
        whyTempting: "The model default governs only queries that say nothing; an explicit include overrides it.",
      },
      {
        text: "Eager loading did fetch the users, but the identity map evicts them before serialization",
        whyTempting: "Cache eviction is plausible, but the extra queries here target a different table entirely.",
      },
      {
        text: "The join multiplies order rows, and the ORM re-queries each one to deduplicate",
        whyTempting: "Joins really do fan out rows in has-many cases, though deduplication happens in memory.",
      },
    ],
    correct: 0,
    explanation:
      "Eager loading covers only the associations you name, so any deeper hop reintroduces the N+1 one level down. Nested includes have to spell out the whole path the serializer walks.",
  },
  {
    concept: "transaction-isolation",
    difficulty: "easy",
    prompt:
      "Under READ COMMITTED two requests each run `SELECT balance`, subtract 10 in application code, then `UPDATE balance = :new`. Both read 100. What is the final balance?",
    options: [
      {
        text: "80, because the second `UPDATE` blocks on the row lock and then recomputes from the fresh value",
        whyTempting: "The row lock does serialise the writes, but the value was already computed from a stale read.",
      },
      { text: "90, because the second write stores a value it computed from 100 and one decrement is lost" },
      {
        text: "80: the engine detects the write-write conflict and aborts the losing transaction",
        whyTempting: "That is REPEATABLE READ or SERIALIZABLE behaviour; READ COMMITTED never raises here.",
      },
      {
        text: "80, because every statement under READ COMMITTED takes a fresh snapshot of the row it touches",
        whyTempting: "Fresh per-statement snapshots are real, and they do nothing about a stale value in memory.",
      },
    ],
    correct: 1,
    explanation:
      "READ COMMITTED prevents dirty reads, not lost updates: both transactions legitimately read 100 and the later write wins. The read-modify-write happened outside the database's view.",
  },
  {
    concept: "transaction-isolation",
    difficulty: "medium",
    prompt:
      "Which change actually prevents that lost update, without raising the isolation level?",
    options: [
      {
        text: "Re-read the row immediately before writing, and compare it with the value read earlier",
        whyTempting: "It narrows the window to microseconds, which is not the same as closing it.",
      },
      {
        text: "Wrap both statements in `BEGIN` and `COMMIT` so they commit or roll back together",
        whyTempting: "Atomicity is not isolation; the two statements already commit together and still lose the update.",
      },
      {
        text: "Add a unique index on the account row: every conflicting `UPDATE` is then rejected as a duplicate",
        whyTempting: "Constraints reject duplicate keys, not two writers overwriting the same existing row.",
      },
      { text: "Move the subtraction into SQL: `UPDATE accounts SET balance = balance - 10 WHERE id = :id`" },
    ],
    correct: 3,
    explanation:
      "A single UPDATE reads and writes under the same row lock, so the second writer sees the committed result of the first. `SELECT ... FOR UPDATE` or a version column are the alternatives when the arithmetic cannot move into SQL.",
  },
  {
    concept: "transaction-isolation",
    difficulty: "hard",
    prompt:
      "A team raises a job's isolation level to SERIALIZABLE to fix a race. What must the calling code now handle that it did not before?",
    options: [
      {
        text: "Every read takes a table lock, so the transaction must be shortened to avoid lock timeouts",
        whyTempting: "Lock-based engines do escalate locking, but MVCC engines surface conflicts as aborts instead.",
      },
      {
        text: "Statements now read a snapshot taken at transaction start, and rows must be re-read before writing",
        whyTempting: "Snapshot-at-start is accurate, yet re-reading inside the transaction returns that same snapshot.",
      },
      { text: "Transactions can abort at commit with a serialization failure and need retrying from the top" },
      {
        text: "Deadlocks can no longer occur, so an existing deadlock retry loop around the job can be deleted",
        whyTempting: "SERIALIZABLE adds conflict aborts on top of deadlocks; it removes neither failure mode.",
      },
    ],
    correct: 2,
    explanation:
      "SERIALIZABLE guarantees a serial-equivalent outcome by aborting transactions it cannot order, so retry is part of the contract. Code that ships without a retry loop just converts a race into 500s.",
  },
  {
    concept: "retry-backoff",
    difficulty: "easy",
    prompt:
      "A client retries a failing dependency five times with no delay between attempts. The dependency is failing because it is overloaded. What does that policy do?",
    options: [
      { text: "It multiplies load on the struggling service, because retries land when headroom is lowest" },
      {
        text: "It has no effect on the dependency: failed requests are rejected cheaply at its edge",
        whyTempting: "Rejection is cheap only when it happens at the edge; an overloaded server pays per connection.",
      },
      {
        text: "It shortens the outage, because the call succeeds as soon as one instance recovers",
        whyTempting: "Retries genuinely do paper over brief blips, which is why they get added without limits.",
      },
      {
        text: "It shifts the pain to the client only, because server-side load shedding already caps every retry",
        whyTempting: "Load shedding exists but is rarely tuned to absorb a synchronised retry storm.",
      },
    ],
    correct: 0,
    explanation:
      "Immediate retries turn one failed request into five arriving within milliseconds, exactly when the dependency has the least headroom. Backoff plus a retry budget is what keeps a brownout from becoming an outage.",
  },
  {
    concept: "retry-backoff",
    difficulty: "medium",
    prompt:
      "Four hundred workers all use exponential backoff with the same base and no jitter after a shared dependency blips. What is the failure mode?",
    options: [
      {
        text: "Backoff grows too quickly, and the tail of the retries lands long after the dependency recovered",
        whyTempting: "Over-long backoff is a real tuning problem, but it is not what synchronisation produces.",
      },
      { text: "They retry in synchronised waves, and the dependency takes a fresh spike at each doubling step" },
      {
        text: "The doubling overflows the delay computation, so a portion of the workers never retry at all",
        whyTempting: "Uncapped doubling really can yield absurd delays, though that is a separate bug from herding.",
      },
      {
        text: "Each worker keeps its connection open while backing off, exhausting the dependency's socket table",
        whyTempting: "Connection leaks around retries do happen; backoff itself holds nothing open.",
      },
    ],
    correct: 1,
    explanation:
      "Identical schedules keep the callers in phase, so the dependency sees 400 requests at t=1s, then t=2s, then t=4s. Randomised jitter spreads those waves into a flat trickle.",
  },
  {
    concept: "retry-backoff",
    difficulty: "hard",
    prompt:
      "A generic retry wrapper sits around a payment POST. Which of these failures should it NOT retry?",
    options: [
      {
        text: "A 503 carrying a `Retry-After` header, because the server has already scheduled the next attempt",
        whyTempting: "Retry-After tells you when to retry, not that the server will do the retrying for you.",
      },
      {
        text: "A connection reset during the TLS handshake, because the request may already be in flight",
        whyTempting: "A handshake failure means no request bytes were sent, making this among the safest retries.",
      },
      {
        text: "A 429 rate-limit response: retrying a request the server throttled only adds pressure",
        whyTempting: "429 is the canonical retryable status; it asks for backoff, not abandonment.",
      },
      { text: "A 400 naming an invalid field, because resending the same body earns the same 400 each time" },
    ],
    correct: 3,
    explanation:
      "Retries help only with transient failures; a deterministic client error burns the budget and delays the real error. Classify by whether a repeat could plausibly succeed.",
  },
  {
    concept: "cache-invalidation",
    difficulty: "easy",
    prompt:
      "The update path writes the row to the database and returns. Reads go through a 10-minute cache keyed by row id. What does a user see right after editing?",
    options: [
      {
        text: "The new value, because the write invalidates every cache key derived from the same row id",
        whyTempting: "Deriving the key from the id is not invalidation; nothing in the write path evicts anything.",
      },
      {
        text: "The new value for themselves, but the old one for everyone else on the cached copy",
        whyTempting: "Read-your-writes holds only if the writer bypasses the cache, which nothing here arranges.",
      },
      { text: "Nothing in the write path evicts the key, so the old value stands for up to ten minutes" },
      {
        text: "A mix of both, because most caches evict entries whose backing database row has changed",
        whyTempting: "Some caches offer invalidation hooks, but a plain TTL cache never learns the row changed.",
      },
    ],
    correct: 2,
    explanation:
      "A TTL cache with no explicit eviction serves whatever it stored until the entry expires. The write path has to delete or overwrite the key for the edit to be visible.",
  },
  {
    concept: "cache-invalidation",
    difficulty: "medium",
    prompt:
      "One very hot key expires at the exact moment traffic peaks, behind a plain read-through cache. What happens next?",
    options: [
      { text: "Each concurrent miss recomputes the same value, and the whole request set lands on the database" },
      {
        text: "The cache keeps serving the stale value to every caller while one request refreshes it",
        whyTempting: "That is stale-while-revalidate, a pattern you implement rather than a default behaviour.",
      },
      {
        text: "Only the first request misses, because the cache blocks every other caller until the key is populated",
        whyTempting: "Some clients do single-flight, but a bare get-then-set read-through takes no lock.",
      },
      {
        text: "The database absorbs it easily: identical queries are answered from its own result cache",
        whyTempting: "Query caches exist but are usually disabled, and any write to the table invalidates them.",
      },
    ],
    correct: 0,
    explanation:
      "A cache stampede is the whole concurrent request set arriving at the origin at once, which is often more load than the origin ever sees uncached. Single-flight locks, jittered TTLs, or early refresh are the standard defences.",
  },
  {
    concept: "cache-invalidation",
    difficulty: "hard",
    prompt:
      "A write path invalidates the cache key first and then runs the UPDATE. Under concurrency, which stale state can persist until the next write?",
    options: [
      {
        text: "The UPDATE can fail after the invalidation, leaving the key empty and reads unusually slow",
        whyTempting: "That really happens, but a cold cache is correct and self-healing, not stale.",
      },
      {
        text: "Two writers can invalidate at the same instant, and one of the two updates is silently lost",
        whyTempting: "It conflates cache ordering with a database lost update, which row locks already prevent.",
      },
      {
        text: "The cluster can replicate the delete after the set, because eviction propagates asynchronously",
        whyTempting: "Replication lag is real, yet the classic hole here opens in the application's own read path.",
      },
      { text: "A reader can miss between the two steps: the key is repopulated with the row about to change" },
    ],
    correct: 3,
    explanation:
      "Between the delete and the commit there is a window where a miss reads the old row and caches it, and that entry now outlives the write. Invalidating after the commit, or using a short TTL plus versioned keys, closes it.",
  },
  {
    concept: "missing-timeout",
    difficulty: "easy",
    prompt:
      "A service calls an internal API with an HTTP client that has no timeout configured. The API begins hanging instead of erroring. What happens to the caller?",
    options: [
      {
        text: "Requests fail fast with a connection error: the OS reaps idle sockets",
        whyTempting: "TCP keepalive eventually reaps dead peers, but a hung-yet-alive server keeps the socket healthy.",
      },
      { text: "Callers pile up until threads or pool slots run out, and every endpoint on that pool stalls" },
      {
        text: "Only that endpoint degrades, because each request runs on its own isolated worker thread",
        whyTempting: "Isolation holds right up until the shared pool is drained, which is what this failure does.",
      },
      {
        text: "The load balancer's own timeout protects it, because it closes the connection after 30 seconds",
        whyTempting: "The balancer frees the client, while your worker stays blocked on the upstream read.",
      },
    ],
    correct: 1,
    explanation:
      "Without a deadline the caller inherits the callee's worst case, and concurrency turns that into pool exhaustion across unrelated endpoints. This is the standard path from one slow dependency to a full outage.",
  },
  {
    concept: "missing-timeout",
    difficulty: "medium",
    prompt:
      "A PR sets a 2-second connect timeout on the HTTP client, yet requests still hang for minutes. Why?",
    options: [
      {
        text: "Two seconds is under the TCP retransmit interval, so the setting is silently ignored",
        whyTempting: "SYN retransmit timing is real, but it makes connects fail sooner rather than voiding the setting.",
      },
      {
        text: "Retries re-arm the timer, and three attempts can take three times the configured budget",
        whyTempting: "Cumulative retry time is a genuine trap; it just cannot stretch a single call to minutes.",
      },
      { text: "Only the handshake is covered by that setting: the read phase still carries no deadline" },
      {
        text: "DNS resolution runs before the timer starts, so a slow resolver blocks ahead of the connect",
        whyTempting: "DNS does sit outside many clients' connect timeout, which makes this half-right elsewhere.",
      },
    ],
    correct: 2,
    explanation:
      "Connect, read, write and total-request deadlines are separate settings in most clients, and a hanging server stalls the read phase. Set an overall deadline for the call, not just the handshake.",
  },
  {
    concept: "missing-timeout",
    difficulty: "hard",
    prompt:
      "Service A times out after 1 second. It calls B, which waits up to 30 seconds for C. What goes wrong when C slows to 10 seconds?",
    options: [
      { text: "B keeps burning capacity on requests A has abandoned, but nothing reads the results" },
      {
        text: "A retries, and B coalesces the second attempt into its in-flight request map",
        whyTempting: "Request coalescing is a real mitigation, but nothing in this chain implements it.",
      },
      {
        text: "B's longer timeout wins: A's one-second deadline is extended to 30 seconds",
        whyTempting: "It inverts the relationship: the shortest deadline in a chain is the one users experience.",
      },
      {
        text: "C sheds the excess load, because its own server-side timeout cancels the queued work first",
        whyTempting: "Server-side deadlines help only when the server enforces and propagates cancellation.",
      },
    ],
    correct: 0,
    explanation:
      "Deadlines must shrink as you go down the call chain, or downstream services spend their capacity computing responses nobody is waiting for. Propagating A's remaining budget to B and C is the fix.",
  },
  {
    concept: "env-secrets",
    difficulty: "easy",
    prompt:
      "An API key was committed in a config file three weeks ago and someone just noticed. What is the necessary first action?",
    options: [
      {
        text: "Force-push a rewritten history: the commit holding the key no longer exists",
        whyTempting: "History rewriting belongs in the cleanup, but it cannot recall clones that already fetched it.",
      },
      {
        text: "Add the file to `.gitignore`, and delete it in a follow-up commit to stop further exposure",
        whyTempting: "That prevents a recurrence and does nothing at all about the key already published.",
      },
      {
        text: "Make the repository private, which takes the key out of the publicly reachable git objects",
        whyTempting: "Visibility changes do not unpublish forks, proxy caches, or copies already scraped.",
      },
      { text: "Rotate the key, because anyone who cloned or forked the repo already holds the old one" },
    ],
    correct: 3,
    explanation:
      "Once a secret is distributed it is compromised, so revocation is the only step that actually restores control. History rewriting and gitignore are hygiene you do afterwards.",
  },
  {
    concept: "env-secrets",
    difficulty: "medium",
    prompt:
      "A CI job passes a token to `docker build --build-arg NPM_TOKEN=...` and uses it during install. Where does that value end up?",
    options: [
      {
        text: "Only in the CI runner's memory, because build args are scoped to the build process",
        whyTempting: "Build args feel ephemeral, yet they are recorded in the image's layer metadata.",
      },
      { text: "In the image's build history: layer metadata that anyone who can pull the image can read" },
      {
        text: "In the final layer, but only if a `RUN` step writes it into a file on the container's disk",
        whyTempting: "Writing it to disk is one leak path, but the argument value is retained either way.",
      },
      {
        text: "Nowhere persistent, because a multi-stage build always discards the earlier stages",
        whyTempting: "Multi-stage does drop earlier filesystems, while history and args can still be inspected.",
      },
    ],
    correct: 1,
    explanation:
      "`docker history` exposes build arguments baked into image metadata, so the token ships with every pull of the image. BuildKit secret mounts exist precisely because build args are not secret.",
  },
  {
    concept: "env-secrets",
    difficulty: "hard",
    prompt:
      "A web bundler is configured to substitute `process.env.STRIPE_SECRET_KEY` into the frontend build so a helper module can read it. What is the exposure?",
    options: [
      {
        text: "Only server-rendered pages hold it: the client bundle strips unrecognised env vars",
        whyTempting: "Bundlers strip what they were never told to inline; an explicit substitution is not stripped.",
      },
      {
        text: "It leaks only if the variable name carries the framework's public prefix, such as `NEXT_PUBLIC_`",
        whyTempting: "The prefix governs automatic exposure, not what a hand-written define rule does.",
      },
      { text: "The value is inlined as a string literal in the shipped bundle, readable by every visitor" },
      {
        text: "It stays server-side, because environment variables are read from the host at runtime",
        whyTempting: "True of a Node server process, but build-time substitution happens long before runtime.",
      },
    ],
    correct: 2,
    explanation:
      "Build-time substitution writes the literal string into the JavaScript that browsers download, so the key is public the moment the bundle ships. Secret keys belong behind a server endpoint, never in a client build.",
  },
  {
    concept: "auth-check",
    difficulty: "easy",
    prompt:
      "`GET /invoices/:id` verifies that the caller has a valid session, then loads the invoice by id and returns it. What is the flaw?",
    options: [
      { text: "Any logged-in user can read any invoice by changing the id, because no owner check runs" },
      {
        text: "Unauthenticated callers can read invoices, since the session check runs after the `SELECT`",
        whyTempting: "Ordering bugs like that exist, but here authentication genuinely happens first.",
      },
      {
        text: "Nothing serious, as long as invoice ids are random UUIDs an attacker cannot guess",
        whyTempting: "Unguessable ids raise the cost of enumeration; they are not an authorisation control.",
      },
      {
        text: "The only exposure is counting how many invoices exist, not reading their actual contents",
        whyTempting: "It downgrades a full authorisation break into a harmless-sounding information leak.",
      },
    ],
    correct: 0,
    explanation:
      "Authentication establishes who is calling; authorisation must still check that this caller owns this record. The fix is to scope the query by the session's account, not to filter after loading.",
  },
  {
    concept: "auth-check",
    difficulty: "medium",
    prompt:
      "`PATCH /users/me` checks the session, then copies the JSON body's fields onto the caller's user record. What can a user do with that?",
    options: [
      {
        text: "Escalate only if the JWT is unsigned, since the effective role is read back from the token",
        whyTempting: "Token tampering is a different escalation path; here a database column grants the role.",
      },
      {
        text: "Nothing harmful, because ORMs reject body fields absent from the update schema",
        whyTempting: "Some ORMs filter unknown keys, but `role` is a real column and passes straight through.",
      },
      { text: "Set their own `role` to admin by adding that field to the JSON body of the request" },
      {
        text: "Only read fields they should not see: the endpoint echoes the merged record back",
        whyTempting: "It reframes a privilege escalation as a response-shaping problem with a cosmetic fix.",
      },
    ],
    correct: 2,
    explanation:
      "Mass assignment lets the client choose which columns to write, so any privileged column becomes user-controlled. Allow-list the updatable fields instead of copying the body.",
  },
  {
    concept: "auth-check",
    difficulty: "hard",
    prompt:
      "Auth middleware is mounted with a path matcher for `/api/*`. A PR adds an admin CSV export at `/internal/reports`. What is the likely outcome?",
    options: [
      {
        text: "The route inherits the app's default policy: it fails closed and answers 401 to everyone",
        whyTempting: "Failing closed is what you want, but path-matched middleware is fail-open by construction.",
      },
      {
        text: "It is protected anyway, because the framework always runs middleware globally and the matcher only orders it",
        whyTempting: "This confuses middleware ordering with middleware scoping: the matcher decides what runs.",
      },
      {
        text: "It is reachable but harmless, because `/internal/*` is not routable through the public ingress",
        whyTempting: "Network obscurity is not access control, and ingress rules are rarely as tight as assumed.",
      },
      { text: "The new route runs with no authentication, because the matcher covers only the `/api/*` prefix" },
    ],
    correct: 3,
    explanation:
      "Path-scoped middleware protects only the paths it matches, so every new prefix is unprotected until someone remembers to add it. Deny-by-default routing, or a check inside the handler, avoids the class entirely.",
  },
];
