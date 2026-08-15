import type { BankEntry } from "./types.js";

/**
 * Go.
 *
 * Chosen by running candidate rules over 55 merged PRs from kubernetes and
 * grafana and keeping the ones that fired on real diffs. Several of these are
 * everyday idiom rather than exotica, which is deliberate: the median Go PR is
 * error handling, map access and type assertions, so that is where the
 * misconceptions live.
 */
export const GO_ENTRIES: BankEntry[] = [
  // ── go-error-value-pair ──────────────────────────────────────────────────
  {
    concept: "go-error-value-pair",
    difficulty: "easy",
    prompt:
      "A search indexer ships `ts, err := obj.GetUpdatedTimestamp()` followed by `if err != nil && ts != nil { doc.Updated = ts.UnixMilli() }`. Every document indexes `updated: 0`. Why?",
    options: [
      {
        text: "The body runs only when the call failed, and on the success path the assignment is skipped",
      },
      {
        text: "`ts` is nil whenever `err` is nil, so the second half of the condition is never satisfied",
        whyTempting:
          "Returning a nil value alongside a nil error is a real API shape, and it fails in exactly this way.",
      },
      {
        text: "`UnixMilli` on a zero Time returns 0, so the branch runs and writes a zero anyway",
        whyTempting:
          "A zero `time.Time` really does produce a large negative number, so the zero has to come from somewhere.",
      },
      {
        text: "`&&` in Go does not short-circuit, so both operands are evaluated and the nil deref is swallowed",
        whyTempting:
          "Short-circuiting is easy to doubt under pressure, and Go does evaluate left to right exactly as expected.",
      },
    ],
    correct: 0,
    explanation:
      "`err != nil` is the failure branch, so the guard reads the value on the path where it is meaningless and skips it on the path where it is good. One character between `!=` and `==` decides whether the feature works.",
  },
  {
    concept: "go-error-value-pair",
    difficulty: "medium",
    prompt:
      "`f, err := os.Open(path)` returns a non-nil error. A colleague adds `defer f.Close()` on the next line, before the error check, to guarantee cleanup. What does that ship?",
    options: [
      {
        text: "A nil pointer dereference at function exit, because `os.Open` returns a nil `*File` alongside the error",
      },
      {
        text: "Nothing harmful: `Close` on a nil `*File` returns `ErrInvalid` and the deferred call discards it",
        whyTempting:
          "`(*os.File).Close` really does have a nil check and return ErrInvalid, so this is right for os.File and wrong as a rule.",
      },
      {
        text: "A resource leak, since a deferred call registered before the error check is skipped on the error return",
        whyTempting:
          "Deferred calls do have registration-order subtleties, but registration is what schedules them, not the return path.",
      },
      {
        text: "A vet failure, because Go forbids deferring a method on a value whose error has not been checked",
        whyTempting:
          "`errcheck` and `lostcancel` are real analysers, so expecting the toolchain to catch this is reasonable.",
      },
    ],
    correct: 0,
    explanation:
      "When a Go function returns an error the other results are usually zero values, so touching them is only safe after the check. `os.File` happens to guard its nil receiver, and the same line against most other types panics.",
  },
  {
    concept: "go-error-value-pair",
    difficulty: "hard",
    prompt:
      "`func find(id string) (*Row, error)` returns `nil, nil` when nothing matched. A caller does `row, err := find(id); if err != nil { return err }; return row.Render()`. What is the defect and where does it live?",
    options: [
      {
        text: "In the callee: three states are encoded in two return values, so every caller has to know that nil, nil means absent",
      },
      {
        text: "In the caller: it should compare against a typed nil, since a nil `*Row` inside an interface is not nil",
        whyTempting:
          "The typed-nil-in-an-interface trap is real and famous, and it bites the moment the return type becomes an interface.",
      },
      {
        text: "In the callee: returning a nil pointer with a nil error is a compile error under Go's nilness analysis",
        whyTempting:
          "`go vet` does ship a nilness pass, and it flags some of these, which makes a compile error feel one step away.",
      },
      {
        text: "In the caller: `row.Render()` on a nil receiver panics, and it should use a comma-ok form instead",
        whyTempting:
          "The panic is real, and the comma-ok form is the right fix for maps, so the instinct transfers to the wrong construct.",
      },
    ],
    correct: 0,
    explanation:
      "Not-found is a third outcome and needs its own signal: a sentinel like `ErrNotFound`, or a `(value, found, error)` triple. Leaving it implicit means the panic lands in a caller that never had the information to prevent it.",
  },

  // ── go-map-zero-value ────────────────────────────────────────────────────
  {
    concept: "go-map-zero-value",
    difficulty: "easy",
    prompt:
      "A config struct has `Overrides map[string]string` and nobody calls `make`. Reads work all through the test suite. Production panics on the first write. Why the asymmetry?",
    options: [
      {
        text: "Reading a nil map yields the zero value, and writing to one panics",
      },
      {
        text: "The nil map is allocated lazily on first access, and the panic comes from two writes racing that allocation",
        whyTempting:
          "Concurrent map writes do panic with a specific message, and lazy allocation is how several languages work.",
      },
      {
        text: "Reads are fine and writes panic only when the key is absent, since an existing key is written in place",
        whyTempting:
          "It explains why some writes could survive, and update-versus-insert is a real distinction in other containers.",
      },
      {
        text: "The struct was copied before the write, and a map field copies as nil rather than sharing the header",
        whyTempting:
          "Struct copying and map sharing is a genuine Go subtlety, just the opposite of this one: maps do share.",
      },
    ],
    correct: 0,
    explanation:
      "A nil map is a valid empty map for reading, `len` and `range`, and assigning to a key panics. Initialise it in the constructor, and be suspicious of any map field a struct literal can skip.",
  },
  {
    concept: "go-map-zero-value",
    difficulty: "medium",
    prompt:
      "`if cfg[\"timeout\"] == \"\" { cfg[\"timeout\"] = \"30s\" }` runs over a user-supplied config. A user sets `timeout: \"\"` deliberately to mean no timeout. What does the code do?",
    options: [
      {
        text: "Overwrites it with 30s, because an absent key and an empty value both read as the empty string",
      },
      {
        text: "Leaves it alone, since a key present with an empty value compares unequal to the zero value of the map",
        whyTempting:
          "Distinguishing present-but-empty is what you want, and it is what the comma-ok form actually gives you.",
      },
      {
        text: "Panics, because assigning to a key while comparing it in the same statement aliases the bucket",
        whyTempting:
          "Map internals and rehashing during iteration are real hazards, so bucket aliasing sounds plausible.",
      },
      {
        text: "Overwrites it, and the same code on a `map[string]*string` would not, since a stored nil pointer is distinguishable",
        whyTempting:
          "A pointer value would in fact distinguish the two, which makes this the right idea attached to the wrong claim.",
      },
    ],
    correct: 0,
    explanation:
      "`m[k]` on a missing key returns the zero value with no way to tell it from a stored zero. Use `v, ok := m[k]` whenever absent and empty mean different things.",
  },
  {
    concept: "go-map-zero-value",
    difficulty: "hard",
    prompt:
      "A cache keyed `map[string]Entry` on pool name collides once two drivers each register a pool called `default`. The fix changes the key to a `PoolID` struct of driver plus name. What property of Go map keys makes that fix work?",
    options: [
      {
        text: "A comparable struct compares field by field, so the composite key is distinct for each driver",
      },
      {
        text: "Structs are hashed by memory address, so two separately constructed PoolIDs never collide",
        whyTempting:
          "Pointer keys really are identity-based, and a struct key looks close enough to one to inherit the model.",
      },
      {
        text: "Go interns struct keys, so equal values share one entry and unequal drivers cannot share a bucket",
        whyTempting:
          "String interning is real in some runtimes, and the outcome described is what you want to happen.",
      },
      {
        text: "The map switches to a sorted tree once keys stop being strings, which makes composite lookups exact",
        whyTempting:
          "Some languages do switch representations by key type, and Go's map internals are opaque enough to invite the guess.",
      },
    ],
    correct: 0,
    explanation:
      "Any comparable type works as a key, and struct equality is field by field, so a composite struct key says exactly what identifies an entry. Adding a slice or map field to that struct stops it compiling, which is the compiler telling you the key is no longer well defined.",
  },

  // ── go-error-wrapping ────────────────────────────────────────────────────
  {
    concept: "go-error-wrapping",
    difficulty: "easy",
    prompt:
      "A helper changes `fmt.Errorf(\"publish: %w\", err)` to `fmt.Errorf(\"publish: %v\", err)` during a logging cleanup. Nothing fails to compile and no test breaks. What did it change?",
    options: [
      {
        text: "`errors.Is` upstream stops matching, so the retry branch keyed on a sentinel error goes dead",
      },
      {
        text: "The message loses the wrapped error's text, so logs now show only the prefix",
        whyTempting:
          "`%v` and `%w` do format identically, which is exactly why this change survives a review by eye.",
      },
      {
        text: "The error becomes a plain string value, so type assertions on it now panic instead of returning ok",
        whyTempting:
          "Type assertions are the pre-1.13 way to inspect errors, and this would break them, but with ok rather than a panic.",
      },
      {
        text: "Nothing at runtime: `%w` is a vet-only annotation that records intent for static analysis",
        whyTempting:
          "`%w` does have vet rules attached to it, so treating it as documentation is a small step.",
      },
    ],
    correct: 0,
    explanation:
      "`%w` stores the original error so `errors.Is` and `errors.As` can walk the chain, and `%v` flattens it to text. The message is byte-identical, which is what makes this a silent break.",
  },
  {
    concept: "go-error-wrapping",
    difficulty: "medium",
    prompt:
      "A service defines `var ErrClosed = errors.New(\"closed\")` and callers check `err == ErrClosed`. A middleware layer starts wrapping every error with context. Which caller-side change keeps the check working?",
    options: [
      {
        text: "`errors.Is(err, ErrClosed)`",
      },
      {
        text: "`err.Error() == ErrClosed.Error()`",
        whyTempting:
          "It works today and keeps working until someone adds a prefix, which is what the middleware just did.",
      },
      {
        text: "`errors.As(err, &ErrClosed)`",
        whyTempting:
          "`errors.As` is the right tool for a custom error type, so reaching for it against a sentinel is a near miss.",
      },
      {
        text: "`errors.Unwrap(err) == ErrClosed`",
        whyTempting:
          "One Unwrap handles one layer, which fixes the case in front of you and breaks on the second wrap.",
      },
    ],
    correct: 0,
    explanation:
      "`errors.Is` walks the whole chain, so it survives any number of wrapping layers. `errors.As` is its sibling for extracting a concrete error type, and needs a pointer to a variable of that type.",
  },
  {
    concept: "go-error-wrapping",
    difficulty: "hard",
    prompt:
      "A package returns `fmt.Errorf(\"query %s: %w\", sql, err)` where `err` may be a driver error carrying the connection string. What is the risk, and does `errors.Is` help?",
    options: [
      {
        text: "Wrapping publishes the wrapped error's message to every log line and every API response that renders the outer error",
      },
      {
        text: "None: wrapping stores the error for inspection and the outer Error() prints only the format prefix",
        whyTempting:
          "Separating the machine-readable chain from the human message is what wrapping ought to do, and it does not.",
      },
      {
        text: "`errors.Is` forces the chain to be walked at call time, which materialises the inner message into the outer one",
        whyTempting:
          "Is does walk the chain, so blaming the walk for the exposure links two real facts with a wrong arrow.",
      },
      {
        text: "The risk is only in structured logging, since `%w` marks the value as sensitive and text handlers skip it",
        whyTempting:
          "slog does have attribute-level redaction via LogValuer, which makes a marker-based model feel plausible.",
      },
    ],
    correct: 0,
    explanation:
      "A wrapped error's `Error()` string includes everything underneath it, so wrapping decides what leaks as much as what is inspectable. Wrap for control flow, and choose separately what text reaches a user.",
  },

  // ── go-optional-pointer ──────────────────────────────────────────────────
  {
    concept: "go-optional-pointer",
    difficulty: "easy",
    prompt:
      "A flags struct holds `ProxyURL *string`. Its constructor sets `ProxyURL: ptr.To(\"\")` rather than leaving it nil. What distinction is that line preserving?",
    options: [
      {
        text: "Nil means the flag was never registered, and a pointer to the empty string means registered and left blank",
      },
      {
        text: "Nil would make the field invisible to encoding/json, so the pointer keeps it in the serialised output",
        whyTempting:
          "`omitempty` on a nil pointer really does drop the field, so this is a true fact about a different problem.",
      },
      {
        text: "A nil string pointer panics on `flag.StringVar`, so the allocation is defensive",
        whyTempting:
          "Passing nil to StringVar does panic, which makes this a real reason to allocate, just not this one.",
      },
      {
        text: "The empty string is the zero value, so assigning it stops Go from sharing one backing array between instances",
        whyTempting:
          "Shared backing arrays are a genuine Go hazard for slices, and the vocabulary carries over convincingly.",
      },
    ],
    correct: 0,
    explanation:
      "A pointer field has three states where a value field has two: absent, present-and-zero, and present. That is the whole reason to pay for the indirection, and code downstream reading `if f.ProxyURL != nil` depends on it.",
  },
  {
    concept: "go-optional-pointer",
    difficulty: "medium",
    prompt:
      "`for _, item := range items { results = append(results, &item.Spec) }` builds a slice of pointers. Every entry ends up pointing at the same Spec on Go 1.21 and at distinct copies on Go 1.22. Neither points into `items`. Why?",
    options: [
      {
        text: "`item` is a copy of the element, so `&item.Spec` addresses the copy rather than the slice",
      },
      {
        text: "`append` copies the pointed-to values when it grows the results slice, which collapses them",
        whyTempting:
          "append does copy the slice's own backing array on growth, so blaming append is one indirection off.",
      },
      {
        text: "Taking the address of a field escapes the whole struct to the heap, and the escape analysis shares one allocation",
        whyTempting:
          "Escape analysis is real and does move this to the heap, which makes it a satisfying-sounding culprit.",
      },
      {
        text: "`range` over a slice of structs yields the element by reference, and the loop variable rebinds on each pass",
        whyTempting:
          "Rebinding is exactly what changed in 1.22, so this gets the version story right and the by-reference part wrong.",
      },
    ],
    correct: 0,
    explanation:
      "`range` copies each element into the loop variable, so its address is never the element's address. Use `&items[i]` when you want a pointer into the slice, which is what the standard fix looks like.",
  },
  {
    concept: "go-optional-pointer",
    difficulty: "hard",
    prompt:
      "`func find() *Row` returns nil on miss. A caller assigns it to a variable of interface type: `var r Renderer = find()`. The next line `if r != nil` is true. Explain.",
    options: [
      {
        text: "An interface holds a type and a value, and a nil `*Row` gives it a non-nil type, so the interface itself is not nil",
      },
      {
        text: "Assigning a nil pointer to an interface allocates a zero Row, so the interface points at a real value",
        whyTempting:
          "It would explain the observation, and Go does box values into interfaces, so an allocation feels involved.",
      },
      {
        text: "`Renderer` has a method with a pointer receiver, and Go inserts a nil check that substitutes a default implementation",
        whyTempting:
          "Method sets and pointer receivers are genuinely fiddly here, so the answer sounds like it belongs.",
      },
      {
        text: "The comparison is against the interface's dynamic value, and comparing a nil pointer to untyped nil is always true",
        whyTempting:
          "It inverts the actual rule, which is why it reads as an authoritative statement of the same subject.",
      },
    ],
    correct: 0,
    explanation:
      "An interface value is nil only when both its type and value are nil, and putting a typed nil pointer inside fills in the type half. Return the interface type from the function, or compare the concrete pointer before boxing it.",
  },

  // ── go-type-assertion ────────────────────────────────────────────────────
  {
    concept: "go-type-assertion",
    difficulty: "easy",
    prompt:
      "A handler does `conn := built.(OAuthConnection)`. One request arrives where `built` holds a different implementation. What does the handler do?",
    options: [
      {
        text: "Panics on that request, since the single-value form asserts rather than tests",
      },
      {
        text: "Assigns the zero value and carries on, which surfaces later as an empty response",
        whyTempting:
          "The comma-ok form does give you a zero value, and dropping the `ok` looks like dropping a detail.",
      },
      {
        text: "Fails to compile, because Go requires the comma-ok form for interface-to-interface assertions",
        whyTempting:
          "Compile-time checks do exist for impossible assertions between concrete types, so this is half a real rule.",
      },
      {
        text: "Converts the value, since an assertion to an interface type is satisfied by any type with those methods",
        whyTempting:
          "Structural satisfaction is how Go interfaces work at compile time, which makes runtime coercion feel consistent.",
      },
    ],
    correct: 0,
    explanation:
      "`x.(T)` panics on a mismatch and `v, ok := x.(T)` reports it. In a request handler that difference is one bad input away from taking the server down.",
  },
  {
    concept: "go-type-assertion",
    difficulty: "medium",
    prompt:
      "`if c, ok := conn.(Closer); ok { c.Close() }`. `conn` holds a `*File` that is nil. What happens?",
    options: [
      {
        text: "`ok` is true and `Close` runs on a nil receiver, since the assertion checks the type and not the value",
      },
      {
        text: "`ok` is false, because a nil value cannot satisfy an interface's method set",
        whyTempting:
          "It is what the comma-ok form feels like it should protect you from, and it is the whole reason people write it.",
      },
      {
        text: "`ok` is true and `Close` panics immediately, because calling any method on nil dereferences the receiver",
        whyTempting:
          "Many methods do deref and panic, so this is right for most types and wrong as a language rule.",
      },
      {
        text: "The assertion panics, since asserting on an interface holding a nil pointer is undefined",
        whyTempting:
          "Nothing in Go is undefined behaviour, but the phrase carries over from other languages under time pressure.",
      },
    ],
    correct: 0,
    explanation:
      "The assertion answers a question about the dynamic type, so a typed nil passes it. Whether the call then works depends on whether that method handles a nil receiver, which many standard-library methods do on purpose.",
  },
  {
    concept: "go-type-assertion",
    difficulty: "hard",
    prompt:
      "A type switch has `case error:` above `case *net.OpError:`. The OpError branch never runs. What is the rule, and what is the fix?",
    options: [
      {
        text: "Cases are tested top to bottom and `*net.OpError` implements error, so the general case matches first: put the specific case above it",
      },
      {
        text: "A type switch matches the most specific case regardless of order, so the real bug is elsewhere in the switch",
        whyTempting:
          "Overload resolution in several other languages does pick the most specific match, and it feels like the sane design.",
      },
      {
        text: "Interface cases and concrete cases live in separate namespaces, so the fix is one switch for each",
        whyTempting:
          "Splitting the switch does work as a fix, which makes the invented rule behind it easy to accept.",
      },
      {
        text: "`error` is special-cased by the compiler and always matched last, so the two cases must be swapped for a different reason",
        whyTempting:
          "`error` is a predeclared interface, so believing the compiler treats it specially is not a wild leap.",
      },
    ],
    correct: 0,
    explanation:
      "A type switch is an ordered chain and stops at the first case the dynamic type satisfies. Order specific before general, exactly as with an if-else chain, and the compiler will not warn you when you get it backwards.",
  },

  // ── go-map-value-copy ────────────────────────────────────────────────────
  {
    concept: "go-map-value-copy",
    difficulty: "easy",
    prompt:
      "`state, ok := m[driver]; state.Devices = nil` compiles and runs, and the devices are still there afterwards. What is missing?",
    options: [
      {
        text: "The write-back `m[driver] = state`, since `state` is a copy of the stored struct",
      },
      {
        text: "A `make` on `m`, because writing through a value read from a nil map silently does nothing",
        whyTempting:
          "Nil-map behaviour is a genuine Go trap, and silence is exactly what nil maps give you on some operations.",
      },
      {
        text: "The `ok` check, since the zero value returned on a miss is mutated instead of the stored one",
        whyTempting:
          "Checking ok is the right habit and would catch a different bug of the same shape in this code.",
      },
      {
        text: "A pointer receiver on the method that clears Devices, since a value receiver mutates its own copy",
        whyTempting:
          "Value receivers really do lose mutations, and it is the same class of mistake one level up.",
      },
    ],
    correct: 0,
    explanation:
      "Reading a struct out of a map copies it, so the field assignment lands on the copy. That is also why `m[k].Field = x` does not compile: map values are not addressable, and the compiler refuses the version that would look correct.",
  },
  {
    concept: "go-map-value-copy",
    difficulty: "medium",
    prompt:
      "A reviewer suggests changing `map[string]Config` to `map[string]*Config` so that `m[k].Timeout = d` compiles. What else changes with it?",
    options: [
      {
        text: "Entries now share their Config with anything else holding the pointer, so a mutation through the map is visible everywhere",
      },
      {
        text: "Lookups get slower, since the map now stores an extra indirection that has to be chased on every read",
        whyTempting:
          "The indirection is real and does cost a cache miss, so it is a true observation dressed as the main consequence.",
      },
      {
        text: "A missing key now returns a zero Config rather than a nil pointer, because the map allocates on read",
        whyTempting:
          "The zero value for a pointer is nil, so this states the opposite of the rule with total confidence.",
      },
      {
        text: "The map stops being safe for concurrent reads, since pointer values are not covered by the read-only guarantee",
        whyTempting:
          "Concurrent map access rules are subtle enough that a value-versus-pointer distinction sounds like it could matter.",
      },
    ],
    correct: 0,
    explanation:
      "Pointer values make the entry mutable in place and give up the isolation a value map had. That is the trade: pick it deliberately rather than to satisfy the compiler on one line.",
  },
  {
    concept: "go-map-value-copy",
    difficulty: "hard",
    prompt:
      "`counts[k]++` where `counts` is `map[string]int` compiles, but `structs[k].n++` where `structs` is `map[string]Thing` does not. Why does one work?",
    options: [
      {
        text: "`m[k]++` is read, add, assign back through the index expression, and only a whole map value can be assigned that way",
      },
      {
        text: "Integers are stored inline while structs are boxed, so only the inline case can be updated without a rehash",
        whyTempting:
          "Map internals do treat sizes differently, which makes a storage-layout explanation sound authoritative.",
      },
      {
        text: "`++` on a map entry is compiler sugar that skips addressability, and field selection is not covered by that sugar",
        whyTempting:
          "It gets the conclusion right by inventing an exception, and the real reason is simpler than an exception.",
      },
      {
        text: "`int` is comparable and `Thing` may not be, and only comparable values can be updated in place",
        whyTempting:
          "Comparability really is what map keys require, so applying the same constraint to values is a tidy mistake.",
      },
    ],
    correct: 0,
    explanation:
      "`m[k]` is not addressable, so anything needing an address is rejected, while `m[k] = m[k] + 1` needs none. Read into a local, mutate it, and write it back when the value is a struct.",
  },

  // ── go-blank-identifier ──────────────────────────────────────────────────
  {
    concept: "go-blank-identifier",
    difficulty: "easy",
    prompt:
      "A line reads `paths, _ := resolve(input)`. What has the author asserted by writing it that way?",
    options: [
      {
        text: "That resolve cannot fail here, or that its failure is safe to ignore, and neither claim is checked by anything",
      },
      {
        text: "That the second return is unused elsewhere, which the compiler enforces the same way it enforces unused variables",
        whyTempting:
          "Go really does reject unused variables, so `_` reads as a way of satisfying that rule rather than a decision.",
      },
      {
        text: "That the error is handled by the caller, since discarding it here lets it propagate up the stack",
        whyTempting:
          "Propagation is the usual pattern, and discarding an error is the one thing that stops it happening.",
      },
      {
        text: "Nothing: `_` on an error is idiomatic for a call whose failure mode is a zero value anyway",
        whyTempting:
          "It is genuinely idiomatic in a few standard-library cases, which is what makes it spread everywhere else.",
      },
    ],
    correct: 0,
    explanation:
      "`_` is not a shortcut, it is a claim that the value does not matter, and it is the one place Go's error discipline turns off. Every one deserves a comment saying why, because nothing else records the reasoning.",
  },
  {
    concept: "go-blank-identifier",
    difficulty: "medium",
    prompt:
      "`n, _ := io.Copy(dst, src)` in an upload handler. Under what condition does this ship truncated files with no error?",
    options: [
      {
        text: "Any failure partway through, since Copy returns the bytes written so far alongside the error being discarded",
      },
      {
        text: "Only when `src` is a network reader, because a local file read either succeeds fully or fails at open",
        whyTempting:
          "Network readers are where short reads are most common, and it correctly identifies the usual trigger.",
      },
      {
        text: "Never: Copy retries internally until the source is drained, which is what distinguishes it from a bare Read",
        whyTempting:
          "Copy does loop until EOF, so the difference between looping and retrying is the whole subtlety here.",
      },
      {
        text: "Only when `dst` is unbuffered, since a buffered writer surfaces the failure at Flush rather than at Copy",
        whyTempting:
          "Deferred write errors surfacing at Flush is a real and separate bug, and worth checking in the same review.",
      },
    ],
    correct: 0,
    explanation:
      "`io.Copy` returns how far it got and why it stopped, so discarding the error keeps the count and throws away the reason. The truncated result then looks like a successful short upload to everything downstream.",
  },
  {
    concept: "go-blank-identifier",
    difficulty: "hard",
    prompt:
      "`_ = json.Unmarshal(body, &cfg)` appears in a config loader with a comment saying defaults are fine on failure. What is left in `cfg` after a malformed body?",
    options: [
      {
        text: "Whatever Unmarshal managed to set before it failed, which can be a partly-populated struct rather than the defaults",
      },
      {
        text: "The zero value, since Unmarshal resets the target before decoding into it",
        whyTempting:
          "Resetting first would make the comment true, and it is what a decoder built for this pattern would do.",
      },
      {
        text: "The defaults the struct was constructed with, since a failed decode leaves the target untouched",
        whyTempting:
          "It is what the author believed, and it holds for a syntax error found before any field is assigned.",
      },
      {
        text: "The zero value for every field that appeared in the body and the defaults for the rest",
        whyTempting:
          "It is a precise-sounding middle position, and Unmarshal genuinely does leave absent fields alone.",
      },
    ],
    correct: 0,
    explanation:
      "Unmarshal decodes field by field and stops where it fails, so the target holds a mixture nobody designed. Decode into a fresh struct and only copy it over on success.",
  },
];
