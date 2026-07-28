import { describe, expect, test } from "bun:test";
import { loadRealisticVerifiedSummary } from "./benchmark";

describe("loadRealisticVerifiedSummary", () => {
  test("empty state until GHA proof is committed", () => {
    const summary = loadRealisticVerifiedSummary();
    expect(summary.verified).toBe(false);
    expect(summary.emptyMessage).toMatch(/lab-realistic-bench/);
    expect(summary.lastVerified).toBeNull();
    expect(summary.bytesSavedPct).toBeNull();
  });
});
