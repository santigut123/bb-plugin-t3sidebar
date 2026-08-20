/** Curated hues that stay distinct on a dark sidebar. */
export const PROJECT_COLOR_SWATCH_HUES = [
  12, 28, 48, 68, 88, 108, 132, 156, 180, 204, 228, 252, 276, 300, 324, 348,
] as const;

export type ProjectAccent = {
  hue: number;
  stripe: string;
  label: string;
};

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
    stripe: `oklch(0.58 0.12 ${hue})`,
    label: `oklch(0.72 0.08 ${hue})`,
  };
}

export function resolveProjectAccent(
  projectId: string,
  overrides: ReadonlyMap<string, number>,
): ProjectAccent {
  const hue = overrides.get(projectId) ?? defaultProjectHue(projectId);
  return projectAccentFromHue(hue);
}
