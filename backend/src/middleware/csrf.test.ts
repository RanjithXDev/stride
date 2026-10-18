import test from "node:test";
import assert from "node:assert/strict";
import { csrfProtection } from "./csrf";

function responseRecorder() {
  const state: { status?: number } = {};
  return { state, response: { status(code: number) { state.status = code; return this; }, json() { return this; } } };
}

test("CSRF protection allows safe requests and matching double-submit tokens", () => {
  for (const req of [
    { method: "GET", cookies: { stride_session: "session" }, headers: {} },
    { method: "POST", cookies: { stride_session: "session", stride_csrf: "a".repeat(64) }, headers: { "x-csrf-token": "a".repeat(64) } },
  ]) {
    const { response } = responseRecorder(); let next = false;
    csrfProtection(req as never, response as never, () => { next = true; });
    assert.equal(next, true);
  }
});

test("CSRF protection rejects missing or mismatched tokens for cookie sessions", () => {
  const { state, response } = responseRecorder(); let next = false;
  csrfProtection({ method: "POST", cookies: { stride_session: "session", stride_csrf: "a".repeat(64) }, headers: { "x-csrf-token": "b".repeat(64) } } as never, response as never, () => { next = true; });
  assert.equal(next, false);
  assert.equal(state.status, 403);
});
