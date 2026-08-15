import test from "node:test";
import assert from "node:assert/strict";

import { MasteryLoop } from "../dist/core/mastery.js";

/**
 * Synthetic questions rather than bank ones, because these tests are about the
 * loop's bookkeeping and a bank change should never turn them red.
 */
function q(id, concept = "async/concurrency") {
  return {
    id,
    difficulty: "medium",
    archetype: "language-concept",
    concept,
    prompt: `prompt for ${id}`,
    options: [
      { key: "A", text: `${id} alpha` },
      { key: "B", text: `${id} bravo` },
      { key: "C", text: `${id} charlie` },
      { key: "D", text: `${id} delta` },
    ],
    correct: "B",
    explanation: `explanation for ${id}`,
    anchors: ["src/example.ts"],
  };
}

/** A timed-pass answer, in the shape `Answered` demands. */
function answered(question, correct) {
  return { question, chosen: correct ? question.correct : "A", correct, ms: 4200, points: 0, comboAt: 0 };
}

/** Serve and grade everything correctly, returning the ids in serve order. */
function drainCorrect(loop, cap = 100) {
  const served = [];
  for (let i = 0; i < cap; i++) {
    const question = loop.next();
    if (!question) break;
    served.push(question.id);
    loop.record(true);
  }
  return served;
}

test("questions answered correctly in the first pass are pre-mastered and never asked again", () => {
  const questions = [q("a"), q("b"), q("c")];
  const loop = new MasteryLoop(questions, [
    answered(questions[0], true),
    answered(questions[1], false),
    answered(questions[2], false),
  ]);

  const served = drainCorrect(loop);
  assert.deepEqual(served, ["b", "c"]);
  assert.equal(served.includes("a"), false);
});

test("questions missed in the first pass are queued", () => {
  const questions = [q("a"), q("b")];
  const loop = new MasteryLoop(questions, [
    answered(questions[0], false),
    answered(questions[1], true),
  ]);

  assert.equal(loop.progress.remaining, 1);
  assert.deepEqual(drainCorrect(loop), ["a"]);
});

test("questions the clock never reached are queued too, so the gate is about understanding rather than reading speed", () => {
  const questions = [q("a"), q("b"), q("c")];
  // Only the first question was reached before time ran out. The other two
  // have no entry at all, which is a different thing from being wrong and must
  // land in the same place regardless.
  const loop = new MasteryLoop(questions, [answered(questions[0], true)]);

  assert.equal(loop.progress.remaining, 2);
  assert.deepEqual(drainCorrect(loop), ["b", "c"]);
});

test("a wrong answer requeues the question and it comes back on the next pass", () => {
  const questions = [q("a"), q("b")];
  const loop = new MasteryLoop(questions);

  assert.equal(loop.next().id, "a");
  loop.record(false);
  assert.equal(loop.next().id, "b");
  loop.record(true);

  const again = loop.next();
  assert.equal(again.id, "a");
  loop.record(true);
  assert.equal(loop.next(), null);
});

test("pass increments only when a sweep ends with misses left", () => {
  const clean = new MasteryLoop([q("a"), q("b")]);
  clean.next();
  clean.record(true);
  clean.next();
  clean.record(true);
  assert.equal(clean.progress.pass, 1);
  assert.equal(clean.next(), null);
  assert.equal(clean.progress.pass, 1, "a sweep with no misses never starts a second pass");

  const messy = new MasteryLoop([q("a"), q("b")]);
  messy.next();
  messy.record(false);
  messy.next();
  messy.record(true);
  assert.equal(messy.progress.pass, 1, "the pass turns over on the next serve, not on the last answer");
  messy.next();
  assert.equal(messy.progress.pass, 2);
  messy.record(true);
  assert.equal(messy.progress.pass, 2);
});

test("done flips only when every question has been answered correctly", () => {
  const questions = [q("a"), q("b")];
  const loop = new MasteryLoop(questions);
  assert.equal(loop.done, false);

  loop.next();
  loop.record(true);
  assert.equal(loop.done, false, "one right out of two is not done");

  loop.next();
  loop.record(false);
  assert.equal(loop.done, false, "a wrong answer leaves it open");

  loop.next();
  loop.record(true);
  assert.equal(loop.done, true);
});

test("a set already fully mastered by the timed pass starts done", () => {
  const questions = [q("a"), q("b")];
  const loop = new MasteryLoop(questions, [
    answered(questions[0], true),
    answered(questions[1], true),
  ]);

  assert.equal(loop.done, true);
  assert.equal(loop.progress.remaining, 0);
  assert.equal(loop.next(), null);
});

test("progress.remaining and progress.total stay right throughout", () => {
  const questions = [q("a"), q("b"), q("c")];
  const loop = new MasteryLoop(questions);
  assert.deepEqual(
    { remaining: loop.progress.remaining, total: loop.progress.total },
    { remaining: 3, total: 3 },
  );

  loop.next();
  loop.record(true);
  assert.equal(loop.progress.remaining, 2);

  loop.next();
  loop.record(false);
  assert.equal(loop.progress.remaining, 2, "a miss changes nothing about what is left to master");

  loop.next();
  loop.record(true);
  assert.equal(loop.progress.remaining, 1);

  loop.next();
  loop.record(true);
  assert.equal(loop.progress.remaining, 0);
  // total is the size of the set, so it never moves.
  assert.equal(loop.progress.total, 3);
});

test("attempts counts every answer given, right or wrong", () => {
  const loop = new MasteryLoop([q("a"), q("b")]);
  assert.equal(loop.progress.attempts, 0);

  loop.next();
  loop.record(false);
  assert.equal(loop.progress.attempts, 1);

  loop.next();
  loop.record(false);
  assert.equal(loop.progress.attempts, 2);

  loop.next();
  loop.record(true);
  loop.next();
  loop.record(true);
  assert.equal(loop.progress.attempts, 4, "two misses plus two hits on a two question set");
});

test("attempts ignores a record() with no question outstanding", () => {
  const loop = new MasteryLoop([q("a")]);
  loop.record(true);
  assert.equal(loop.progress.attempts, 0);
  assert.equal(loop.done, false, "grading nothing must not master anything");
});

test("re-asks reshuffle the options while correct keeps naming the same option text", () => {
  const question = q("a");
  const correctText = question.options.find((o) => o.key === question.correct).text;

  const loop = new MasteryLoop([question]);
  const orders = new Set();
  // 24 orderings exist for four options, so 30 serves that all came back
  // identical would be a 1-in-24^29 coincidence. A failure here is the shuffle
  // being gone, not luck.
  for (let i = 0; i < 30; i++) {
    const served = loop.next();
    orders.add(served.options.map((o) => o.text).join("|"));
    assert.equal(
      served.options.find((o) => o.key === served.correct).text,
      correctText,
      "correct must follow the text, never a remembered letter",
    );
    assert.deepEqual(
      [...served.options].map((o) => o.text).sort(),
      [...question.options].map((o) => o.text).sort(),
      "reshuffling must not drop or invent an option",
    );
    loop.record(false);
  }

  assert.ok(orders.size > 1, "the same question came back in the same order every single time");
});

test("re-asks hand out keys in reading order rather than carrying the old ones", () => {
  const loop = new MasteryLoop([q("a")]);
  for (let i = 0; i < 5; i++) {
    const served = loop.next();
    assert.deepEqual(served.options.map((o) => o.key), ["A", "B", "C", "D"]);
    loop.record(false);
  }
});

test("calling next() twice without record() does not lose the abandoned question", () => {
  const questions = [q("a"), q("b")];
  const loop = new MasteryLoop(questions);

  const first = loop.next();
  assert.equal(first.id, "a");

  // No record(). The caller walked away, which is a quit or a redraw, and the
  // question has to survive it: silently dropping it would let someone skip
  // past a question by re-serving.
  const second = loop.next();
  assert.equal(second.id, "b");
  assert.equal(loop.progress.attempts, 0, "an abandoned question was never answered");
  assert.equal(loop.progress.remaining, 2);

  loop.record(true);
  const third = loop.next();
  assert.equal(third.id, "a", "the abandoned question comes back");
  loop.record(true);

  assert.equal(loop.done, true);
  assert.equal(loop.next(), null);
});

test("a lone abandoned question is re-served rather than ending the loop", () => {
  const loop = new MasteryLoop([q("a")]);
  loop.next();
  const again = loop.next();
  assert.notEqual(again, null, "abandoning the only question must not read as done");
  assert.equal(again.id, "a");
  assert.equal(loop.done, false);
});
