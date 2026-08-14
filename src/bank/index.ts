import type { BankEntry } from "./types.js";
import { ASYNC_ENTRIES } from "./async.js";
import { DATA_ENTRIES } from "./data.js";
import { REACT_ENTRIES } from "./react.js";
import { PYGO_ENTRIES } from "./pygo.js";
import { SYSTEMS_ENTRIES } from "./systems.js";

/**
 * The full curated bank.
 *
 * Adding a question here benefits every user of poppr, which makes this the
 * natural place for contributions: one good PR is one more thing the whole
 * community gets quizzed on. Keep the distractor discipline (see CONTRIBUTING)
 * — `npm run audit:bank` fails the build if the correct answer is the longest
 * option too often, which is the main way multiple choice quietly rots.
 */
export const ALL_ENTRIES: BankEntry[] = [
  ...ASYNC_ENTRIES,
  ...DATA_ENTRIES,
  ...REACT_ENTRIES,
  ...PYGO_ENTRIES,
  ...SYSTEMS_ENTRIES,
];

export type { BankEntry };
