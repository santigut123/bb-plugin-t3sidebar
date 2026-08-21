import { describe, expect, it, vi } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin, { TURN_STARTS_CHANNEL } from "./server";

function turnStartedEvent(threadId: string, createdAt: number) {
  return {
    id: `event_${createdAt}`,
    scope: { kind: "turn" as const, turnId: `turn_${createdAt}` },
    threadId,
    seq: createdAt,
    createdAt,
    type: "turn/started" as const,
    data: { providerThreadId: `provider_thread_${createdAt}` },
  };
}

function turnCompletedEvent(threadId: string, createdAt: number) {
  return {
    id: `event_${createdAt}`,
    scope: { kind: "turn" as const, turnId: `turn_${createdAt}` },
    threadId,
    seq: createdAt,
    createdAt,
    type: "turn/completed" as const,
    data: {
      providerThreadId: `provider_thread_${createdAt}`,
      status: "completed" as const,
    },
  };
}

describe("turn start RPC", () => {
  it("returns the latest turn start for each unique requested thread", async () => {
    const { bb, harness } = createFakePluginHost({
      pluginId: "t3sidebar",
      sdk: {
        subscribe: () => () => {},
        threads: {
          events: {
            list: async ({ threadId }) =>
              threadId === "thr_working"
                ? [
                    {
                      id: "event_1",
                      scope: { kind: "turn", turnId: "turn_1" },
                      threadId,
                      seq: 7,
                      createdAt: 12_345,
                      type: "turn/started" as const,
                      data: { providerThreadId: "provider_thread_1" },
                    },
                  ]
                : [],
          },
        },
      },
    });
    await plugin(bb);

    const result = await harness.behavior.callRpc("listTurnStarts", {
      threadIds: ["thr_working", "thr_missing", "thr_working"],
    });

    expect(result).toEqual({
      rows: [
        { threadId: "thr_working", startedAt: 12_345 },
        { threadId: "thr_missing", startedAt: null },
      ],
    });
    expect(
      harness.inspection.sdk.callsTo("threads.events.list").map(([args]) =>
        args,
      ),
    ).toEqual([
      {
        threadId: "thr_working",
        types: ["turn/started", "turn/completed"],
        order: "desc",
        limit: "1",
      },
      {
        threadId: "thr_missing",
        types: ["turn/started", "turn/completed"],
        order: "desc",
        limit: "1",
      },
    ]);

    await harness.lifecycle.dispose();
  });

  it("does not return the previous start after that turn completed", async () => {
    const { bb, harness } = createFakePluginHost({
      pluginId: "t3sidebar",
      sdk: {
        subscribe: () => () => {},
        threads: {
          events: {
            list: async ({ threadId }) => [
              turnCompletedEvent(threadId, 20_000),
            ],
          },
        },
      },
    });
    await plugin(bb);

    const result = await harness.behavior.callRpc("listTurnStarts", {
      threadIds: ["thr_working"],
    });
    expect(result).toEqual({
      rows: [{ threadId: "thr_working", startedAt: null }],
    });

    await harness.lifecycle.dispose();
  });

  it("publishes the new turn start when BB reports turn/started", async () => {
    let onThreadChanged:
      | ((event: {
          type: "changed";
          entity: "thread";
          id: string;
          changes: ["events-appended"];
          metadata: { eventTypes: ["turn/started"] };
        }) => void)
      | undefined;
    const { bb, harness } = createFakePluginHost({
      pluginId: "t3sidebar",
      sdk: {
        subscribe: ({ callback }) => {
          onThreadChanged = callback as typeof onThreadChanged;
          return () => {};
        },
        threads: {
          events: {
            list: async ({ threadId }) => [
              turnStartedEvent(threadId, 30_000),
            ],
          },
        },
      },
    });
    await plugin(bb);

    onThreadChanged?.({
      type: "changed",
      entity: "thread",
      id: "thr_working",
      changes: ["events-appended"],
      metadata: { eventTypes: ["turn/started"] },
    });
    await vi.waitFor(() =>
      expect(harness.inspection.realtimeSignals).toEqual([
        {
          channel: TURN_STARTS_CHANNEL,
          payload: { threadId: "thr_working", startedAt: 30_000 },
        },
      ]),
    );

    await harness.lifecycle.dispose();
  });
});
