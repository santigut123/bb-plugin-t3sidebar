import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import {
  StatusGlyph,
  hasStatusGlyph,
  statusPresentation,
} from "./StatusGlyph";
import { cn } from "./lib/utils";
import { relativeTimeLabel } from "./relative-time";

/**
 * The row's trailing slot: right-aligned with a fixed minimum width.
 *
 * Idle ages keep the original aligned column. A live status can grow beyond
 * it to show a compact label; the project/title area is the flexible region
 * and truncates before this status does.
 */
export const STATUS_SLOT_CLASS =
  "flex min-w-7 shrink-0 items-center justify-end";

/**
 * The box every trailing glyph sits in, whatever its artwork measures.
 *
 * The status glyph, the provider glyph and a shelf's chevron all end a line at
 * the same inset, but they are drawn at different sizes. A shared box centres
 * each one on the same vertical axis, so right-aligning the boxes lines the
 * icons up instead of leaving them one or two pixels apart.
 */
export const TRAILING_GLYPH_BOX_CLASS =
  "flex size-3.5 shrink-0 items-center justify-center";

/**
 * Status OR age, never both: the glyph already implies the row is current, and
 * the age only earns its place once the thread has nothing to say.
 */
export function StatusOrTime({
  thread,
  now,
}: {
  thread: PluginSidebarThread;
  /** Quantized clock, shared by every row in one render. */
  now: number;
}) {
  if (hasStatusGlyph(thread.indicator)) {
    const presentation = statusPresentation(
      thread.indicator,
      thread.indicatorLabel,
    );
    if (presentation === null) return null;

    return (
      <span
        className={cn(
          "flex items-center gap-1 whitespace-nowrap text-2xs font-medium",
          presentation.toneClass,
        )}
      >
        <StatusGlyph
          indicator={thread.indicator}
          label={thread.indicatorLabel}
        />
        {/* The glyph keeps bb's richer accessible label; this is its compact
            visual shorthand, so exposing both would announce it twice. */}
        <span aria-hidden="true">{presentation.shortLabel}</span>
      </span>
    );
  }
  return (
    <span className="tabular-nums text-2xs text-muted-foreground">
      {relativeTimeLabel(thread.updatedAt, now)}
    </span>
  );
}
