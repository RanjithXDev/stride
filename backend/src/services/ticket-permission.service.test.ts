import assert from "node:assert/strict";
import test from "node:test";
import { Role } from "@prisma/client";
import {
  assertTicketPermission, canAssignTicket, canComment, canCreateTicket, canDeleteTicket,
  canEditTicket, canLogTime, canTransitionTicket, canViewTicket, TicketAccessRecord, TicketActor,
} from "./ticket-permission.service";

const ticket: TicketAccessRecord = {
  organizationId: "org-a", reporterId: "reporter", assigneeId: "assignee",
  projectId: "project-a", deletedAt: null,
};
const actor = (id: string, role: Role, organizationId = "org-a"): TicketActor => ({
  id, role, organizationId, email: `${id}@example.com`, isSuperAdmin: false,
});

test("rejects all access across organizations", () => {
  const outsider = actor("manager", Role.MANAGER, "org-b");
  assert.equal(canViewTicket(outsider, ticket), false);
  assert.equal(canEditTicket(outsider, ticket), false);
  assert.equal(canDeleteTicket(outsider, ticket), false);
});

test("employee can view and edit assigned or reported tickets", () => {
  assert.equal(canViewTicket(actor("assignee", Role.EMPLOYEE), ticket), true);
  assert.equal(canEditTicket(actor("reporter", Role.EMPLOYEE), ticket), true);
  assert.equal(canViewTicket(actor("other", Role.EMPLOYEE), ticket), false);
  assert.equal(canDeleteTicket(actor("assignee", Role.EMPLOYEE), ticket), false);
});

test("manager can manage tickets only in their organization", () => {
  assert.equal(canViewTicket(actor("manager", Role.MANAGER), ticket), true);
  assert.equal(canEditTicket(actor("manager", Role.MANAGER), ticket), true);
  assert.equal(canDeleteTicket(actor("manager", Role.MANAGER), ticket), true);
});

test("creation and action aliases preserve the same authorization boundary", () => {
  const employee = actor("assignee", Role.EMPLOYEE);
  assert.equal(canCreateTicket(employee), true);
  assert.equal(canCreateTicket(actor("none", Role.EMPLOYEE, "")), false);
  assert.equal(canAssignTicket(employee, ticket), true);
  assert.equal(canTransitionTicket(employee, ticket), true);
  assert.equal(canComment(employee, ticket), true);
  assert.equal(canLogTime(employee, ticket), true);
});

test("super admins bypass organization restrictions and assertions throw typed errors", () => {
  const superAdmin = { ...actor("root", Role.EMPLOYEE, "org-b"), isSuperAdmin: true };
  assert.equal(canViewTicket(superAdmin, ticket), true);
  assert.equal(canDeleteTicket(superAdmin, ticket), true);
  assert.doesNotThrow(() => assertTicketPermission(true));
  assert.throws(() => assertTicketPermission(false, "Denied"), (error: any) => error.status === 403 && error.code === "FORBIDDEN" && error.message === "Denied");
});
