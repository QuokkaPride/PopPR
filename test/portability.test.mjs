/**
 * The cross-platform paths, and the non-TTY ones.
 *
 * Everything here was written on macOS, so none of it can execute Windows
 * behaviour. What it can do is pin the platform-independent halves: the quoting
 * we hand to cmd.exe, the git-quoted path decoder, the streak day key, and the
 * regex anchors. The Windows halves are covered by the windows-latest job in
 * CI, which is the only thing that actually proves them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the streak at a scratch directory BEFORE importing history.js. Without
// this the save test overwrites the developer's own ~/.poppr/history.json, which
// is not hypothetical: it is how POPPR_HOME came to exist.
process.env.POPPR_HOME = mkdtempSync(join(tmpdir(), "poppr-test-"));

// Pin the zone so the streak tests actually distinguish local days from UTC
// ones. Written against the runner's own zone they pass either way, which is
// how the first version of them shipped green against the bug they were meant
// to pin. UTC-4 in August, so a late-evening run is already tomorrow in UTC.
process.env.TZ = "America/New_York";

const { currentStreak, saveHistory, loadHistory } = await import("../dist/core/history.js");
const { detectConcepts } = await import("../dist/core/concepts.js");
const { resolveBin, pickExecutable } = await import("../dist/core/providers/spawn.js");

test("resolveBin returns a path for a binary that exists, null for one that does not", async () => {
  const found = await resolveBin(process.platform === "win32" ? "cmd" : "sh");
  assert.ok(found && found.length > 0, "expected a resolved path");
  assert.equal(await resolveBin("poppr-definitely-not-a-real-binary-xyz"), null);
});

test("resolveBin returns one line, not the whole `where` listing", async () => {
  const found = await resolveBin(process.platform === "win32" ? "cmd" : "sh");
  assert.ok(!found.includes("\n"), "a multi-match `where` must still yield one path");
  assert.equal(found, found.trim());
});

test("a streak counts local calendar days, not UTC ones", () => {
  // The times matter. A run at 23:30 local in a western zone is already
  // TOMORROW in UTC, so keying off toISOString() splits two consecutive days of
  // play across three UTC days and the streak breaks. Pinned to UTC-4 so the
  // disagreement is deterministic: this returns 2 keyed locally and 1 keyed in
  // UTC, which is what the previous implementation returned.
  assert.equal(process.env.TZ, "America/New_York", "TZ must be pinned for this test");

  const h = {
    version: 1,
    concepts: {},
    runs: [
      { date: new Date(2026, 7, 10, 9, 0).toISOString() },
      { date: new Date(2026, 7, 11, 23, 30).toISOString() },
    ],
  };

  assert.equal(currentStreak(h, new Date(2026, 7, 11, 23, 45)), 2);
});

test("a streak survives today not being played yet", () => {
  const h = {
    version: 1,
    concepts: {},
    runs: [
      { date: new Date(2026, 7, 10, 23, 30).toISOString() },
      { date: new Date(2026, 7, 11, 23, 30).toISOString() },
    ],
  };

  assert.equal(currentStreak(h, new Date(2026, 7, 12, 9, 0)), 2);
});

test("where's listing resolves to the .cmd, never npm's extensionless sh shim", () => {
  // What `where claude` actually prints on Windows after `npm i -g`: npm's
  // cmd-shim writes all three, and the extensionless one is a #!/bin/sh script
  // for Git Bash that Windows cannot execute. Taking the first line resolved
  // every npm-installed backend to that script.
  const listing = [
    "C:\\Users\\dev\\AppData\\Roaming\\npm\\claude",
    "C:\\Users\\dev\\AppData\\Roaming\\npm\\claude.ps1",
    "C:\\Users\\dev\\AppData\\Roaming\\npm\\claude.cmd",
  ];

  assert.equal(pickExecutable(listing), "C:\\Users\\dev\\AppData\\Roaming\\npm\\claude.cmd");
});

test("a real .exe outranks a .cmd when both are on PATH", () => {
  assert.equal(
    pickExecutable(["C:\\shims\\gh.cmd", "C:\\Program Files\\GitHub CLI\\gh.exe"]),
    "C:\\Program Files\\GitHub CLI\\gh.exe",
  );
});

test("a listing with nothing executable resolves to null, not a shell script", () => {
  assert.equal(pickExecutable(["C:\\Users\\dev\\AppData\\Roaming\\npm\\claude"]), null);
  assert.equal(pickExecutable([]), null);
});

test("a path holding a percent sign is rejected rather than expanded by cmd", () => {
  // Quotes neutralise & | < > ^ but not %VAR%, which cmd expands inside them.
  assert.equal(pickExecutable(["C:\\tools\\%USERNAME%\\claude.cmd"]), null);
});

test("saveHistory round-trips through POPPR_HOME", async () => {
  const h = { version: 1, runs: [{ date: new Date().toISOString() }], concepts: {} };
  assert.equal(await saveHistory(h), true);
  const back = await loadHistory();
  assert.equal(back.runs.length, 1);
});

test("saveHistory reports failure instead of throwing", async () => {
  // A file cannot be a parent directory, on any platform. The run has to
  // survive this: it happens between the last answer and the review screen, and
  // a throw here used to take the whole score down with it.
  const previous = process.env.POPPR_HOME;
  const asFile = join(previous, "history.json");
  process.env.POPPR_HOME = join(asFile, "nested");
  try {
    assert.equal(await saveHistory({ version: 1, runs: [], concepts: {} }), false);
  } finally {
    process.env.POPPR_HOME = previous;
  }
});

test("an end-of-line rule fires on a line that is not the last one", () => {
  // Rules run against a file's added lines joined into one blob. Without /m a
  // `$` anchors to the end of that whole blob, so the end-of-line alternative
  // could only ever match the final line of the file.
  const ctx = {
    label: "test",
    repo: "test/test",
    files: [
      {
        path: "src/a.ts",
        status: "modified",
        additions: 3,
        deletions: 0,
        patch: [
          "diff --git a/src/a.ts b/src/a.ts",
          "@@ -1,0 +1,3 @@",
          "+const cache = {};",
          "+function keep(x: string) { return x; }",
          "+export const other = keep(\"padding to move the end of file\");",
        ].join("\n"),
      },
    ],
  };

  const concepts = detectConcepts(ctx).map((c) => c.concept);
  assert.ok(
    concepts.includes("unbounded-growth"),
    `expected unbounded-growth from a non-final line, got: ${concepts.join(", ")}`,
  );
});
