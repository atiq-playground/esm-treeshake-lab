import { describe, expect, test } from "bun:test";
import {
  formatProjectedBytes,
  projectLinearBytes,
  SCALE_PROJECTION_ASSUMPTIONS,
} from "./scale-projection";

describe("projectLinearBytes", () => {
  test("scales measured singleton bytes linearly with N", () => {
    // Landing fat @ N=100 ≈ 4.25 MB singleton → N=1000 ≈ 42.5 MB
    expect(projectLinearBytes(4_251_131, 100, 1000)).toBe(42_511_310);
    expect(projectLinearBytes(4_251_131, 100, 500)).toBe(21_255_655);
  });

  test("rejects non-positive measured N", () => {
    expect(() => projectLinearBytes(1000, 0, 500)).toThrow(/measuredN/);
  });
});

describe("formatProjectedBytes", () => {
  test("labels projection with target N and assumption note", () => {
    const out = formatProjectedBytes({
      measuredBytes: 4_251_131,
      measuredN: 100,
      targetN: 500,
    });
    expect(out.bytes).toBe(21_255_655);
    expect(out.primary).toBe("20.27 MB");
    expect(out.evidence).toBe("extrapolated");
    expect(out.assumptionId).toBe(
      SCALE_PROJECTION_ASSUMPTIONS.singletonBytesLinearInN.id,
    );
    expect(out.note).toContain("N=500");
    expect(out.note).toContain("linear in N");
  });
});
