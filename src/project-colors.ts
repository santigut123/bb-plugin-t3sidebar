/** Curated hues that stay distinct on a dark sidebar. */
export const PROJECT_COLOR_SWATCH_HUES = [
  12, 28, 48, 68, 88, 108, 132, 156, 180, 204, 228, 252, 276, 300, 324, 348,
] as const;

export type ProjectAccent = {
  hue: number;
  stripe: string;
};

// Project identity stays decorative. These host-owned tokens follow light,
// dark, and custom themes instead of fixing a luminance in plugin code.
const PROJECT_COLOR_THEME_TOKENS = [
  "var(--ansi-9)",
  "var(--ansi-1)",
  "var(--ansi-11)",
  "var(--ansi-3)",
  "var(--ansi-10)",
  "var(--ansi-2)",
  "var(--ansi-14)",
  "var(--ansi-6)",
  "var(--timeline-accent)",
  "var(--ansi-12)",
  "var(--ansi-4)",
  "var(--ansi-13)",
  "var(--ansi-5)",
  "var(--pr-merged)",
  "var(--destructive-text)",
  "var(--primary)",
] as const;

/** Stable default from the project id — not random, but feels arbitrary until set. */
export function defaultProjectHue(projectId: string): number {
  return hashHue(projectId);
}

export function hashHue(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 360;
  }
  return hash;
}

export function projectAccentFromHue(hue: number): ProjectAccent {
  return {
    hue,
    stripe: PROJECT_COLOR_THEME_TOKENS[closestSwatchIndex(hue)]!,
  };
}

function closestSwatchIndex(hue: number): number {
  const normalized = ((hue % 360) + 360) % 360;
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < PROJECT_COLOR_SWATCH_HUES.length; index += 1) {
    const swatchHue = PROJECT_COLOR_SWATCH_HUES[index]!;
    const directDistance = Math.abs(normalized - swatchHue);
    const distance = Math.min(directDistance, 360 - directDistance);
    if (distance < closestDistance) {
      closestIndex = index;
      closestDistance = distance;
    }
  }
  return closestIndex;
}

export function resolveProjectAccent(
  projectId: string,
  overrides: ReadonlyMap<string, number>,
): ProjectAccent {
  const hue = overrides.get(projectId) ?? defaultProjectHue(projectId);
  return projectAccentFromHue(hue);
}
