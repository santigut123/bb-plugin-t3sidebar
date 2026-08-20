import { describe, expect, it } from "vitest";
import {
  defaultProjectHue,
  projectAccentFromHue,
  resolveProjectAccent,
} from "./project-colors";

describe("project colors", () => {
  it("keeps a stable default hue per project id", () => {
    expect(defaultProjectHue("proj_a")).toBe(defaultProjectHue("proj_a"));
    expect(defaultProjectHue("proj_a")).not.toBe(defaultProjectHue("proj_b"));
  });

  it("prefers a stored override over the default", () => {
    const overrides = new Map([["proj_a", 120]]);
    expect(resolveProjectAccent("proj_a", overrides).hue).toBe(120);
    expect(resolveProjectAccent("proj_b", overrides).hue).toBe(
      defaultProjectHue("proj_b"),
    );
  });

  it("builds sidebar-safe accent strings from a hue", () => {
    const accent = projectAccentFromHue(200);
    expect(accent.stripe).toContain("200");
    expect(accent.label).toContain("200");
  });
});
