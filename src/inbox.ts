import type { PluginSidebarThread } from "@get-bb/plugin-sdk";

/** Newest-first baseline order. Ties break on id for stable renders. */
export function sortByCreatedAtDescending<
  T extends { readonly id: string; readonly createdAt: number },
>(threads: readonly T[]): T[] {
  return [...threads].sort(
    (left, right) =>
      right.createdAt - left.createdAt || left.id.localeCompare(right.id),
  );
}

/**
 * Recently working families come first. A descendant bumps its whole ancestry,
 * while every descendant remains directly beneath its parent.
 */
export function sortByThreadHierarchy<
  T extends {
    readonly id: string;
    readonly parentThreadId: string | null;
    readonly createdAt: number;
  },
>(
  threads: readonly T[],
  workStartedAt: ReadonlyMap<string, number> = new Map(),
): T[] {
  const byId = new Map(threads.map((thread) => [thread.id, thread]));
  const ids = new Set(threads.map((thread) => thread.id));
  const children = new Map<string, T[]>();
  const roots: T[] = [];

  for (const thread of threads) {
    if (
      thread.parentThreadId &&
      thread.parentThreadId !== thread.id &&
      ids.has(thread.parentThreadId)
    ) {
      const siblings = children.get(thread.parentThreadId) ?? [];
      siblings.push(thread);
      children.set(thread.parentThreadId, siblings);
    } else {
      roots.push(thread);
    }
  }

  const familyStartedAt = new Map<string, number>();
  for (const [threadId, startedAt] of workStartedAt) {
    let thread = byId.get(threadId);
    const visited = new Set<string>();
    while (thread && !visited.has(thread.id)) {
      visited.add(thread.id);
      familyStartedAt.set(
        thread.id,
        Math.max(familyStartedAt.get(thread.id) ?? 0, startedAt),
      );
      thread = thread.parentThreadId
        ? byId.get(thread.parentThreadId)
        : undefined;
    }
  }

  const compareFamilies = (left: T, right: T): number => {
    const leftStartedAt = familyStartedAt.get(left.id);
    const rightStartedAt = familyStartedAt.get(right.id);
    if (leftStartedAt !== undefined || rightStartedAt !== undefined) {
      if (leftStartedAt === undefined) return 1;
      if (rightStartedAt === undefined) return -1;
      if (leftStartedAt !== rightStartedAt) {
        return rightStartedAt - leftStartedAt;
      }
    }
    return (
      right.createdAt - left.createdAt || left.id.localeCompare(right.id)
    );
  };

  for (const [parentId, siblings] of children) {
    children.set(parentId, [...siblings].sort(compareFamilies));
  }

  const result: T[] = [];
  const visited = new Set<string>();
  const appendFamily = (root: T) => {
    const stack = [root];
    while (stack.length > 0) {
      const thread = stack.pop()!;
      if (visited.has(thread.id)) continue;
      visited.add(thread.id);
      result.push(thread);
      stack.push(...[...(children.get(thread.id) ?? [])].reverse());
    }
  };

  [...roots].sort(compareFamilies).forEach(appendFamily);
  // Keep malformed cycles reachable rather than silently dropping rows.
  [...threads].sort(compareFamilies).forEach(appendFamily);
  return result;
}

export function hideCollapsedDescendants<
  T extends { readonly id: string; readonly parentThreadId: string | null },
>(threads: readonly T[], collapsedParentIds: ReadonlySet<string>): T[] {
  const byId = new Map(threads.map((thread) => [thread.id, thread]));
  return threads.filter((thread) => {
    const seen = new Set<string>();
    let parentId = thread.parentThreadId;
    while (parentId && !seen.has(parentId)) {
      const parent = byId.get(parentId);
      if (!parent) break;
      if (collapsedParentIds.has(parentId)) return false;
      seen.add(parentId);
      parentId = parent.parentThreadId;
    }
    return true;
  });
}

export function threadDisplayTitle(thread: PluginSidebarThread): string {
  const title = thread.title?.trim();
  if (title) return title;
  const fallback = thread.titleFallback?.trim();
  return fallback ? fallback : "Untitled thread";
}

/** Substring match on the visible title only, preserving the incoming order. */
export function searchThreadsByTitle(
  threads: readonly PluginSidebarThread[],
  query: string,
): PluginSidebarThread[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return [...threads];
  return threads.filter((thread) =>
    threadDisplayTitle(thread).toLowerCase().includes(normalized),
  );
}

/** Archived threads never belong in the inbox. */
export function visibleInboxThreads(
  threads: readonly PluginSidebarThread[],
): PluginSidebarThread[] {
  return threads.filter((thread) => !thread.isArchived);
}

/**
 * Keep every visible parent/child family on one shelf. If any family member is
 * pinned, the whole family belongs on the pinned shelf so hierarchy is intact.
 */
export function partitionPinned(threads: readonly PluginSidebarThread[]): {
  pinned: PluginSidebarThread[];
  inbox: PluginSidebarThread[];
} {
  const byId = new Map(threads.map((thread) => [thread.id, thread]));
  const neighbors = new Map(
    threads.map((thread) => [thread.id, [] as string[]]),
  );
  for (const thread of threads) {
    const parentId = thread.parentThreadId;
    if (!parentId || parentId === thread.id || !byId.has(parentId)) continue;
    neighbors.get(thread.id)!.push(parentId);
    neighbors.get(parentId)!.push(thread.id);
  }

  const pinnedIds = new Set<string>();
  const visited = new Set<string>();
  for (const thread of threads) {
    if (visited.has(thread.id)) continue;
    const family: string[] = [];
    const stack = [thread.id];
    let familyIsPinned = false;
    while (stack.length > 0) {
      const threadId = stack.pop()!;
      if (visited.has(threadId)) continue;
      visited.add(threadId);
      family.push(threadId);
      familyIsPinned ||= byId.get(threadId)?.isPinned === true;
      stack.push(...(neighbors.get(threadId) ?? []));
    }
    if (familyIsPinned) family.forEach((threadId) => pinnedIds.add(threadId));
  }

  const pinned: PluginSidebarThread[] = [];
  const inbox: PluginSidebarThread[] = [];
  for (const thread of threads) {
    (pinnedIds.has(thread.id) ? pinned : inbox).push(thread);
  }
  return { pinned, inbox };
}

/**
 * The parent of one thread, or null when the thread is a root, when the id is
 * unknown, or when the parent row is gone (deleted). The parent may be
 * archived or in another project, so the header remains a useful way back.
 */
export function parentOf(
  threads: readonly PluginSidebarThread[],
  threadId: string,
): PluginSidebarThread | null {
  const thread = threads.find((candidate) => candidate.id === threadId);
  const parentThreadId = thread?.parentThreadId;
  if (!parentThreadId) return null;
  return threads.find((candidate) => candidate.id === parentThreadId) ?? null;
}

/** The children of one thread, oldest first (the order they were spawned). */
export function childrenOf(
  threads: readonly PluginSidebarThread[],
  parentThreadId: string,
): PluginSidebarThread[] {
  return threads
    .filter((thread) => thread.parentThreadId === parentThreadId)
    .sort((left, right) => left.createdAt - right.createdAt);
}
