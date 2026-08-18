import { describe, expect, it } from "vitest";
import {
  parseWorkingShimmerVariant,
  workingShimmerClass,
} from "./working-shimmer";

describe("working shimmer", () => {
  it("parses known variants and falls back to beam", () => {
    expect(parseWorkingShimmerVariant("glow")).toBe("glow");
    expect(parseWorkingShimmerVariant(undefined)).toBe("glow");
    expect(parseWorkingShimmerVariant("nope")).toBe("glow");
  });

  it("maps variants to css hooks", () => {
    expect(workingShimmerClass("beam")).toBe("t3-working-shimmer-beam");
    expect(workingShimmerClass("off")).toBeNull();
  });
});
