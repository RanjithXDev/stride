import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import type { User } from "@/types";
import api from "@/lib/api";

const user = { id: "u1", name: "Asha", email: "asha@example.com", role: "EMPLOYEE", isSuperAdmin: false, isActive: true, createdAt: "2026-01-01" } as User;

describe("application stores", () => {
  beforeEach(() => {
    vi.spyOn(api, "post").mockResolvedValue({} as never);
    useAuthStore.setState({ user: null, _hasHydrated: false });
    useThemeStore.setState({ isDark: false });
  });

  it("sets and clears authentication consistently", () => {
    useAuthStore.getState().setAuth(user);
    expect(useAuthStore.getState()).toMatchObject({ user });
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState()).toMatchObject({ user: null });
  });

  it("tracks hydration and toggles the theme", () => {
    useAuthStore.getState().setHasHydrated(true);
    expect(useAuthStore.getState()._hasHydrated).toBe(true);
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().isDark).toBe(true);
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().isDark).toBe(false);
  });
});
