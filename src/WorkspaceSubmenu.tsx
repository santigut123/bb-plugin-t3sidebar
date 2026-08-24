import { useState } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { Icon } from "./components/Icon";
import { cn } from "./lib/utils";
import type { WorkspacesApi } from "./useWorkspaces";

export function WorkspaceSubmenu({
  thread,
  workspaces,
}: {
  thread: PluginSidebarThread;
  workspaces: WorkspacesApi;
}) {
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger className="cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
        Workspaces
      </ContextMenu.SubTrigger>
      <ContextMenu.Portal>
        <ContextMenu.SubContent
          aria-label="Workspaces"
          className="z-50 w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {workspaces.workspaces.map((workspace) => {
            const included = workspace.threadIds.includes(thread.id);
            return (
              <ContextMenu.CheckboxItem
                key={workspace.id}
                checked={included}
                disabled={pendingWorkspaceId !== null}
                onSelect={(event) => {
                  event.preventDefault();
                  setPendingWorkspaceId(workspace.id);
                  setError(null);
                  void workspaces
                    .setThreadMembership({
                      workspaceId: workspace.id,
                      projectId: thread.projectId,
                      threadId: thread.id,
                      included: !included,
                    })
                    .catch((reason: unknown) => {
                      setError(
                        reason instanceof Error
                          ? reason.message
                          : "Could not update workspace.",
                      );
                    })
                    .finally(() => setPendingWorkspaceId(null));
                }}
                className={cn(
                  "relative flex cursor-pointer items-center rounded-md py-1.5 pl-7 pr-2 text-sm outline-none",
                  "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                )}
              >
                <ContextMenu.ItemIndicator className="absolute left-2 flex size-4 items-center justify-center">
                  <Icon name="Check" className="size-3.5" />
                </ContextMenu.ItemIndicator>
                <span className="min-w-0 truncate">{workspace.name}</span>
              </ContextMenu.CheckboxItem>
            );
          })}
          {error ? (
            <p role="alert" className="px-2 py-1.5 text-xs text-destructive-text">
              {error}
            </p>
          ) : null}
        </ContextMenu.SubContent>
      </ContextMenu.Portal>
    </ContextMenu.Sub>
  );
}
