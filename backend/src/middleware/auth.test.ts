import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { authenticate, authorize, requireOrgAdmin, requireSuperAdmin, AuthRequest } from "./auth";
import { prisma } from "../lib/prisma";

function responseRecorder() {
  const state: { status?: number; body?: unknown } = {};
  const response = { status(code: number) { state.status = code; return this; }, json(body: unknown) { state.body = body; return this; } };
  return { state, response };
}

const actor = (role: Role = Role.EMPLOYEE, isSuperAdmin = false) => ({ id: "u1", email: "u@example.com", role, organizationId: "org1", isSuperAdmin });

test("authenticate rejects missing and invalid bearer tokens", async () => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-bytes";
  for (const authorization of [undefined, "Basic abc", "Bearer invalid"]) {
    const { state, response } = responseRecorder();
    const req = { headers: { authorization } } as AuthRequest;
    let called = false;
    await authenticate(req, response as never, (() => { called = true; }) as never);
    assert.equal(called, false);
    assert.equal(state.status, 401);
  }
});

test("authenticate assigns a verified active actor and continues", { concurrency: false }, async () => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-bytes";
  const payload = actor(Role.MANAGER);
  const token = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: "HS256", issuer: "stride-api", audience: "stride-web" });
  const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
  const { response } = responseRecorder();
  let called = false;
  const original = prisma.user.findUnique;
  (prisma.user.findUnique as unknown) = async () => ({ ...payload, isActive: true, organization: { isActive: true } });
  try { await authenticate(req, response as never, (() => { called = true; }) as never); }
  finally { (prisma.user.findUnique as unknown) = original; }
  assert.equal(called, true);
  assert.deepEqual(req.user && { id: req.user.id, email: req.user.email, role: req.user.role, organizationId: req.user.organizationId, isSuperAdmin: req.user.isSuperAdmin }, payload);
});

test("role authorization permits listed roles and rejects everyone else", () => {
  const middleware = authorize(Role.FOUNDER, Role.MANAGER);
  for (const [user, allowed] of [[actor(Role.MANAGER), true], [actor(Role.EMPLOYEE), false], [undefined, false]] as const) {
    const { state, response } = responseRecorder();
    let called = false;
    middleware({ user } as AuthRequest, response as never, (() => { called = true; }) as never);
    assert.equal(called, allowed);
    if (!allowed) assert.equal(state.status, 403);
  }
});

test("admin middleware distinguishes super, organization admin, unauthorized, and employee users", () => {
  const cases = [
    { middleware: requireSuperAdmin, user: actor(Role.EMPLOYEE, true), allowed: true },
    { middleware: requireSuperAdmin, user: actor(Role.FOUNDER, false), allowed: false },
    { middleware: requireOrgAdmin, user: actor(Role.CFO, false), allowed: true },
    { middleware: requireOrgAdmin, user: actor(Role.EMPLOYEE, true), allowed: true },
    { middleware: requireOrgAdmin, user: actor(Role.EMPLOYEE, false), allowed: false },
    { middleware: requireOrgAdmin, user: undefined, allowed: false },
  ];
  for (const item of cases) {
    const { state, response } = responseRecorder();
    let called = false;
    item.middleware({ user: item.user } as AuthRequest, response as never, (() => { called = true; }) as never);
    assert.equal(called, item.allowed);
    if (!item.allowed) assert.ok(state.status === 401 || state.status === 403);
  }
});
