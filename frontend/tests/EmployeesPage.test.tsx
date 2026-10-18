import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EmployeesPage from "@/app/(dashboard)/employees/page";

const push = vi.hoisted(() => vi.fn());
const list = vi.hoisted(() => vi.fn());
const departments = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/employees", () => ({ employeesApi: { list, departments, remove } }));
vi.mock("@/store/auth", () => ({ useAuthStore: () => ({ user: { id: "admin", role: "FOUNDER", isSuperAdmin: false } }) }));
vi.mock("@/components/employees/CreateEmployeeModal", () => ({ default: ({ open }: { open: boolean }) => open ? <div role="dialog">Add employee form</div> : null }));

const employee = { id: "u1", name: "Asha Rao", email: "asha@example.com", role: "EMPLOYEE", jobTitle: "Engineer", isSuperAdmin: false, isActive: true, createdAt: "2026-01-01", department: { id: "d1", name: "Engineering" }, manager: { id: "m1", name: "Manager" }, _count: { assignedTickets: 3, reportedTickets: 1 } };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><EmployeesPage /></QueryClientProvider>);
}

describe("EmployeesPage", () => {
  beforeEach(() => { push.mockReset(); list.mockReset(); departments.mockResolvedValue([{ id: "d1", name: "Engineering", _count: { employees: 1 } }]); remove.mockResolvedValue({}); });

  it("renders typed employee data and supports keyboard navigation", async () => {
    list.mockResolvedValue([employee]);
    renderPage();
    const name = await screen.findByText("Asha Rao");
    expect(screen.getByText("Engineer")).toBeInTheDocument();
    fireEvent.keyDown(name.closest("tr")!, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/employees/u1");
  });

  it("opens creation and reports API failures with retry", async () => {
    list.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Add Employee/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /Try again/ }));
    await waitFor(() => expect(screen.getByText("No employees yet")).toBeInTheDocument());
  });
});
