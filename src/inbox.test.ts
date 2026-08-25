import { describe, expect, it } from "vitest";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk";
import {
  childrenOf,
  hideCollapsedDescendants,
  parentOf,
  partitionPinned,
  searchThreadsByTitle,
  sortByCreatedAtDescending,
  sortByThreadHierarchy,
  threadDisplayTitle,
  visibleInboxThreads,
} from "./inbox";

function thread(
  overrides: Partial<PluginSidebarThread> = {},
): PluginSidebarThread {
  return {
    id: "thr_1",
    projectId: "proj_1",
    title: "A thread",
    titleFallback: null,
    parentThreadId: null,
    sectionId: null,
    originKind: null,
    originPluginId: null,
    providerId: "codex",
    hasPendingInteraction: false,
    activity: {
      workflows: 0,
      backgroundAgents: 0,
      backgroundCommands: 0,
      planMode: 0,
      goals: 0,
    },
    indicator: "none",
    indicatorLabel: null,
    isUnread: false,
    isPinned: false,
    isArchived: false,
    environment: null,
    host: null,
    createdAt: 100,
    updatedAt: 100,
    lastReadAt: 100,
    latestAttentionAt: 100,
    ...overrides,
  };
}

describe("sortByCreatedAtDescending", () => {
  it("puts the newest thread first", () => {
    const ordered = sortByCreatedAtDescending([
      thread({ id: "a", createdAt: 1 }),
      thread({ id: "b", createdAt: 3 }),
      thread({ id: "c", createdAt: 2 }),
    ]);
    expect(ordered.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  // The whole premise: activity must never move a row. Only createdAt is read,
  // so a thread that just did work keeps its place.
  it("ignores activity and update time", () => {
    const before = [
      thread({ id: "a", createdAt: 2, updatedAt: 1 }),
      thread({ id: "b", createdAt: 1, updatedAt: 999, indicator: "runtime" }),
    ];
    expect(sortByCreatedAtDescending(before).map((t) => t.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("breaks ties on id so the order is stable", () => {
    const ordered = sortByCreatedAtDescending([
      thread({ id: "b", createdAt: 5 }),
      thread({ id: "a", createdAt: 5 }),
    ]);
    expect(ordered.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("does not mutate its input", () => {
    const input = [
      thread({ id: "a", createdAt: 1 }),
      thread({ id: "b", createdAt: 2 }),
    ];
    sortByCreatedAtDescending(input);
    expect(input.map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("threadDisplayTitle", () => {
  it("prefers the title, then the fallback, then a placeholder", () => {
    expect(threadDisplayTitle(thread({ title: "Real" }))).toBe("Real");
    expect(
      threadDisplayTitle(thread({ title: null, titleFallback: "Fallback" })),
    ).toBe("Fallback");
    expect(
      threadDisplayTitle(thread({ title: null, titleFallback: null })),
    ).toBe("Untitled thread");
  });

  it("treats a whitespace-only title as absent", () => {
    expect(
      threadDisplayTitle(thread({ title: "   ", titleFallback: "Fallback" })),
    ).toBe("Fallback");
  });
});

describe("searchThreadsByTitle", () => {
  it("matches case-insensitively on the visible title", () => {
    const threads = [
      thread({ id: "a", title: "Sidebar work" }),
      thread({ id: "b", title: "Something else" }),
      thread({ id: "c", title: null, titleFallback: "sidebar fallback" }),
    ];
    expect(searchThreadsByTitle(threads, "SIDEBAR").map((t) => t.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("returns everything for a blank query", () => {
    const threads = [thread({ id: "a" }), thread({ id: "b" })];
    expect(searchThreadsByTitle(threads, "   ")).toHaveLength(2);
  });
});

describe("filtering", () => {
  it("drops archived threads", () => {
    const threads = [
      thread({ id: "a" }),
      thread({ id: "b", isArchived: true }),
    ];
    expect(visibleInboxThreads(threads).map((t) => t.id)).toEqual(["a"]);
  });

  it("splits pinned from the rest, keeping order", () => {
    const { pinned, inbox } = partitionPinned([
      thread({ id: "a" }),
      thread({ id: "b", isPinned: true }),
      thread({ id: "c" }),
    ]);
    expect(pinned.map((t) => t.id)).toEqual(["b"]);
    expect(inbox.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("keeps a pinned parent and its unpinned descendants together", () => {
    const { pinned, inbox } = partitionPinned([
      thread({ id: "parent", isPinned: true }),
      thread({ id: "child", parentThreadId: "parent" }),
      thread({ id: "unrelated" }),
    ]);

    expect(pinned.map((item) => item.id)).toEqual(["parent", "child"]);
    expect(inbox.map((item) => item.id)).toEqual(["unrelated"]);
  });

  it("promotes a whole family when a descendant is pinned", () => {
    const { pinned, inbox } = partitionPinned([
      thread({ id: "parent" }),
      thread({ id: "pinned-child", parentThreadId: "parent", isPinned: true }),
      thread({ id: "sibling", parentThreadId: "parent" }),
      thread({ id: "unrelated" }),
    ]);

    expect(pinned.map((item) => item.id)).toEqual([
      "parent",
      "pinned-child",
      "sibling",
    ]);
    expect(inbox.map((item) => item.id)).toEqual(["unrelated"]);
  });
});

describe("child threads", () => {
  it("bumps the most recently working family while keeping its hierarchy", () => {
    const ordered = sortByThreadHierarchy(
      [
        thread({ id: "parent", createdAt: 1 }),
        thread({ id: "older-child", parentThreadId: "parent", createdAt: 2 }),
        thread({ id: "working-child", parentThreadId: "parent", createdAt: 3 }),
        thread({ id: "newer-root", createdAt: 10 }),
      ],
      new Map([
        ["working-child", 50],
        ["newer-root", 40],
      ]),
    );

    expect(ordered.map((item) => item.id)).toEqual([
      "parent",
      "working-child",
      "older-child",
      "newer-root",
    ]);
  });

  it("places descendants directly after their parent", () => {
    expect(
      sortByThreadHierarchy([
        thread({ id: "parent", createdAt: 1 }),
        thread({ id: "child", parentThreadId: "parent", createdAt: 3 }),
        thread({ id: "other", createdAt: 2 }),
        thread({ id: "grandchild", parentThreadId: "child", createdAt: 4 }),
      ]).map((item) => item.id),
    ).toEqual(["other", "parent", "child", "grandchild"]);
  });

  it("keeps an orphan in the root creation order", () => {
    expect(
      sortByThreadHierarchy([
        thread({ id: "older", createdAt: 1 }),
        thread({ id: "orphan", parentThreadId: "missing", createdAt: 2 }),
      ]).map((item) => item.id),
    ).toEqual(["orphan", "older"]);
  });

  it("hides every descendant of a collapsed parent", () => {
    expect(
      hideCollapsedDescendants(
        [
          thread({ id: "parent" }),
          thread({ id: "child", parentThreadId: "parent" }),
          thread({ id: "grandchild", parentThreadId: "child" }),
          thread({ id: "other" }),
        ],
        new Set(["parent"]),
      ).map((item) => item.id),
    ).toEqual(["parent", "other"]);
  });

  it("lists a thread's children oldest first", () => {
    const children = childrenOf(
      [
        thread({ id: "parent" }),
        thread({ id: "b", parentThreadId: "parent", createdAt: 20 }),
        thread({ id: "a", parentThreadId: "parent", createdAt: 10 }),
        thread({ id: "other", parentThreadId: "elsewhere" }),
      ],
      "parent",
    );
    expect(children.map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("parentOf", () => {
  // An archived parent is absent from the inbox but remains reachable from
  // the child's header.
  it("finds a parent the inbox filters out", () => {
    const parent = parentOf(
      [
        thread({ id: "parent", isArchived: true, projectId: "other" }),
        thread({ id: "child", parentThreadId: "parent" }),
      ],
      "child",
    );
    expect(parent?.id).toBe("parent");
  });

  it("returns null for a root thread", () => {
    expect(parentOf([thread({ id: "root" })], "root")).toBeNull();
  });

  it("returns null when the parent row is gone", () => {
    const threads = [thread({ id: "child", parentThreadId: "deleted" })];
    expect(parentOf(threads, "child")).toBeNull();
  });
});
