import { useEffect, useId, useRef, useState } from "react";
import type { PluginSidebarProject } from "@get-bb/plugin-sdk/app";
import { Icon } from "./components/Icon";
import { cn } from "./lib/utils";
import { hashHue, projectAccentFromHue } from "./project-colors";
import type { Workspace, WorkspacesApi } from "./useWorkspaces";

export function WorkspaceTabs({
  activeWorkspaceId,
  onActiveWorkspaceChange,
  projects,
  workspaces,
}: {
  activeWorkspaceId: string | null;
  onActiveWorkspaceChange(workspaceId: string | null): void;
  projects: readonly PluginSidebarProject[];
  workspaces: WorkspacesApi;
}) {
  const [editorOpen, setEditorOpen] = useState(false);

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
                <button
                  key={workspace.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 border-b-2 px-2 text-xs font-medium transition-colors",
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => onActiveWorkspaceChange(workspace.id)}
                >
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: accent.stripe }}
                  />
                  {workspace.name}
                </button>
              );
            })
          )}
        </div>
        <button
          type="button"
          aria-label="Add workspace"
          className="ml-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          onClick={() => setEditorOpen(true)}
        >
          <Icon name="Plus" className="size-4" />
        </button>
      </div>
      {editorOpen ? (
        <WorkspaceEditor
          projects={projects}
          onCancel={() => setEditorOpen(false)}
          onSave={async (input) => {
            const workspace = await workspaces.save(input);
            onActiveWorkspaceChange(workspace.id);
            setEditorOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function WorkspaceEditor({
  onCancel,
  onSave,
  projects,
  workspace = null,
}: {
  onCancel(): void;
  onSave(input: {
    workspaceId: string | null;
    name: string;
    projectIds: string[];
  }): Promise<void>;
  projects: readonly PluginSidebarProject[];
  workspace?: Workspace | null;
}) {
  const titleId = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(workspace?.name ?? "");
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(workspace?.projectIds ?? []),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    nameInput.current?.focus();
  }, []);

  const canSave = name.trim().length > 0 && selected.size > 0 && !saving;
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
        className="w-full max-w-sm rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          setSaving(true);
          setError(null);
          void onSave({
            workspaceId: workspace?.id ?? null,
            name: name.trim(),
            projectIds: [...selected],
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
          Group projects so their threads stay focused together.
        </p>

        <label className="mt-4 block text-xs font-medium" htmlFor={`${titleId}-name`}>
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
                  checked={selected.has(project.id)}
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(project.id);
                      else next.delete(project.id);
                      return next;
                    });
                  }}
                />
                <span className="min-w-0 truncate">{project.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive-text">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="h-8 rounded-md px-3 text-xs text-muted-foreground hover:bg-state-hover hover:text-foreground"
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
      </form>
    </div>
  );
}
