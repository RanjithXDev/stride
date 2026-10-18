import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectsPage from "@/app/(dashboard)/projects/page";

const push = vi.hoisted(() => vi.fn());
const list = vi.hoisted(() => vi.fn());
const departments = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/projects", async (original) => ({ ...(await original<typeof import("@/lib/projects")>()), projectsApi: { list } }));
vi.mock("@/lib/employees", () => ({ employeesApi: { departments } }));
vi.mock("@/store/auth", () => ({ useAuthStore: () => ({ user: { role: "FOUNDER" } }) }));
vi.mock("@/components/projects/CreateProjectModal", () => ({ default: ({ open }: { open: boolean }) => open ? <div role="dialog">Create project form</div> : null }));

const projects = [
  { id: "p1", name: "Apollo", description: "Core platform", status: "ACTIVE", deadline: "2099-01-01", createdAt: "2026-01-01", updatedAt: "2026-01-01", department: { id: "d1", name: "Engineering" }, _count: { tickets: 4, members: 2, timeLogs: 1 } },
  { id: "p2", name: "Archive", description: null, status: "COMPLETED", createdAt: "2026-01-01", updatedAt: "2026-01-01", department: null, _count: { tickets: 2, members: 1, timeLogs: 0 } },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ProjectsPage /></QueryClientProvider>);
}

describe("ProjectsPage", () => {
  beforeEach(() => { push.mockReset(); list.mockReset(); departments.mockReset(); departments.mockResolvedValue([{ id: "d1", name: "Engineering", _count: { employees: 2 } }]); });

  it("renders portfolio metrics and opens a project", async () => {
    list.mockResolvedValue(projects);
    renderPage();
    expect(await screen.findByText("Apollo")).toBeInTheDocument();
    expect(screen.getByText("Successfully delivered")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Apollo project" }));
    expect(push).toHaveBeenCalledWith("/projects/p1");
  });

  it("passes search filters to the API and can open creation", async () => {
    list.mockResolvedValue(projects);
    renderPage();
    await screen.findByText("Apollo");
    await userEvent.type(screen.getByPlaceholderText("Search projects..."), "core");
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ search: "core" })));
    fireEvent.click(screen.getByRole("button", { name: /New Project/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Create project form");
  });

  it("shows retry and filtered-empty states without pretending data exists", async () => {
    list.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Try again/ }));
    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
  });
});
