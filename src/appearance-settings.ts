export const CARD_DIVIDERS_SETTING_KEY = "cardDividers";
export const PROJECT_COLOR_STRIPES_SETTING_KEY = "projectColorStripes";
export const STATUS_ICON_SHINE_SETTING_KEY = "statusIconShine";
export const UNREAD_TITLE_WEIGHT_SETTING_KEY = "unreadTitleWeight";

export const UNREAD_TITLE_WEIGHTS = [
  "normal",
  "medium",
  "semibold",
  "bold",
] as const;

export type UnreadTitleWeight = (typeof UNREAD_TITLE_WEIGHTS)[number];

export function parseBooleanSetting(
  value: string | boolean | undefined,
  defaultValue: boolean,
): boolean {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return defaultValue;
}

export function parseUnreadTitleWeight(
  value: string | boolean | undefined,
): UnreadTitleWeight {
  if (
    value === "normal" ||
    value === "medium" ||
    value === "semibold" ||
    value === "bold"
  ) {
    return value;
  }
  return "bold";
}

export function unreadTitleWeightClass(
  weight: UnreadTitleWeight,
): string | null {
  switch (weight) {
    case "medium":
      return "font-medium";
    case "semibold":
      return "font-semibold";
    case "bold":
      return "font-bold";
    default:
      return null;
  }
}
