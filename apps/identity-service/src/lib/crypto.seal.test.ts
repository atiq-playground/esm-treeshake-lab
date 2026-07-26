import { describe, expect, it } from "vitest";
import { sealJson, unsealJson } from "./crypto";

describe("sealJson / unsealJson", () => {
  it("round-trips a token payload", async () => {
    const payload = {
      access_token: "a",
      refresh_token: "r",
      id_token: "i",
      expires_in: 3600,
      token_type: "Bearer" as const,
    };
    const sealed = await sealJson("unit-test-secret", payload);
    expect(sealed).not.toContain("access_token");
    await expect(unsealJson("wrong-secret", sealed)).resolves.toBeNull();
    await expect(
      unsealJson("unit-test-secret", sealed),
    ).resolves.toEqual(payload);
  });
});
