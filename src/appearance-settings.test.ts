import { describe, expect, it } from "vitest";
import {
  parseBooleanSetting,
  parseUnreadTitleWeight,
  unreadTitleWeightClass,
} from "./appearance-settings";

describe("appearance settings", () => {
  it("parses booleans with defaults", () => {
    expect(parseBooleanSetting(true, false)).toBe(true);
    expect(parseBooleanSetting("false", true)).toBe(false);
    expect(parseBooleanSetting(undefined, true)).toBe(true);
  });

  it("parses unread title weight", () => {
    expect(parseUnreadTitleWeight("semibold")).toBe("semibold");
    expect(parseUnreadTitleWeight(undefined)).toBe("bold");
    expect(unreadTitleWeightClass("bold")).toBe("font-bold");
    expect(unreadTitleWeightClass("normal")).toBeNull();
  });
});
