import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { hashHue } from "./project-colors";

/**
 * A per-thread dot. Colour comes from the thread's id so the same thread keeps
 * the same colour everywhere it appears, and every hue is a rotation of one
 * accent, so a custom palette still applies.
 *
 * `thread` is null for the "and more" disc in a cluster.
 */
export function Disc({ thread }: { thread: PluginSidebarThread | null }) {
  const hue = thread === null ? 0 : hashHue(thread.id);
  return (
    <span
      className="inline-block size-3.5 shrink-0 rounded-full border border-background"
      style={{
        backgroundColor:
          thread === null
            ? "var(--muted-foreground)"
            : `oklch(0.72 0.13 ${hue})`,
      }}
    />
  );
}
