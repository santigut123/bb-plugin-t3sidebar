import { useEffect, useId, useRef, useState } from "react";
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
  const portalScope = usePortalScopeProps();

  return (
    <>
      <div className="flex h-9 shrink-0 border-b border-sidebar-border/60 px-1.5">
        <div
          className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
          role="tablist"
          aria-label="Workspaces"
        >
          {workspaces.workspaces.length === 0 ? (
            <button
              type="button"
              role="tab"
              aria-selected="true"
              className="shrink-0 border-b-2 border-primary px-2 text-xs font-medium text-foreground"
            >
              All projects
            </button>
          ) : (
            workspaces.workspaces.map((workspace) => {
              const active = workspace.id === activeWorkspaceId;
              const accent = projectAccentFromHue(hashHue(workspace.id));
              return (
                <ContextMenu.Root key={workspace.id}>
                  <ContextMenu.Trigger asChild>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 border-b-2 px-2 text-xs font-medium transition-colors",
                        active
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() =>
                        onActiveWorkspaceChange(active ? null : workspace.id)
                      }
                    >
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: accent.stripe }}
                      />
                      {workspace.name}
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
                        onSelect={() => setEditor(workspace)}
                      >
                        Edit workspace
                      </ContextMenu.Item>
                    </ContextMenu.Content>
                  </ContextMenu.Portal>
                </ContextMenu.Root>
              );
            })
          )}
        </div>
        <button
          type="button"
          aria-label="Add workspace"
          className="ml-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          onClick={() => setEditor("new")}
        >
          <Icon name="Plus" className="size-4" />
        </button>
      </div>
      {editor !== null ? (
        <WorkspaceEditor
          key={editor === "new" ? "new" : editor.id}
          projects={projects}
          threads={threads}
          workspace={editor === "new" ? null : editor}
          onCancel={() => setEditor(null)}
          onDelete={
            editor === "new"
              ? undefined
              : async () => {
                  await workspaces.delete(editor.id);
                  onActiveWorkspaceChange(null);
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

function WorkspaceEditor({
  onCancel,
  onDelete,
  onSave,
  projects,
  threads,
  workspace = null,
}: {
  onCancel(): void;
  onDelete?: () => Promise<void>;
  onSave(input: {
    workspaceId: string | null;
    name: string;
    projectIds: string[];
    threadIds: string[];
  }): Promise<void>;
  projects: readonly PluginSidebarProject[];
  threads: readonly PluginSidebarThread[];
  workspace?: Workspace | null;
}) {
  const titleId = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(workspace?.name ?? "");
  const [selectedProjects, setSelectedProjects] = useState<ReadonlySet<string>>(
    () => new Set(workspace?.projectIds ?? []),
  );
  const [selectedThreads, setSelectedThreads] = useState<ReadonlySet<string>>(
    () => new Set(workspace?.threadIds ?? []),
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    nameInput.current?.focus();
  }, []);

  const busy = saving || deleting;
  const canSave = name.trim().length > 0 && selectedProjects.size > 0 && !busy;
  const availableThreads = threads.filter(
    (thread) =>
      !thread.isArchived && selectedProjects.has(thread.projectId),
  );
  const availableThreadIds = new Set(
    availableThreads.map((thread) => thread.id),
  );
  const projectNameById = new Map(
    projects.map((project) => [project.id, project.name]),
  );
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          setSaving(true);
          setError(null);
          void onSave({
            workspaceId: workspace?.id ?? null,
            name: name.trim(),
            projectIds: [...selectedProjects],
            threadIds: [...selectedThreads].filter((threadId) =>
              availableThreadIds.has(threadId),
            ),
          })
            .catch((reason: unknown) => {
              setError(
                reason instanceof Error ? reason.message : "Could not save workspace.",
              );
            })
            .finally(() => setSaving(false));
        }}
      >
        <h2 id={titleId} className="text-sm font-semibold">
          {workspace === null ? "New workspace" : "Edit workspace"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose the projects available here, then include only the threads you
          need.
        </p>

        <label
          className="mt-4 block text-xs font-medium"
          htmlFor={`${titleId}-name`}
        >
          Workspace name
        </label>
        <input
          ref={nameInput}
          id={`${titleId}-name`}
          value={name}
          maxLength={64}
          className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          onChange={(event) => setName(event.target.value)}
        />

        <fieldset className="mt-4">
          <legend className="text-xs font-medium">Projects</legend>
          <div className="mt-1 max-h-52 overflow-y-auto rounded-md border border-border p-1">
            {projects.map((project) => (
              <label
                key={project.id}
                className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-2 text-xs hover:bg-state-hover"
              >
                <input
                  type="checkbox"
                  checked={selectedProjects.has(project.id)}
                  onChange={(event) => {
                    setSelectedProjects((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(project.id);
                      else next.delete(project.id);
                      return next;
                    });
                    if (!event.target.checked) {
                      const removedThreadIds = new Set(
                        threads
                          .filter((thread) => thread.projectId === project.id)
                          .map((thread) => thread.id),
                      );
                      setSelectedThreads(
                        (current) =>
                          new Set(
                            [...current].filter(
                              (threadId) => !removedThreadIds.has(threadId),
                            ),
                          ),
                      );
                    }
                  }}
                />
                <span className="min-w-0 truncate">{project.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-xs font-medium">Threads</legend>
          <div className="mt-1 max-h-52 overflow-y-auto rounded-md border border-border p-1">
            {selectedProjects.size === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Select a project to choose its threads.
              </p>
            ) : availableThreads.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                No active threads in the selected projects.
              </p>
            ) : (
              availableThreads.map((thread) => {
                const title =
                  thread.title?.trim() ||
                  thread.titleFallback?.trim() ||
                  "Untitled thread";
                return (
                  <label
                    key={thread.id}
                    className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 hover:bg-state-hover"
                  >
                    <input
                      type="checkbox"
                      aria-label={title}
                      checked={selectedThreads.has(thread.id)}
                      onChange={(event) => {
                        setSelectedThreads((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(thread.id);
                          else next.delete(thread.id);
                          return next;
                        });
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs">{title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {projectNameById.get(thread.projectId) ??
                          "Unknown project"}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive-text">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2">
          {onDelete ? (
            <button
              type="button"
              disabled={busy}
              className="h-8 rounded-md px-2 text-xs text-destructive-text hover:bg-state-hover disabled:opacity-50"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                setDeleting(true);
                setError(null);
                void onDelete()
                  .catch((reason: unknown) => {
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : "Could not delete workspace.",
                    );
                  })
                  .finally(() => setDeleting(false));
              }}
            >
              {deleting
                ? "Deleting…"
                : confirmDelete
                  ? "Confirm delete"
                  : "Delete workspace"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              className="h-8 rounded-md px-3 text-xs text-muted-foreground hover:bg-state-hover hover:text-foreground disabled:opacity-50"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Saving…" : workspace === null ? "Create" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
