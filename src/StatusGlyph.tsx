import type { PluginSidebarThreadIndicator } from "@get-bb/plugin-sdk";
import { Icon } from "./components/Icon";
import { cn } from "./lib/utils";

/**
 * This plugin's status glyphs use bb's own sidebar shapes and semantic theme
 * colors. Shape, motion, and the host-provided accessible label carry the
 * meaning; color reinforces it without becoming the only signal.
 *
 * The SDK ships `indicator` as data and no status component on purpose, so a
 * replaced sidebar can choose its own look. Monitoring currently arrives as a
 * runtime indicator whose label contains "monitoring", so it gets a distinct
 * radar until the SDK exposes a dedicated indicator kind.
 *
 * An unrecognized indicator draws nothing: bb adds kinds over time, and a
 * plugin built today must not break on a kind shipped tomorrow.
 */

/**
 * Whether this indicator draws a glyph that speaks for the row.
 *
 * The row gives the glyph and the age ONE slot, so this decides which of the
 * two the user sees. Listed kind by kind rather than "anything but none": an
 * indicator bb ships tomorrow must fall through to the age label, not blank
 * the slot.
 */
export function hasStatusGlyph(
  indicator: PluginSidebarThreadIndicator,
): boolean {
  return statusPresentation(indicator, null) !== null;
}

export interface StatusPresentation {
  shortLabel: string;
  toneClass: string;
}

/** Compact visible wording and its matching host-theme color. */
export function statusPresentation(
  indicator: PluginSidebarThreadIndicator,
  label: string | null,
): StatusPresentation | null {
  switch (indicator) {
    case "unread-error":
      return { shortLabel: "Error", toneClass: "text-destructive-text" };
    case "waiting-for-input":
      return { shortLabel: "Input needed", toneClass: "text-warning-text" };
    case "unread-success":
      return { shortLabel: "Success", toneClass: "text-success" };
    case "runtime":
      return isMonitoring(label)
        ? { shortLabel: "Monitoring", toneClass: "text-timeline-accent" }
        : { shortLabel: "Working", toneClass: "text-primary" };
    case "workflow":
      return { shortLabel: "Workflow", toneClass: "text-primary" };
    case "background-agent":
      return { shortLabel: "Agent", toneClass: "text-timeline-accent" };
    case "background-command":
      return { shortLabel: "Command", toneClass: "text-timeline-accent" };
    case "plan-mode":
      return { shortLabel: "Planning", toneClass: "text-warning-text" };
    case "goal":
      return { shortLabel: "Goal", toneClass: "text-success" };
    case "draft":
    case "working-draft":
      return { shortLabel: "Draft", toneClass: "text-muted-foreground" };
    case "none":
    default:
      return null;
  }
}

export function StatusGlyph({
  indicator,
  label,
  className,
}: {
  indicator: PluginSidebarThreadIndicator;
  label: string | null;
  className?: string;
}) {
  const shared = cn("size-3.5 shrink-0", className);
  const aria = label ?? undefined;
  const tone =
    statusPresentation(indicator, label)?.toneClass ??
    "text-muted-foreground";

  switch (indicator) {
    case "unread-error":
      return (
        <Icon
          name="CircleX"
          aria-label={aria}
          className={cn(shared, tone)}
        />
      );
    case "waiting-for-input":
      return (
        <Icon
          name="CircleQuestion"
          aria-label={aria}
          className={cn(shared, tone)}
        />
      );
    case "runtime":
      if (isMonitoring(label)) {
        return (
          <Icon
            name="Radar"
            aria-label={aria}
            className={cn(
              shared,
              tone,
              "motion-safe:animate-pulse",
            )}
          />
        );
      }
      return (
        <Icon
          name="Loading"
          aria-label={aria}
          className={cn(shared, "animate-spin", tone)}
        />
      );
    case "workflow":
      return (
        <ShineIcon
          name="Workflow"
          label={aria}
          color={tone}
          className={shared}
        />
      );
    case "background-agent":
      return (
        <ShineIcon
          name="UserRoundPlus"
          label={aria}
          color={tone}
          className={shared}
        />
      );
    case "background-command":
      return (
        <ShineIcon
          name="Terminal"
          label={aria}
          color={tone}
          className={shared}
        />
      );
    case "plan-mode":
      return (
        <ShineIcon
          name="ListTodo"
          label={aria}
          color={tone}
          className={shared}
        />
      );
    case "goal":
      return (
        <ShineIcon
          name="Target"
          label={aria}
          color={tone}
          className={shared}
        />
      );
    case "draft":
    case "working-draft":
      return (
        <Icon
          name="Edit"
          aria-label={aria}
          className={cn(shared, tone)}
        />
      );
    case "unread-success":
      // The notification dot, in a box the size of every other glyph, the way
      // bb centers its own trailing indicators. Right-aligned on its own, a
      // 5px dot would sit ~4px off the column the icons share.
      return (
        <span
          aria-label={aria}
          className={cn("flex items-center justify-center", shared)}
        >
          <span className="size-[5px] rounded-full bg-success" />
        </span>
      );
    case "none":
      return null;
    default:
      return null;
  }
}

function isMonitoring(label: string | null): boolean {
  return label !== null && /\bmonitor(?:ed|ing|s)?\b/i.test(label);
}

function ShineIcon({
  name,
  label,
  color,
  className,
}: {
  name: "Workflow" | "UserRoundPlus" | "Terminal" | "ListTodo" | "Target";
  label: string | undefined;
  color: string;
  className: string;
}) {
  return (
    <Icon
      name={name}
      aria-label={label}
      className={cn("animate-shine-icon", color, className)}
    />
  );
}
