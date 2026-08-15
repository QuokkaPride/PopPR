import type { BankEntry } from "./types.js";

/**
 * Python beyond the tutorial traps.
 *
 * The bank's original Python questions targeted `def f(x=[])` and bare excepts,
 * which occur zero times in 27,000 added lines across django and transformers:
 * mature repos lint them out before a PR exists. These were measured over 1,507
 * changed .py files from real merged PRs instead, which is why two of them are
 * about torch and one about the Django ORM.
 */
export const PYTHON_RUNTIME_ENTRIES: BankEntry[] = [
  // ── python-isinstance-dispatch ───────────────────────────────────────────
  {
    concept: "python-isinstance-dispatch",
    difficulty: "easy",
    prompt:
      "A totals function branches `if isinstance(v, int): total += v` and `elif isinstance(v, bool): flags += 1`. Booleans are being summed into the total. What is the rule?",
    options: [
      {
        text: "`bool` is a subclass of `int`, so the first branch matches and the second is unreachable",
      },
      {
        text: "`isinstance` compares by duck typing, so anything supporting `+` matches the int branch first",
        whyTempting:
          "Duck typing is the language's usual answer, and it is what `isinstance` deliberately does not do.",
      },
      {
        text: "`True` is coerced to 1 by the `+=`, so the branch that ran does not matter to the total",
        whyTempting:
          "The coercion is real, which makes the observed sum correct-looking regardless of which branch ran.",
      },
      {
        text: "`elif` chains are evaluated in reverse for isinstance checks, so the more specific type is tested first",
        whyTempting:
          "Reverse evaluation would be a sensible design, and it is what pattern matching in some languages gives you.",
      },
    ],
    correct: 0,
    explanation:
      "`isinstance(True, int)` is True, so any int check placed above a bool check swallows it. Test bool first, or use `type(v) is int` when you want the exact type.",
  },
  {
    concept: "python-isinstance-dispatch",
    difficulty: "medium",
    prompt:
      "A handler uses `if hasattr(obj, \"close\"): obj.close()`. A property named `close` on `obj` raises `ConnectionError` when accessed. What does `hasattr` return, and on which Python?",
    options: [
      {
        text: "It propagates the ConnectionError on Python 3, which stopped swallowing every exception in 3.2",
      },
      {
        text: "False on every version, since hasattr is defined as getattr-in-a-try and any exception means no attribute",
        whyTempting:
          "That was exactly the Python 2 behaviour, and the docstring's wording still reads that way.",
      },
      {
        text: "True on every version, since hasattr checks the class dictionary and never invokes the descriptor",
        whyTempting:
          "Checking the class dict would be cheaper and is what `\"close\" in dir(obj)` does, so it feels like the implementation.",
      },
      {
        text: "False, and a `DeprecationWarning` about exception-swallowing hasattr, which is how the change was staged",
        whyTempting:
          "Python does stage changes with warnings, so a deprecation path is a reasonable thing to remember.",
      },
    ],
    correct: 0,
    explanation:
      "`hasattr` calls `getattr` and only catches AttributeError since Python 3.2, so a property that raises anything else propagates. Call the attribute inside your own try when the access itself can fail.",
  },
  {
    concept: "python-isinstance-dispatch",
    difficulty: "hard",
    prompt:
      "`isinstance(x, Sequence)` from `collections.abc` returns False for a class that defines `__len__` and `__getitem__`. Why, when that class is usable in a `for` loop and with indexing?",
    options: [
      {
        text: "Sequence is a nominal ABC: a class has to inherit from it or be registered, and having the methods is not enough",
      },
      {
        text: "Sequence requires `__iter__` as well, and the fallback iteration protocol does not count toward the check",
        whyTempting:
          "The old-style iteration protocol via `__getitem__` really is a fallback, so this reads like the precise rule.",
      },
      {
        text: "`isinstance` against an ABC only consults `__subclasshook__`, which Sequence leaves undefined on purpose",
        whyTempting:
          "`__subclasshook__` is exactly the mechanism that makes some ABCs structural, so the name is the right one.",
      },
      {
        text: "Sequence checks are erased at runtime, so the call falls back to identity and returns False for anything else",
        whyTempting:
          "Type erasure is real in `typing`, and mixing up `typing` with `collections.abc` is a small step.",
      },
    ],
    correct: 0,
    explanation:
      "Only a few ABCs like `Iterable` and `Hashable` are structural via `__subclasshook__`; `Sequence` is not. Inherit from it, call `Sequence.register(YourClass)`, or check for the methods you actually need.",
  },

  // ── python-falsy-default ─────────────────────────────────────────────────
  {
    concept: "python-falsy-default",
    difficulty: "easy",
    prompt:
      "`timeout = opts.get(\"timeout\") or 30`. A caller passes `timeout=0` meaning no timeout. What is `timeout`?",
    options: [
      {
        text: "30, because `0` is falsy and `or` returns its right operand for any falsy left one",
      },
      {
        text: "0, since `.get` found the key and `or` only fires when the lookup returned None",
        whyTempting:
          "It is the behaviour people write the line for, and it is what `if x is None` would give you.",
      },
      {
        text: "30, and the same line with `opts[\"timeout\"]` would raise rather than default",
        whyTempting:
          "The KeyError half is correct, which makes it easy to accept the rest of the sentence unexamined.",
      },
      {
        text: "0, because `or` compares against the type's sentinel and an explicit zero is distinguishable from a missing key",
        whyTempting:
          "Sentinel-based defaults are the right fix here, which makes a built-in sentinel sound plausible.",
      },
    ],
    correct: 0,
    explanation:
      "`or` tests truthiness, and `0`, `\"\"`, `[]`, `{}` and `False` are all falsy. Use `opts.get(\"timeout\", 30)` for the missing-key case, and `is None` when the value itself may legitimately be falsy.",
  },
  {
    concept: "python-falsy-default",
    difficulty: "medium",
    prompt:
      "`if col := annotations.get(name):` where `name` may be None and the annotation may legitimately be an empty container. What two problems does that line carry?",
    options: [
      {
        text: "It looks up None as a key when name is None, and it treats a legitimately empty annotation as absent",
      },
      {
        text: "The walrus leaks `col` into the enclosing scope, and `.get` raises when the key is None",
        whyTempting:
          "The scope claim is right for a comprehension, and `.get(None)` really is legal, so both halves feel checkable.",
      },
      {
        text: "The walrus evaluates twice under a truthiness test, so a `.get` with a side effect runs once per branch",
        whyTempting:
          "Double evaluation is a real hazard in macro-like constructs, and the syntax is unfamiliar enough to invite it.",
      },
      {
        text: "`.get` on a dict with a None key raises TypeError, and the walrus swallows it into a falsy result",
        whyTempting:
          "None is hashable so this is wrong, but unhashable-key TypeErrors are a real and adjacent failure.",
      },
    ],
    correct: 0,
    explanation:
      "`None` is a perfectly valid dict key, so the lookup succeeds and returns whatever is stored under it, usually nothing. Separate presence from truthiness: check `name is not None`, then use `in` or a sentinel default.",
  },
  {
    concept: "python-falsy-default",
    difficulty: "hard",
    prompt:
      "`counts = defaultdict(int)` then `if key in counts:` inside a loop that also does `counts[key] += 1`. A separate reader does `if counts[missing]: ...`. What has the reader done?",
    options: [
      {
        text: "Inserted `missing` into the dict with value 0, since reading a defaultdict creates the entry",
      },
      {
        text: "Nothing: reads are non-mutating, and only `__setitem__` inserts into a defaultdict",
        whyTempting:
          "It is true of a plain dict with `.get`, which is the mental model most people bring to defaultdict.",
      },
      {
        text: "Raised KeyError, because the default factory only applies inside methods that declare it",
        whyTempting:
          "A KeyError would be the plain-dict behaviour, which is a fair guess if you have not used defaultdict much.",
      },
      {
        text: "Inserted the entry and made the surrounding `in` checks unreliable, which is why `defaultdict` cannot be iterated safely",
        whyTempting:
          "The first half is right and the conclusion overreaches, which is what makes it the closest wrong answer.",
      },
    ],
    correct: 0,
    explanation:
      "`__getitem__` on a defaultdict calls the factory and stores the result, so reading grows the dict. Use `.get(key, 0)` for reads, and keep `defaultdict` for the paths that genuinely accumulate.",
  },

  // ── python-short-circuit ─────────────────────────────────────────────────
  {
    concept: "python-short-circuit",
    difficulty: "easy",
    prompt:
      "A guard reads `return cfg.quant_method == \"awq\" and cfg is not None`. What input breaks it?",
    options: [
      {
        text: "`cfg` being None, since the attribute access runs before the None check",
      },
      {
        text: "Any `cfg` at all, because `and` evaluates both operands before combining them",
        whyTempting:
          "Doubting short-circuiting is common under pressure, and it would explain the failure in one step.",
      },
      {
        text: "`cfg.quant_method` being None, which makes the comparison return None rather than False",
        whyTempting:
          "Comparisons returning something other than a bool is real for numpy arrays, so it is not a wild idea.",
      },
      {
        text: "`cfg` being a falsy object with a `__bool__`, which short-circuits before the comparison runs",
        whyTempting:
          "Custom `__bool__` really does change truthiness, and it is a genuine hazard in a different position.",
      },
    ],
    correct: 0,
    explanation:
      "`and` evaluates strictly left to right and stops at the first falsy operand, so the guard has to come first. `cfg is not None and cfg.quant_method == \"awq\"` is the same test in the order that protects the access.",
  },
  {
    concept: "python-short-circuit",
    difficulty: "medium",
    prompt:
      "`def is_ready(self) -> bool: return self.started and self.config`. A caller does `if is_ready(x) is True:` and it never matches, even when both attributes are set. Why?",
    options: [
      {
        text: "`and` returns an operand rather than a bool, so the function hands back the config object",
      },
      {
        text: "The return annotation coerces the value, and coercion of a non-empty object gives a new True each time",
        whyTempting:
          "Annotations doing runtime work is a common misreading, and `is True` failing on a fresh object fits it.",
      },
      {
        text: "`is True` compares identity against the singleton, and Python caches only the False singleton",
        whyTempting:
          "Small-integer and singleton caching is real, so an asymmetry between True and False sounds plausible.",
      },
      {
        text: "`self.config` is truthy but not a bool, so `and` coerces it to `1` rather than `True`",
        whyTempting:
          "`True == 1` is genuinely true, and this gets close enough to the mechanism to feel like the answer.",
      },
    ],
    correct: 0,
    explanation:
      "`a and b` evaluates to `a` when `a` is falsy and to `b` otherwise, so the annotation is a claim the code does not honour. Wrap it in `bool(...)`, and prefer truthiness at the call site over `is True`.",
  },
  {
    concept: "python-short-circuit",
    difficulty: "hard",
    prompt:
      "`x = a or b` where `a` is a numpy array. It raises `ValueError: truth value of an array with more than one element is ambiguous`. What is the general lesson?",
    options: [
      {
        text: "`or` needs a single truth value from its left operand, so any type with elementwise semantics cannot answer it",
      },
      {
        text: "`or` is not defined for numpy arrays, so the fix is the elementwise `|` operator",
        whyTempting:
          "`|` is the right elementwise operator, so this proposes a working fix from a wrong description of the cause.",
      },
      {
        text: "numpy arrays override `__bool__` to raise, and the fix is to compare against None explicitly",
        whyTempting:
          "The override is real and comparing to None is often the fix, so this is the closest of the wrong answers.",
      },
      {
        text: "`or` evaluates both operands for non-scalar types, and the error comes from combining the results",
        whyTempting:
          "It correctly senses that arrays break the usual model, then blames evaluation order rather than truthiness.",
      },
    ],
    correct: 0,
    explanation:
      "`or` and `if` both call `bool()` on their operand, and a container whose truth is elementwise has no single answer to give. Use `a if a is not None else b`, which asks a question the array can answer.",
  },

  // ── python-init-order ────────────────────────────────────────────────────
  {
    concept: "python-init-order",
    difficulty: "easy",
    prompt:
      "A subclass sets `self.mode = mode` before calling `super().__init__(**kwargs)`, and the base initializer rebuilds derived state from a file. The mode has no effect. Why?",
    options: [
      {
        text: "The base ran after the assignment and overwrote the derived state the mode was supposed to influence",
      },
      {
        text: "Assigning before `super().__init__` is illegal in Python and the attribute is discarded",
        whyTempting:
          "Java and C# do enforce a constructor-call-first rule, and the habit carries over intact.",
      },
      {
        text: "`**kwargs` no longer contains `mode` after the assignment, since the subclass consumed it",
        whyTempting:
          "Base initializers popping keys out of kwargs is a real and adjacent bug in exactly this code shape.",
      },
      {
        text: "The base sets `__slots__`, so any attribute assigned before it is dropped when the layout is fixed",
        whyTempting:
          "`__slots__` genuinely does restrict attributes, which makes an ordering interaction sound possible.",
      },
    ],
    correct: 0,
    explanation:
      "Whatever runs last wins, so state the base derives has to be recomputed after `super().__init__` returns. That is why the fix for this class of bug is usually one line moved rather than one line added.",
  },
  {
    concept: "python-init-order",
    difficulty: "medium",
    prompt:
      "A base `__init__` calls `self.validate()`, which a subclass overrides to read `self.rules`. `self.rules` is set in the subclass after `super().__init__()`. What happens?",
    options: [
      {
        text: "AttributeError inside validate, because the override runs before the subclass has set the attribute it reads",
      },
      {
        text: "The base's `validate` runs, since method resolution during `__init__` uses the class being initialised",
        whyTempting:
          "It is what non-virtual constructors give you in C++, and it is the behaviour that would make this safe.",
      },
      {
        text: "`self.rules` resolves to the class attribute, since instance attributes are not yet bound during `__init__`",
        whyTempting:
          "Class attribute fallback is real, so it would work if the subclass happened to declare a class-level default.",
      },
      {
        text: "The call is deferred until `__init__` returns, because Python defers overridden calls made during construction",
        whyTempting:
          "Deferring would be a tidy solution, and `__post_init__` on dataclasses is close enough to suggest it.",
      },
    ],
    correct: 0,
    explanation:
      "Python dispatches to the most derived override from the moment the object exists, including inside a base initializer. Do not call overridable methods from `__init__`, or give the subclass a hook that runs after its own setup.",
  },
  {
    concept: "python-init-order",
    difficulty: "hard",
    prompt:
      "A tokenizer subclass adds one line, `self.update_post_processor()`, after `super().__init__(...)`. The bug it fixes is that `add_bos_token` had no effect when loading from a saved directory. What does that ordering tell you?",
    options: [
      {
        text: "The base consumed or rebuilt the state the flag controls, so the subclass has to reapply it once the base is done",
      },
      {
        text: "The flag was stored on the class rather than the instance, so the call is what copies it down per instance",
        whyTempting:
          "Class-versus-instance attribute confusion is a real bug of the same shape, and it would also be fixed by a call.",
      },
      {
        text: "`__init__` cannot see keyword arguments the loader injected, so the call re-reads them from the saved config",
        whyTempting:
          "The loader really does strip keys from init kwargs, which is the surrounding fact this answer misattributes.",
      },
      {
        text: "The post-processor is lazily built on first use, so the call warms it before anything else can observe the default",
        whyTempting:
          "Lazy construction is common in tokenizers, and an eager warm-up is a plausible-sounding reason for the line.",
      },
    ],
    correct: 0,
    explanation:
      "When a base initializer derives state, any subclass input that feeds that state has to be applied afterwards. The position of the line is the entire fix, which is why an ordering bug reviews as a no-op.",
  },

  // ── django-queryset-lazy ─────────────────────────────────────────────────
  {
    concept: "django-queryset-lazy",
    difficulty: "easy",
    prompt:
      "A test asserts on `State.objects.filter(poly__intersects=raster)` without a database connection and passes. What does that demonstrate?",
    options: [
      {
        text: "`filter` builds a query and runs nothing, so the SQL can be inspected without ever executing it",
      },
      {
        text: "Django falls back to an in-memory backend when no connection is configured, which is what makes the test cheap",
        whyTempting:
          "sqlite in-memory is the usual test setup, so assuming a silent fallback is a small step.",
      },
      {
        text: "Spatial lookups are evaluated in Python, so this particular filter never needs the database",
        whyTempting:
          "Some lookups genuinely are handled application-side, which makes a lookup-specific explanation plausible.",
      },
      {
        text: "The queryset is cached from a previous test, so the assertion reads the cache rather than issuing SQL",
        whyTempting:
          "Django does have a per-connection query cache, and test isolation problems of this shape are real.",
      },
    ],
    correct: 0,
    explanation:
      "A QuerySet is lazy: it holds a query and evaluates when something needs rows. That is what lets `.query` be asserted on with no database, and it is also why passing a queryset around moves the query to wherever it is first consumed.",
  },
  {
    concept: "django-queryset-lazy",
    difficulty: "medium",
    prompt:
      "A view holds `qs = Order.objects.filter(open=True)` and does `if qs:` then `for o in qs:` then `len(qs)`. How many queries does that issue?",
    options: [
      {
        text: "One: the first evaluation loads the result cache and the later operations read it",
      },
      {
        text: "Three, since each of `bool`, iteration and `len` is a separate evaluation trigger",
        whyTempting:
          "All three are genuinely evaluation triggers, which is the right half of the rule without the result cache.",
      },
      {
        text: "Two: `if qs` issues an EXISTS query, and the iteration then loads the rows and caches them",
        whyTempting:
          "`.exists()` really does issue an EXISTS, so attributing that optimisation to `bool` is a near miss.",
      },
      {
        text: "One, and slicing it afterwards would still read the cache rather than issue a LIMIT query",
        whyTempting:
          "The first half is correct, and slicing an unevaluated queryset really does issue a LIMIT, so this is close.",
      },
    ],
    correct: 0,
    explanation:
      "A QuerySet caches its rows on first evaluation, so repeated use of the same object is one query. A fresh queryset each time, or a `.count()` on a loaded one, is what turns this into N.",
  },
  {
    concept: "django-queryset-lazy",
    difficulty: "hard",
    prompt:
      "A module-level `ACTIVE = User.objects.filter(active=True)` is used by several views. Users are deactivated in the database. What do the views see?",
    options: [
      {
        text: "Whatever each view's first evaluation returned, since the queryset caches per object and this one lives for the process",
      },
      {
        text: "Stale rows forever, because the module-level queryset evaluates once at import and never again",
        whyTempting:
          "It is the intuitive reading of a module-level binding, and the outcome is nearly as bad, which makes it hard to separate.",
      },
      {
        text: "Fresh rows every time, since a queryset re-executes on each evaluation and never caches",
        whyTempting:
          "Re-execution is what you get from a cloned queryset, which is the far more common case in view code.",
      },
      {
        text: "Fresh rows, because Django binds module-level querysets to the request lifecycle and resets them per request",
        whyTempting:
          "Request-scoped resets do exist for the query log and some caches, so extending that to querysets is plausible.",
      },
    ],
    correct: 0,
    explanation:
      "The object is not evaluated at import, and once anything evaluates it the cache lives as long as the object does. Store the callable or the filter arguments, and build the queryset inside the view.",
  },

  // ── torch-device-placement ───────────────────────────────────────────────
  {
    concept: "torch-device-placement",
    difficulty: "easy",
    prompt:
      "A test builds `torch.tensor(input_ids)` and passes it to a model created with `device_map=\"auto\"` on a GPU box. What is the error?",
    options: [
      {
        text: "RuntimeError about tensors on different devices, since the model moved and the input was built on CPU",
      },
      {
        text: "No error: the model moves inputs to its own device, which is what `device_map` configures",
        whyTempting:
          "Some pipeline wrappers do exactly this, so the behaviour exists in the library at a different layer.",
      },
      {
        text: "A dtype mismatch, since a tensor built from a Python list defaults to int64 and the embedding expects int32",
        whyTempting:
          "The int64 default is real, and dtype errors from this constructor are a genuine neighbouring problem.",
      },
      {
        text: "A silent wrong result, because the CPU tensor is copied per operation and the copies desynchronise",
        whyTempting:
          "Silent wrongness is the scarier outcome, and implicit copies do exist in some frameworks.",
      },
    ],
    correct: 0,
    explanation:
      "Moving a model does not move anything you hand it later, so inputs need `.to(model.device)`. With `device_map=\"auto\"` the model can span devices, which is why hardcoding `cuda:0` is a second bug.",
  },
  {
    concept: "torch-device-placement",
    difficulty: "medium",
    prompt:
      "A training loop logs `loss.item()` every step. Throughput drops on GPU and the profile shows time in synchronisation. What is `.item()` doing?",
    options: [
      {
        text: "Forcing a host sync: it waits for every queued kernel to finish so the value can be copied back",
      },
      {
        text: "Copying the whole tensor to host memory, which is the transfer the profile is attributing to sync",
        whyTempting:
          "Transfer cost is real for large tensors, and for a scalar loss it is a single float.",
      },
      {
        text: "Detaching from the graph, which frees the activations and forces the next step to recompute them",
        whyTempting:
          "`.item()` does detach in effect, and recomputation would explain a slowdown, so the causal story hangs together.",
      },
      {
        text: "Triggering a device-to-device copy on multi-GPU, which serialises the ranks at the logging call",
        whyTempting:
          "Collective operations do serialise ranks, which is a real cause of exactly this profile in distributed runs.",
      },
    ],
    correct: 0,
    explanation:
      "CUDA work is queued asynchronously, and reading a value on the host has to wait for the queue to drain. Accumulate losses as tensors and call `.item()` once per logging interval.",
  },
  {
    concept: "torch-device-placement",
    difficulty: "hard",
    prompt:
      "A checkpoint saved on a GPU box is loaded with `torch.load(path)` on a CPU-only machine and fails. Which argument fixes it, and what was the failure?",
    options: [
      {
        text: "`map_location=\"cpu\"`: the saved tensors record their device, and load tries to restore them onto a CUDA device that is absent",
      },
      {
        text: "`weights_only=True`: the checkpoint pickled a CUDA context object, and skipping arbitrary objects avoids it",
        whyTempting:
          "`weights_only` is real, is now the default, and does avoid a different class of load failure.",
      },
      {
        text: "`mmap=True`: the tensors are memory-mapped from the file rather than materialised, which sidesteps the device",
        whyTempting:
          "`mmap` is a real argument that changes how storage is realised, which makes it sound device-adjacent.",
      },
      {
        text: "`pickle_module`: the GPU build serialises storages with a different protocol that the CPU build cannot read",
        whyTempting:
          "Protocol mismatches are a familiar cause of load failures, and the argument exists for overriding it.",
      },
    ],
    correct: 0,
    explanation:
      "Serialised tensors carry their device, so loading replays the placement. `map_location` rewrites it at load time, and it is the argument that makes a checkpoint portable.",
  },

  // ── torch-no-grad ────────────────────────────────────────────────────────
  {
    concept: "torch-no-grad",
    difficulty: "easy",
    prompt:
      "An evaluation loop calls `model.eval()` and runs forward passes with no `.backward()`. Memory grows until it runs out. What is being retained?",
    options: [
      {
        text: "The autograd graph and every intermediate activation, kept for a backward pass that never comes",
      },
      {
        text: "The output tensors, since each forward result is appended to a list that is never cleared",
        whyTempting:
          "Accumulating outputs is a real and common cause of the same symptom, and worth checking first.",
      },
      {
        text: "The CUDA caching allocator's blocks, which grow because eval mode disables the reuse heuristics",
        whyTempting:
          "The caching allocator does hold memory and does confuse profiling, which makes it a frequent scapegoat.",
      },
      {
        text: "The batchnorm running statistics, which accumulate per batch until the module is reset",
        whyTempting:
          "`eval()` really does change batchnorm behaviour, so tying the leak to the thing eval touched is coherent.",
      },
    ],
    correct: 0,
    explanation:
      "`eval()` changes dropout and batchnorm and does nothing to autograd, so the graph is still built. Wrap inference in `torch.no_grad()` or `torch.inference_mode()`, which is what actually stops the recording.",
  },
  {
    concept: "torch-no-grad",
    difficulty: "medium",
    prompt:
      "A colleague replaces `model.eval()` with `with torch.no_grad():` and reports the memory fix worked. What is now wrong with the numbers?",
    options: [
      {
        text: "Dropout is still active and batchnorm still uses batch statistics, so the outputs vary run to run",
      },
      {
        text: "Gradients are missing from the output tensors, so any metric computed from `grad_fn` is now None",
        whyTempting:
          "It is a true consequence of no_grad, and it sounds like the kind of thing a metric could depend on.",
      },
      {
        text: "The weights are frozen, so any layer that updates buffers during the forward pass now silently skips it",
        whyTempting:
          "no_grad does prevent some in-place updates, and buffer updates during forward are a real thing.",
      },
      {
        text: "Nothing: no_grad implies eval mode, and the two are different names for the same switch",
        whyTempting:
          "They are usually written together, which makes them feel like one operation with two spellings.",
      },
    ],
    correct: 0,
    explanation:
      "They are orthogonal switches: `eval()` selects inference behaviour for dropout and normalisation, and `no_grad()` stops graph construction. Inference needs both, and dropping either gives you a different bug.",
  },
  {
    concept: "torch-no-grad",
    difficulty: "hard",
    prompt:
      "A metric accumulator does `total += loss` inside the training loop, where `loss` is the tensor rather than `loss.item()`. What does that cost after 1,000 steps?",
    options: [
      {
        text: "The graphs of all 1,000 steps stay alive, since `total` holds a chain of grad_fns back to every step's activations",
      },
      {
        text: "Nothing beyond one extra tensor, since addition of two tensors produces a new leaf with no history",
        whyTempting:
          "Leaf tensors do have no history, and the result of an operation looks like a fresh value.",
      },
      {
        text: "A device sync per step, because adding to a Python-scoped accumulator forces the value onto the host",
        whyTempting:
          "That is exactly what `.item()` does, so attributing it to the version without `.item()` is an easy inversion.",
      },
      {
        text: "Precision loss, since accumulating 1,000 fp16 losses into one tensor saturates the mantissa",
        whyTempting:
          "fp16 accumulation error is a genuine problem in training loops, just not the one that ends in an OOM.",
      },
    ],
    correct: 0,
    explanation:
      "Adding tensors that require grad builds a new node holding references to both operands, so the accumulator pins every step's graph. Use `loss.detach()` or `loss.item()` for anything you only intend to report.",
  },
];
