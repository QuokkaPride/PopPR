/**
 * Copies the compiled core and bank into web/vendor/.
 *
 * No bundler on purpose. tsc already emits ESM with explicit `.js` specifiers,
 * which is exactly what a browser resolves natively, so the whole build is a
 * recursive copy. Adding a bundler here would be a third dependency to serve a
 * page that does not need one.
 *
 * Only modules free of node builtins are copied. `diff.ts` and `pr.ts` shell
 * out to git, and `history.ts` touches the filesystem; the web app supplies its
 * own versions of those two jobs.
 */
import { cp, rm, mkdir, readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendor = join(root, "web", "vendor");

const SKIP = new Set(["diff.js", "pr.js", "history.js", "classify.js", "quiz.js"]);

await rm(vendor, { recursive: true, force: true });
await mkdir(join(vendor, "core"), { recursive: true });

await cp(join(root, "dist", "bank"), join(vendor, "bank"), {
  recursive: true,
  filter: (src) => !src.endsWith(".d.ts"),
});

for (const name of await readdir(join(root, "dist", "core"))) {
  if (name.endsWith(".d.ts") || SKIP.has(name)) continue;
  const from = join(root, "dist", "core", name);
  try {
    await cp(from, join(vendor, "core", name));
  } catch {
    continue; // providers/ and other directories are not needed in the browser
  }
}

// A node builtin reaching the browser is a blank page with a console error, so
// fail the build here instead.
const offenders = [];
for (const dir of ["core", "bank"]) {
  for (const name of await readdir(join(vendor, dir))) {
    if (!name.endsWith(".js")) continue;
    const src = await readFile(join(vendor, dir, name), "utf8");
    if (/from ["']node:/.test(src)) offenders.push(`${dir}/${name}`);
  }
}
if (offenders.length) {
  console.error(`Node builtins in browser bundle: ${offenders.join(", ")}`);
  process.exit(1);
}

console.log(`web/vendor ready (${offenders.length} node imports)`);
