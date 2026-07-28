import { describe, expect, test } from "bun:test";
import { splitImprovementHeadline } from "./quick-facts";

describe("splitImprovementHeadline", () => {
  test("splits before → after for size and time headlines", () => {
    expect(splitImprovementHeadline("4.25 MB → 458 KB")).toEqual({
      before: "4.25 MB",
      after: "458 KB",
    });
    expect(splitImprovementHeadline("1.97 ms → 0.33 ms")).toEqual({
      before: "1.97 ms",
      after: "0.33 ms",
    });
  });

  test("returns null for singleton-only or empty sides", () => {
    expect(splitImprovementHeadline("42.5 MB")).toBeNull();
    expect(splitImprovementHeadline("→ 458 KB")).toBeNull();
    expect(splitImprovementHeadline("4.25 MB →")).toBeNull();
  });
});
