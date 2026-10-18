import assert from "node:assert/strict";
import test from "node:test";
import { decrypt, encrypt } from "./encrypt";

test("encrypts with authenticated randomness and decrypts exactly", () => {
  const previous = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = "ab".repeat(32);
  try {
    const first = encrypt("sensitive value");
    const second = encrypt("sensitive value");
    assert.notEqual(first, second);
    assert.equal(first.split(":").length, 3);
    assert.equal(decrypt(first), "sensitive value");
    const [iv, tag, body] = first.split(":");
    const tamperedTag = `${tag[0] === "0" ? "1" : "0"}${tag.slice(1)}`;
    assert.throws(() => decrypt(`${iv}:${tamperedTag}:${body}`));
  } finally { process.env.ENCRYPTION_KEY = previous; }
});

test("rejects missing or malformed encryption keys", () => {
  const previous = process.env.ENCRYPTION_KEY;
  delete process.env.ENCRYPTION_KEY;
  assert.throws(() => encrypt("value"), /64 hex chars/);
  process.env.ENCRYPTION_KEY = "aa";
  assert.throws(() => encrypt("value"), /64 hex chars/);
  process.env.ENCRYPTION_KEY = previous;
});
