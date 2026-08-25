import { useCallback, useEffect, useRef, useState } from "react";
import {
  useRealtime,
  useRealtimeConnectionState,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { t3sidebarRpcContract } from "./server";

/** Durable last-work-start timestamps used to order thread families. */
export function useWorkOrder(): ReadonlyMap<string, number> {
  const rpc = useRpc<typeof t3sidebarRpcContract>();
  const connectionState = useRealtimeConnectionState();
  const [workStartedAt, setWorkStartedAt] = useState<
    ReadonlyMap<string, number>
  >(() => new Map());
  const requestSeq = useRef(0);
  const previousConnectionState = useRef(connectionState);

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const result = await rpc.call("listWorkOrder", {});
      if (seq !== requestSeq.current) return;
      setWorkStartedAt(
        new Map(result.rows.map((row) => [row.threadId, row.startedAt])),
      );
    } catch {
      // A transient refresh failure must not reshuffle an already ordered list.
    }
  }, [rpc]);

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
