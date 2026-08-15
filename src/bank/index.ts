import type { BankEntry } from "./types.js";
import { ASYNC_ENTRIES } from "./async.js";
import { DATA_ENTRIES } from "./data.js";
import { REACT_ENTRIES } from "./react.js";
import { PYGO_ENTRIES } from "./pygo.js";
import { SYSTEMS_ENTRIES } from "./systems.js";
import { JS_BINDINGS_ENTRIES } from "./js-bindings.js";
import { JS_ARRAYS_ENTRIES } from "./js-arrays.js";
import { JS_VALUES_ENTRIES } from "./js-values.js";
import { TS_BASICS_ENTRIES } from "./ts-basics.js";
import { TS_RUNTIME_ENTRIES } from "./ts-runtime.js";
import { PYTHON_RUNTIME_ENTRIES } from "./python-runtime.js";
import { GO_ENTRIES } from "./go.js";
import { RUST_ENTRIES } from "./rust.js";
import { JAVA_ENTRIES } from "./java.js";
import { RUBY_ENTRIES } from "./ruby.js";
import { C_ENTRIES } from "./c.js";
import { UNIVERSAL_ENTRIES } from "./universal.js";

/**
 * The full curated bank.
 *
 * Adding a question here benefits every user of poppr, which makes this the
 * natural place for contributions: one good PR is one more thing the whole
 * community gets quizzed on. Keep the distractor discipline (see CONTRIBUTING)
 *: `npm run audit:bank` fails the build when anything other than the content of
 * an option predicts which one is correct, which is the main way multiple
 * choice quietly rots.
 */
export const ALL_ENTRIES: BankEntry[] = [
  ...ASYNC_ENTRIES,
  ...DATA_ENTRIES,
  ...REACT_ENTRIES,
  ...PYGO_ENTRIES,
  ...SYSTEMS_ENTRIES,
  ...JS_BINDINGS_ENTRIES,
  ...JS_ARRAYS_ENTRIES,
  ...JS_VALUES_ENTRIES,
  ...TS_BASICS_ENTRIES,
  ...TS_RUNTIME_ENTRIES,
  ...PYTHON_RUNTIME_ENTRIES,
  ...GO_ENTRIES,
  ...RUST_ENTRIES,
  ...JAVA_ENTRIES,
  ...RUBY_ENTRIES,
  ...C_ENTRIES,
  ...UNIVERSAL_ENTRIES,
];

export { UNIVERSAL_ENTRIES, UNIVERSAL_CONCEPTS } from "./universal.js";
export type { BankEntry };
