import { describe, expect, it } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "./server";

describe("turn start RPC", () => {
  it("returns the latest turn start for each unique requested thread", async () => {
    const { bb, harness } = createFakePluginHost({
      pluginId: "t3sidebar",
      sdk: {
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
        types: ["turn/started"],
        order: "desc",
        limit: "1",
      },
      {
        threadId: "thr_missing",
        types: ["turn/started"],
        order: "desc",
        limit: "1",
      },
    ]);

    await harness.lifecycle.dispose();
  });
});
