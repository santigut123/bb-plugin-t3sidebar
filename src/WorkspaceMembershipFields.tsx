import type {
  PluginSidebarProject,
  PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";

export function WorkspaceMembershipFields({
  availableThreads,
  onProjectChange,
  onThreadChange,
  projects,
  selectedProjects,
  selectedThreads,
}: {
  availableThreads: readonly PluginSidebarThread[];
  onProjectChange(projectId: string, included: boolean): void;
  onThreadChange(threadId: string, included: boolean): void;
  projects: readonly PluginSidebarProject[];
  selectedProjects: ReadonlySet<string>;
  selectedThreads: ReadonlySet<string>;
}) {
  const projectNameById = new Map(
    projects.map((project) => [project.id, project.name]),
  );

  return (
    <>
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
                onChange={(event) =>
                  onProjectChange(project.id, event.target.checked)
                }
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
                    onChange={(event) =>
                      onThreadChange(thread.id, event.target.checked)
                    }
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
    </>
  );
}
