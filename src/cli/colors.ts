import pc from "picocolors";

/**
 * picocolors with its Windows special case removed.
 *
 * Its detection reads `p.platform === "win32"` as a standalone truthy branch
 * (node_modules/picocolors/picocolors.js:4), so every Windows process gets ANSI
 * whether or not stdout is a terminal. `poppr --detect --json > out.json` on
 * Windows writes escape codes into the JSON, and piping into another tool feeds
 * it the same. On every other platform picocolors already requires isTTY, so
 * this only ever tightens Windows to match.
 *
 * NO_COLOR wins over everything, then FORCE_COLOR, then the terminal check.
 * CI stays colored because Actions renders ANSI in its log viewer.
 */
const disabled = Boolean(process.env.NO_COLOR) || process.argv.includes("--no-color");
const forced = Boolean(process.env.FORCE_COLOR) || process.argv.includes("--color");

// TERM=dumb is picocolors' own guard and has to survive: a dumb terminal is one
// that has told us it cannot render escape codes.
const usable = Boolean(process.stdout.isTTY) && process.env.TERM !== "dumb";

const colorEnabled = !disabled && (forced || usable || Boolean(process.env.CI));

export default pc.createColors(colorEnabled);
