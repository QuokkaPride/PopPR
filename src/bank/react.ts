import type { BankEntry } from "./types.js";

export const REACT_ENTRIES: BankEntry[] = [
  {
    concept: "useeffect-deps",
    difficulty: "easy",
    prompt:
      "A component runs useEffect(() => { setLog([...log, 'tick']); }, [log]) and renders forever. What is the mechanism?",
    options: [
      { text: "React batches the updates, so the loop settles by itself after the second commit", whyTempting: "Batching collapses several updates into one render, but it cannot stop a dependency from changing on every pass." },
      { text: "Setting state inside an effect is an unconditional render loop, and no dep array can stop it", whyTempting: "Overcorrection: setting state in an effect is fine as long as the update does not feed back into the deps." },
      { text: "The effect builds a new `log` array, so the `log` dependency changes and the effect runs again" },
      { text: "Deps are compared with `===`, and values recomputed during render never compare equal to the previous ones", whyTempting: "True for objects and arrays, but primitives with the same value do compare equal, so identity alone is not the rule." },
    ],
    correct: 2,
    explanation:
      "The effect writes a brand-new array into the same state it depends on, so every run schedules the next one. Either drop log from the deps and use a functional update, or derive the value during render instead.",
  },
  {
    concept: "useeffect-deps",
    difficulty: "medium",
    prompt:
      "The component body has const options = { pageSize: 20, sort }; and then useEffect(() => { fetchRows(options); }, [options]). The network tab shows one request per render. Why?",
    options: [
      { text: "`fetchRows` is not memoized, so React re-runs the effect to pick up its newest reference", whyTempting: "Only values listed in the dep array are compared; a non-memoized function outside the array changes nothing." },
      { text: "`options` is rebuilt every render, and Object.is says the new object differs from the old" },
      { text: "React compares object deps by their enumerable keys, and sort changes on every keystroke", whyTempting: "Dep comparison is shallow identity via Object.is, never a walk of the object's keys." },
      { text: "The effect returns no cleanup, but React re-invokes it anyway to cancel the previous request in flight", whyTempting: "A missing cleanup leaks the old request, but it never causes React to schedule an extra run." },
    ],
    correct: 1,
    explanation:
      "Object literals declared during render get a fresh identity each time, so an object dependency is always considered changed. Move the object inside the effect, or depend on the primitives (pageSize, sort) it is built from.",
  },
  {
    concept: "useeffect-deps",
    difficulty: "medium",
    prompt:
      "An effect calls socket.on('msg', handler) with deps [roomId] and returns nothing. After hopping between rooms a few times, users see each message several times. What is going on?",
    options: [
      { text: "React always defers cleanup to unmount, so returning a cleanup function would not have helped", whyTempting: "Cleanup runs before every re-run of the effect, and not only on unmount: that is what makes dep-driven subscriptions safe." },
      { text: "`roomId` is in the deps, so React swaps the subscription for you and every duplicate comes from the server", whyTempting: "Deps tell React when to re-run your code; React has no knowledge of the subscription your code created." },
      { text: "StrictMode double-invokes effects, and that is the whole story behind the duplicate handlers", whyTempting: "The dev-only double invoke surfaces missing cleanup, but it does not multiply handlers once per room change in production." },
      { text: "Each roomId change runs the effect body again, registering a second handler; nothing removes the first" },
    ],
    correct: 3,
    explanation:
      "A dependency change re-runs the effect body, so without a cleanup that calls socket.off, handlers accumulate one per room visited. The duplicate count grows with navigation, which is why it only shows up after a few switches.",
  },
  {
    concept: "useeffect-deps",
    difficulty: "hard",
    prompt:
      "useEffect(() => { fetch(url(query)).then(r => r.json()).then(setResults); }, [query]) sometimes leaves an older query's results on screen when the user types quickly. Which change fixes it?",
    options: [
      { text: "Add `results` to the dependency array, because the effect must re-run when stale data lands", whyTempting: "Adding deps is the reflex fix for effect bugs, but here it creates a fetch-render-fetch loop and still cannot order responses." },
      { text: "Switch to `setResults(prev => next)`, since functional updates serialise the writes in arrival order", whyTempting: "Functional updates fix reads of stale state; they do nothing about two responses landing out of order." },
      { text: "Return a cleanup that sets a cancelled flag for that run, and skip setResults if the flag is set" },
      { text: "Debounce the input: fewer requests in flight removes the chance of two responses overlapping", whyTempting: "Debouncing shrinks the window but never closes it; one slow response can still overtake a newer fast one." },
    ],
    correct: 2,
    explanation:
      "Cleanup runs when query changes, so flipping a per-run flag lets the superseded request discard its own result. Nothing about response latency is under your control, so the guard has to live on the write, not the request.",
  },
  {
    concept: "usememo",
    difficulty: "easy",
    prompt:
      "A component computes const ids = items.map(i => i.id) in its body, then const stats = useMemo(() => aggregate(ids), [ids]). What does that memo buy you?",
    options: [
      { text: "Nothing: ids is a new array each render, so the dep does not match and aggregate re-runs" },
      { text: "It recomputes only when the contents of `ids` change, because React always shallow-compares arrays", whyTempting: "React compares dependencies with Object.is, so two arrays with identical contents are still different deps." },
      { text: "It caches one result per distinct ids value, so revisiting an earlier selection reuses the old result", whyTempting: "useMemo keeps exactly one cached value, not a keyed cache of past results." },
      { text: "It defers aggregate until `stats` is read: renders that ignore the value skip the work", whyTempting: "useMemo is eager: the factory runs during render whether or not you use its return value." },
    ],
    correct: 0,
    explanation:
      "The dependency is derived during render, so it never compares equal and the memo is pure overhead. Memoize ids too, or depend on the source value (items) that aggregate is keyed on.",
  },
  {
    concept: "usememo",
    difficulty: "medium",
    prompt:
      "You wrap a config object in useMemo and pass it as <Chart config={config} /> to stop Chart re-rendering. Chart still re-renders on every parent render. Why?",
    options: [
      { text: "`Chart` re-renders with its parent whatever props it gets, because nothing wraps it in `React.memo`" },
      { text: "`useMemo` holds its cached value for a single render only, so the child receives a new object anyway", whyTempting: "The cache survives across renders as long as the deps are unchanged; that is the whole point of it." },
      { text: "Values passed as props need useCallback rather than useMemo, which is only for computed scalars", whyTempting: "Both hooks stabilise identity; useCallback is useMemo specialised for functions." },
      { text: "React shallow-compares props before re-rendering any child, so prop identity was never the problem", whyTempting: "React re-renders children unconditionally by default; prop comparison happens only for memoized components." },
    ],
    correct: 0,
    explanation:
      "Stable prop identity only matters to a component that bails out on equal props, which means React.memo (or a matching shouldComponentUpdate). Without it the memo work is wasted.",
  },
  {
    concept: "usememo",
    difficulty: "medium",
    prompt:
      "const visible = useMemo(() => rows.filter(r => r.status === filter), [rows]); filter is a state value driven by a dropdown. What is the production symptom?",
    options: [
      { text: "The `exhaustive-deps` lint rule guarantees a complete dep array, so this shape never reaches production", whyTempting: "The rule only warns, and it is routinely disabled or suppressed with an inline comment." },
      { text: "Every dropdown change recomputes anyway, because the closure reads `filter` by live reference", whyTempting: "Closures capture the binding from the render that created them; the cached value was produced by an older closure." },
      { text: "React throws when a cached value's deps no longer match the ones it was computed from", whyTempting: "There is no runtime validation of cached values: React returns whatever it stored." },
      { text: "The list keeps showing the previous filter's rows, but any change to rows invalidates the memo" },
    ],
    correct: 3,
    explanation:
      "Omitting filter means the memo is never invalidated when filter changes, so the stale computed list is returned. The bug hides until some unrelated update to rows accidentally refreshes it.",
  },
  {
    concept: "usememo",
    difficulty: "hard",
    prompt:
      "A PR creates a connection with const socket = useMemo(() => new WebSocket(url), [url]) to avoid reconnecting on every render. Beyond style, why is this unsafe?",
    options: [
      { text: "`useMemo` runs after paint like an effect, and the socket opens a frame late, dropping early frames", whyTempting: "useMemo runs during render, not after commit; the timing story belongs to useEffect." },
      { text: "React may discard the cached value and rebuild it at any point; nothing closes the old socket" },
      { text: "Side effects in a useMemo factory are detected by React: development builds throw", whyTempting: "It is a rule of thumb, not an enforced check: React has no way to detect an arbitrary side effect." },
      { text: "Deps are compared with `Object.is`: changing url to another string would not rebuild the socket", whyTempting: "Object.is compares strings by value, so a different url does invalidate the memo." },
    ],
    correct: 1,
    explanation:
      "useMemo is a performance hint, not a lifecycle: React is free to throw the value away and recompute, and it never runs cleanup. Resources belong in useEffect (with a teardown) or in lazy useState/useRef initialisation.",
  },
  {
    concept: "stale-closure",
    difficulty: "easy",
    prompt:
      "useEffect(() => { const id = setInterval(() => setCount(count + 1), 1000); return () => clearInterval(id); }, []) makes the counter reach 1 and stop. Why?",
    options: [
      { text: "`setCount` inside the callback always triggers the effect's cleanup, which clears the interval", whyTempting: "Cleanup only runs on unmount or a dep change; a state update does not re-run an effect with an empty dep array." },
      { text: "React 18 batches the ticks, but an effect with empty deps updates once per mount", whyTempting: "Automatic batching merges updates within a tick; it never caps how many updates an interval may perform." },
      { text: "The callback captured `count` from the mount render, so it computes 0 + 1 on every tick" },
      { text: "count is declared with const, so the increment fails once its initial value is consumed", whyTempting: "const only prevents reassignment of that binding; each render creates a separate binding with its own value." },
    ],
    correct: 2,
    explanation:
      "The interval closure holds the count from the render that created it, so it writes 1 forever and React bails out on the unchanged value. Use setCount(c => c + 1) so the update does not read the captured variable.",
  },
  {
    concept: "stale-closure",
    difficulty: "medium",
    prompt:
      "An effect with [] deps adds a keydown listener whose handler calls onSave(draft), and users report it saves an old draft. Which fix keeps exactly one listener registered for the component's lifetime?",
    options: [
      { text: "Add `draft` to the dep array, and the listener re-registers on every keystroke with fresh state", whyTempting: "This does read fresh values, but it churns a listener per keystroke instead of keeping one registration." },
      { text: "Keep `draft` in a ref that each render writes, then read `ref.current` when the handler runs" },
      { text: "Wrap the handler in `useCallback` with [draft], since the memoized function closes over fresh state", whyTempting: "A new function identity is useless here: addEventListener already holds the original reference." },
      { text: "Use a functional state update: the escape hatch that always beats a stale closure", whyTempting: "Functional updates only help when you are writing that same piece of state, not when you must read a value to pass elsewhere." },
    ],
    correct: 1,
    explanation:
      "A ref is a stable box whose current field the handler reads at call time, so one long-lived listener always sees the latest draft. This is the standard 'latest value' pattern behind useEffectEvent.",
  },
  {
    concept: "stale-closure",
    difficulty: "medium",
    prompt:
      "Inside a useCallback(..., []) click handler you call setCount(c => c + 1) and then analytics.track('inc', { count }). After several clicks the counter is correct but every event reports 0. Why?",
    options: [
      { text: "The updater form fixes only the write, and the count in the payload is the mount binding" },
      { text: "track runs before React flushes the pending update, so the payload trails the state by exactly one", whyTempting: "That reasoning explains an off-by-one, not a value frozen at 0 across many clicks." },
      { text: "useCallback with [] freezes the component's state, and nothing called from that handler sees updates", whyTempting: "Nothing is frozen: other handlers and the render body see current state, only this captured binding is old." },
      { text: "State resets to its initial value between renders unless you keep it in a ref", whyTempting: "State is preserved across renders: each render gets its own binding for the value at that time." },
    ],
    correct: 0,
    explanation:
      "setCount(c => c + 1) receives the latest value from React, but the count identifier in the same closure is still the one from the first render. Add count to the deps, or read it from a ref, when you need it as data.",
  },
  {
    concept: "stale-closure",
    difficulty: "hard",
    prompt:
      "const onPick = async (id) => { await save(id); if (id === selectedId) refresh(); }: selectedId is state and the handler is recreated on every render. Why can the comparison still use an outdated selectedId?",
    options: [
      { text: "The handler is rebuilt on each render, and after the await it re-reads the current selectedId, so the bug lies elsewhere", whyTempting: "A fresh function per render only helps up to the moment it starts; resuming after an await does not re-capture anything." },
      { text: "React re-invokes event handlers after each state change, and the pre-await run disagrees with the post-await one", whyTempting: "Handlers run once per event; React never replays them because state changed." },
      { text: "The closure holds the selectedId from the render that created it, because an await resumes in the same scope" },
      { text: "Because save is async, React defers the queued state update until the handler returns", whyTempting: "The update is applied as soon as it is dispatched and rendered; it is not held back until the async function settles." },
    ],
    correct: 2,
    explanation:
      "An async function resumes in the same lexical environment it suspended in, so selectedId is the value from the render where the click happened. Compare against a ref, or re-read the value from a store, after any await.",
  },
  {
    concept: "react-key",
    difficulty: "easy",
    prompt:
      "A list renders rows with key={index}, and each row contains an uncontrolled <input>. The user types into the third row, then deletes the first row. What do they see?",
    options: [
      { text: "The typed text now sits in the row above, because React reused the DOM nodes by position" },
      { text: "Every input clears, because removing an item invalidates all of the keys that follow it", whyTempting: "Index keys shift rather than invalidate, so React reuses nodes instead of tearing them down." },
      { text: "Nothing visible changes; index keys never affect correctness, only the speed of the diff", whyTempting: "The common belief that keys only speed up diffing: they decide which state belongs to which item." },
      { text: "React warns about `key={index}` and falls back to comparing element identity, so the inputs stay put", whyTempting: "There is no such fallback: React trusts the keys you supply and warns only when they are missing." },
    ],
    correct: 0,
    explanation:
      "With index keys, deleting an earlier item makes every later item adopt the previous item's key, so React keeps the existing DOM node and its uncontrolled value. Keying by a stable item id moves the state with the item.",
  },
  {
    concept: "react-key",
    difficulty: "medium",
    prompt:
      "A child is declared as function Row({ key, item }) and logging key always prints undefined, even though the parent passes key on every element. Why?",
    options: [
      { text: "JSX strips key only for elements produced inside a .map() callback, so passing it directly would work", whyTempting: "The stripping is done by the element factory itself, so it happens no matter where the element is created." },
      { text: "React consumes `key` itself, but the props object never carries it, so pass id as a second prop" },
      { text: "Destructuring shadows React's internal field, but props['key'] still returns the value", whyTempting: "Destructuring cannot shadow anything: the field is absent from the props object." },
      { text: "key is attached to props during commit, but the render body runs before that", whyTempting: "Keys are consumed during reconciliation, not attached to props at any later phase." },
    ],
    correct: 1,
    explanation:
      "key (like ref) is consumed by React itself and is not forwarded to the component, so any child that needs it must receive a separate prop such as id. React 19 warns when you destructure key out of props.",
  },
  {
    concept: "react-key",
    difficulty: "medium",
    prompt:
      "In a client-rendered app, someone silences a key warning with key={Math.random()} and the console goes quiet. What breaks?",
    options: [
      { text: "Nothing breaks: uniqueness among siblings is the only requirement React documents for keys", whyTempting: "Uniqueness is necessary but not sufficient: a key must also be stable across renders for the same item." },
      { text: "React drops one of the two rows, because duplicate `Math.random()` values collide in time", whyTempting: "Collisions are rare and would warn rather than drop a row; the damage here lands on every render." },
      { text: "Hydration mismatches appear, because server and client generate different keys on the first paint", whyTempting: "A genuine problem in SSR apps, but this app renders on the client, so hydration is not involved." },
      { text: "Keys change every render, so React remounts each row and loses focus, scroll and child state" },
    ],
    correct: 3,
    explanation:
      "A new key means a different element identity, so React unmounts the old subtree and mounts a fresh one on every render, destroying DOM and component state and re-running effects. It is worse than index keys.",
  },
  {
    concept: "react-key",
    difficulty: "hard",
    prompt:
      "To clear a form when the selected user changes, a PR renders <ProfileForm key={userId} user={user} /> as the only child. What does that change do?",
    options: [
      { text: "React reuses the instance and re-runs its effects, since key affects only sibling ordering", whyTempting: "Keys are part of element identity, not a hint about order within a list." },
      { text: "The form's state resets but its effects survive, because keys reset state without touching the effect list", whyTempting: "State and effects live on the same fiber, so they are discarded together." },
      { text: "Nothing resets, because a key has no meaning unless there are two or more siblings to distinguish", whyTempting: "A key is compared against the previous element in the same position, even when it is an only child." },
      { text: "The old ProfileForm unmounts and a fresh one mounts: state resets and effects re-run their cleanup" },
    ],
    correct: 3,
    explanation:
      "Changing the key changes the element's identity, so React discards the whole subtree and mounts a new one: the documented way to reset state on prop change. The cost is a full remount, including refetching in mount effects.",
  },
];
