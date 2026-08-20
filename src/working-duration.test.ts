import { describe, expect, it } from "vitest";
import { formatWorkingDurationLabel } from "./working-duration";

describe("formatWorkingDurationLabel", () => {
  it("matches T3's compact seconds, minutes, and hours", () => {
    expect(formatWorkingDurationLabel(37_999)).toBe("37s");
    expect(formatWorkingDurationLabel(3 * 60_000 + 59_000)).toBe("3m");
    expect(formatWorkingDurationLabel(63 * 60_000)).toBe("1h 3m");
  });

  it("clamps invalid and negative durations to zero", () => {
    expect(formatWorkingDurationLabel(Number.NaN)).toBe("0s");
    expect(formatWorkingDurationLabel(-1_000)).toBe("0s");
  });
});
