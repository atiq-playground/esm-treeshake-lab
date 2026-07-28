import { describe, expect, test } from "bun:test";
import {
  thirdPartyRealSrc,
  thirdPartyStubSrc,
  TP_CORE_MARKER,
  tpExtraCount,
  tpExtraMarker,
} from "./third-party-stubs.ts";

describe("thirdPartyStubSrc", () => {
  test("embeds marker and exact ballast length for reproducible weight", () => {
    const src = thirdPartyStubSrc(TP_CORE_MARKER, 128);
    expect(src).toContain(`marker: "${TP_CORE_MARKER}"`);
    const match = /ballast: "([^"]+)"/.exec(src);
    expect(match?.[1]?.length).toBe(128);
    expect(src).toContain("__LAB_3P_TOUCH__");
  });
});

describe("thirdPartyRealSrc", () => {
  test("wraps a side-effect import so esbuild retains the real dep", () => {
    const src = thirdPartyRealSrc('import "graphql";\n');
    expect(src).toContain('import "graphql"');
    expect(src).toContain("export {}");
  });
});

describe("tpExtraCount", () => {
  test("reserves one slot for shared core", () => {
    expect(
      tpExtraCount({ count: 4, bytesPerPackage: 100, mode: "stub" }),
    ).toBe(3);
    expect(
      tpExtraCount({ count: 1, bytesPerPackage: 100, mode: "stub" }),
    ).toBe(0);
    expect(tpExtraMarker(0)).toBe("LAB_3P_EXTRA_0");
  });
});
