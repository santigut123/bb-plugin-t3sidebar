export const WORKING_SHIMMER_VARIANTS = ["off", "beam", "glow", "sheen"] as const;

export type WorkingShimmerVariant = (typeof WORKING_SHIMMER_VARIANTS)[number];

export const WORKING_SHIMMER_SETTING_KEY = "workingShimmer";

export const WORKING_SHIMMER_LABELS: Record<
  Exclude<WorkingShimmerVariant, "off">,
  string
> = {
  beam: "Beam — tight bright band",
  glow: "Glow — soft wide spotlight",
  sheen: "Sheen — multi-band hard highlights",
};

export function parseWorkingShimmerVariant(
  value: string | boolean | undefined,
): WorkingShimmerVariant {
  if (value === "beam" || value === "glow" || value === "sheen" || value === "off") {
    return value;
  }
  return "off";
}

export function workingShimmerClass(variant: WorkingShimmerVariant): string | null {
  if (variant === "off") return null;
  return `t3-working-shimmer-${variant}`;
}
