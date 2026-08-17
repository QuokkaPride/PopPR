/**
 * Regenerates demo/poppr.gif for the README. Maintainer-only: it needs Python
 * and Pillow, which nothing else in the project does.
 *
 * This exists because the npm script it replaces was
 * `node demo/frames.mjs > /tmp/poppr-frames.json && python3 demo/render.py ...`,
 * which hardcodes three POSIX-only things: the /tmp path, shell redirection,
 * and the `python3` binary name (Windows installs it as `python`, and `python3`
 * there is usually a Store stub that exits without doing anything).
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const framesJson = join(tmpdir(), "poppr-frames.json");

const frames = spawnSync(process.execPath, [join(root, "demo", "frames.mjs")], {
  encoding: "utf8",
  cwd: root,
});
if (frames.status !== 0) {
  console.error(frames.stderr || "demo/frames.mjs failed.");
  process.exit(frames.status ?? 1);
}
writeFileSync(framesJson, frames.stdout);

// Try the interpreters in the order that gets it right on each platform first.
const candidates = process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"];

for (const py of candidates) {
  const out = spawnSync(py, [join(root, "demo", "render.py"), framesJson, join(root, "demo", "poppr.gif")], {
    stdio: "inherit",
    cwd: root,
  });
  // ENOENT means that interpreter is not installed; anything else is a real
  // failure from a Python that did run, and retrying another one would hide it.
  if (out.error && out.error.code === "ENOENT") continue;
  process.exit(out.status ?? 1);
}

console.error(
  `No Python found (tried ${candidates.join(", ")}). The demo GIF needs Python with Pillow installed.`,
);
process.exit(1);
