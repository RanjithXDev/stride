import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../lib/api-error";
import { parseBulkUpdate, parseComment, parseLink, parsePagination, parseTicketCreate, parseTicketUpdate, parseTimeLog } from "./ticket.validation";

function rejectsValidation(fn: () => unknown, field?: string) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 400);
    assert.equal(error.code, "VALIDATION_ERROR");
    if (field) assert.equal((error.details as { field?: string }).field, field);
    return true;
  });
}

test("ticket create trims and converts supported values", () => {
  const result = parseTicketCreate({ title: "  Ship feature  ", description: "", priority: "HIGH", type: "FEATURE", dueDate: "2026-10-12", estimation: "30" });
  assert.equal(result.title, "Ship feature");
  assert.equal(result.description, null);
  assert.equal(result.priority, "HIGH");
  assert.equal(result.estimation, 30);
  assert.equal(result.dueDate?.toISOString(), "2026-10-12T00:00:00.000Z");
});

test("ticket create rejects malformed bodies and fields", () => {
  rejectsValidation(() => parseTicketCreate(null));
  rejectsValidation(() => parseTicketCreate({}), "title");
  rejectsValidation(() => parseTicketCreate({ title: 42 }), "title");
  rejectsValidation(() => parseTicketCreate({ title: "x".repeat(301) }), "title");
  rejectsValidation(() => parseTicketCreate({ title: "ok", priority: "EXTREME" }), "priority");
  rejectsValidation(() => parseTicketCreate({ title: "ok", dueDate: "nope" }), "dueDate");
  rejectsValidation(() => parseTicketCreate({ title: "ok", estimation: -1 }), "estimation");
});

test("ticket update requires optimistic-lock version and handles nullable fields", () => {
  rejectsValidation(() => parseTicketUpdate({ title: "Changed" }), "version");
  const result = parseTicketUpdate({ version: 2, assigneeId: "", parentId: null, dueDate: null, estimation: "0", status: "IN_PROGRESS" });
  assert.equal(result.version, 2);
  assert.equal(result.assigneeId, null);
  assert.equal(result.dueDate, null);
  assert.equal(result.estimation, 0);
});

test("bulk update validates limits and removes duplicate ids", () => {
  rejectsValidation(() => parseBulkUpdate({ ids: [], update: {} }), "ids");
  rejectsValidation(() => parseBulkUpdate({ ids: Array.from({ length: 101 }, (_, index) => String(index)), update: {} }), "ids");
  rejectsValidation(() => parseBulkUpdate({ ids: [1], update: {} }), "ids");
  const result = parseBulkUpdate({ ids: ["a", "a", "b"], update: { status: "CLOSED", assigneeId: "" } });
  assert.deepEqual(result.ids, ["a", "b"]);
  assert.deepEqual(result.update, { status: "CLOSED", priority: undefined, assigneeId: null });
});

test("comment, time, link, and pagination parsers enforce boundaries", () => {
  assert.deepEqual(parseComment({ content: " hello " }), { content: "hello" });
  rejectsValidation(() => parseComment({ content: "" }), "content");
  assert.deepEqual(parseTimeLog({ minutes: "45", notes: "", workType: "TESTING" }), { minutes: 45, notes: null, workType: "TESTING" });
  rejectsValidation(() => parseTimeLog({ minutes: 0 }), "minutes");
  assert.deepEqual(parseLink({ targetId: "t2" }), { targetId: "t2", linkType: "RELATES_TO" });
  rejectsValidation(() => parseLink({ targetId: "t2", linkType: "UNKNOWN" }), "linkType");
  assert.deepEqual(parsePagination({}), { page: 1, pageSize: 25 });
  assert.deepEqual(parsePagination({ page: "3", pageSize: "50" }), { page: 3, pageSize: 50 });
  rejectsValidation(() => parsePagination({ page: 0 }), "page");
});
