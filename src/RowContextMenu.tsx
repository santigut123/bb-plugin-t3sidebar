import type { ReactNode } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  experimental_useSidebarThreadActions as useSidebarThreadActions,
  type PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { cn } from "./lib/utils";
import { usePortalScopeProps } from "./lib/portal-scope";
import { threadDisplayTitle } from "./inbox";
import { resolveSnoozePresets } from "./lifecycle";
import {
  ActionsMenu,
  MENU_CONTENT_CLASS,
  MENU_SUB_TRIGGER_CLASS,
  MenuItem,
  type MenuKit,
  MenuSeparator,
} from "./menu";
import {
  PROJECT_COLOR_SWATCH_HUES,
  projectAccentFromHue,
} from "./project-colors";
import type { WorkspacesApi } from "./useWorkspaces";
import { WorkspaceSubmenu } from "./WorkspaceSubmenu";

/** What the menu can do about the thread's shelf. */
export type ThreadParking =
  | {
      shelf: "active";
      /** False while the thread is working or blocked on the user. */
      canPark: boolean;
      onSettle: () => void;
      onSnooze: (snoozedUntil: number) => void;
    }
  | { shelf: "snoozed" | "settled"; onRestore: () => void };

export interface ThreadMenuProps {
  thread: PluginSidebarThread;
  projectName: string | null;
  projectHue: number;
  hasCustomProjectColor: boolean;
  onSetProjectColor: (hue: number) => void;
  onResetProjectColor: () => void;
  workspaces: WorkspacesApi;
  parking: ThreadParking;
  /** Phone-width or touch: no splits, and the menu hangs off a button. */
  compact: boolean;
}

/**
 * This sidebar's own right-click menu.
 *
 * The plugin API ships no menu component on purpose, so a replaced sidebar
 * owns this surface. Every item below is one call on
 * `experimental_useSidebarThreadActions` or the plugin's lifecycle, and the
 * destructive one is `requestDelete`, which opens BB's confirmation rather
 * than deleting a subtree silently.
 */
export function RowContextMenu({
  children,
  ...menu
}: ThreadMenuProps & { children: ReactNode }) {
  const portalScope = usePortalScopeProps();

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          {...portalScope}
          aria-label="Thread actions"
          className={cn(MENU_CONTENT_CLASS, "min-w-44")}
        >
          <ThreadMenuItems kit={ContextMenu} {...menu} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

/**
 * The same menu behind a visible button, for a finger. It sits in the row's
 * right-hand gutter, beside the right-click trigger rather than inside it:
 * React bubbles events out of a portal along the component tree, so a long
 * press on one of this menu's items would otherwise open the row's context
 * menu on top of it.
 */
export function RowActionsMenu(menu: ThreadMenuProps) {
  return (
    <ActionsMenu
      label={`Actions for ${threadDisplayTitle(menu.thread)}`}
      className="absolute right-0.5 top-1/2 z-[2] -translate-y-1/2"
    >
      <ThreadMenuItems kit={DropdownMenu} {...menu} />
    </ActionsMenu>
  );
}

function ThreadMenuItems({
  kit,
  thread,
  projectName,
  projectHue,
  hasCustomProjectColor,
  onSetProjectColor,
  onResetProjectColor,
  workspaces,
  parking,
  compact,
}: ThreadMenuProps & { kit: MenuKit }) {
  const actions = useSidebarThreadActions();
  const portalScope = usePortalScopeProps();

  return (
    <>
      {compact ? null : (
        <>
          <MenuItem
            kit={kit}
            onSelect={() => actions.open(thread.id, { split: true })}
          >
            Open in split
          </MenuItem>
          <MenuSeparator kit={kit} />
        </>
      )}
      {parking.shelf !== "active" ? (
        <>
          <MenuItem kit={kit} onSelect={parking.onRestore}>
            {parking.shelf === "snoozed" ? "Wake now" : "Un-settle"}
          </MenuItem>
          <MenuSeparator kit={kit} />
        </>
      ) : parking.canPark ? (
        <>
          <MenuItem kit={kit} onSelect={parking.onSettle}>
            Settle
          </MenuItem>
          <SnoozeSubmenu kit={kit} onSnooze={parking.onSnooze} />
          <MenuSeparator kit={kit} />
        </>
      ) : null}
      <MenuItem
        kit={kit}
        onSelect={() => void actions.setRead(thread.id, thread.isUnread)}
      >
        {thread.isUnread ? "Mark read" : "Mark unread"}
      </MenuItem>
      <MenuItem
        kit={kit}
        onSelect={() => void actions.setPinned(thread.id, !thread.isPinned)}
      >
        {thread.isPinned ? "Unpin" : "Pin"}
      </MenuItem>
      {workspaces.workspaces.length > 0 ? (
        <WorkspaceSubmenu kit={kit} thread={thread} workspaces={workspaces} />
      ) : null}
      <MenuSeparator kit={kit} />
      <kit.Sub>
        <kit.SubTrigger className={MENU_SUB_TRIGGER_CLASS}>
          {projectName ? `${projectName} color` : "Project color"}
        </kit.SubTrigger>
        <kit.Portal>
          <kit.SubContent
            {...portalScope}
            className={cn(MENU_CONTENT_CLASS, "w-52 p-2")}
          >
            <kit.RadioGroup
              className="grid grid-cols-8 gap-1.5"
              aria-label="Project color swatch"
              value={hasCustomProjectColor ? String(projectHue) : ""}
              onValueChange={(value) => onSetProjectColor(Number(value))}
            >
              {PROJECT_COLOR_SWATCH_HUES.map((hue) => {
                const selected = hasCustomProjectColor && projectHue === hue;
                return (
                  <kit.RadioItem
                    key={hue}
                    value={String(hue)}
                    aria-label={`Set project color ${hue}`}
                    className={cn(
                      "flex size-5 cursor-pointer items-center justify-center rounded-full outline-none",
                      "data-[highlighted]:ring-2 data-[highlighted]:ring-ring",
                      selected && "ring-2 ring-foreground",
                    )}
                  >
                    <span
                      className="size-4 rounded-full border border-background/40"
                      style={{
                        backgroundColor: projectAccentFromHue(hue).stripe,
                      }}
                    />
                  </kit.RadioItem>
                );
              })}
            </kit.RadioGroup>
            <MenuSeparator kit={kit} />
            <MenuItem
              kit={kit}
              onSelect={onResetProjectColor}
              disabled={!hasCustomProjectColor}
            >
              Use automatic color
            </MenuItem>
          </kit.SubContent>
        </kit.Portal>
      </kit.Sub>
      <MenuSeparator kit={kit} />
      <MenuItem kit={kit} onSelect={() => actions.archive(thread.id)}>
        Archive
      </MenuItem>
      <MenuItem
        kit={kit}
        destructive
        onSelect={() => actions.requestDelete(thread.id)}
      >
        Delete
      </MenuItem>
    </>
  );
}

function SnoozeSubmenu({
  kit,
  onSnooze,
}: {
  kit: MenuKit;
  onSnooze: (snoozedUntil: number) => void;
}) {
  const portalScope = usePortalScopeProps();

  return (
    <kit.Sub>
      <kit.SubTrigger className={MENU_SUB_TRIGGER_CLASS}>Snooze</kit.SubTrigger>
      <kit.Portal>
        <kit.SubContent
          {...portalScope}
          className={cn(MENU_CONTENT_CLASS, "min-w-36")}
        >
          {/* Resolved when the submenu opens, so "In 1 hour" means from now. */}
          {resolveSnoozePresets(new Date()).map((preset) => (
            <MenuItem
              key={preset.id}
              kit={kit}
              onSelect={() => onSnooze(preset.snoozedUntil)}
            >
              {preset.label}
            </MenuItem>
          ))}
        </kit.SubContent>
      </kit.Portal>
    </kit.Sub>
  );
}
