import { useCallback, useEffect, useRef, useState } from "react";
import {
  useRealtime,
  useRealtimeConnectionState,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { t3sidebarRpcContract } from "./server";

const WORK_ORDER_BATCH_SIZE = 500;

/** Durable last-work-start timestamps used to order thread families. */
export function useWorkOrder(
  threadIds: readonly string[],
): ReadonlyMap<string, number> {
  const rpc = useRpc<typeof t3sidebarRpcContract>();
  const connectionState = useRealtimeConnectionState();
  const [workStartedAt, setWorkStartedAt] = useState<
    ReadonlyMap<string, number>
  >(() => new Map());
  const requestSeq = useRef(0);
  const previousConnectionState = useRef(connectionState);
  const threadIdsRef = useRef(threadIds);
  threadIdsRef.current = threadIds;
  const membershipKey = JSON.stringify([...new Set(threadIds)].sort());

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    const uniqueThreadIds = [...new Set(threadIdsRef.current)];
    if (uniqueThreadIds.length === 0) {
      setWorkStartedAt(new Map());
      return;
    }
    try {
      const results = await Promise.all(
        Array.from(
          { length: Math.ceil(uniqueThreadIds.length / WORK_ORDER_BATCH_SIZE) },
          (_, index) =>
            rpc.call("listWorkOrder", {
              threadIds: uniqueThreadIds.slice(
                index * WORK_ORDER_BATCH_SIZE,
                (index + 1) * WORK_ORDER_BATCH_SIZE,
              ),
            }),
        ),
      );
      if (seq !== requestSeq.current) return;
      setWorkStartedAt(
        new Map(
          results.flatMap((result) => result.rows)
            .map((row) => [row.threadId, row.startedAt] as const),
        ),
      );
    } catch {
      // A transient refresh failure must not reshuffle an already ordered list.
    }
  }, [membershipKey, rpc]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtime("work-order", () => {
    void refresh();
  });

  useEffect(() => {
    const previous = previousConnectionState.current;
    previousConnectionState.current = connectionState;
    if (connectionState === "connected" && previous !== "connected") {
      void refresh();
    }
  }, [connectionState, refresh]);

  return workStartedAt;
}
