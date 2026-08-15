import test from "node:test";
import assert from "node:assert/strict";

import { bankQuestions, certifySet, shuffleOptions } from "../dist/core/bank.js";
import { ALL_ENTRIES } from "../dist/bank/index.js";

/**
 * Selection is randomised, so these assert invariants: how many, from where,
 * unique or not. Anything that pinned an ordering would be a test that fails
 * on a Tuesday for no reason.
 */

/** Real per-concept counts, read off the bank rather than assumed. */
const COUNT = new Map();
for (const entry of ALL_ENTRIES) {
  COUNT.set(entry.concept, (COUNT.get(entry.concept) ?? 0) + 1);
}

/** Concepts carrying at least `n` questions, richest first, as request objects. */
function conceptsWithAtLeast(n, take) {
  const slugs = [...COUNT.entries()]
    .filter(([, count]) => count >= n)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, take)
    .map(([slug]) => slug);

  assert.ok(
    slugs.length === take,
    `the bank no longer has ${take} concepts with ${n}+ questions, so this test needs rewriting`,
  );
  return slugs.map((concept) => ({ concept, files: [`src/${concept}.ts`] }));
}

function countByConcept(questions) {
  const counts = new Map();
  for (const question of questions) {
    counts.set(question.concept, (counts.get(question.concept) ?? 0) + 1);
  }
  return counts;
}

test("certifySet respects limit", () => {
  const concepts = conceptsWithAtLeast(2, 6);

  for (const limit of [1, 3, 5, 7]) {
    const questions = certifySet(concepts, { limit, perConcept: 2 });
    assert.equal(questions.length, limit, `limit ${limit}`);
  }
});

test("certifySet defaults to ten questions and stops at what the bank actually holds", () => {
  const plenty = conceptsWithAtLeast(2, 8);
  assert.equal(certifySet(plenty).length, 10, "the documented default is ten");

  // Two concepts at two each is four questions, and the default limit of ten
  // must not invent the other six.
  const thin = conceptsWithAtLeast(2, 2);
  assert.equal(certifySet(thin).length, 4);
});

test("certifySet takes at most perConcept questions from any one concept", () => {
  const concepts = conceptsWithAtLeast(3, 5);

  for (const perConcept of [1, 2, 3]) {
    // Repeat, because a per-concept cap that leaks would leak on the shuffles
    // that happen to order one concept's entries first.
    for (let i = 0; i < 50; i++) {
      const questions = certifySet(concepts, { limit: 99, perConcept });
      for (const [concept, count] of countByConcept(questions)) {
        assert.ok(
          count <= perConcept,
          `${concept} contributed ${count} questions with perConcept ${perConcept}`,
        );
      }
    }
  }
});

test("certifySet spreads across concepts instead of letting one monopolise the gate", () => {
  const concepts = conceptsWithAtLeast(3, 5);

  for (let i = 0; i < 50; i++) {
    const questions = certifySet(concepts, { limit: 5, perConcept: 2 });
    assert.equal(
      countByConcept(questions).size,
      5,
      "round-robin means five questions come from five concepts, not two",
    );
  }
});

test("certifySet returns only questions for the concepts asked for", () => {
  const concepts = conceptsWithAtLeast(2, 4);
  const asked = new Set(concepts.map((c) => c.concept));

  for (let i = 0; i < 50; i++) {
    for (const question of certifySet(concepts, { limit: 10, perConcept: 2 })) {
      assert.ok(asked.has(question.concept), `${question.concept} was never asked for`);
    }
  }

  assert.deepEqual(certifySet([{ concept: "no-such-concept", files: ["a.rs"] }]), []);
  assert.deepEqual(certifySet([]), []);
});

test("certifySet ids are unique within a set", () => {
  const concepts = conceptsWithAtLeast(3, 6);

  for (let i = 0; i < 50; i++) {
    const questions = certifySet(concepts, { limit: 10, perConcept: 2 });
    const ids = questions.map((q) => q.id);
    assert.equal(
      new Set(ids).size,
      ids.length,
      // The mastery loop keys mastery off the id, so a duplicate id would mean
      // answering one question marked two as understood.
      `duplicate ids would let one answer master two questions: ${ids.join(",")}`,
    );
    const prompts = questions.map((q) => q.prompt);
    assert.equal(new Set(prompts).size, prompts.length, "the same question must not appear twice");
  }
});

test("certifySet anchors each question to the files that triggered its concept", () => {
  const questions = certifySet(
    [{ concept: conceptsWithAtLeast(2, 1)[0].concept, files: ["a.ts", "b.ts", "c.ts", "d.ts"] }],
    { limit: 2, perConcept: 2 },
  );

  assert.equal(questions.length, 2);
  for (const question of questions) {
    assert.deepEqual(question.anchors, ["a.ts", "b.ts", "c.ts"], "anchors cap at three");
  }
});

test("shuffleOptions preserves the correct answer's text while reassigning the keys", () => {
  const question = {
    id: "q1",
    difficulty: "hard",
    archetype: "language-concept",
    concept: "promise-all",
    prompt: "which one",
    options: [
      { key: "A", text: "quokka", whyTempting: "why quokka" },
      { key: "B", text: "numbat", whyTempting: "why numbat" },
      { key: "C", text: "bilby", whyTempting: "why bilby" },
      { key: "D", text: "potoroo", whyTempting: "why potoroo" },
    ],
    correct: "C",
    explanation: "because",
    anchors: ["src/a.ts"],
  };

  const orders = new Set();
  const correctKeys = new Set();

  // Four options give 24 orderings, so 200 shuffles landing on one ordering is
  // a 1-in-24^199 event. If this fails, the shuffle is gone, not unlucky.
  for (let i = 0; i < 200; i++) {
    const served = shuffleOptions(question);

    assert.equal(
      served.options.find((o) => o.key === served.correct).text,
      "bilby",
      "correct has to keep pointing at the same text, or a re-ask teaches a letter",
    );
    assert.deepEqual(
      served.options.map((o) => o.key),
      ["A", "B", "C", "D"],
      "keys are handed out in reading order, never carried over from the old positions",
    );
    assert.deepEqual(
      served.options.map((o) => o.text).sort(),
      ["bilby", "numbat", "potoroo", "quokka"],
      "shuffling must not drop, duplicate or invent an option",
    );
    for (const option of served.options) {
      assert.equal(option.whyTempting, `why ${option.text}`, "whyTempting travels with its text");
    }

    orders.add(served.options.map((o) => o.text).join("|"));
    correctKeys.add(served.correct);
  }

  assert.ok(orders.size > 1, "the options came back in the same order 200 times");
  assert.ok(correctKeys.size > 1, "the correct key never moved, so the answer is memorisable");

  assert.equal(question.correct, "C", "the input question is not mutated");
  assert.equal(question.options[0].text, "quokka");
});

test("shuffleOptions leaves everything except the options alone", () => {
  const question = {
    id: "q1",
    difficulty: "hard",
    archetype: "trap",
    concept: "await-in-loop",
    prompt: "which one",
    options: [
      { key: "A", text: "one" },
      { key: "B", text: "two" },
    ],
    correct: "B",
    explanation: "because",
    anchors: ["src/a.ts", "src/b.ts"],
  };

  const served = shuffleOptions(question);
  assert.equal(served.id, "q1");
  assert.equal(served.difficulty, "hard");
  assert.equal(served.archetype, "trap");
  assert.equal(served.concept, "await-in-loop");
  assert.equal(served.prompt, "which one");
  assert.equal(served.explanation, "because");
  assert.deepEqual(served.anchors, ["src/a.ts", "src/b.ts"]);
});

test("bankQuestions still behaves as before the toQuestions refactor", () => {
  const concepts = conceptsWithAtLeast(2, 4);
  const asked = new Set(concepts.map((c) => c.concept));
  const available = concepts.reduce((sum, c) => sum + COUNT.get(c.concept), 0);

  for (let i = 0; i < 50; i++) {
    const questions = bankQuestions(concepts, 5);

    assert.equal(questions.length, 5, "limit truncates the matched set");

    const ids = questions.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length, "ids are unique within a set");
    assert.deepEqual(ids, ["bank1", "bank2", "bank3", "bank4", "bank5"], "ids are positional");

    for (const question of questions) {
      assert.ok(asked.has(question.concept), `${question.concept} was never asked for`);
      assert.deepEqual(
        question.options.map((o) => o.key),
        ["A", "B", "C", "D"],
      );
      assert.ok(
        question.options.some((o) => o.key === question.correct),
        "correct always names an option that exists",
      );
      assert.ok(question.prompt.length > 0);
      assert.ok(question.explanation.length > 0);
      assert.equal(question.archetype, "language-concept");
      assert.deepEqual(question.anchors, [`src/${question.concept}.ts`]);
    }
  }

  // Unlike certifySet there is no per-concept cap here, so a limit above the
  // matched set simply returns the whole thing.
  assert.equal(bankQuestions(concepts, 999).length, available);
  assert.equal(bankQuestions(concepts).length, Math.min(available, 20), "the default limit is 20");
  assert.deepEqual(bankQuestions([{ concept: "no-such-concept", files: ["a.rs"] }]), []);
  assert.deepEqual(bankQuestions([]), []);
});

test("bankQuestions can draw more than two questions from one concept, unlike certifySet", () => {
  const [rich] = [...COUNT.entries()].sort((a, b) => b[1] - a[1]);
  const concepts = [{ concept: rich[0], files: ["src/a.ts"] }];

  assert.ok(rich[1] >= 3, "this test needs a concept with three or more questions");
  assert.equal(
    bankQuestions(concepts, 99).length,
    rich[1],
    "the scored run is free to lean on one concept, which is exactly why certify does not use it",
  );
});
