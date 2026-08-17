/**
 * Runs the node:test suites on every platform.
 *
 * `npm test` used to be `node --test test/*.test.mjs`, which depends on the
 * shell expanding the glob. cmd.exe and PowerShell do not expand it, so on
 * Windows node received the literal string `test/*.test.mjs`, found no such
 * file, and the one command CONTRIBUTING tells you to run before every commit
 * failed before it ran a single assertion.
 *
 * The obvious fixes both break something. Node's own glob support in the test
 * runner landed in v22 and package.json declares >=18. Passing the bare `test`
 * directory makes node try to execute it as a module. And argument-free
 * `node --test` walks the whole repo, including dist/ and web/, which never
 * terminates. Reading the directory here is the version that works on Node 18,
 * 20 and 22, on all three platforms, with no dependency.
 *
 * process.execPath rather than "node": it is the interpreter already running
 * this file, so there is no PATH lookup and no Windows shim to resolve.
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, "test");

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort()
  .map((f) => join(dir, f));

if (files.length === 0) {
  console.error("No *.test.mjs files in test/. Did the build or the checkout go wrong?");
  process.exit(1);
}

const { status } = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  cwd: root,
});

process.exit(status ?? 1);
