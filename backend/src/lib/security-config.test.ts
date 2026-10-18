import test from "node:test";
import assert from "node:assert/strict";
import { getJwtSecret } from "./security-config";

test("JWT configuration rejects short secrets", { concurrency: false }, () => {
  const original = process.env.JWT_SECRET;
  try {
    process.env.JWT_SECRET = "short";
    assert.throws(() => getJwtSecret(), /at least 32 bytes/);
    process.env.JWT_SECRET = "a".repeat(32);
    assert.equal(getJwtSecret(), "a".repeat(32));
  } finally {
    if (original === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = original;
  }
});
