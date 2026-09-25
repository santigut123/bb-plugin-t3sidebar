import { useState } from "react";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { Icon } from "./components/Icon";
import { usePortalScopeProps } from "./lib/portal-scope";
import { cn } from "./lib/utils";
import {
  MENU_CONTENT_CLASS,
  MENU_ITEM_CLASS,
  MENU_SUB_TRIGGER_CLASS,
  type MenuKit,
} from "./menu";
import type { WorkspacesApi } from "./useWorkspaces";

export function WorkspaceSubmenu({
  kit,
  thread,
  workspaces,
}: {
  kit: MenuKit;
  thread: PluginSidebarThread;
  workspaces: WorkspacesApi;
}) {
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const portalScope = usePortalScopeProps();

  return (
    <kit.Sub>
      <kit.SubTrigger className={MENU_SUB_TRIGGER_CLASS}>Workspaces</kit.SubTrigger>
      <kit.Portal>
        <kit.SubContent
          {...portalScope}
          aria-label="Workspaces"
          className={cn(MENU_CONTENT_CLASS, "w-56")}
        >
          {workspaces.workspaces.map((workspace) => {
            const included = workspace.threadIds.includes(thread.id);
            return (
              <kit.CheckboxItem
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
                  MENU_ITEM_CLASS,
                  "relative flex items-center pl-7",
                )}
              >
                <kit.ItemIndicator className="absolute left-2 flex size-4 items-center justify-center">
                  <Icon name="Check" className="size-3.5" />
                </kit.ItemIndicator>
                <span className="min-w-0 truncate">{workspace.name}</span>
              </kit.CheckboxItem>
            );
          })}
          {error ? (
            <p role="alert" className="px-2 py-1.5 text-xs text-destructive-text">
              {error}
            </p>
          ) : null}
        </kit.SubContent>
      </kit.Portal>
    </kit.Sub>
  );
}
