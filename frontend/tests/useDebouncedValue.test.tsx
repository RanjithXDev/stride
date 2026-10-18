import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

describe("useDebouncedValue", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps the previous value until the delay elapses", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), { initialProps: { value: "first" } });
    rerender({ value: "second" });
    expect(result.current).toBe("first");
    act(() => vi.advanceTimersByTime(199));
    expect(result.current).toBe("first");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("second");
  });

  it("cancels a pending update when the value changes again", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), { initialProps: { value: 1 } });
    rerender({ value: 2 });
    act(() => vi.advanceTimersByTime(50));
    rerender({ value: 3 });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe(3);
  });
});
