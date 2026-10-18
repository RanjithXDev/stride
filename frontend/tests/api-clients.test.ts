import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: http }));

import { attendanceApi } from "@/lib/attendance";
import { employeesApi } from "@/lib/employees";
import { expensesApi } from "@/lib/expenses";
import { incomeApi } from "@/lib/income";
import { integrationApi, projectRepoApi } from "@/lib/integrations";
import { orgApi } from "@/lib/organization";
import { projectsApi } from "@/lib/projects";
import { searchApi } from "@/lib/search";
import { ticketsApi } from "@/lib/tickets";
import { timesheetsApi } from "@/lib/timesheets";

describe("API clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(http).forEach((mock) => mock.mockResolvedValue({ data: { ok: true } }));
  });

  it("sends ticket operations to the expected endpoints and returns response data", async () => {
    await expect(ticketsApi.list({ status: "OPEN" })).resolves.toEqual({ ok: true });
    expect(http.get).toHaveBeenLastCalledWith("/tickets", { params: { status: "OPEN" } });
    await ticketsApi.bulkUpdate(["t1"], { priority: "HIGH" });
    expect(http.post).toHaveBeenLastCalledWith("/tickets/bulk", { ids: ["t1"], update: { priority: "HIGH" } });
    await ticketsApi.get("t1"); await ticketsApi.create({ title: "Fix" }); await ticketsApi.update("t1", { version: 1, status: "CLOSED" });
    await ticketsApi.restore("t1"); await ticketsApi.addComment("t1", "hello"); await ticketsApi.updateComment("t1", "c1", "edited");
    await ticketsApi.deleteComment("t1", "c1"); await ticketsApi.logTime("t1", 30, "work", "TESTING");
    await ticketsApi.addLink("t1", "t2", "BLOCKS"); await ticketsApi.removeLink("l1"); await ticketsApi.delete("t1");
    expect(http.put).toHaveBeenCalledWith("/tickets/t1", { version: 1, status: "CLOSED" });
    expect(http.post).toHaveBeenCalledWith("/tickets/t1/time", { minutes: 30, notes: "work", workType: "TESTING" });
    expect(http.delete).toHaveBeenCalledWith("/tickets/t1");
  });

  it("preserves project and employee request payloads", async () => {
    await projectsApi.list({ search: "Apollo" }); await projectsApi.get("p1"); await projectsApi.create({ name: "Apollo" });
    await projectsApi.update("p1", { status: "ACTIVE" }); await projectsApi.addMember("p1", "u1", "Lead");
    await projectsApi.removeMember("p1", "u1"); await projectsApi.stats("p1"); await projectsApi.delete("p1");
    expect(http.post).toHaveBeenCalledWith("/projects/p1/members", { userId: "u1", role: "Lead" });
    await employeesApi.list({ isActive: true }); await employeesApi.get("u1");
    await employeesApi.create({ name: "A", email: "a@x.com", password: "secret" }); await employeesApi.update("u1", { role: "MANAGER" });
    await employeesApi.departments(); await employeesApi.createDepartment("Engineering"); await employeesApi.orgTree(); await employeesApi.remove("u1");
    expect(http.post).toHaveBeenLastCalledWith("/employees/departments", { name: "Engineering" });
    expect(http.delete).toHaveBeenLastCalledWith("/employees/u1");
  });

  it("supports finance APIs including multipart and approval workflows", async () => {
    const form = new FormData();
    await expensesApi.list({ status: "PAID" }); await expensesApi.get("e1"); await expensesApi.create(form); await expensesApi.update("e1", form);
    await expensesApi.approve("e1", "APPROVED", "ok"); await expensesApi.markAsPaid("e1"); await expensesApi.revokePayment("e1");
    await expensesApi.revokeApproval("e1"); await expensesApi.revokeL1Approval("e1"); await expensesApi.pending(); await expensesApi.financial();
    expect(http.post).toHaveBeenCalledWith("/expenses/e1/approve", { decision: "APPROVED", note: "ok" });
    expect(http.post).toHaveBeenCalledWith("/expenses", form, { headers: { "Content-Type": "multipart/form-data" } });
    await incomeApi.list({ status: "RECEIVED" }); await incomeApi.get("i1"); await incomeApi.create(form); await incomeApi.update("i1", form); await incomeApi.delete("i1"); await incomeApi.summary();
    expect(http.get).toHaveBeenCalledWith("/incomes/summary");
  });

  it("supports attendance, timesheet, organization, and search APIs", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 12, 10));
    await attendanceApi.checkIn({ workMode: "WFH" }); await attendanceApi.checkOut(); await attendanceApi.getToday();
    await attendanceApi.teamToday(); await attendanceApi.stats({ month: 10 }); await attendanceApi.list({ page: 2 });
    await attendanceApi.markLeave({ userId: "u1", date: "2026-10-13" }); await attendanceApi.fillAbsences("2026-10-01", "2026-10-10");
    expect(http.post).toHaveBeenCalledWith("/attendance/check-in", { workMode: "WFH", date: "2026-10-12" });
    vi.useRealTimers();
    await timesheetsApi.list({ projectId: "p1" }); await timesheetsApi.summary({ projectId: "p1" });
    await orgApi.superAdminStats(); await orgApi.listAll(); await orgApi.getOne("o1");
    await orgApi.create({ name: "Org", slug: "org", adminName: "Admin", adminEmail: "a@x.com", adminPassword: "secret" });
    await orgApi.updatePlan("o1", { plan: "GROWTH" }); await orgApi.getSettings(); await orgApi.updateSettings({ name: "New" });
    await searchApi.search("apollo");
    expect(http.get).toHaveBeenLastCalledWith("/search", { params: { q: "apollo", limit: 6 } });
  });

  it("supports source-control configuration, identity, repository, and access operations", async () => {
    await integrationApi.getScmConfig();
    await integrationApi.saveScmConfig({ provider: "GITHUB", clientId: "client" });
    await integrationApi.clearScmConfig("GITLAB");
    await integrationApi.getConnections();
    await integrationApi.deleteConnection("c1");
    await integrationApi.getRepositories("c1");
    await integrationApi.getMyIdentities();
    await integrationApi.disconnectIdentity("identity-1");
    expect(http.delete).toHaveBeenCalledWith("/integrations/identities/identity-1");

    await projectRepoApi.list("p1");
    await projectRepoApi.add("p1", { repositoryId: "repo-1" });
    await projectRepoApi.remove("p1", "r1", "REVOKE_ACCESS");
    await projectRepoApi.getAccess("p1", "r1");
    await projectRepoApi.sync("p1", "r1");
    await projectRepoApi.retryGrant("g1");
    await projectRepoApi.getGitActivity("p1");
    expect(http.delete).toHaveBeenCalledWith("/projects/p1/repositories/r1", { data: { mode: "REVOKE_ACCESS" } });
    expect(http.post).toHaveBeenCalledWith("/repository-access/g1/retry");
  });
});
