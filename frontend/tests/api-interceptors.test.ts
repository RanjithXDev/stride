import { beforeEach, describe, expect, it, vi } from "vitest";

const callbacks = vi.hoisted(() => ({
  request: undefined as undefined | ((config: { headers: Record<string, string>; method?: string }) => unknown),
  fulfilled: undefined as undefined | ((response: unknown) => unknown),
  rejected: undefined as undefined | ((error: unknown) => Promise<never>),
}));

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: { use: (callback: typeof callbacks.request) => { callbacks.request = callback; } },
        response: { use: (fulfilled: typeof callbacks.fulfilled, rejected: typeof callbacks.rejected) => { callbacks.fulfilled = fulfilled; callbacks.rejected = rejected; } },
      },
    })),
  },
}));

describe("API interceptors", () => {
  beforeEach(async () => {
    vi.resetModules();
    await import("@/lib/api");
  });

  it("adds the CSRF token to state-changing cookie-authenticated requests", () => {
    document.cookie = "stride_csrf=csrf-secret; path=/";
    const config = { method: "post", headers: { Accept: "application/json" } };
    expect(callbacks.request?.(config)).toBe(config);
    expect(config.headers).toEqual({ Accept: "application/json", "X-CSRF-Token": "csrf-secret" });
  });

  it("leaves unauthenticated requests unchanged and passes successful responses through", () => {
    const config = { method: "get", headers: {} as Record<string, string> };
    callbacks.request?.(config);
    expect(config.headers["X-CSRF-Token"]).toBeUndefined();
    const response = { data: { ok: true } };
    expect(callbacks.fulfilled?.(response)).toBe(response);
  });

  it("preserves non-authentication failures", async () => {
    const error = { response: { status: 500 } };
    await expect(callbacks.rejected?.(error)).rejects.toBe(error);
  });
});
