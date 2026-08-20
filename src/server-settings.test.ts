import { describe, expect, it } from "vitest";
import { t3sidebarSettings } from "./server";

describe("plugin setting defaults", () => {
  it("keeps both status motion treatments opt-in", () => {
    expect(t3sidebarSettings.statusIconShine.default).toBe(false);
    expect(t3sidebarSettings.workingShimmer.default).toBe("off");
  });
});
