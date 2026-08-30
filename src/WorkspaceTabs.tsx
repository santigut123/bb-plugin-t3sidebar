import { useRef, useState } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import type {
  PluginSidebarProject,
  PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { Icon } from "./components/Icon";
import { usePortalScopeProps } from "./lib/portal-scope";
import { cn } from "./lib/utils";
import { hashHue, projectAccentFromHue } from "./project-colors";
import type { Workspace, WorkspacesApi } from "./useWorkspaces";
import { WorkspaceEditor } from "./WorkspaceEditor";

export function WorkspaceTabs({
  activeWorkspaceId,
  onActiveWorkspaceChange,
  projects,
  threads,
  workspaces,
}: {
  activeWorkspaceId: string | null;
  onActiveWorkspaceChange(workspaceId: string | null): void;
  projects: readonly PluginSidebarProject[];
  threads: readonly PluginSidebarThread[];
  workspaces: WorkspacesApi;
}) {
  const [editor, setEditor] = useState<Workspace | "new" | null>(null);
  const addWorkspaceButton = useRef<HTMLButtonElement>(null);
  const editorTrigger = useRef<HTMLElement | null>(null);
  const workspaceButtons = useRef(new Map<string, HTMLButtonElement>());
  const [visibilityError, setVisibilityError] = useState<string | null>(null);
  const portalScope = usePortalScopeProps();

  return (
    <>
      <div className="flex h-9 shrink-0 border-b border-sidebar-border/60 px-1.5">
        <div
          className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
          role="group"
          aria-label="Workspaces"
        >
          {workspaces.workspaces.length === 0 ? (
            <button
              type="button"
              aria-pressed="true"
              className="my-1 shrink-0 rounded-md bg-sidebar-accent px-2 text-xs font-medium text-foreground"
            >
              All projects
            </button>
          ) : (
            workspaces.workspaces.map((workspace) => {
              const active = workspace.id === activeWorkspaceId;
              const hiddenInAllProjects =
                workspace.hiddenFromAll && activeWorkspaceId === null;
              const accent = projectAccentFromHue(hashHue(workspace.id));
              return (
                <ContextMenu.Root key={workspace.id}>
                  <ContextMenu.Trigger asChild>
                    <button
                      ref={(button) => {
                        if (button) {
                          workspaceButtons.current.set(workspace.id, button);
                        } else {
                          workspaceButtons.current.delete(workspace.id);
                        }
                      }}
                      type="button"
                      aria-label={
                        hiddenInAllProjects
                          ? `${workspace.name}, hidden from All projects`
                          : workspace.name
                      }
                      aria-pressed={active}
                      className={cn(
                        "my-1 flex shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                        hiddenInAllProjects && "opacity-70",
                      )}
                      onClick={() =>
                        onActiveWorkspaceChange(active ? null : workspace.id)
                      }
                    >
                      <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: accent.stripe }}
                      />
                      {workspace.name}
                      {hiddenInAllProjects ? (
                        <span
                          aria-hidden="true"
                          title="Hidden from All projects"
                          className="font-semibold text-muted-foreground"
                        >
                          ⊘
                        </span>
                      ) : null}
                    </button>
                  </ContextMenu.Trigger>
                  <ContextMenu.Portal>
                    <ContextMenu.Content
                      {...portalScope}
                      aria-label={`${workspace.name} workspace actions`}
                      className="z-50 min-w-40 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
                    >
                      <ContextMenu.Item
                        className="cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                        onSelect={() => {
                          editorTrigger.current =
                            workspaceButtons.current.get(workspace.id) ?? null;
                          setEditor(workspace);
                        }}
                      >
                        Edit workspace
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        className="cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                        onSelect={() => {
                          setVisibilityError(null);
                          void workspaces
                            .setHiddenFromAll({
                              workspaceId: workspace.id,
                              hiddenFromAll: !workspace.hiddenFromAll,
                            })
                            .catch((reason: unknown) => {
                              setVisibilityError(
                                reason instanceof Error
                                  ? reason.message
                                  : "Could not update workspace visibility.",
                              );
                            });
                        }}
                      >
                        {workspace.hiddenFromAll
                          ? "Show in All projects"
                          : "Hide from All projects"}
                      </ContextMenu.Item>
                    </ContextMenu.Content>
                  </ContextMenu.Portal>
                </ContextMenu.Root>
              );
            })
          )}
        </div>
        <button
          ref={addWorkspaceButton}
          type="button"
          aria-label="Add workspace"
          className="ml-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          onClick={(event) => {
            editorTrigger.current = event.currentTarget;
            setEditor("new");
          }}
        >
          <Icon name="Plus" className="size-4" />
        </button>
      </div>
      {visibilityError ? (
        <p role="alert" className="px-3 py-1 text-xs text-destructive-text">
          {visibilityError}
        </p>
      ) : null}
      {editor !== null ? (
        <WorkspaceEditor
          key={editor === "new" ? "new" : editor.id}
          fallbackFocus={addWorkspaceButton.current}
          projects={projects}
          returnFocus={editorTrigger.current}
          threads={threads}
          workspace={editor === "new" ? null : editor}
          onCancel={() => setEditor(null)}
          onDelete={
            editor === "new"
              ? undefined
              : async () => {
                  await workspaces.delete(editor.id);
                  if (editor.id === activeWorkspaceId) {
                    onActiveWorkspaceChange(null);
                  }
                  setEditor(null);
                }
          }
          onSave={async (input) => {
            const workspace = await workspaces.save(input);
            onActiveWorkspaceChange(workspace.id);
            setEditor(null);
          }}
        />
      ) : null}
    </>
  );
}
