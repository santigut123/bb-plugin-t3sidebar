import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useRealtime,
  useRealtimeConnectionState,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { t3sidebarRpcContract } from "./server";

export interface Workspace {
  id: string;
  name: string;
  projectIds: string[];
  threadIds: string[];
}

export interface WorkspacesApi {
  workspaces: readonly Workspace[];
  save(input: {
    workspaceId: string | null;
    name: string;
    projectIds: string[];
    threadIds: string[];
  }): Promise<Workspace>;
  setThreadMembership(input: {
    workspaceId: string;
    projectId: string;
    threadId: string;
    included: boolean;
  }): Promise<Workspace>;
  delete(workspaceId: string): Promise<void>;
}

export function useWorkspaces(): WorkspacesApi {
  const rpc = useRpc<typeof t3sidebarRpcContract>();
  const connectionState = useRealtimeConnectionState();
  const [workspaces, setWorkspaces] = useState<readonly Workspace[]>([]);
  const requestSeq = useRef(0);
  const previousConnectionState = useRef(connectionState);

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    const result = await rpc.call("listWorkspaces", {});
    if (seq === requestSeq.current) setWorkspaces(result.workspaces);
  }, [rpc]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtime("workspaces", () => {
    void refresh();
  });

  useEffect(() => {
    const previous = previousConnectionState.current;
    previousConnectionState.current = connectionState;
    if (connectionState === "connected" && previous !== "connected") {
      void refresh();
    }
  }, [connectionState, refresh]);

  const save = useCallback(
    async (input: {
      workspaceId: string | null;
      name: string;
      projectIds: string[];
      threadIds: string[];
    }) => {
      const result = await rpc.call("saveWorkspace", input);
      await refresh();
      return result.workspace;
    },
    [refresh, rpc],
  );

  const setThreadMembership = useCallback(
    async (input: {
      workspaceId: string;
      projectId: string;
      threadId: string;
      included: boolean;
    }) => {
      const result = await rpc.call("setWorkspaceThreadMembership", input);
      await refresh();
      return result.workspace;
    },
    [refresh, rpc],
  );

  const deleteWorkspace = useCallback(
    async (workspaceId: string) => {
      await rpc.call("deleteWorkspace", { workspaceId });
      await refresh();
    },
    [refresh, rpc],
  );

  return useMemo(
    () => ({
      workspaces,
      save,
      setThreadMembership,
      delete: deleteWorkspace,
    }),
    [deleteWorkspace, save, setThreadMembership, workspaces],
  );
}
