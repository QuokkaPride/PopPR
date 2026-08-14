import type { BankEntry } from "./types.js";

export const REACT_ENTRIES: BankEntry[] = [
  {
    concept: "useeffect-deps",
    difficulty: "easy",
    prompt:
      "A component runs useEffect(() => { setLog([...log, 'tick']); }, [log]) and renders forever. What is the mechanism?",
    options: [
      { text: "React batches the updates, so the loop settles by itself after the second commit", whyTempting: "Batching collapses several updates into one render, but it cannot stop a dependency from changing on every pass." },
      { text: "Setting state from inside an effect is an unconditional render loop, whatever the dep array holds", whyTempting: "Overcorrection: setting state in an effect is fine as long as the update does not feed back into the deps." },
      { text: "The effect builds a new log array, and log is a dependency, so the effect runs again" },
      { text: "Deps are compared with ===, and values recomputed during render never compare equal to the previous ones", whyTempting: "True for objects and arrays, but primitives with the same value do compare equal, so identity alone is not the rule." },
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
      { text: "fetchRows is not memoized, so React re-runs the effect to pick up its newest reference", whyTempting: "Only values listed in the dep array are compared; a non-memoized function outside the array changes nothing." },
      { text: "options is rebuilt every render, and Object.is says the new object differs from the old" },
      { text: "React compares object deps by their enumerable keys, and sort is changing on every keystroke", whyTempting: "Dep comparison is shallow identity via Object.is, never a walk of the object's keys." },
      { text: "The effect returns no cleanup, so React re-invokes it in order to cancel the previous request", whyTempting: "A missing cleanup leaks the old request, but it never causes React to schedule an extra run." },
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
      { text: "React only runs cleanup at unmount, so returning a cleanup function would not have helped here", whyTempting: "Cleanup runs before every re-run of the effect, not just on unmount — that is exactly what makes dep-driven subscriptions safe." },
      { text: "roomId is listed in the deps, so React swaps the subscription for you and the duplicates come from the server", whyTempting: "Deps tell React when to re-run your code; React has no knowledge of the subscription your code created." },
      { text: "StrictMode double-invokes effects, and that is the whole story behind the duplicate handlers", whyTempting: "The dev-only double invoke surfaces missing cleanup, but it does not multiply handlers once per room change in production." },
      { text: "Every roomId change runs the effect again and registers another handler, and none are removed" },
    ],
    correct: 3,
    explanation:
      "A dependency change re-runs the effect body, so without a cleanup that calls socket.off, handlers accumulate one per room visited. The duplicate count grows with navigation, which is why it only shows up after a few switches.",
  },
  {
    concept: "useeffect-deps",
    difficulty: "hard",
    prompt:
      "useEffect(() => { fetch(url(query)).then(r => r.json()).then(setResults); }, [query]) sometimes leaves an older query's results on screen when the user types quickly. What actually fixes it?",
    options: [
      { text: "Add results to the dependency array so the effect re-runs whenever stale data lands in state", whyTempting: "Adding deps is the reflex fix for effect bugs, but here it creates a fetch-render-fetch loop and still cannot order responses." },
      { text: "Switch to setResults(prev => next), since functional updates serialise the writes in arrival order", whyTempting: "Functional updates fix reads of stale state; they do nothing about two responses landing out of order." },
      { text: "Return a cleanup that sets a cancelled flag, and skip setResults when that flag is set" },
      { text: "Debounce the input so fewer requests are in flight, which removes the chance of overlapping responses", whyTempting: "Debouncing shrinks the window but never closes it; one slow response can still overtake a newer fast one." },
    ],
    correct: 2,
    explanation:
      "Cleanup runs when query changes, so flipping a per-run flag lets the superseded request discard its own result. Nothing about response latency is under your control, so the guard has to live on the write, not the request.",
  },
  {
    concept: "usememo",
    difficulty: "easy",
    prompt:
      "A component computes const ids = items.map(i => i.id) in its body, then const stats = useMemo(() => aggregate(ids), [ids]). What does that memo actually buy you?",
    options: [
      { text: "Nothing: ids is a new array each render, so it recomputes every time plus a comparison" },
      { text: "It recomputes only when the contents of ids change, because React shallow-compares array dependencies", whyTempting: "React compares dependencies with Object.is, so two arrays with identical contents are still different deps." },
      { text: "It caches one result per distinct ids value, so revisiting an earlier selection reuses the old result", whyTempting: "useMemo keeps exactly one cached value, not a keyed cache of past results." },
      { text: "It defers aggregate until stats is first read, which skips the work on renders that ignore it", whyTempting: "useMemo is eager: the factory runs during render whether or not you use its return value." },
    ],
    correct: 0,
    explanation:
      "The dependency is derived during render, so it never compares equal and the memo is pure overhead. Memoize ids too, or depend on the source value (items) that aggregate is really keyed on.",
  },
  {
    concept: "usememo",
    difficulty: "medium",
    prompt:
      "You wrap a config object in useMemo and pass it as <Chart config={config} /> to stop Chart re-rendering. Chart still re-renders on every parent render. Why?",
    options: [
      { text: "Chart is not wrapped in React.memo, so it re-renders whenever its parent does" },
      { text: "useMemo holds its cached value for a single render only, so the child receives a new object anyway", whyTempting: "The cache survives across renders as long as the deps are unchanged; that is the whole point of it." },
      { text: "Values passed as props need useCallback rather than useMemo, which is only for computed scalars", whyTempting: "Both hooks stabilise identity; useCallback is just useMemo specialised for functions." },
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
      { text: "The exhaustive-deps lint rule guarantees a complete dep array, so this shape cannot reach production", whyTempting: "The rule only warns, and it is routinely disabled or suppressed with an inline comment." },
      { text: "Every dropdown change recomputes anyway, because the closure reads filter by live reference", whyTempting: "Closures capture the binding from the render that created them; the cached value was produced by an older closure." },
      { text: "React throws when a cached value's dependencies no longer match the ones it was computed from", whyTempting: "There is no runtime validation of cached values; React simply returns whatever it stored." },
      { text: "The list keeps showing the previous filter's rows until rows itself happens to change" },
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
      { text: "useMemo runs after paint like an effect, so the socket opens a frame late and drops early frames", whyTempting: "useMemo runs during render, not after commit; the timing story belongs to useEffect." },
      { text: "React may discard the cached value and rebuild it, and there is no hook to close the old socket" },
      { text: "Side effects inside a useMemo factory are detected by React, which throws in development builds", whyTempting: "It is a rule of thumb, not an enforced check — React has no way to detect an arbitrary side effect." },
      { text: "Deps are compared with Object.is, so changing url to a different string would not rebuild the socket", whyTempting: "Object.is compares strings by value, so a different url genuinely does invalidate the memo." },
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
      { text: "setCount inside the callback triggers the effect's cleanup, which clears the interval after one tick", whyTempting: "Cleanup only runs on unmount or a dep change; a state update does not re-run an effect with an empty dep array." },
      { text: "React 18 throttles repeated updates from the same effect down to one per mount", whyTempting: "Automatic batching merges updates within a tick; it never caps how many updates an interval may perform." },
      { text: "The callback captured count from the mount render, so it computes 0 + 1 on every tick" },
      { text: "count is declared with const, so the increment silently fails once its initial value is consumed", whyTempting: "const only prevents reassignment of that binding; each render creates a separate binding with its own value." },
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
      { text: "Add draft to the dep array so the listener is torn down and re-registered on each keystroke", whyTempting: "This does read fresh values, but it churns a listener per keystroke instead of keeping one registration." },
      { text: "Keep draft in a ref written on every render, and read ref.current inside the handler" },
      { text: "Wrap the handler in useCallback with [draft], since the memoized function closes over fresh state", whyTempting: "A new function identity is useless here: addEventListener already holds the original reference." },
      { text: "Use a functional state update in the handler, which is the general escape hatch from stale closures", whyTempting: "Functional updates only help when you are writing that same piece of state, not when you must read a value to pass elsewhere." },
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
      { text: "The updater form fixes only the write; count is still the binding captured at mount" },
      { text: "track runs before React flushes the pending update, so the payload trails the state by exactly one", whyTempting: "That reasoning explains an off-by-one, not a value frozen at 0 across many clicks." },
      { text: "useCallback with [] freezes the component's state, so nothing called from that handler can observe updates", whyTempting: "Nothing is frozen: other handlers and the render body see current state, only this captured binding is old." },
      { text: "State variables reset to their initial value between renders unless you keep them in a ref", whyTempting: "State is preserved across renders; each render simply gets its own binding for the value at that time." },
    ],
    correct: 0,
    explanation:
      "setCount(c => c + 1) receives the latest value from React, but the count identifier in the same closure is still the one from the first render. Add count to the deps, or read it from a ref, when you need it as data.",
  },
  {
    concept: "stale-closure",
    difficulty: "hard",
    prompt:
      "const onPick = async (id) => { await save(id); if (id === selectedId) refresh(); } — selectedId is state and the handler is recreated on every render. Why can the comparison still use an outdated selectedId?",
    options: [
      { text: "The handler is rebuilt each render, so after the await it re-reads the current selectedId and the bug lies elsewhere", whyTempting: "A fresh function per render only helps up to the moment it starts; resuming after an await does not re-capture anything." },
      { text: "React re-invokes event handlers after each state change, so the pre-await and post-await runs disagree", whyTempting: "Handlers run once per event; React never replays them because state changed." },
      { text: "The closure holds the selectedId from the render that created it, and awaiting does not refresh it" },
      { text: "Because save is async, React defers the queued state update until the handler returns, leaving state behind", whyTempting: "The update is applied as soon as it is dispatched and rendered; it is not held back until the async function settles." },
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
      { text: "Nothing visible changes; index keys are a performance concern rather than a correctness one", whyTempting: "The common belief that keys only speed up diffing — they actually decide which state belongs to which item." },
      { text: "React logs a warning and falls back to comparing element identity, so the inputs stay with their rows", whyTempting: "There is no such fallback: React trusts the keys you supply and warns only when they are missing." },
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
      { text: "JSX strips key only for elements produced inside .map(), so passing it directly would work", whyTempting: "The stripping is done by the element factory itself, so it happens no matter where the element is created." },
      { text: "React consumes key for reconciliation and never forwards it in props; pass it again as id" },
      { text: "Destructuring shadows React's internal field, so the value has to be read as props['key'] instead", whyTempting: "Destructuring cannot shadow anything — the field is simply absent from the props object." },
      { text: "key is only populated during the commit phase, so it reads as undefined in the render body", whyTempting: "Keys are consumed during reconciliation, not attached to props at any later phase." },
    ],
    correct: 1,
    explanation:
      "key (like ref) is consumed by React itself and is not forwarded to the component, so any child that needs it must receive a separate prop such as id. React 19 warns loudly when you destructure key out of props.",
  },
  {
    concept: "react-key",
    difficulty: "medium",
    prompt:
      "In a client-rendered app, someone silences a key warning with key={Math.random()} and the console goes quiet. What breaks?",
    options: [
      { text: "Nothing breaks: uniqueness among siblings is the only requirement React documents for keys", whyTempting: "Uniqueness is necessary but not sufficient — a key must also be stable across renders for the same item." },
      { text: "Duplicate random values eventually collide, and React quietly drops one of the two rows", whyTempting: "Collisions are vanishingly rare and would warn rather than drop; the real damage happens on every render." },
      { text: "Hydration mismatches appear because server and client generate different keys on the first paint", whyTempting: "A genuine problem in SSR apps, but this app renders on the client, so hydration is not involved." },
      { text: "Keys change every render, so React remounts each row and loses focus, scroll and child state" },
    ],
    correct: 3,
    explanation:
      "A new key means a different element identity, so React unmounts the old subtree and mounts a fresh one on every render, destroying DOM and component state and re-running effects. It is strictly worse than index keys.",
  },
  {
    concept: "react-key",
    difficulty: "hard",
    prompt:
      "To clear a form when the selected user changes, a PR renders <ProfileForm key={userId} user={user} /> as the only child. What does that change do?",
    options: [
      { text: "React reuses the instance and merely re-runs its effects, since key affects only sibling ordering", whyTempting: "Keys are part of element identity, not just a hint about order within a list." },
      { text: "The form's state resets while its effects survive, because keys reset state but not the effect list", whyTempting: "State and effects live on the same fiber, so they are discarded together." },
      { text: "Nothing resets, because a key has no meaning unless there are two or more siblings to distinguish", whyTempting: "A key is compared against the previous element in the same position, even when it is an only child." },
      { text: "The old ProfileForm unmounts and a fresh one mounts: state resets and effects re-run their cleanup" },
    ],
    correct: 3,
    explanation:
      "Changing the key changes the element's identity, so React discards the whole subtree and mounts a new one — the documented way to reset state on prop change. The cost is a full remount, including refetching in mount effects.",
  },
];
