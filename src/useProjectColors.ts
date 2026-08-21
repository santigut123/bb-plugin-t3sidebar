import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useRealtime,
  useRealtimeConnectionState,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { t3sidebarRpcContract } from "./server";
import { resolveProjectAccent, type ProjectAccent } from "./project-colors";

export interface ProjectColorsApi {
  accentFor(projectId: string): ProjectAccent;
  customHueFor(projectId: string): number | null;
  hasCustomColor(projectId: string): boolean;
  setColor(projectId: string, hue: number): void;
  resetColor(projectId: string): void;
}

export function useProjectColors(): ProjectColorsApi {
  const rpc = useRpc<typeof t3sidebarRpcContract>();
  const connectionState = useRealtimeConnectionState();
  const [overrides, setOverrides] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const requestSeq = useRef(0);
  const previousConnectionState = useRef(connectionState);

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    const result = await rpc.call("listProjectColors", {});
    if (seq !== requestSeq.current) return;
    setOverrides(
      new Map(result.rows.map((row) => [row.projectId, row.hue])),
    );
  }, [rpc]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtime("project-colors", () => {
    void refresh();
  });

  useEffect(() => {
    const previous = previousConnectionState.current;
    previousConnectionState.current = connectionState;
    if (connectionState === "connected" && previous !== "connected") {
      void refresh();
    }
  }, [connectionState, refresh]);

  const refreshAfter = useCallback(
    (write: Promise<unknown>) => {
      void write.then(() => refresh()).catch(() => undefined);
    },
    [refresh],
  );

  return useMemo<ProjectColorsApi>(
    () => ({
      accentFor: (projectId) => resolveProjectAccent(projectId, overrides),
      customHueFor: (projectId) => overrides.get(projectId) ?? null,
      hasCustomColor: (projectId) => overrides.has(projectId),
      setColor: (projectId, hue) => {
        refreshAfter(rpc.call("setProjectColor", { projectId, hue }));
      },
      resetColor: (projectId) => {
        refreshAfter(rpc.call("resetProjectColor", { projectId }));
      },
    }),
    [overrides, refreshAfter, rpc],
  );
}
