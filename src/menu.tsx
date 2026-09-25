import { useRef, useState, type ReactNode } from "react";
import type * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Icon } from "./components/Icon";
import { usePortalScopeProps } from "./lib/portal-scope";
import { cn } from "./lib/utils";

/**
 * The parts Radix's context and dropdown menus share. Both are built on one
 * menu primitive, so the same items fill either: right-click on a desktop, a
 * visible button on a touch screen.
 */
export type MenuKit = Pick<
  typeof ContextMenu,
  | "CheckboxItem"
  | "Item"
  | "ItemIndicator"
  | "Portal"
  | "RadioGroup"
  | "RadioItem"
  | "Separator"
  | "Sub"
  | "SubContent"
  | "SubTrigger"
>;

export const MENU_CONTENT_CLASS =
  "z-50 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md";

// Rows grow under a finger; a mouse keeps the dense desktop menu.
export const MENU_ITEM_CLASS = cn(
  "cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none pointer-coarse:py-2.5",
  "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
);

export const MENU_SUB_TRIGGER_CLASS = cn(
  MENU_ITEM_CLASS,
  "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
);

export function MenuItem({
  kit,
  children,
  destructive = false,
  disabled = false,
  onSelect,
}: {
  kit: MenuKit;
  children: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <kit.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(MENU_ITEM_CLASS, destructive && "text-destructive-text")}
    >
      {children}
    </kit.Item>
  );
}

export function MenuSeparator({ kit }: { kit: MenuKit }) {
  return <kit.Separator className="my-1 h-px bg-border" />;
}

/**
 * A visible "…" button that opens a dropdown — the touch screen's stand-in for
 * right-click and hover, neither of which a finger has.
 *
 * Radix opens a dropdown on pointerdown, so on a phone a scroll that happens to
 * start on the button would open the menu. Touch and pen open on click
 * instead, which the browser fires only for a tap.
 */
export function ActionsMenu({
  label,
  className,
  children,
}: {
  /** Names the button, and through it the menu. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pointerType = useRef("");
  const portalScope = usePortalScopeProps();

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger
        aria-label={label}
        onPointerDown={(event) => {
          pointerType.current = event.pointerType;
          if (event.pointerType !== "mouse") event.preventDefault();
        }}
        onClick={() => {
          if (pointerType.current !== "mouse") setOpen((current) => !current);
        }}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground",
          "hover:text-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-foreground",
          className,
        )}
      >
        <Icon name="More" className="size-4" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          {...portalScope}
          align="end"
          collisionPadding={8}
          className={cn(MENU_CONTENT_CLASS, "min-w-44")}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
