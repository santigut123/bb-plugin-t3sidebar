import { useEffect, useMemo, useRef, useState } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import {
  experimental_useSidebarThreadActions as useSidebarThreadActions,
  experimental_useSidebarThreads as useSidebarThreads,
  useSettings,
  type PluginSidebarThread,
  type PluginThreadListProps,
} from "@get-bb/plugin-sdk/app";
import { Icon } from "./components/Icon";
import { cn } from "./lib/utils";
import { ThreadCard } from "./ThreadCard";
import { SlimRow } from "./SlimRow";
import { useLifecycle, isWorking } from "./useLifecycle";
import { useProjectColors } from "./useProjectColors";
import {
  parseWorkingShimmerVariant,
  WORKING_SHIMMER_SETTING_KEY,
} from "./working-shimmer";
import {
  CARD_DIVIDERS_SETTING_KEY,
  parseBooleanSetting,
  parseUnreadTitleWeight,
  PROJECT_COLOR_STRIPES_SETTING_KEY,
  STATUS_ICON_SHINE_SETTING_KEY,
  UNREAD_TITLE_WEIGHT_SETTING_KEY,
} from "./appearance-settings";
import { TRAILING_GLYPH_BOX_CLASS } from "./StatusSlot";
import { statusPresentation } from "./StatusGlyph";
import { useTurnStarts } from "./useTurnStarts";
import { useWorkOrder } from "./useWorkOrder";
import { WorkspaceTabs } from "./WorkspaceTabs";
import { useWorkspaces } from "./useWorkspaces";
import {
  hideCollapsedDescendants,
  partitionPinned,
  searchThreadsByTitle,
  sortByCreatedAtDescending,
  sortByThreadHierarchy,
  visibleInboxThreads,
} from "./inbox";

/**
 * The sidebar's scrolling list: recently working families with descendants beneath.
 *
 * The host owns the New-thread button and the search field above it, so this
 * ships neither. It filters by the `searchQuery` prop and adds workspace
 * controls that the host has no equivalent for.
 */
export function ThreadInbox({
  activeThreadId,
  onNavigate,
  searchQuery,
}: PluginThreadListProps) {
  const { status, threads, projects } = useSidebarThreads();
  const actions = useSidebarThreadActions();
  const lifecycle = useLifecycle(threads);
  const projectColors = useProjectColors();
  const workOrderThreadIds = useMemo(
    () => visibleInboxThreads(threads).map((thread) => thread.id),
    [threads],
  );
  const workOrder = useWorkOrder(workOrderThreadIds);
  const workspaces = useWorkspaces();
  const { values: settingsValues } = useSettings();
  const workingShimmer = parseWorkingShimmerVariant(
    settingsValues?.[WORKING_SHIMMER_SETTING_KEY],
  );
  const showCardDividers = parseBooleanSetting(
    settingsValues?.[CARD_DIVIDERS_SETTING_KEY],
    true,
  );
  const projectColorStripes = parseBooleanSetting(
    settingsValues?.[PROJECT_COLOR_STRIPES_SETTING_KEY],
    true,
  );
  const animateStatusIcons = parseBooleanSetting(
    settingsValues?.[STATUS_ICON_SHINE_SETTING_KEY],
    false,
  );
  const unreadTitleWeight = parseUnreadTitleWeight(
    settingsValues?.[UNREAD_TITLE_WEIGHT_SETTING_KEY],
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null,
  );
  const [workspaceMembershipError, setWorkspaceMembershipError] = useState<
    string | null
  >(null);
  // One clock for every card in a render, quantized to the minute so the
  // labels do not disagree and do not churn on unrelated re-renders.
  const [nowMinute, setNowMinute] = useState(() =>
    Math.floor(Date.now() / 60_000),
  );
  useEffect(() => {
    const timer = setInterval(
      () => setNowMinute(Math.floor(Date.now() / 60_000)),
      60_000,
    );
    return () => clearInterval(timer);
  }, []);
  const now = nowMinute * 60_000;
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [showSettled, setShowSettled] = useState(false);
  const [collapsedParentIds, setCollapsedParentIds] = useState<
    ReadonlySet<string>
  >(() => new Set());

  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  const activeWorkspace =
    workspaces.workspaces.find(
      (workspace) => workspace.id === activeWorkspaceId,
    ) ?? null;
  const previousActiveThreadId = useRef(activeThreadId);
  const newThreadBaseline = useRef(
    new Set(threads.map((thread) => thread.id)),
  );
  const newThreadWorkspaceId = useRef<string | null>(null);
  const pendingWorkspaceAssignments = useRef(
    new Map<string, { workspaceId: string; threadId: string }>(),
  );
  const workspaceAssignmentsInFlight = useRef(new Set<string>());
  const threadIdsKey = JSON.stringify(threads.map((thread) => thread.id));

  // The host owns New Thread. Capture the selected workspace while this client
  // is on that screen, then queue only the new active root from this client.
  useEffect(() => {
    const previous = previousActiveThreadId.current;
    previousActiveThreadId.current = activeThreadId;

    if (activeThreadId === null) {
      if (previous !== null) {
        newThreadBaseline.current = new Set(
          threads.map((thread) => thread.id),
        );
        setWorkspaceMembershipError(null);
      }
      newThreadWorkspaceId.current = activeWorkspace?.id ?? null;
      return;
    }

    const workspaceId = newThreadWorkspaceId.current;
    if (
      previous === null &&
      workspaceId !== null &&
      !newThreadBaseline.current.has(activeThreadId)
    ) {
      pendingWorkspaceAssignments.current.set(activeThreadId, {
        workspaceId,
        threadId: activeThreadId,
      });
    }
  }, [activeThreadId, activeWorkspace, threads]);

  useEffect(() => {
    if (status !== "ready") return;

    const workspaceById = new Map(
      workspaces.workspaces.map((workspace) => [workspace.id, workspace]),
    );
    const threadById = new Map(threads.map((thread) => [thread.id, thread]));
    const assignments = [
      ...pendingWorkspaceAssignments.current.values(),
    ].flatMap((assignment) => {
      const workspace = workspaceById.get(assignment.workspaceId);
      if (!workspace) {
        pendingWorkspaceAssignments.current.delete(assignment.threadId);
        return [];
      }
      const thread = threadById.get(assignment.threadId);
      if (!thread) return [];
      if (
        thread.parentThreadId !== null ||
        workspace.threadIds.includes(assignment.threadId)
      ) {
        pendingWorkspaceAssignments.current.delete(assignment.threadId);
        return [];
      }
      if (workspaceAssignmentsInFlight.current.has(assignment.threadId)) {
        return [];
      }
      return [{ ...assignment, projectId: thread.projectId }];
    });
    if (assignments.length === 0) return;

    setWorkspaceMembershipError(null);
    assignments.forEach((assignment) => {
      workspaceAssignmentsInFlight.current.add(assignment.threadId);
      void workspaces
        .addCreatedThread({
          workspaceId: assignment.workspaceId,
          projectId: assignment.projectId,
          threadId: assignment.threadId,
        })
        .then(() =>
          pendingWorkspaceAssignments.current.delete(assignment.threadId),
        )
        .catch(() =>
          setWorkspaceMembershipError("Could not add new thread to workspace."),
        )
        .finally(() =>
          workspaceAssignmentsInFlight.current.delete(assignment.threadId),
        );
    });
  }, [activeThreadId, status, threadIdsKey, threads, workspaces]);
  const workspaceThreadIds = useMemo(
    () => (activeWorkspace === null ? null : new Set(activeWorkspace.threadIds)),
    [activeWorkspace],
  );
  const hiddenWorkspaceThreadIds = useMemo(
    () =>
      new Set(
        workspaces.workspaces
          .filter((workspace) => workspace.hiddenFromAll)
          .flatMap((workspace) => workspace.threadIds),
      ),
    [workspaces.workspaces],
  );

  const { pinned, inbox, snoozed, settled } = useMemo(() => {
    const workspaceThreads =
      workspaceThreadIds === null
        ? visibleInboxThreads(threads).filter(
            (thread) => !hiddenWorkspaceThreadIds.has(thread.id),
          )
        : visibleInboxThreads(threads).filter((thread) =>
            workspaceThreadIds.has(thread.id),
          );
    const matched = searchThreadsByTitle(workspaceThreads, searchQuery);
    const active: typeof matched = [];
    const onSnoozeShelf: typeof matched = [];
    const onSettledShelf: typeof matched = [];
    for (const thread of matched) {
      const shelf = lifecycle.shelfFor(thread);
      if (shelf === "snoozed") onSnoozeShelf.push(thread);
      else if (shelf === "settled") onSettledShelf.push(thread);
      else active.push(thread);
    }
    const split = partitionPinned(active);
    return {
      pinned: sortByThreadHierarchy(split.pinned, workOrder),
      inbox: sortByThreadHierarchy(split.inbox, workOrder),
      // Soonest wake first: "what comes back next" is the shelf's question.
      snoozed: [...onSnoozeShelf].sort(
        (left, right) =>
          (lifecycle.wakeAtFor(left) ?? 0) - (lifecycle.wakeAtFor(right) ?? 0),
      ),
      settled: sortByCreatedAtDescending(onSettledShelf),
    };
  }, [
    lifecycle,
    hiddenWorkspaceThreadIds,
    searchQuery,
    threads,
    workOrder,
    workspaceThreadIds,
  ]);

  const displayedPinned = hideCollapsedDescendants(
    pinned,
    collapsedParentIds,
  );
  const displayedInbox = hideCollapsedDescendants(inbox, collapsedParentIds);
  const timedThreadIds = useMemo(
    () =>
      [...displayedPinned, ...displayedInbox]
        .filter(
          (thread) =>
            statusPresentation(thread.indicator, thread.indicatorLabel)
              ?.shortLabel === "Working",
        )
        .map((thread) => thread.id)
        .slice(0, 100),
    [displayedInbox, displayedPinned],
  );
  const turnStarts = useTurnStarts(timedThreadIds);
  const pinnedIds = new Set(pinned.map((thread) => thread.id));
  const inboxIds = new Set(inbox.map((thread) => thread.id));
  const pinnedChildCounts = directChildCounts(pinned);
  const inboxChildCounts = directChildCounts(inbox);

  const toggleChildren = (threadId: string) => {
    setCollapsedParentIds((current) => {
      const next = new Set(current);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };

  const showProjectAccent = projectColorStripes;
  let emptyThreadMessage = "No threads yet";
  if (searchQuery.trim()) emptyThreadMessage = "No threads found";
  else if (activeWorkspace !== null) {
    emptyThreadMessage = "No threads in this workspace";
  }

  const threadCardProps = (
    thread: PluginSidebarThread,
    visibleIds: ReadonlySet<string>,
    childCounts: ReadonlyMap<string, number>,
  ) => ({
    thread,
    projectName: projectNameById.get(thread.projectId) ?? null,
    projectAccent: projectColors.accentFor(thread.projectId),
    showProjectAccent,
    hasCustomProjectColor: projectColors.hasCustomColor(thread.projectId),
    onSetProjectColor: (hue: number) =>
      projectColors.setColor(thread.projectId, hue),
    onResetProjectColor: () => projectColors.resetColor(thread.projectId),
    isWorking: isWorking(thread),
    workingShimmer,
    animateStatusIcons,
    turnStartedAt: turnStarts.get(thread.id) ?? null,
    unreadTitleWeight,
    isActive: thread.id === activeThreadId,
    isChild:
      thread.parentThreadId !== null && visibleIds.has(thread.parentThreadId),
    childCount: childCounts.get(thread.id) ?? 0,
    childrenCollapsed: collapsedParentIds.has(thread.id),
    onToggleChildren: () => toggleChildren(thread.id),
    canPark: lifecycle.canPark(thread),
    onNavigate,
    onSettle: () => lifecycle.settle(thread.id),
    onSnooze: (until: number) => lifecycle.snooze(thread.id, until),
    workspaces,
    now,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceTabs
        activeWorkspaceId={activeWorkspace?.id ?? null}
        onActiveWorkspaceChange={setActiveWorkspaceId}
        projects={projects}
        threads={threads}
        workspaces={workspaces}
      />
      {workspaceMembershipError ? (
        <p role="alert" className="px-3 py-1 text-xs text-destructive-text">
          {workspaceMembershipError}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {status === "loading" ? null : status === "error" ? (
          <p
            role="status"
            className="px-2 py-6 text-center text-xs text-muted-foreground"
          >
            Could not load threads.
          </p>
        ) : pinned.length + inbox.length + snoozed.length + settled.length ===
          0 ? (
          <p
            role="status"
            className="px-2 py-6 text-center text-xs text-muted-foreground"
          >
            {emptyThreadMessage}
          </p>
        ) : (
          <>
            {pinned.length > 0 ? (
              <Shelf label="Pinned" showCardDividers={showCardDividers}>
                {displayedPinned.map((thread) => (
                  <ThreadCard
                    key={thread.id}
                    {...threadCardProps(
                      thread,
                      pinnedIds,
                      pinnedChildCounts,
                    )}
                  />
                ))}
              </Shelf>
            ) : null}
            {inbox.length > 0 ? (
              <Shelf
                label={pinned.length > 0 ? "Inbox" : null}
                showCardDividers={showCardDividers}
              >
                {displayedInbox.map((thread) => (
                  <ThreadCard
                    key={thread.id}
                    {...threadCardProps(thread, inboxIds, inboxChildCounts)}
                  />
                ))}
              </Shelf>
            ) : null}
            <ParkedShelf
              label="Snoozed"
              threads={snoozed}
              expanded={showSnoozed}
              onToggle={() => setShowSnoozed((open) => !open)}
              shelf="snoozed"
              showCardDividers={showCardDividers}
              animateStatusIcons={animateStatusIcons}
              activeThreadId={activeThreadId}
              lifecycle={lifecycle}
              projectNameById={projectNameById}
              projectColors={projectColors}
              workspaces={workspaces}
              onNavigate={onNavigate}
            />
            <ParkedShelf
              label="Settled"
              threads={settled}
              expanded={showSettled}
              onToggle={() => setShowSettled((open) => !open)}
              onArchiveAll={() => {
                const settledIds = new Set(settled.map((thread) => thread.id));
                settled
                  .filter(
                    (thread) =>
                      !thread.parentThreadId ||
                      !settledIds.has(thread.parentThreadId),
                  )
                  .forEach((thread) => actions.archive(thread.id));
              }}
              shelf="settled"
              showCardDividers={showCardDividers}
              animateStatusIcons={animateStatusIcons}
              activeThreadId={activeThreadId}
              lifecycle={lifecycle}
              projectNameById={projectNameById}
              projectColors={projectColors}
              workspaces={workspaces}
              onNavigate={onNavigate}
            />
          </>
        )}
      </div>
    </div>
  );
}

function directChildCounts(
  threads: readonly PluginSidebarThread[],
): ReadonlyMap<string, number> {
  const ids = new Set(threads.map((thread) => thread.id));
  const counts = new Map<string, number>();
  for (const thread of threads) {
    if (thread.parentThreadId && ids.has(thread.parentThreadId)) {
      counts.set(
        thread.parentThreadId,
        (counts.get(thread.parentThreadId) ?? 0) + 1,
      );
    }
  }
  return counts;
}

/**
 * A collapsed shelf of parked threads. The header stays while anything is
 * parked — the count is the whole footprint when collapsed — and the shelf
 * vanishes entirely at zero.
 */
function ParkedShelf({
  label,
  threads,
  expanded,
  onToggle,
  onArchiveAll,
  shelf,
  showCardDividers,
  animateStatusIcons,
  activeThreadId,
  lifecycle,
  projectNameById,
  projectColors,
  workspaces,
  onNavigate,
}: {
  label: string;
  threads: readonly PluginSidebarThread[];
  expanded: boolean;
  onToggle: () => void;
  onArchiveAll?: () => void;
  shelf: "snoozed" | "settled";
  showCardDividers: boolean;
  animateStatusIcons: boolean;
  activeThreadId: string | null;
  lifecycle: ReturnType<typeof useLifecycle>;
  projectNameById: ReadonlyMap<string, string>;
  projectColors: ReturnType<typeof useProjectColors>;
  workspaces: ReturnType<typeof useWorkspaces>;
  onNavigate: () => void;
}) {
  if (threads.length === 0) return null;
  const now = Date.now();
  const header = (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={`${expanded ? "Collapse" : "Expand"} ${label.toLowerCase()} threads`}
      className="mt-3 flex w-full items-center gap-2 px-2.5 pb-1 text-left"
    >
      <span className="text-2xs font-medium text-muted-foreground/70">
        {expanded ? label : `${label} (${threads.length})`}
      </span>
      <span className="h-px flex-1 bg-sidebar-border" />
      <span className={TRAILING_GLYPH_BOX_CLASS}>
        <Icon
          name="ChevronDown"
          className={cn(
            "size-3 text-muted-foreground/70 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </span>
    </button>
  );
  return (
    <section aria-label={label}>
      {onArchiveAll ? (
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>{header}</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Content
              aria-label="Settled actions"
              className="z-50 min-w-36 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
            >
              <ContextMenu.Item
                onSelect={onArchiveAll}
                className="cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                Archive all
              </ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ) : (
        header
      )}
      {expanded ? (
        <ul
          className={cn(
            "flex flex-col",
            showCardDividers && "divide-y divide-sidebar-border/50",
          )}
        >
          {threads.map((thread) => (
            <SlimRow
              key={thread.id}
              thread={thread}
              projectName={projectNameById.get(thread.projectId) ?? null}
              projectHue={projectColors.accentFor(thread.projectId).hue}
              hasCustomProjectColor={projectColors.hasCustomColor(
                thread.projectId,
              )}
              onSetProjectColor={(hue) =>
                projectColors.setColor(thread.projectId, hue)
              }
              onResetProjectColor={() =>
                projectColors.resetColor(thread.projectId)
              }
              workspaces={workspaces}
              isActive={thread.id === activeThreadId}
              shelf={shelf}
              wakeAt={lifecycle.wakeAtFor(thread)}
              now={now}
              animateStatusIcons={animateStatusIcons}
              onNavigate={onNavigate}
              onRestore={() =>
                shelf === "snoozed"
                  ? lifecycle.unsnooze(thread.id)
                  : lifecycle.unsettle(thread.id)
              }
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Shelf({
  label,
  showCardDividers,
  children,
}: {
  label: string | null;
  showCardDividers: boolean;
  children: React.ReactNode;
}) {
  return (
    // A named section is exposed as a landmark region; an unnamed one is not,
    // which is exactly right for the single unlabelled inbox list.
    <section {...(label ? { "aria-label": label } : {})}>
      {label ? (
        <h2 className={cn("flex items-center gap-2 px-2.5 pb-1 pt-3")}>
          <span className="text-2xs font-medium text-muted-foreground/70">
            {label}
          </span>
          <span className="h-px flex-1 bg-sidebar-border" />
        </h2>
      ) : null}
      <ul
        className={cn(
          "flex flex-col",
          showCardDividers && "divide-y divide-sidebar-border/50",
        )}
      >
        {children}
      </ul>
    </section>
  );
}
