import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterBar, MetricGrid, MetricTile, PageEmpty, PageError, PageHeader, PageLoading } from "@/components/ui/AppPage";

describe("shared page components", () => {
  it("renders page identity, actions, and metrics", () => {
    render(<><PageHeader eyebrow="Portfolio" title="Projects" description="Track delivery" action={<button>Create</button>} /><MetricGrid><MetricTile label="Active" value={12} color="#00f" hint="In delivery" /></MetricGrid></>);
    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByText("Track delivery")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("only offers clear filters when filters are active", () => {
    const clear = vi.fn();
    const { rerender } = render(<FilterBar resultLabel="2 results" onClear={clear}><input aria-label="Search" /></FilterBar>);
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    rerender(<FilterBar resultLabel="2 results" onClear={clear} hasFilters><input aria-label="Search" /></FilterBar>);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(clear).toHaveBeenCalledOnce();
  });

  it("provides honest empty, loading, and retry states", () => {
    const retry = vi.fn();
    const { rerender } = render(<PageError onRetry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    rerender(<PageEmpty title="Nothing here" description="Create the first record" action={<button>Add</button>} />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    rerender(<PageLoading cards={3} />);
    expect(screen.getByLabelText("Loading content")).toHaveAttribute("aria-busy", "true");
  });
});
