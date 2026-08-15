import type { BankEntry } from "./types.js";

/**
 * Ruby.
 *
 * Measured over 100 Ruby-touching PRs across rails, discourse and mastodon.
 * Two of these concepts are ActiveSupport rather than core Ruby (`blank?` and
 * relation laziness), kept because they fire on a quarter of real Ruby diffs
 * and carry a misconception that ships bugs.
 */
export const RUBY_ENTRIES: BankEntry[] = [
  // ── ruby-blank-vs-nil ────────────────────────────────────────────────────
  {
    concept: "ruby-blank-vs-nil",
    difficulty: "easy",
    prompt:
      "A setting is read as `config[:notifications].presence || true`. A user sets it to `false` to turn notifications off. What do they get?",
    options: [
      {
        text: "Notifications on, because `false` is blank, so `presence` returns nil and the default wins",
      },
      {
        text: "Notifications off, since `presence` only replaces nil and empty strings",
        whyTempting:
          "`presence` is described as nil-or-value in most summaries, and for strings that description holds.",
      },
      {
        text: "A NoMethodError, because `false` has no `presence` method defined on it",
        whyTempting:
          "ActiveSupport does define blank? on Object, so a method-missing guess is reasonable if you have not checked.",
      },
      {
        text: "Notifications off, and the same code with `nil` would raise rather than default",
        whyTempting:
          "`||` on nil is the case people test, so it is easy to assume the interesting behaviour is over there.",
      },
    ],
    correct: 0,
    explanation:
      "`false.blank?` is true, so `presence` turns an explicit false into nil and `||` then supplies the default. Any boolean setting needs `key?` or an explicit `nil?` check, never truthiness.",
  },
  {
    concept: "ruby-blank-vs-nil",
    difficulty: "medium",
    prompt:
      "Which values are `blank?` in a Rails app: `nil`, `false`, `\"\"`, `\" \"`, `[]`, `{}`, `0`, `\"0\"`?",
    options: [
      {
        text: "All except `0` and `\"0\"`, which are present",
      },
      {
        text: "All except `\" \"`, `0` and `\"0\"`, since a string with content is present",
        whyTempting:
          "It is the plain-Ruby reading, and `\" \".empty?` is genuinely false, which is what makes the exception worth knowing.",
      },
      {
        text: "Only `nil` and `\"\"`, since blank? is defined as nil-or-empty on the base object",
        whyTempting:
          "That is the definition on Object, and it is what most people carry when they have not read the collection cases.",
      },
      {
        text: "All except `0`, because a numeric zero is the only value Rails treats as present by exception",
        whyTempting:
          "Zero being falsy in other languages makes it the value people expect to be the special case here.",
      },
    ],
    correct: 0,
    explanation:
      "`blank?` is `respond_to?(:empty?) ? !!empty? : !self`, plus a whitespace-only override for String. Numbers are never blank, which is why a quantity of zero survives a `presence` guard and a boolean false does not.",
  },
  {
    concept: "ruby-blank-vs-nil",
    difficulty: "hard",
    prompt:
      "A model does `validates :name, presence: true` and separately a query does `where.not(name: nil)`. A row with `name` set to `\"\"` was written before the validation existed. Which of these finds it?",
    options: [
      {
        text: "Neither: the validation only runs on save, and the query asks the database, which does not know about blank?",
      },
      {
        text: "The query, because Rails translates `where.not(name: nil)` into a blankness check on string columns",
        whyTempting:
          "Rails does rewrite some nil conditions into IS NOT NULL, so believing the translation goes further is a small step.",
      },
      {
        text: "The validation, since it runs on load as well as save for any attribute with a presence rule",
        whyTempting:
          "`valid?` really does re-run validations on demand, so it feels like they could be load-time.",
      },
      {
        text: "Both, since presence validation adds a NOT NULL AND != '' constraint to the column at migration time",
        whyTempting:
          "Validations and database constraints do get conflated, and adding both is exactly the right practice.",
      },
    ],
    correct: 0,
    explanation:
      "`presence: true` is application-level and only runs when the record is saved through the model. The database has no idea what blank means, so historical rows and anything written outside the model can violate it.",
  },

  // ── ruby-frozen-shallow ──────────────────────────────────────────────────
  {
    concept: "ruby-frozen-shallow",
    difficulty: "easy",
    prompt:
      "`CONFIG = { hosts: [] }.freeze` sits at the top of a class. Somewhere else `CONFIG[:hosts] << \"a.example\"` runs. What happens?",
    options: [
      {
        text: "The push succeeds and the array grows, since freeze reaches the hash and not the objects inside it",
      },
      {
        text: "A FrozenError, because freezing a container freezes everything reachable from it",
        whyTempting:
          "It is what the word suggests and what `Ractor.make_shareable` actually does, so the behaviour exists nearby.",
      },
      {
        text: "The push succeeds on a copy, because reading a key from a frozen hash returns a dup",
        whyTempting:
          "Copy-on-read would make this safe, and it is what a defensive implementation would do.",
      },
      {
        text: "A FrozenError only in Ruby 3.x, since shallow freeze was deepened when Ractors landed",
        whyTempting:
          "Ractors did bring `make_shareable`, so tying a semantic change to that release is a coherent story.",
      },
    ],
    correct: 0,
    explanation:
      "`freeze` is one level deep: the hash rejects new keys and the array it holds is untouched. Use `Ractor.make_shareable` for a deep freeze, or freeze each nested value as you build it.",
  },
  {
    concept: "ruby-frozen-shallow",
    difficulty: "medium",
    prompt:
      "`a = frozen_string.dup` and `b = frozen_string.clone`. Which is safe to mutate, and why?",
    options: [
      {
        text: "`a`: dup drops the frozen state while clone copies it, so `b` raises on the first mutation",
      },
      {
        text: "Both, since a copy is a new object and freezing is a property of the original",
        whyTempting:
          "That is the intuitive model and it is right for `dup`, which is half the pair and the half people use.",
      },
      {
        text: "`b`: clone takes a mutable copy and dup preserves the source's state including frozen",
        whyTempting:
          "The two names give no hint which way round it goes, so a coin flip lands here half the time.",
      },
      {
        text: "Neither, because a copy of a frozen string is deduplicated into the same frozen instance",
        whyTempting:
          "String deduplication is real under a frozen-string-literal pragma, which makes this a live mechanism.",
      },
    ],
    correct: 0,
    explanation:
      "`clone` copies frozen state and singleton methods, and `dup` copies neither. `clone(freeze: false)` gives you the third option when you want the singleton methods and a mutable result.",
  },
  {
    concept: "ruby-frozen-shallow",
    difficulty: "hard",
    prompt:
      "A PR removes four `.freeze` calls from assignment sites and re-does them as `Ractor.make_shareable` in an `after_initialize` hook. What problem was the original pattern causing?",
    options: [
      {
        text: "Each `.freeze` locked one object while the values it referenced stayed mutable and shared across threads",
      },
      {
        text: "Freezing at assignment time ran before the values existed, so the calls froze nil and did nothing",
        whyTempting:
          "Initialisation order really does cause this, and it would explain a fix that moves work into a hook.",
      },
      {
        text: "Freezing a constant at assignment prevents later reassignment, and the config had to stay replaceable",
        whyTempting:
          "Constant reassignment warnings are a real Ruby annoyance, so the two ideas sit close together.",
      },
      {
        text: "`.freeze` on a string literal is a no-op under the frozen-string-literal pragma, so the calls were dead code",
        whyTempting:
          "Redundant freeze on literals is a genuine style-guide finding, and would justify deleting the calls.",
      },
    ],
    correct: 0,
    explanation:
      "Shallow freeze on a config object leaves the nested hashes and arrays writable, which is exactly the state a second thread or Ractor can corrupt. `make_shareable` walks the graph and freezes all of it, which is the guarantee the code needed.",
  },

  // ── ruby-proc-vs-lambda ──────────────────────────────────────────────────
  {
    concept: "ruby-proc-vs-lambda",
    difficulty: "easy",
    prompt:
      "A validation is written as `check = Proc.new { |v| return false if v.nil?; true }` and called from inside a method. On a nil value, what does the enclosing method do?",
    options: [
      {
        text: "Returns false itself, because `return` inside a proc returns from the method that defined it",
      },
      {
        text: "Continues with `check` having evaluated to false, since return exits the proc body",
        whyTempting:
          "That is exactly how a lambda behaves, and the two are close enough that the distinction is easy to lose.",
      },
      {
        text: "Raises LocalJumpError, because a proc has no frame of its own to return from",
        whyTempting:
          "LocalJumpError is real and does fire for this, once the defining method has already returned.",
      },
      {
        text: "Returns nil, since a bare `return false` inside a block is parsed as a value and discarded",
        whyTempting:
          "Blocks do produce values from their last expression, which makes discarding the return sound plausible.",
      },
    ],
    correct: 0,
    explanation:
      "A proc shares the return semantics of the block it came from, so `return` leaves the enclosing method. A lambda has its own frame, which is why callbacks that need to produce a value should be lambdas.",
  },
  {
    concept: "ruby-proc-vs-lambda",
    difficulty: "medium",
    prompt:
      "`p = proc { |a, b| [a, b] }` and `l = ->(a, b) { [a, b] }`. What does each do when called with one argument?",
    options: [
      {
        text: "`p.call(1)` gives `[1, nil]`, and `l.call(1)` raises ArgumentError",
      },
      {
        text: "Both raise ArgumentError, since arity is checked at call time for any callable",
        whyTempting:
          "Method calls do check arity, and treating a callable as a method is the default assumption.",
      },
      {
        text: "`p.call(1)` gives `[1]`, and `l.call(1)` gives `[1, nil]`, since a lambda pads missing arguments",
        whyTempting:
          "Padding is real behaviour, applied here to the wrong half of the pair.",
      },
      {
        text: "Both give `[1, nil]`, and the difference between them shows up only in `return`",
        whyTempting:
          "The return difference is the headline one, so assuming it is the only one is a common shortcut.",
      },
    ],
    correct: 0,
    explanation:
      "A proc destructures like a block: extra arguments are dropped and missing ones become nil. A lambda checks arity like a method, which is why an interface you want enforced should be a lambda.",
  },
  {
    concept: "ruby-proc-vs-lambda",
    difficulty: "hard",
    prompt:
      "A framework calls `user_callback.make_lambda` on every callback a user registers, then stores the result. What class of bug does that convert into a loud one?",
    options: [
      {
        text: "A user block containing `return` that would otherwise abort the framework method that invoked it",
      },
      {
        text: "A user block capturing self, which would otherwise leak the caller's instance into the framework's scope",
        whyTempting:
          "Closures do capture self, and scope leakage is a real reason frameworks reach for instance_exec.",
      },
      {
        text: "A user block that mutates its arguments, since lambdas receive copies rather than references",
        whyTempting:
          "Argument copying would be a meaningful guarantee, and some languages do give it for value types.",
      },
      {
        text: "A user block registered twice, which lambda conversion deduplicates by identity",
        whyTempting:
          "Duplicate callback registration is a real bug class, and identity comparison is how you would catch it.",
      },
    ],
    correct: 0,
    explanation:
      "Converting to a lambda gives the callback its own frame, so a stray `return` ends the callback and not the framework method that called it. It also turns a silent arity mismatch into an ArgumentError at the call site.",
  },

  // ── ruby-safe-navigation ─────────────────────────────────────────────────
  {
    concept: "ruby-safe-navigation",
    difficulty: "easy",
    prompt:
      "`user&.profile.name` is written to guard against a nil user. `user` is nil. What happens?",
    options: [
      {
        text: "Only the first call is guarded, so `nil.name` still runs and raises NoMethodError",
      },
      {
        text: "nil, since `&.` makes the rest of the chain nil-safe once it short-circuits",
        whyTempting:
          "It is what the operator looks like it does, and it is how optional chaining works in several other languages.",
      },
      {
        text: "A syntax error, since `&.` and `.` cannot be mixed in one chain",
        whyTempting:
          "Ruby does have parsing rules around `&.` that catch people out, so a parse error is a fair guess.",
      },
      {
        text: "nil, and the same chain on a non-nil user with a nil profile would raise",
        whyTempting:
          "The second half is exactly right, which makes the wrong first half easy to accept alongside it.",
      },
    ],
    correct: 0,
    explanation:
      "`&.` guards one call only, so the chain has to be `user&.profile&.name`. This is the single most common way the operator gives false confidence.",
  },
  {
    concept: "ruby-safe-navigation",
    difficulty: "medium",
    prompt:
      "`flag&.enabled?` where `flag` holds `false`. What does the expression evaluate to?",
    options: [
      {
        text: "NoMethodError, because `&.` only short-circuits on nil and `false` is a real receiver",
      },
      {
        text: "nil, since `&.` short-circuits on any falsy receiver",
        whyTempting:
          "Falsy is one category in most languages, and Ruby's nil-and-false pairing everywhere else reinforces it.",
      },
      {
        text: "false, because `&.` returns the receiver unchanged when the method is undefined on it",
        whyTempting:
          "Returning the receiver would make chains composable, which is how some fluent APIs behave.",
      },
      {
        text: "false, since `enabled?` is defined on Object and answers for any receiver",
        whyTempting:
          "Ruby does define a surprising number of methods on Object, so this is not an unreasonable belief.",
      },
    ],
    correct: 0,
    explanation:
      "`&.` tests for nil specifically, and `false` is an ordinary object that happens to be falsy. A three-state value stored as nil, false or true needs an explicit `nil?` check.",
  },
  {
    concept: "ruby-safe-navigation",
    difficulty: "hard",
    prompt:
      "A hot path is `@post&.hotlinked_media&.preload(:upload)&.index_by(&:url)`. A reviewer asks why the last call is guarded. What does the guard cost or protect against?",
    options: [
      {
        text: "It protects against `preload` returning nil, and if preload always returns a relation the guard hides a future nil rather than handling one",
      },
      {
        text: "It costs a method dispatch per call, which is why style guides ban `&.` in loops",
        whyTempting:
          "There is a small cost, and performance is the usual reason to question an operator in a hot path.",
      },
      {
        text: "It protects against an empty relation, since `index_by` on an empty collection returns nil",
        whyTempting:
          "Empty-versus-nil is genuinely worth checking, and several Enumerable methods do return nil on empty.",
      },
      {
        text: "It is required for the chain to parse, since `&.` must be used consistently across a chain",
        whyTempting:
          "Consistency is a real style rule, which makes a syntax requirement sound like the strong form of it.",
      },
    ],
    correct: 0,
    explanation:
      "Each `&.` guards exactly one call, so the question is whether that call can genuinely return nil. Guarding a call that never returns nil converts a future bug into a silent nil that travels somewhere else.",
  },

  // ── ruby-memoization ─────────────────────────────────────────────────────
  {
    concept: "ruby-memoization",
    difficulty: "easy",
    prompt:
      "`def owner; @owner ||= lookup_owner; end` where `lookup_owner` legitimately returns nil for unowned records. How many times does `lookup_owner` run for such a record?",
    options: [
      {
        text: "Once per call, since nil is never stored as a cached result and the lookup repeats forever",
      },
      {
        text: "Once, because `||=` assigns the result whatever it is and later calls read the ivar",
        whyTempting:
          "That is what the operator looks like it does, and it is true for every non-nil, non-false result.",
      },
      {
        text: "Twice: once to compute nil and once more after the ivar is defined, then it settles",
        whyTempting:
          "`defined?`-based memoization has a two-phase feel, so a settling story sounds like a real mechanism.",
      },
      {
        text: "Once per call, and a warning is emitted about an uninitialized instance variable each time",
        whyTempting:
          "Ruby does warn about uninitialized ivars under `-W`, so the warning is real in some configurations.",
      },
    ],
    correct: 0,
    explanation:
      "`a ||= b` is `a || a = b`, so a falsy cached value fails the test and recomputes every time. Memoize with `defined?(@owner) ? @owner : @owner = lookup_owner` when nil and false are legitimate results.",
  },
  {
    concept: "ruby-memoization",
    difficulty: "medium",
    prompt:
      "A memoized method registers a listener as a side effect. Under a threaded server the listener sometimes appears twice. What is the mechanism?",
    options: [
      {
        text: "`||=` is read, then compute, then write, and two threads can both read nil before either writes",
      },
      {
        text: "Instance variables are not shared across threads, so each thread memoizes into its own copy",
        whyTempting:
          "Thread-local storage would explain duplicate work, and Ruby does have `Thread.current` for exactly that.",
      },
      {
        text: "The GVL releases between the read and the write only for IO, so the race requires the listener to do IO",
        whyTempting:
          "The GVL genuinely does release around IO, which makes this a real constraint applied too narrowly.",
      },
      {
        text: "`||=` on an ivar compiles to two bytecodes that the interpreter may reorder under load",
        whyTempting:
          "Reordering is a real hazard in other runtimes, and the two-bytecode framing sounds precise.",
      },
    ],
    correct: 0,
    explanation:
      "Memoization is check-then-act, so the compute step can run more than once even though only one result is kept. That is harmless for a pure computation and wrong the moment the computation has a side effect.",
  },
  {
    concept: "ruby-memoization",
    difficulty: "hard",
    prompt:
      "A PR deletes `@root ||= \"#{Rails.root}/\"` from a shared object as part of making it Ractor-safe. Why does a read-only-looking memo block that?",
    options: [
      {
        text: "The memo writes to the object on first read, and a shareable object cannot be mutated from a Ractor",
      },
      {
        text: "String interpolation allocates, and Ractors forbid allocation of unshareable objects inside a shared method",
        whyTempting:
          "Ractor sharing rules really are about object shareability, so an allocation-focused answer sounds adjacent.",
      },
      {
        text: "`Rails.root` is not shareable, so any method touching it is rejected regardless of the memo",
        whyTempting:
          "It might well be true of Rails.root, which makes the memo look incidental rather than the point.",
      },
      {
        text: "Memoized values are stored in a per-class table that Ractors cannot see, so each Ractor recomputes",
        whyTempting:
          "Recomputing per Ractor would be an acceptable outcome, which makes it sound like a design rather than a bug.",
      },
    ],
    correct: 0,
    explanation:
      "A memo is a write, so an object that must be frozen to be shared cannot carry one. The usual fix is to compute the value eagerly at initialization, before the object is made shareable.",
  },

  // ── ruby-kwargs-separation ───────────────────────────────────────────────
  {
    concept: "ruby-kwargs-separation",
    difficulty: "easy",
    prompt:
      "`def build(app, *args); Middleware.new(app, *args); end` is called as `build(app, timeout: 5)`. `Middleware#initialize` is `def initialize(app, timeout: 30)`. What timeout does the middleware get?",
    options: [
      {
        text: "30, because the options hash is forwarded as a positional argument and never binds to the keyword",
      },
      {
        text: "5, since a trailing hash is converted to keywords automatically when the callee declares them",
        whyTempting:
          "That was exactly the behaviour up to Ruby 2.7, so it is right for a very large amount of existing code.",
      },
      {
        text: "5, because `*args` splats keywords back into keywords when the receiving method has no positional slot for them",
        whyTempting:
          "It correctly senses the missing slot, then assumes Ruby resolves the ambiguity in the caller's favour.",
      },
      {
        text: "30, and Ruby prints a deprecation warning about the separation on every call",
        whyTempting:
          "2.7 really did warn about this, which is what many people last saw before the behaviour changed for good.",
      },
    ],
    correct: 0,
    explanation:
      "Ruby 3 separated positional and keyword arguments, so `*args` carries a hash as a hash. Forward with `*args, **kwargs`, or use `...` to pass everything through unchanged.",
  },
  {
    concept: "ruby-kwargs-separation",
    difficulty: "medium",
    prompt:
      "A method is `def call(*args, **opts, &blk)`. A caller passes a literal hash as the last positional argument: `call(1, {a: 2})`. Where does the hash land?",
    options: [
      {
        text: "In `args`, as a plain hash, and `opts` stays empty",
      },
      {
        text: "In `opts`, since a hash literal in final position is keyword syntax",
        whyTempting:
          "Braces and keyword arguments look alike at the call site, which is most of why the separation was needed.",
      },
      {
        text: "In both, since Ruby duplicates a trailing hash to keep pre-3.0 code working",
        whyTempting:
          "Compatibility shims did exist during the transition, so a duplication story fits the history.",
      },
      {
        text: "In `opts` only when the keys are symbols, and in `args` otherwise",
        whyTempting:
          "Symbol keys really were the trigger for the old auto-conversion, so this is the pre-3.0 rule stated precisely.",
      },
    ],
    correct: 0,
    explanation:
      "An explicit hash is positional and `**` is what makes it keywords. `call(1, **{a: 2})` sends it to `opts`, and that visible difference is the point of the separation.",
  },
  {
    concept: "ruby-kwargs-separation",
    difficulty: "hard",
    prompt:
      "A gem replaces `args << Hash.ruby2_keywords_hash(kwargs)` with `klass.new(app, *args, **kwargs, &block)`. What was `ruby2_keywords_hash` doing?",
    options: [
      {
        text: "Flagging a hash so that a later splat would deliver it as keywords, which is the shim the explicit form replaces",
      },
      {
        text: "Freezing the hash so that the callee could not mutate the caller's options",
        whyTempting:
          "Defensive freezing of options is a real gem practice, and the method name gives no clue against it.",
      },
      {
        text: "Converting string keys to symbols so the callee's keyword parameters would bind",
        whyTempting:
          "Key type genuinely matters for keyword binding, so a conversion helper is a plausible reading of the name.",
      },
      {
        text: "Marking the hash so `respond_to_missing?` would forward unknown keys to the parent middleware",
        whyTempting:
          "Middleware forwarding is the surrounding context, which makes a delegation story fit the diff.",
      },
    ],
    correct: 0,
    explanation:
      "`ruby2_keywords` marks a hash so a splat through an intermediate method still arrives as keywords, which is how delegation survived the 3.0 separation without rewriting every signature. Once every layer forwards `**kwargs` explicitly, the flag is dead weight.",
  },

  // ── ruby-mutating-shared ─────────────────────────────────────────────────
  {
    concept: "ruby-mutating-shared",
    difficulty: "easy",
    prompt:
      "`list = list.uniq!` runs on an array that already has no duplicates. What is `list` afterwards?",
    options: [
      {
        text: "nil, because the bang method returns nil when it changed nothing",
      },
      {
        text: "The same array, since a bang method returns self so it can be chained",
        whyTempting:
          "Plenty of bang methods do return self, and chaining is exactly what the assignment is reaching for.",
      },
      {
        text: "An empty array, since uniq! with nothing to remove reduces to the identity element",
        whyTempting:
          "It fits the observation that something goes wrong, and empty is the failure people notice first.",
      },
      {
        text: "The same array, and the nil-return behaviour applies only to `sub!` and `gsub!` on strings",
        whyTempting:
          "Those two are the famous cases, so believing the behaviour is string-specific is a common narrowing.",
      },
    ],
    correct: 0,
    explanation:
      "`uniq!`, `compact!`, `flatten!`, `reject!`, `sub!` and friends return nil when they made no change. Mutate in place and keep the original name, or use the non-bang version and assign.",
  },
  {
    concept: "ruby-mutating-shared",
    difficulty: "medium",
    prompt:
      "`copy = original.dup` where `original` is `{ a: [1, 2] }`. Then `copy[:a] << 3`. What is `original[:a]`?",
    options: [
      {
        text: "`[1, 2, 3]`, because dup copies the hash and both hashes point at the same array",
      },
      {
        text: "`[1, 2]`, since dup on a collection copies its contents one level down",
        whyTempting:
          "One level down is exactly what dup does, and the disagreement is over which level counts as one.",
      },
      {
        text: "`[1, 2]`, because `<<` on a value read from a duped hash triggers copy-on-write",
        whyTempting:
          "Copy-on-write is a real strategy and would make this safe, so it is a comfortable thing to assume.",
      },
      {
        text: "`[1, 2, 3]`, and using `clone` instead would have produced an independent copy",
        whyTempting:
          "The dup and clone distinction is real, so expecting it to cover depth as well is one step too far.",
      },
    ],
    correct: 0,
    explanation:
      "`dup` copies the container and shares every object inside it. For an independent nested structure use `deep_dup` in Rails, or rebuild the nested values by hand.",
  },
  {
    concept: "ruby-mutating-shared",
    difficulty: "hard",
    prompt:
      "A notification registry does `subscribers.each { |name, list| copy[name] = list.dup }` rather than `copy = subscribers.dup`. What does the per-value dup buy?",
    options: [
      {
        text: "Each subscriber list becomes independent, so a later `<<` on one copy does not append to the registry's list",
      },
      {
        text: "It forces a rehash, which is what makes the copy safe to read while another thread writes",
        whyTempting:
          "Concurrency is the surrounding concern, and rehashing genuinely does matter for concurrent hash reads.",
      },
      {
        text: "It converts the values to frozen arrays, since `dup` on an array reached through iteration returns a frozen copy",
        whyTempting:
          "Freezing is what you would want here, and it is what `freeze` in the same position would give you.",
      },
      {
        text: "It removes the default proc from the hash, which would otherwise be shared with the copy",
        whyTempting:
          "Default procs really do survive a dup and really are shared, so it is a true fact about a different field.",
      },
    ],
    correct: 0,
    explanation:
      "A hash dup shares its values, so a copy of a registry still hands out the same arrays. Duping each value is the one-level-deeper copy the code actually needed.",
  },

  // ── ruby-relation-laziness ───────────────────────────────────────────────
  {
    concept: "ruby-relation-laziness",
    difficulty: "easy",
    prompt:
      "`users = User.where(active: true)` executes in a console with no SQL logged. When does the query run?",
    options: [
      {
        text: "On the first operation that needs rows: iteration, `to_a`, `first`, `length`, or an interpolation into a string",
      },
      {
        text: "Immediately, and the log is quiet because `where` uses a prepared statement cache rather than a fresh query",
        whyTempting:
          "Prepared statements are real and do change what shows in some logs, which makes a logging explanation plausible.",
      },
      {
        text: "At the end of the enclosing request, when the connection pool flushes pending relations",
        whyTempting:
          "Batching until a flush point is how several ORMs in other languages work, and it is a coherent design.",
      },
      {
        text: "Never on its own: a relation must be sent `load` or `execute` before it will contact the database",
        whyTempting:
          "`load` is a real method that forces it, so treating it as required rather than optional is a small step.",
      },
    ],
    correct: 0,
    explanation:
      "A relation is a query builder, and it runs when something asks for records. That is why `where` can be chained freely, and why a relation passed into a view issues its query wherever the view happens to touch it.",
  },
  {
    concept: "ruby-relation-laziness",
    difficulty: "medium",
    prompt:
      "A loop calls `orders.count` on each pass and a colleague changes it to `orders.size`. What changed?",
    options: [
      {
        text: "`count` always issues a fresh COUNT query, and `size` uses the loaded records when the relation is already loaded",
      },
      {
        text: "`size` counts in Ruby and `count` counts in SQL, so `size` now loads every row into memory on each pass",
        whyTempting:
          "`length` really does that, and `size` really can, so this is right for the relation-not-loaded case.",
      },
      {
        text: "Nothing measurable: both delegate to the same SQL and the difference is stylistic",
        whyTempting:
          "They do return the same number, which is what most code cares about and what most review comments notice.",
      },
      {
        text: "`size` caches the first result for the request, so a change made mid-loop is invisible to later passes",
        whyTempting:
          "Query caching per request is real in Rails, and it does make repeated identical queries cheap.",
      },
    ],
    correct: 0,
    explanation:
      "`size` asks the relation whether it is loaded and counts in memory when it is, falling back to SQL when it is not. `count` never uses the loaded records, which is what turns a loop into N queries.",
  },
  {
    concept: "ruby-relation-laziness",
    difficulty: "hard",
    prompt:
      "`Order.where(state: :open).order(:created_at).find_each { |o| ... }` processes rows in an order nobody expected. What did `find_each` do?",
    options: [
      {
        text: "Discarded the `order` clause and batched by primary key, because that is how it keeps the cursor stable across batches",
      },
      {
        text: "Kept the order and reloaded the relation per batch, so rows created during the run are interleaved",
        whyTempting:
          "Reloading per batch is exactly what it does, which makes the half about ordering easy to accept too.",
      },
      {
        text: "Applied the order within each batch and not across them, so batches are sorted and the sequence is not",
        whyTempting:
          "It is a precise-sounding description of a real phenomenon, and it is what a naive implementation would give.",
      },
      {
        text: "Ignored the `where` as well, since batching rebuilds the relation from the model rather than the chain",
        whyTempting:
          "Overstating the same mechanism is a natural guess once you suspect the chain is being rebuilt.",
      },
    ],
    correct: 0,
    explanation:
      "`find_each` batches with `WHERE id > ?` and therefore overrides any order you supplied, logging a warning as it does so. Use `in_batches` with your own cursor when the order is part of the requirement.",
  },
];
