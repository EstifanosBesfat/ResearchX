import assert from "node:assert/strict";
import test from "node:test";
import { countPassagesCovering, distinctiveTokens } from "./coverage";
import { DEMO_QUESTIONS } from "./demos";

test("the absent demo topic is tuberculosis and the others stay in corpus vocabulary", () => {
  const [maternal, factors, malaria, tuberculosis] = DEMO_QUESTIONS;
  assert.deepEqual(distinctiveTokens(maternal.question), []);
  assert.deepEqual(distinctiveTokens(factors.question), []);
  assert.deepEqual(distinctiveTokens(malaria.question), []);
  assert.deepEqual(distinctiveTokens(tuberculosis.question), ["tuberculosis"]);
});

test("one passing mention of tuberculosis does not cover the question", () => {
  const tokens = distinctiveTokens(DEMO_QUESTIONS[3].question);
  const passages = [
    "Maternal sepsis and other infections such as influenza, malaria, tuberculosis, and hepatitis contributed.",
    "Antenatal care utilization increased in Ethiopia.",
  ];
  assert.equal(countPassagesCovering(tokens, passages), 1);
});
