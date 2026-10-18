import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, apiErrorHandler } from "./api-error";

function responseRecorder() {
  const state: { status?: number; body?: unknown } = {};
  const response = { status(code: number) { state.status = code; return this; }, json(body: unknown) { state.body = body; return this; } };
  return { state, response };
}

test("serializes operational API errors without losing details", () => {
  const { state, response } = responseRecorder();
  apiErrorHandler(new ApiError(409, "Conflict", "CONFLICT", { version: 2 }), {} as never, response as never, (() => undefined) as never);
  assert.equal(state.status, 409);
  assert.deepEqual(state.body, { message: "Conflict", error: { code: "CONFLICT", message: "Conflict", details: { version: 2 } } });
});

test("does not expose unexpected internal errors", () => {
  const { state, response } = responseRecorder();
  const original = console.error; console.error = () => undefined;
  try { apiErrorHandler(new Error("database password leaked"), {} as never, response as never, (() => undefined) as never); }
  finally { console.error = original; }
  assert.equal(state.status, 500);
  assert.deepEqual(state.body, { message: "An unexpected error occurred", error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
});
