import { useEffect, useRef, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import type { t3sidebarRpcContract } from "./server";

/** One backend lookup per visible set; the frontend owns the ticking clock. */
export function useTurnStarts(
  threadIds: readonly string[],
): ReadonlyMap<string, number> {
  const rpc = useRpc<typeof t3sidebarRpcContract>();
  const [starts, setStarts] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const requestSeq = useRef(0);

  useEffect(() => {
    const seq = ++requestSeq.current;
    if (threadIds.length === 0) {
      setStarts(new Map());
      return;
    }
    void rpc.call("listTurnStarts", { threadIds: [...threadIds] }).then(
      (result) => {
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
      },
      () => {
        if (seq === requestSeq.current) setStarts(new Map());
      },
    );
  }, [rpc, threadIds]);

  return starts;
}
