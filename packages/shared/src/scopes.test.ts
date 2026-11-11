import assert from "node:assert/strict";
import test from "node:test";
import { resolveScopes } from "./scopes";

test("keeps Ethiopian rows when the question names Ethiopia", () => {
  assert.deepEqual(resolveScopes("maternal health in Ethiopia", { includeInternational: false }), ["ethiopia"]);
});

test("adds international rows only when the filter asks for them", () => {
  assert.deepEqual(
    resolveScopes("What factors are associated with maternal mortality?", {
      includeEthiopia: true,
      includeInternational: true,
      country: "Ethiopia",
    }),
    ["ethiopia", "international"],
  );
});

test("omits Ethiopian rows when nothing mentions Ethiopia", () => {
  assert.deepEqual(
    resolveScopes("How do insecticide-treated nets prevent malaria?", {
      includeEthiopia: false,
      includeInternational: true,
    }),
    ["international"],
  );
});

test("returns no scope when both switches are off and the question is silent", () => {
  assert.deepEqual(resolveScopes("malaria prevention methods", { includeInternational: false }), []);
});
