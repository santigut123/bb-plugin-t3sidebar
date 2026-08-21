import type { ReactNode } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import {
  experimental_useSidebarThreadActions as useSidebarThreadActions,
  type PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { cn } from "./lib/utils";
import {
  PROJECT_COLOR_SWATCH_HUES,
  projectAccentFromHue,
} from "./project-colors";

/**
 * This sidebar's own right-click menu.
 *
 * The plugin API ships no menu component on purpose, so a replaced sidebar
 * owns this surface. Every item below is one call on
 * `experimental_useSidebarThreadActions`, and the destructive one is
 * `requestDelete`, which opens BB's confirmation rather than deleting a
 * subtree silently.
 */
export function RowContextMenu({
  thread,
  projectName,
  projectHue,
  hasCustomProjectColor,
  onSetProjectColor,
  onResetProjectColor,
  children,
}: {
  thread: PluginSidebarThread;
  projectName: string | null;
  projectHue: number;
  hasCustomProjectColor: boolean;
  onSetProjectColor: (hue: number) => void;
  onResetProjectColor: () => void;
  children: ReactNode;
}) {
  const actions = useSidebarThreadActions();

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          aria-label="Thread actions"
          className="z-50 min-w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <Item onSelect={() => actions.open(thread.id, { split: true })}>
            Open in split
          </Item>
          <Separator />
          <Item
            onSelect={() => void actions.setRead(thread.id, thread.isUnread)}
          >
            {thread.isUnread ? "Mark read" : "Mark unread"}
          </Item>
          <Item
            onSelect={() => void actions.setPinned(thread.id, !thread.isPinned)}
          >
            {thread.isPinned ? "Unpin" : "Pin"}
          </Item>
          <Separator />
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
              {projectName ? `${projectName} color` : "Project color"}
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent
                className="z-50 w-52 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-md"
              >
                <ContextMenu.RadioGroup
                  className="grid grid-cols-8 gap-1.5"
                  aria-label="Project color swatch"
                  value={hasCustomProjectColor ? String(projectHue) : ""}
                  onValueChange={(value) => onSetProjectColor(Number(value))}
                >
                  {PROJECT_COLOR_SWATCH_HUES.map((hue) => {
                    const selected =
                      hasCustomProjectColor && projectHue === hue;
                    return (
                      <ContextMenu.RadioItem
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
                            backgroundColor:
                              projectAccentFromHue(hue).stripe,
                          }}
                        />
                      </ContextMenu.RadioItem>
                    );
                  })}
                </ContextMenu.RadioGroup>
                <Separator />
                <Item
                  onSelect={onResetProjectColor}
                  disabled={!hasCustomProjectColor}
                >
                  Use automatic color
                </Item>
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>
          <Separator />
          <Item onSelect={() => actions.archive(thread.id)}>Archive</Item>
          <Item destructive onSelect={() => actions.requestDelete(thread.id)}>
            Delete
          </Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function Item({
  children,
  destructive = false,
  disabled = false,
  onSelect,
}: {
  children: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <ContextMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        destructive && "text-destructive-text",
      )}
    >
      {children}
    </ContextMenu.Item>
  );
}

function Separator() {
  return <ContextMenu.Separator className="my-1 h-px bg-border" />;
}
