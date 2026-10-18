import test from "node:test";
import assert from "node:assert/strict";
import { planTicketReversal, ReversalCandidate } from "./audit-reversal";

const now = new Date("2026-10-13T10:00:00.000Z");
const candidate = (overrides: Partial<ReversalCandidate> = {}): ReversalCandidate => ({
  reversible: true,
  reversibleUntil: new Date("2026-10-20T10:00:00.000Z"),
  resourceVersion: 4,
  beforeState: { title: "Before", priority: "LOW", version: 3 },
  afterState: { title: "After", priority: "HIGH", version: 4 },
  alreadyReversed: false,
  ...overrides,
});

test("plans only the fields changed by the original activity", () => {
  const result = planTicketReversal(candidate(), { title: "After", priority: "HIGH", version: 4 }, now);
  assert.equal(result.allowed, true);
  assert.deepEqual(result.changes, [
    { field: "title", current: "After", restored: "Before" },
    { field: "priority", current: "HIGH", restored: "LOW" },
  ]);
});

test("blocks a non-reversible activity", () => {
  const result = planTicketReversal(candidate({ reversible: false }), { version: 4 }, now);
  assert.equal(result.allowed, false);
  assert.equal(result.code, "NOT_REVERSIBLE");
});

test("blocks an activity that already has a reversal event", () => {
  const result = planTicketReversal(candidate({ alreadyReversed: true }), { version: 4 }, now);
  assert.equal(result.code, "ALREADY_REVERSED");
});

test("blocks an expired activity", () => {
  const result = planTicketReversal(candidate({ reversibleUntil: new Date("2026-10-12T10:00:00.000Z") }), { version: 4 }, now);
  assert.equal(result.code, "EXPIRED");
});

test("blocks reversal when the resource version has advanced", () => {
  const result = planTicketReversal(candidate(), { version: 5 }, now);
  assert.equal(result.code, "VERSION_CONFLICT");
});

test("rejects incomplete and no-op snapshots", () => {
  assert.equal(planTicketReversal(candidate({ beforeState: null }), { version: 4 }, now).code, "INVALID_EVENT");
  assert.equal(planTicketReversal(candidate({ beforeState: { title: "Same" }, afterState: { title: "Same" } }), { version: 4 }, now).code, "INVALID_EVENT");
});
