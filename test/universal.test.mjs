import test from "node:test";
import assert from "node:assert/strict";

import { bankQuestions, certifySet } from "../dist/core/bank.js";
import { UNIVERSAL_CONCEPTS, ALL_ENTRIES } from "../dist/bank/index.js";
import { codeFiles, detectConcepts, RULES } from "../dist/core/concepts.js";

/**
 * The general-engineering top-up.
 *
 * Two properties matter and pull against each other: a small code PR must not
 * produce a two-question run, and a documentation PR must still produce none.
 * Everything below pins one of those.
 */

const isUniversal = (q) => UNIVERSAL_CONCEPTS.has(q.concept);
const ctx = (files) => ({ label: "PR #1", repo: "o/r", base: "main", head: "x", files });
const file = (path, added) => ({
  path,
  status: "modified",
  additions: added.length,
  deletions: 0,
  patch: `@@ -1,1 +1,${added.length} @@\n${added.map((l) => `+${l}`).join("\n")}`,
});

test("a code PR matching no concept still gets a full run of general questions", () => {
  const questions = bankQuestions([], 20, { codeFiles: ["src/a.rb"] });
  assert.equal(questions.length, 8);
  assert.ok(questions.every(isUniversal));
});

test("a PR with no code files gets nothing, which is what keeps docs PRs silent", () => {
  assert.equal(bankQuestions([], 20, { codeFiles: [] }).length, 0);
  assert.equal(bankQuestions([], 20).length, 0);
});

test("questions from the diff are never displaced by general ones", () => {
  const concept = ALL_ENTRIES.find((e) => !UNIVERSAL_CONCEPTS.has(e.concept)).concept;
  const questions = bankQuestions([{ concept, files: ["src/a.ts"] }], 20, {
    codeFiles: ["src/a.ts"],
  });
  const fromDiff = questions.filter((q) => !isUniversal(q));
  assert.ok(fromDiff.length > 0, "the detected concept still contributes");
  assert.equal(questions.length, 8, "topped up to the floor and no further");
  // The diff's own questions lead, because the clock may not reach the end.
  assert.ok(!isUniversal(questions[0]));
});

test("a rich diff is not topped up at all", () => {
  const rich = [...new Set(ALL_ENTRIES.map((e) => e.concept))]
    .filter((c) => !UNIVERSAL_CONCEPTS.has(c))
    .slice(0, 12)
    .map((concept) => ({ concept, files: ["src/a.ts"] }));
  const questions = bankQuestions(rich, 20, { codeFiles: ["src/a.ts"] });
  assert.equal(questions.length, 20);
  assert.equal(questions.filter(isUniversal).length, 0);
});

test("the floor never exceeds the caller's limit", () => {
  assert.equal(bankQuestions([], 3, { codeFiles: ["src/a.go"] }).length, 3);
});

test("general questions carry no evidence, because no line caused them", () => {
  for (const q of bankQuestions([], 20, { codeFiles: ["src/a.py"] })) {
    assert.equal(q.evidence, undefined);
    assert.deepEqual(q.anchors, []);
  }
});

test("certify tops up too, so a thin diff is not a two-question gate", () => {
  const set = certifySet([], { limit: 10, topUp: { codeFiles: ["src/a.java"] } });
  assert.equal(set.length, 8);
  assert.ok(set.every(isUniversal));
  // Same question is never asked twice in a set everyone must master.
  assert.equal(new Set(set.map((q) => q.prompt)).size, set.length);
});

test("certify without a code file stays empty rather than gating on trivia", () => {
  assert.equal(certifySet([], { limit: 10, topUp: { codeFiles: [] } }).length, 0);
});

/**
 * `codeFiles` is an allowlist, and this is why. Measured over 487 merged PRs, a
 * blocklist called systemd's hardware database and OpenSSL's VERSION.dat "code",
 * which would have put eight engineering questions on a copyright-year bump.
 */
test("only real source extensions count as code", () => {
  const notCode = ctx([
    file("hwdb.d/20-acpi-vendor.hwdb", ["acpi:MEIK*:"]),
    file("VERSION.dat", ["PATCH=7"]),
    file("doc/man1/openssl-cms.pod.in", ["Copyright 2008-2025"]),
    file("CHANGELOG.md", ["- fixed a thing"]),
    file("package-lock.json", ['"version": "1.2.3"']),
  ]);
  assert.deepEqual(codeFiles(notCode), []);

  const code = ctx([file("src/handler.go", ["v, _ := lookup(k)"])]);
  assert.deepEqual(codeFiles(code), ["src/handler.go"]);
});

test("a file of only comments adds no code", () => {
  assert.deepEqual(codeFiles(ctx([file("src/a.ts", ["// just a note", "  "])])), []);
  assert.deepEqual(codeFiles(ctx([file("src/a.c", ["#include <stdio.h>"])])), ["src/a.c"]);
});

/**
 * The two halves of the same invariant. A rule with no questions names a concept
 * and has nothing to ask about it; a universal concept with a rule would be
 * detected, which is the one thing it must never be.
 */
test("every detectable concept has questions, and no universal concept is detectable", () => {
  const answerable = new Set(ALL_ENTRIES.map((e) => e.concept));
  for (const rule of RULES) {
    assert.ok(answerable.has(rule.concept), `rule "${rule.concept}" has no bank questions`);
    assert.ok(
      !UNIVERSAL_CONCEPTS.has(rule.concept),
      `universal concept "${rule.concept}" must not be detectable`,
    );
  }
});

test("detection and the code-file check agree that a Vue SFC is JavaScript", () => {
  const vue = ctx([
    file("app/Message.vue", [
      "const shown = computed(() => !!props.attributes?.referral);",
    ]),
  ]);
  assert.deepEqual(codeFiles(vue), ["app/Message.vue"]);
  assert.ok(
    detectConcepts(vue).some((d) => d.concept === "optional-chaining"),
    "?. inside a Vue script block is still optional chaining",
  );
});
