import { describe, expect, it, vi } from "vitest";
import { requireSameAccount, userHasRole } from "./authz";

describe("requireSameAccount", () => {
  it("returns null when the bearer owns the resource", () => {
    expect(requireSameAccount("user-1", "user-1")).toBeNull();
  });

  it("returns 403 when the path id does not match the bearer", async () => {
    const res = requireSameAccount("user-1", "user-2");
    expect(res).toBeInstanceOf(Response);
    expect(res!.status).toBe(403);
    await expect(res!.json()).resolves.toEqual({ error: "forbidden" });
  });
});

describe("userHasRole", () => {
  it("is true when user_roles contains the role", async () => {
    const first = vi.fn().mockResolvedValue({ ok: 1 });
    const bind = vi.fn().mockReturnValue({ first });
    const prepare = vi.fn().mockReturnValue({ bind });
    const env = { DB: { prepare } } as unknown as Parameters<
      typeof userHasRole
    >[0];

    await expect(userHasRole(env, "123", "role_admin")).resolves.toBe(true);
    expect(prepare).toHaveBeenCalled();
    expect(bind).toHaveBeenCalledWith("123", "role_admin");
  });

  it("is false when the role row is missing", async () => {
    const first = vi.fn().mockResolvedValue(null);
    const bind = vi.fn().mockReturnValue({ first });
    const prepare = vi.fn().mockReturnValue({ bind });
    const env = { DB: { prepare } } as unknown as Parameters<
      typeof userHasRole
    >[0];

    await expect(userHasRole(env, "123", "role_admin")).resolves.toBe(false);
  });
});
