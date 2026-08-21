import { useCallback, useEffect, useRef, useState } from "react";
import {
  useRealtime,
  useRealtimeConnectionState,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { t3sidebarRpcContract } from "./server";

/** One backend lookup per visible set; the frontend owns the ticking clock. */
export function useTurnStarts(
  threadIds: readonly string[],
): ReadonlyMap<string, number> {
  const rpc = useRpc<typeof t3sidebarRpcContract>();
  const connectionState = useRealtimeConnectionState();
  const [starts, setStarts] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const requestSeq = useRef(0);
  const threadIdsRef = useRef(threadIds);
  const previousConnectionState = useRef(connectionState);
  threadIdsRef.current = threadIds;

  // Membership, not array identity or order, defines a new working period.
  const membershipKey = [...threadIds].sort().join("\0");

  const refresh = useCallback(async () => {
    const current = threadIdsRef.current;
    const seq = ++requestSeq.current;
    if (current.length === 0) {
      setStarts(new Map());
      return;
    }
    try {
      const result = await rpc.call("listTurnStarts", {
        threadIds: [...current],
      });
      if (seq !== requestSeq.current) return;
      setStarts(
        new Map(
          result.rows.flatMap((row) =>
            row.startedAt === null
              ? []
              : [[row.threadId, row.startedAt] as const],
          ),
        ),
      );
    } catch {
      if (seq === requestSeq.current) setStarts(new Map());
    }
  }, [rpc]);

  useEffect(() => {
    void refresh();
  }, [membershipKey, refresh]);

  useRealtime("turn-starts", () => {
    void refresh();
  });

  // Reconcile if the ephemeral turn-start signal arrived while disconnected.
  useEffect(() => {
    const previous = previousConnectionState.current;
    previousConnectionState.current = connectionState;
    if (connectionState === "connected" && previous !== "connected") {
      void refresh();
    }
  }, [connectionState, refresh]);

  return starts;
}
