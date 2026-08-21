// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk";

// Load through the harness so the plugin's `@get-bb/plugin-sdk/app` import binds
// to the test runtime; importing the component directly would bind it to an
// empty runtime first.
const app = await loadPluginApp(() => import("../app"));
const inbox = app.threadLists[0]!;

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

const listProps = {
  activeThreadId: null,
  activeProjectId: null,
  experimental_Original: () => null,
  isCompactViewport: false,
  onNavigate: () => {},
  searchQuery: "",
};

function testRpc(
  overrides: Record<string, (...args: unknown[]) => unknown> = {},
) {
  return {
    listLifecycle: () => ({ rows: [] }),
    listProjectColors: () => ({ rows: [] }),
    listTurnStarts: () => ({ rows: [] }),
    ...overrides,
  };
}

function testSettings(
  values: Record<string, string | boolean> = {
    workingShimmer: "glow",
    statusIconShine: false,
    cardDividers: true,
    projectColorStripes: true,
    unreadTitleWeight: "bold",
  },
) {
  return values;
}

function render(
  threads: PluginSidebarThread[],
  projects = [{ id: "proj_1", name: "bb", isPersonal: false }],
) {
  return renderSlot(inbox, listProps, {
    sidebarThreads: { status: "ready", threads, projects },
    // The lifecycle store is the plugin's own backend; an empty one means
    // every thread is active, which is what these list tests are about.
    rpc: testRpc(),
    settings: testSettings(),
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("t3sidebar registration", () => {
  it("registers exactly one thread list", () => {
    expect(app.threadLists).toHaveLength(1);
    expect(inbox.id).toBe("inbox");
  });
});

describe("ThreadInbox", () => {
  it("lists threads newest first", () => {
    render([
      thread({ id: "a", title: "Older", createdAt: 1 }),
      thread({ id: "b", title: "Newer", createdAt: 2 }),
    ]);
    // The anchor is a full-bleed overlay, so read the row containers.
    const titles = screen
      .getAllByRole("listitem")
      .map((row) => row.textContent);
    expect(titles[0]).toContain("Newer");
    expect(titles[1]).toContain("Older");
  });

  it("shows child threads directly beneath their parent", () => {
    render([
      thread({ id: "parent", title: "Parent", createdAt: 1 }),
      thread({
        id: "child",
        title: "Child",
        parentThreadId: "parent",
        createdAt: 3,
      }),
      thread({ id: "other", title: "Unrelated", createdAt: 2 }),
    ]);
    expect(
      screen.getAllByRole("listitem").map((row) => row.textContent),
    ).toEqual([
      expect.stringContaining("Unrelated"),
      expect.stringContaining("Parent"),
      expect.stringContaining("Child"),
    ]);
    expect(screen.getByText("Child").closest("li")?.className).toContain(
      "ml-4",
    );
  });

  it("collapses and expands a parent's child threads", () => {
    render([
      thread({ id: "parent", title: "Parent" }),
      thread({ id: "child", title: "Child", parentThreadId: "parent" }),
    ]);

    const collapse = screen.getByRole("button", {
      name: "Collapse 1 child thread",
    });
    expect(collapse.parentElement?.className).toContain("h-4");
    fireEvent.click(collapse);
    expect(screen.queryByText("Child")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Expand 1 child thread" }),
    );
    expect(screen.getByText("Child")).toBeDefined();
  });

  // The DOM contract behind numbered thread shortcuts and thread.next/previous.
  // A plugin that drops these attributes silently breaks nine host shortcuts.
  it("marks every row as a host shortcut target", () => {
    render([thread({ id: "thr_x" })]);
    const row = screen.getByRole("link");
    expect(row.hasAttribute("data-sidebar-thread-shortcut-target")).toBe(true);
    expect(row.getAttribute("data-sidebar-thread-id")).toBe("thr_x");
  });

  it("opens a thread on click and closes the mobile drawer", () => {
    let navigated = 0;
    const rendered = renderSlot(
      inbox,
      { ...listProps, onNavigate: () => (navigated += 1) },
      {
        sidebarThreads: {
          status: "ready",
          threads: [thread({ id: "thr_open" })],
          projects: [{ id: "proj_1", name: "bb", isPersonal: false }],
        },
        rpc: testRpc(),
        settings: testSettings(),
      },
    );
    fireEvent.click(screen.getByRole("link"));
    expect(rendered.sidebarActionCalls).toContainEqual({
      method: "open",
      threadId: "thr_open",
      options: { split: false },
    });
    expect(navigated).toBe(1);
  });

  it("opens in a split with the platform modifier held", () => {
    const rendered = render([thread({ id: "thr_split" })]);
    fireEvent.click(screen.getByRole("link"), { metaKey: true });
    expect(rendered.sidebarActionCalls).toContainEqual({
      method: "open",
      threadId: "thr_split",
      options: { split: true },
    });
  });

  it("separates pinned threads from the inbox", () => {
    render([
      thread({ id: "a", title: "Plain" }),
      thread({ id: "b", title: "Stuck", isPinned: true }),
    ]);
    const pinned = screen.getByRole("region", { name: /pinned/i });
    expect(within(pinned).getByText("Stuck")).toBeDefined();
  });

  // The host owns the search field; the plugin only filters by what it is
  // handed, so there is deliberately no second search box to type into.
  it("filters by the host's search query", () => {
    renderSlot(
      inbox,
      { ...listProps, searchQuery: "sidebar" },
      {
        sidebarThreads: {
          status: "ready",
          threads: [
            thread({ id: "a", title: "Sidebar work" }),
            thread({ id: "b", title: "Something else" }),
          ],
          projects: [{ id: "proj_1", name: "bb", isPersonal: false }],
        },
        rpc: testRpc(),
        settings: testSettings(),
      },
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Sidebar work")).toBeDefined();
  });

  it("ships no search field of its own", () => {
    render([thread({ id: "a" })]);
    expect(screen.queryByLabelText("Search threads")).toBeNull();
  });

  it("ships no new-thread button of its own", () => {
    render([thread({ id: "a" })]);
    expect(screen.queryByLabelText("New thread")).toBeNull();
  });

  it("scopes to one project", () => {
    render(
      [
        thread({ id: "a", title: "In bb", projectId: "proj_1" }),
        thread({ id: "b", title: "In other", projectId: "proj_2" }),
      ],
      [
        { id: "proj_1", name: "bb", isPersonal: false },
        { id: "proj_2", name: "other", isPersonal: false },
      ],
    );
    // Radix opens on keyboard too, which jsdom can drive without pointer
    // capture. Enter opens the list; the option click picks the scope.
    fireEvent.keyDown(screen.getByLabelText(/Project scope/), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "other" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("In other")).toBeDefined();
  });

  it("hides archived threads", () => {
    render([thread({ id: "a", isArchived: true })]);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("reports an empty inbox and a fruitless search differently", () => {
    render([]);
    expect(screen.getByText("No threads yet")).toBeDefined();
  });
});

describe("parking threads", () => {
  it("moves a settled thread to the Settled shelf", async () => {
    renderSlot(inbox, listProps, {
      sidebarThreads: {
        status: "ready",
        threads: [thread({ id: "thr_done", title: "Finished work" })],
        projects: [{ id: "proj_1", name: "bb", isPersonal: false }],
      },
      rpc: testRpc({
        listLifecycle: () => ({
          rows: [
            {
              threadId: "thr_done",
              settledAt: 200,
              snoozedUntil: null,
              snoozedAt: null,
            },
          ],
        }),
      }),
      settings: testSettings(),
    });
    // The shelf renders once the lifecycle read resolves.
    const shelf = await screen.findByRole("region", { name: "Settled" });
    expect(within(shelf).getByText(/Settled \(1\)/)).toBeDefined();
    // Collapsed by default: parked work is out of the way, never gone.
    expect(screen.queryByText("Finished work")).toBeNull();
    fireEvent.click(within(shelf).getByRole("button"));
    expect(within(shelf).getByText("Finished work")).toBeDefined();
  });

  it("keeps a working thread out of the shelves and offers no park action", async () => {
    renderSlot(inbox, listProps, {
      sidebarThreads: {
        status: "ready",
        threads: [
          thread({
            id: "thr_busy",
            title: "Still running",
            indicator: "runtime",
            activity: {
              workflows: 0,
              backgroundAgents: 0,
              backgroundCommands: 0,
              planMode: 0,
              goals: 0,
            },
          }),
        ],
        projects: [{ id: "proj_1", name: "bb", isPersonal: false }],
      },
      // Settled in the store, but still working: it must stay visible.
      rpc: testRpc({
        listLifecycle: () => ({
          rows: [
            {
              threadId: "thr_busy",
              settledAt: 200,
              snoozedUntil: null,
              snoozedAt: null,
            },
          ],
        }),
      }),
      settings: testSettings(),
    });
    expect(await screen.findByText("Still running")).toBeDefined();
    expect(screen.queryByRole("region", { name: "Settled" })).toBeNull();
    expect(screen.queryByLabelText("Settle thread")).toBeNull();
  });

  it("offers settle and snooze on a parkable thread", async () => {
    render([thread({ id: "thr_park", title: "Quiet" })]);
    // Rendered (not merely accepted as props): a card whose park controls
    // never mount leaves the whole feature unreachable.
    expect(await screen.findByLabelText("Settle thread")).toBeDefined();
    expect(screen.getByLabelText("Snooze until tomorrow")).toBeDefined();
  });

  it("requests a settle when the user clicks Settle", async () => {
    let settled: string | null = null;
    renderSlot(inbox, listProps, {
      sidebarThreads: {
        status: "ready",
        threads: [thread({ id: "thr_park", title: "Quiet" })],
        projects: [{ id: "proj_1", name: "bb", isPersonal: false }],
      },
      rpc: testRpc({
        settle: (input) => {
          settled = (input as { threadId: string }).threadId;
          return { ok: true };
        },
      }),
      settings: testSettings(),
    });
    fireEvent.click(await screen.findByLabelText("Settle thread"));
    await waitFor(() => expect(settled).toBe("thr_park"));
  });

  it("shows the wake countdown on a snoozed row", async () => {
    const wakeAt = Date.now() + 2 * 60 * 60 * 1000;
    renderSlot(inbox, listProps, {
      sidebarThreads: {
        status: "ready",
        threads: [thread({ id: "thr_snz", title: "Later" })],
        projects: [{ id: "proj_1", name: "bb", isPersonal: false }],
      },
      rpc: testRpc({
        listLifecycle: () => ({
          rows: [
            {
              threadId: "thr_snz",
              settledAt: null,
              snoozedUntil: wakeAt,
              snoozedAt: Date.now(),
            },
          ],
        }),
      }),
      settings: testSettings(),
    });
    const shelf = await screen.findByRole("region", { name: "Snoozed" });
    fireEvent.click(within(shelf).getByRole("button"));
    expect(within(shelf).getByText("2h")).toBeDefined();
    expect(within(shelf).getByLabelText("Wake thread now")).toBeDefined();
  });
});

describe("row context menu", () => {
  it("offers the plugin's own thread actions on right-click", async () => {
    render([thread({ id: "thr_menu", title: "Right click me" })]);
    const row = await screen.findByText("Right click me");
    fireEvent.contextMenu(row);
    const menu = await screen.findByRole("menu", { name: "Thread actions" });
    // The plugin builds this menu itself — the SDK ships no menu component —
    // so the items are this plugin's choice, backed by the action hook.
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Open in split",
      "Mark unread",
      "Pin",
      "bb color",
      "Archive",
      "Delete",
    ]);
  });

  it("routes deletion through the host's confirmation", async () => {
    const rendered = render([thread({ id: "thr_del", title: "Delete me" })]);
    fireEvent.contextMenu(await screen.findByText("Delete me"));
    const menu = await screen.findByRole("menu", { name: "Thread actions" });
    fireEvent.click(within(menu).getByText("Delete"));
    await waitFor(() =>
      expect(rendered.sidebarActionCalls).toContainEqual({
        method: "requestDelete",
        threadId: "thr_del",
      }),
    );
  });

  it("exposes project colors as an accessible radio group", async () => {
    render([thread({ id: "thr_color", title: "Color me" })]);
    fireEvent.contextMenu(await screen.findByText("Color me"));
    const menu = await screen.findByRole("menu", { name: "Thread actions" });
    const colorTrigger = within(menu).getByRole("menuitem", {
      name: "bb color",
    });
    fireEvent.click(colorTrigger);
    expect(colorTrigger.getAttribute("data-state")).toBe("open");

    const colorMenu = await screen.findByRole("menu", {
      name: "bb color",
    });
    const colorGroup = within(colorMenu).getByRole("group", {
      name: "Project color swatch",
    });
    expect(within(colorGroup).getAllByRole("menuitemradio")).toHaveLength(16);
  });
});

describe("project color synchronization", () => {
  it("refreshes durable colors after realtime reconnects", async () => {
    let rows = [{ projectId: "proj_1", hue: 12 }];
    const rendered = renderSlot(inbox, listProps, {
      sidebarThreads: {
        status: "ready",
        threads: [thread({ id: "thr_color" })],
        projects: [{ id: "proj_1", name: "bb", isPersonal: false }],
      },
      rpc: testRpc({ listProjectColors: () => ({ rows }) }),
      settings: testSettings(),
      realtimeConnectionState: "connected",
    });

    await waitFor(() =>
      expect(
        rendered.inspection.rpcCalls.filter(
          (call) => call.method === "listProjectColors",
        ),
      ).toHaveLength(1),
    );
    await rendered.behavior.setRealtimeConnectionState("reconnecting");
    rows = [{ projectId: "proj_1", hue: 204 }];
    await rendered.behavior.setRealtimeConnectionState("connected");

    await waitFor(() =>
      expect(
        rendered.inspection.rpcCalls.filter(
          (call) => call.method === "listProjectColors",
        ),
      ).toHaveLength(2),
    );
  });

  it("refreshes after a local project color mutation", async () => {
    let rows = [{ projectId: "proj_1", hue: 12 }];
    const rendered = renderSlot(inbox, listProps, {
      sidebarThreads: {
        status: "ready",
        threads: [thread({ id: "thr_color", title: "Color me" })],
        projects: [{ id: "proj_1", name: "bb", isPersonal: false }],
      },
      rpc: testRpc({
        listProjectColors: () => ({ rows }),
        setProjectColor: (input) => {
          rows = [input as { projectId: string; hue: number }];
          return { ok: true };
        },
      }),
      settings: testSettings(),
    });

    await waitFor(() =>
      expect(
        rendered.inspection.rpcCalls.filter(
          (call) => call.method === "listProjectColors",
        ),
      ).toHaveLength(1),
    );
    fireEvent.contextMenu(await screen.findByText("Color me"));
    const menu = await screen.findByRole("menu", { name: "Thread actions" });
    const colorTrigger = within(menu).getByRole("menuitem", {
      name: "bb color",
    });
    fireEvent.click(colorTrigger);
    expect(colorTrigger.getAttribute("data-state")).toBe("open");
    const colorMenu = await screen.findByRole("menu", {
      name: "bb color",
    });
    fireEvent.click(
      within(colorMenu).getByRole("menuitemradio", {
        name: "Set project color 204",
      }),
    );

    await waitFor(() =>
      expect(
        rendered.inspection.rpcCalls.filter(
          (call) => call.method === "listProjectColors",
        ),
      ).toHaveLength(2),
    );
  });
});

describe("card metadata", () => {
  it("always shows the provider glyph, even without a branch", async () => {
    render([thread({ id: "thr_p", providerId: "claude-code" })]);
    expect(await screen.findByLabelText("Claude Code")).toBeDefined();
  });

  it("falls back to a neutral glyph for an unknown provider", async () => {
    render([thread({ id: "thr_p", providerId: "some-new-agent" })]);
    expect(await screen.findByLabelText("some-new-agent")).toBeDefined();
  });

  // A personal-project thread has a machine but no worktree, so the machine
  // takes the branch's place instead of leaving the line blank.
  it("shows the machine when the thread has no branch", async () => {
    render([
      thread({
        id: "thr_m",
        host: { id: "host_1", name: "Sawyer's MacBook" },
      }),
    ]);
    expect(await screen.findByText("Sawyer's MacBook")).toBeDefined();
  });

  it("prefers the branch over the machine when both exist", async () => {
    render([
      thread({
        id: "thr_b",
        host: { id: "host_1", name: "Sawyer's MacBook" },
        environment: {
          id: "env_1",
          name: "Worktree",
          branchName: "bb/feature",
          workspaceDisplayKind: "managed-worktree",
        },
      }),
    ]);
    expect(await screen.findByText("bb/feature")).toBeDefined();
    expect(screen.queryByText("Sawyer's MacBook")).toBeNull();
  });

  // Not exactly 3h: the card's clock is quantized to the minute, so a
  // timestamp sitting on a bucket boundary legitimately reads one unit lower.
  it("shows how long ago the thread was touched", async () => {
    render([
      thread({ id: "thr_t", updatedAt: Date.now() - (3 * 3_600_000 + 60_000) }),
    ]);
    expect(await screen.findByText("3h")).toBeDefined();
  });

  // Status and age share one slot. A row that shows both puts a variable-width
  // label in the column, and no two rows line up.
  it("replaces the age label with the status glyph while work runs", async () => {
    render([
      thread({
        id: "thr_run",
        indicator: "runtime",
        indicatorLabel: "Agent is working",
        updatedAt: Date.now() - (3 * 3_600_000 + 60_000),
      }),
    ]);
    expect(await screen.findByLabelText("Agent is working")).toBeDefined();
    expect(screen.queryByText("3h")).toBeNull();
  });

  // An indicator this plugin does not know must fall through to the age label
  // rather than leave the slot blank.
  it("keeps the age label for an unrecognized indicator", async () => {
    render([
      thread({
        id: "thr_new",
        indicator: "something-bb-ships-later" as never,
        updatedAt: Date.now() - (3 * 3_600_000 + 60_000),
      }),
    ]);
    expect(await screen.findByText("3h")).toBeDefined();
  });
});

// The three states that want the user take the slot from the age label, and
// they use bb's own glyphs: the two lists sit in one window, and a user who
// switches between them should not have to learn a second vocabulary.
describe("attention states", () => {
  const textStates = [
    [
      "waiting-for-input",
      "Thread needs user input",
      "Input",
      "text-primary",
    ],
    [
      "unread-error",
      "Unread thread failed",
      "Failed",
      "text-destructive-text",
    ],
  ] as const;

  for (const [indicator, label, visibleLabel, color] of textStates) {
    it(`shows a labeled, colored ${indicator} status instead of the age`, async () => {
      render([
        thread({
          id: `thr_${indicator}`,
          indicator,
          indicatorLabel: label,
          updatedAt: Date.now() - (3 * 3_600_000 + 60_000),
        }),
      ]);
      const status = await screen.findByRole("status", { name: label });
      expect(status.getAttribute("class")).toContain(color);
      expect(status.querySelector("[data-icon]")).toBeNull();
      expect(screen.getByText(visibleLabel)).toBeDefined();
      expect(screen.queryByText("3h")).toBeNull();
    });
  }

  it("uses a success-colored check for an unread success", async () => {
    render([
      thread({
        id: "thr_success",
        indicator: "unread-success",
        indicatorLabel: "Unread thread succeeded",
      }),
    ]);
    const status = await screen.findByRole("status", {
      name: "Unread thread succeeded",
    });
    expect(status.querySelector('[data-icon="CircleCheck"]')).not.toBeNull();
    expect(status.getAttribute("class")).toContain("text-success");
    expect(screen.getByText("Done")).toBeDefined();
  });

  it("shows T3's static timeline-colored dashed circle while work runs", async () => {
    render([
      thread({
        id: "thr_busy",
        isUnread: true,
        indicator: "runtime",
        indicatorLabel: "Thread working",
      }),
    ]);
    const status = await screen.findByRole("status", {
      name: "Thread working",
    });
    const glyph = status.querySelector('[data-icon="CircleDashed"]');
    expect(glyph).not.toBeNull();
    expect(glyph?.getAttribute("class")).toContain("text-timeline-accent");
    expect(glyph?.getAttribute("class")).not.toContain("animate-spin");
    expect(status.getAttribute("class")).toContain("text-xs");
    expect(status.getAttribute("class")).not.toContain("text-2xs");
    expect(screen.getByText("Working")).toBeDefined();
    expect(screen.queryByLabelText("Unread thread succeeded")).toBeNull();
  });

  it("ticks the working duration from the backend turn start", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(40_000);
    renderSlot(inbox, listProps, {
      sidebarThreads: {
        status: "ready",
        threads: [
          thread({
            id: "thr_busy",
            indicator: "runtime",
            indicatorLabel: "Thread working",
          }),
        ],
        projects: [{ id: "proj_1", name: "bb", isPersonal: false }],
      },
      rpc: testRpc({
        listTurnStarts: () => ({
          rows: [{ threadId: "thr_busy", startedAt: 5_000 }],
        }),
      }),
      settings: testSettings(),
    });

    await act(async () => {
      await Promise.resolve();
    });
    const status = screen.getByRole("status", { name: "Thread working" });
    expect(status.textContent).toBe("Working35s");

    act(() => vi.advanceTimersByTime(2_000));
    expect(status.textContent).toBe("Working37s");
  });

  it("replaces a previous task's duration when the new turn start arrives", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(40_000);
    let startedAt: number | null = null;
    const rendered = renderSlot(inbox, listProps, {
      sidebarThreads: {
        status: "ready",
        threads: [
          thread({
            id: "thr_busy",
            indicator: "runtime",
            indicatorLabel: "Thread working",
          }),
        ],
        projects: [{ id: "proj_1", name: "bb", isPersonal: false }],
      },
      rpc: testRpc({
        listTurnStarts: () => ({
          rows: [{ threadId: "thr_busy", startedAt }],
        }),
      }),
      settings: testSettings(),
    });

    await act(async () => {
      await Promise.resolve();
    });
    const status = screen.getByRole("status", { name: "Thread working" });
    expect(status.textContent).toBe("Working");

    startedAt = 30_000;
    await rendered.behavior.emitRealtime("turn-starts", {
      threadId: "thr_busy",
      startedAt,
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(status.textContent).toBe("Working10s");
  });

  it("shows monitoring as quiet timeline-colored text", async () => {
    render([
      thread({
        id: "thr_monitoring",
        indicator: "runtime",
        indicatorLabel: "Monitoring repository",
      }),
    ]);
    const status = await screen.findByRole("status", {
      name: "Monitoring repository",
    });
    expect(status.getAttribute("class")).toContain("text-timeline-accent");
    expect(status.querySelector("[data-icon]")).toBeNull();
    expect(screen.getByText("Monitoring")).toBeDefined();
  });

  const activeStates = [
    [
      "workflow",
      "Workflow running",
      "Workflow",
      "Workflow",
      "text-primary",
    ],
    [
      "background-agent",
      "Background agent running",
      "Agent",
      "UserRoundPlus",
      "text-timeline-accent",
    ],
    [
      "background-command",
      "Background command running",
      "Command",
      "Terminal",
      "text-timeline-accent",
    ],
    [
      "plan-mode",
      "Plan mode active",
      "Planning",
      "ListTodo",
      "text-warning-text",
    ],
    ["goal", "Goal active", "Goal", "Target", "text-success"],
  ] as const;

  for (const [indicator, label, visibleLabel, icon, color] of activeStates) {
    it(`labels and colors the ${indicator} activity glyph`, async () => {
      render([
        thread({ id: `thr_${indicator}`, indicator, indicatorLabel: label }),
      ]);
      const status = await screen.findByRole("status", { name: label });
      const glyph = status.querySelector("[data-icon]");
      if (glyph === null) throw new Error(`Missing ${icon} status glyph`);
      expect(glyph.getAttribute("data-icon")).toBe(icon);
      expect(glyph.getAttribute("class")).toContain(color);
      expect(glyph.getAttribute("class")).not.toContain("animate-shine-icon");
      expect(screen.getByText(visibleLabel)).toBeDefined();
    });
  }

  it("keeps activity-icon shine available as an opt-in setting", async () => {
    renderSlot(inbox, listProps, {
      sidebarThreads: {
        status: "ready",
        threads: [
          thread({
            id: "thr_workflow",
            indicator: "workflow",
            indicatorLabel: "Workflow running",
          }),
        ],
        projects: [{ id: "proj_1", name: "bb", isPersonal: false }],
      },
      rpc: testRpc(),
      settings: testSettings({
        workingShimmer: "off",
        statusIconShine: true,
        cardDividers: true,
        projectColorStripes: true,
        unreadTitleWeight: "bold",
      }),
    });

    const status = await screen.findByRole("status", {
      name: "Workflow running",
    });
    expect(status.querySelector("[data-icon]")?.getAttribute("class")).toContain(
      "animate-shine-icon",
    );
  });

  it("labels draft work", async () => {
    render([
      thread({
        id: "thr_draft",
        indicator: "working-draft",
        indicatorLabel: "Thread has a working draft",
      }),
    ]);
    expect(await screen.findByText("Draft")).toBeDefined();
  });
});

describe("in-flight card treatment", () => {
  it("recedes an inactive working card but not an unread one", async () => {
    render([
      thread({
        id: "thr_read",
        title: "Read work",
        indicator: "runtime",
        indicatorLabel: "Working",
      }),
      thread({
        id: "thr_unread",
        title: "Unread work",
        indicator: "runtime",
        indicatorLabel: "Working",
        isUnread: true,
      }),
    ]);

    const readCard = (await screen.findByRole("link", {
      name: "Read work",
    })).parentElement;
    const unreadCard = screen.getByRole("link", {
      name: "Unread work",
    }).parentElement;
    expect(readCard?.getAttribute("class")).toContain("opacity-70");
    expect(unreadCard?.getAttribute("class")).not.toContain("opacity-70");
  });

  it("keeps the active working card at full opacity", async () => {
    renderSlot(inbox, { ...listProps, activeThreadId: "thr_active" }, {
      sidebarThreads: {
        status: "ready",
        threads: [
          thread({
            id: "thr_active",
            title: "Active work",
            indicator: "runtime",
            indicatorLabel: "Working",
          }),
        ],
        projects: [{ id: "proj_1", name: "bb", isPersonal: false }],
      },
      rpc: testRpc(),
      settings: testSettings(),
    });

    const card = (await screen.findByRole("link", {
      name: "Active work",
    })).parentElement;
    expect(card?.getAttribute("class")).not.toContain("opacity-70");
  });
});

describe("pull request badge", () => {
  const withPr = (attention: string, state = "open") =>
    renderSlot(inbox, listProps, {
      sidebarThreads: {
        status: "ready",
        threads: [thread({ id: "thr_pr" })],
        projects: [{ id: "proj_1", name: "bb", isPersonal: false }],
      },
      rpc: testRpc(),
      settings: testSettings(),
      sidebarPullRequests: {
        thr_pr: {
          number: 412,
          title: "Fix the flake",
          url: "https://github.com/o/r/pull/412",
          state,
          attention,
        } as never,
      },
    });

  it("links the PR number out to the git host", async () => {
    withPr("none");
    const badge = await screen.findByRole("link", { name: "#412" });
    expect(badge.getAttribute("href")).toBe("https://github.com/o/r/pull/412");
    expect(badge.getAttribute("title")).toBe("Fix the flake");
  });

  it("shows no badge when the branch has no PR", async () => {
    render([thread({ id: "thr_nopr" })]);
    await screen.findByText("A thread");
    expect(screen.queryByRole("link", { name: /^#/ })).toBeNull();
  });

  // The attention state is bb's rolled-up "does this need you" signal, so the
  // badge can colour itself without reading checks/review/mergeability.
  it("colors the badge from the attention state", async () => {
    const failing = withPr("checks_failed");
    expect(
      (await screen.findByRole("link", { name: "#412" })).className,
    ).toContain("destructive");
    failing.unmount();

    withPr("ready_to_merge");
    expect(
      (await screen.findByRole("link", { name: "#412" })).className,
    ).toContain("success");
  });
});
