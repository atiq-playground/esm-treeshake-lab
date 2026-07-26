import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/auth-provider", () => ({
  useAuth: () => ({
    session: { authenticated: false },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    clearSessions: vi.fn(),
  }),
}));

vi.mock("@/lib/account/account-provider", () => ({
  useAccount: () => ({
    currentUser: null,
    users: [],
    clear: vi.fn(),
    seed: vi.fn(),
  }),
}));

import { HomeClient } from "@/components/home-client";

describe("HomeClient", () => {
  it("renders the lab heading", () => {
    render(<HomeClient />);

    expect(
      screen.getByRole("heading", { name: /esm tree-shake lab/i }),
    ).toBeInTheDocument();
  });
});
