import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommandPalette from "@/components/navigation/CommandPalette";

const push = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/search", () => ({ searchApi: { search } }));

function renderPalette(open = true, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { onClose, ...render(<QueryClientProvider client={client}><CommandPalette open={open} onClose={onClose} /></QueryClientProvider>) };
}

describe("CommandPalette", () => {
  beforeEach(() => { push.mockReset(); search.mockReset(); });

  it("shows navigation shortcuts and opens the selected destination", async () => {
    const { onClose } = renderPalette();
    const input = await screen.findByRole("textbox", { name: "Search workspace" });
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.click(screen.getByRole("option", { name: /Projects/ }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/projects");
  });

  it("supports arrow-key navigation and Enter", async () => {
    renderPalette();
    const input = screen.getByRole("textbox", { name: "Search workspace" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/tickets");
  });

  it("debounces workspace search and renders grouped results", async () => {
    search.mockResolvedValue({
      tickets: [{ id: "t1", key: "APP-1", title: "Fix login", status: "OPEN", priority: "HIGH", project: { name: "App" } }],
      projects: [{ id: "p1", name: "Apollo", key: "AP", status: "ACTIVE" }],
      employees: [{ id: "u1", name: "Asha", role: "EMPLOYEE", jobTitle: "Engineer" }],
    });
    renderPalette();
    await userEvent.type(screen.getByRole("textbox", { name: "Search workspace" }), "ap");
    await waitFor(() => expect(search).toHaveBeenCalledWith("ap"));
    expect(await screen.findByText(/APP-1/)).toBeInTheDocument();
    expect(screen.getByText("Apollo")).toBeInTheDocument();
    expect(screen.getByText("Asha")).toBeInTheDocument();
  });

  it("shows failures and empty results honestly", async () => {
    search.mockRejectedValue(new Error("offline"));
    renderPalette();
    await userEvent.type(screen.getByRole("textbox", { name: "Search workspace" }), "zz");
    expect(await screen.findByText(/temporarily unavailable/)).toBeInTheDocument();
  });
});
