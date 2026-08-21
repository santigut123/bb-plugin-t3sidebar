import { useEffect, useMemo, useState } from "react";
import {
  experimental_useSidebarThreadActions as useSidebarThreadActions,
  experimental_useSidebarThreads as useSidebarThreads,
  useSettings,
  type PluginSidebarThread,
  type PluginThreadListProps,
} from "@get-bb/plugin-sdk/app";
import { Icon } from "./components/Icon";
import { cn } from "./lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/Select";
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
import {
  filterByProject,
  partitionPinned,
  searchThreadsByTitle,
  sortByCreatedAtDescending,
  sortByThreadHierarchy,
  visibleInboxThreads,
} from "./inbox";

const ALL_PROJECTS = "__all__";

/**
 * The sidebar's scrolling list: stable root cards with descendants beneath.
 *
 * The host owns the New-thread button and the search field above it, so this
 * ships neither. It filters by the `searchQuery` prop and keeps only the one
 * control the host has no equivalent for: the project scope picker.
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
  const [scope, setScope] = useState<string>(ALL_PROJECTS);
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

  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  const { pinned, inbox, snoozed, settled } = useMemo(() => {
    const scoped = filterByProject(
      visibleInboxThreads(threads),
      scope === ALL_PROJECTS ? null : scope,
    );
    const matched = searchThreadsByTitle(scoped, searchQuery);
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
      pinned: sortByThreadHierarchy(split.pinned),
      inbox: sortByThreadHierarchy(split.inbox),
      // Soonest wake first: "what comes back next" is the shelf's question.
      snoozed: [...onSnoozeShelf].sort(
        (left, right) =>
          (lifecycle.wakeAtFor(left) ?? 0) - (lifecycle.wakeAtFor(right) ?? 0),
      ),
      settled: sortByCreatedAtDescending(onSettledShelf),
    };
  }, [lifecycle, scope, searchQuery, threads]);

  const timedThreadIds = useMemo(
    () =>
      [...pinned, ...inbox]
        .filter(
          (thread) =>
            statusPresentation(thread.indicator, thread.indicatorLabel)
              ?.shortLabel === "Working",
        )
        .map((thread) => thread.id)
        .slice(0, 100),
    [inbox, pinned],
  );
  const turnStarts = useTurnStarts(timedThreadIds);
  const pinnedIds = new Set(pinned.map((thread) => thread.id));
  const inboxIds = new Set(inbox.map((thread) => thread.id));

  const scopeLabel =
    scope === ALL_PROJECTS
      ? "All projects"
      : (projectNameById.get(scope) ?? "All projects");
  const showProjectAccent =
    projectColorStripes && scope === ALL_PROJECTS;

  const threadCardProps = (
    thread: PluginSidebarThread,
    visibleIds: ReadonlySet<string>,
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
    canPark: lifecycle.canPark(thread),
    onNavigate,
    onSettle: () => lifecycle.settle(thread.id),
    onSnooze: (until: number) => lifecycle.snooze(thread.id, until),
    now,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The one control the host has no equivalent for. Everything else in
          the chrome above — New thread, search — is bb's and stays bb's. */}
      <div className="flex shrink-0 items-center gap-1 px-2 pb-1">
        <Select value={scope} onValueChange={setScope}>
          {/* Ghost trigger: no border, no filled track — it reads as a label
              until you hover it. */}
          <SelectTrigger
            className="h-7 min-w-0 flex-1 border-0 px-1.5 py-1 text-xs font-medium text-muted-foreground shadow-none hover:bg-sidebar-accent focus:ring-0"
            aria-label={`Project scope: ${scopeLabel}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PROJECTS} className="text-xs">
              All projects
            </SelectItem>
            {projects.map((project) => (
              <SelectItem
                key={project.id}
                value={project.id}
                className="text-xs"
              >
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
            {searchQuery.trim() ? "No threads found" : "No threads yet"}
          </p>
        ) : (
          <>
            {pinned.length > 0 ? (
              <Shelf label="Pinned" showCardDividers={showCardDividers}>
                {pinned.map((thread) => (
                  <ThreadCard
                    key={thread.id}
                    {...threadCardProps(thread, pinnedIds)}
                  />
                ))}
              </Shelf>
            ) : null}
            {inbox.length > 0 ? (
              <Shelf
                label={pinned.length > 0 ? "Inbox" : null}
                showCardDividers={showCardDividers}
              >
                {inbox.map((thread) => (
                  <ThreadCard
                    key={thread.id}
                    {...threadCardProps(thread, inboxIds)}
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
              onNavigate={onNavigate}
            />
            <ParkedShelf
              label="Settled"
              threads={settled}
              expanded={showSettled}
              onToggle={() => setShowSettled((open) => !open)}
              shelf="settled"
              showCardDividers={showCardDividers}
              animateStatusIcons={animateStatusIcons}
              activeThreadId={activeThreadId}
              lifecycle={lifecycle}
              projectNameById={projectNameById}
              projectColors={projectColors}
              onNavigate={onNavigate}
            />
          </>
        )}
      </div>
    </div>
  );
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
  shelf,
  showCardDividers,
  animateStatusIcons,
  activeThreadId,
  lifecycle,
  projectNameById,
  projectColors,
  onNavigate,
}: {
  label: string;
  threads: readonly PluginSidebarThread[];
  expanded: boolean;
  onToggle: () => void;
  shelf: "snoozed" | "settled";
  showCardDividers: boolean;
  animateStatusIcons: boolean;
  activeThreadId: string | null;
  lifecycle: ReturnType<typeof useLifecycle>;
  projectNameById: ReadonlyMap<string, string>;
  projectColors: ReturnType<typeof useProjectColors>;
  onNavigate: () => void;
}) {
  if (threads.length === 0) return null;
  const now = Date.now();
  return (
    <section aria-label={label}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        // Padded like a card, so the chevron ends on the same right edge as
        // every row's status and provider glyph.
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
