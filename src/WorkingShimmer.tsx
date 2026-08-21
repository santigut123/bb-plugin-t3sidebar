import { cn } from "./lib/utils";
import {
  type WorkingShimmerVariant,
  workingShimmerClass,
} from "./working-shimmer";

/**
 * A looping horizontal sweep over working thread cards. Sits under row content
 * and above the card's base background.
 */
export function WorkingShimmer({
  variant,
}: {
  variant: Exclude<WorkingShimmerVariant, "off">;
}) {
  const rootClass = workingShimmerClass(variant);
  if (rootClass === null) return null;

  const root = cn(
    "pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-md",
    rootClass,
  );

  if (variant === "sheen") {
    return (
      <div aria-hidden className={root}>
        <div className="t3-working-shimmer-sheen-track">
          <div className="t3-working-shimmer-sheen-band t3-working-shimmer-sheen-band-a" />
          <div className="t3-working-shimmer-sheen-band t3-working-shimmer-sheen-band-b" />
          <div className="t3-working-shimmer-sheen-band t3-working-shimmer-sheen-band-c" />
          <div className="t3-working-shimmer-sheen-band t3-working-shimmer-sheen-band-d" />
        </div>
      </div>
    );
  }

  return (
    <div aria-hidden className={root}>
      <div className="t3-working-shimmer-layer" />
    </div>
  );
}
