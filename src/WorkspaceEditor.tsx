import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  PluginSidebarProject,
  PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import type { Workspace } from "./useWorkspaces";
import { WorkspaceMembershipFields } from "./WorkspaceMembershipFields";

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function keepFocusInsideDialog(event: KeyboardEvent<HTMLDialogElement>): void {
  if (event.key !== "Tab") return;
  const focusable = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(focusableSelector),
  ];
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function WorkspaceEditor({
  fallbackFocus,
  onCancel,
  onDelete,
  onSave,
  projects,
  returnFocus,
  threads,
  workspace = null,
}: {
  fallbackFocus: HTMLElement | null;
  onCancel(): void;
  onDelete?: () => Promise<void>;
  onSave(input: {
    workspaceId: string | null;
    name: string;
    projectIds: string[];
    threadIds: string[];
  }): Promise<void>;
  projects: readonly PluginSidebarProject[];
  returnFocus: HTMLElement | null;
  threads: readonly PluginSidebarThread[];
  workspace?: Workspace | null;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.open = true;
    nameInput.current?.focus();

    return () => {
      if (dialog.open) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.open = false;
      }
      const focusTarget = returnFocus?.isConnected
        ? returnFocus
        : fallbackFocus?.isConnected
          ? fallbackFocus
          : null;
      focusTarget?.focus();
    };
  }, [fallbackFocus, returnFocus]);

  const busy = saving || deleting;
  const canSave = name.trim().length > 0 && selectedProjects.size > 0 && !busy;
  const availableThreads = threads.filter(
    (thread) => !thread.isArchived && selectedProjects.has(thread.projectId),
  );
  const availableThreadIds = new Set(
    availableThreads.map((thread) => thread.id),
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none items-center justify-center bg-background/70 p-4 text-popover-foreground backdrop:bg-transparent open:flex"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
      onKeyDown={keepFocusInsideDialog}
    >
      <form
        className="mx-auto max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-lg border border-border bg-popover p-4 shadow-lg"
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
                reason instanceof Error
                  ? reason.message
                  : "Could not save workspace.",
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

        <WorkspaceMembershipFields
          availableThreads={availableThreads}
          projects={projects}
          selectedProjects={selectedProjects}
          selectedThreads={selectedThreads}
          onProjectChange={(projectId, included) => {
            setSelectedProjects((current) => {
              const next = new Set(current);
              if (included) next.add(projectId);
              else next.delete(projectId);
              return next;
            });
            if (!included) {
              const removedThreadIds = new Set(
                threads
                  .filter((thread) => thread.projectId === projectId)
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
          onThreadChange={(threadId, included) => {
            setSelectedThreads((current) => {
              const next = new Set(current);
              if (included) next.add(threadId);
              else next.delete(threadId);
              return next;
            });
          }}
        />

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
    </dialog>
  );
}
