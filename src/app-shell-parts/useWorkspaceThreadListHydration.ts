import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { WorkspaceInfo } from "../types";
import {
  resolveNextWorkspaceThreadListHydrationId,
  shouldSkipWorkspaceThreadListLoad,
} from "./workspaceThreadListLoadGuard";

type ListThreadsForWorkspace = (
  workspace: WorkspaceInfo,
  options?: {
    preserveState?: boolean;
    includeOpenCodeSessions?: boolean;
  },
) => Promise<void>;

type UseWorkspaceThreadListHydrationOptions = {
  activeWorkspaceId: string | null;
  activeWorkspaceProjectionOwnerIds: readonly string[];
  listThreadsForWorkspace: ListThreadsForWorkspace;
  threadListLoadingByWorkspace: Record<string, boolean>;
  workspaces: WorkspaceInfo[];
  workspacesById: Map<string, WorkspaceInfo>;
};

type UseWorkspaceThreadListHydrationResult = {
  ensureWorkspaceThreadListLoaded: (
    workspaceId: string,
    options?: { preserveState?: boolean; force?: boolean },
  ) => void;
  hydratedThreadListWorkspaceIdsRef: MutableRefObject<Set<string>>;
  listThreadsForWorkspaceTracked: ListThreadsForWorkspace;
};

export function useWorkspaceThreadListHydration({
  activeWorkspaceId,
  activeWorkspaceProjectionOwnerIds,
  listThreadsForWorkspace,
  threadListLoadingByWorkspace,
  workspaces,
  workspacesById,
}: UseWorkspaceThreadListHydrationOptions): UseWorkspaceThreadListHydrationResult {
  const hydratedThreadListWorkspaceIdsRef = useRef(new Set<string>());
  const hydratingThreadListWorkspaceIdsRef = useRef(new Set<string>());
  const autoHydratedActiveWorkspaceIdRef = useRef<string | null>(null);
  const [hydrationCycle, setHydrationCycle] = useState(0);

  const listThreadsForWorkspaceTracked = useCallback<ListThreadsForWorkspace>(
    async (workspace, options) => {
      hydratingThreadListWorkspaceIdsRef.current.add(workspace.id);
      try {
        await listThreadsForWorkspace(workspace, options);
      } finally {
        hydratedThreadListWorkspaceIdsRef.current.add(workspace.id);
        hydratingThreadListWorkspaceIdsRef.current.delete(workspace.id);
        setHydrationCycle((current) => current + 1);
      }
    },
    [listThreadsForWorkspace],
  );

  const ensureWorkspaceThreadListLoaded = useCallback(
    (
      workspaceId: string,
      options?: { preserveState?: boolean; force?: boolean },
    ) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      const force = options?.force ?? false;
      const isLoading = threadListLoadingByWorkspace[workspaceId] ?? false;
      const hasHydratedThreadList =
        hydratedThreadListWorkspaceIdsRef.current.has(workspaceId);
      const isHydratingThreadList =
        hydratingThreadListWorkspaceIdsRef.current.has(workspaceId);
      if (
        shouldSkipWorkspaceThreadListLoad({
          force,
          isLoading,
          isHydratingThreadList,
          hasHydratedThreadList,
        })
      ) {
        return;
      }
      void listThreadsForWorkspaceTracked(workspace, {
        preserveState: options?.preserveState,
      });
    },
    [
      listThreadsForWorkspaceTracked,
      threadListLoadingByWorkspace,
      workspacesById,
    ],
  );

  useEffect(() => {
    if (!activeWorkspaceId) {
      autoHydratedActiveWorkspaceIdRef.current = null;
      return;
    }
    if (autoHydratedActiveWorkspaceIdRef.current === activeWorkspaceId) {
      return;
    }
    autoHydratedActiveWorkspaceIdRef.current = activeWorkspaceId;
    ensureWorkspaceThreadListLoaded(activeWorkspaceId, { preserveState: true });
  }, [activeWorkspaceId, ensureWorkspaceThreadListLoaded]);

  useEffect(() => {
    if (!activeWorkspaceId || activeWorkspaceProjectionOwnerIds.length <= 1) {
      return;
    }
    activeWorkspaceProjectionOwnerIds.forEach((workspaceId) => {
      if (workspaceId === activeWorkspaceId) {
        return;
      }
      ensureWorkspaceThreadListLoaded(workspaceId, { preserveState: true });
    });
  }, [
    activeWorkspaceId,
    activeWorkspaceProjectionOwnerIds,
    ensureWorkspaceThreadListLoaded,
  ]);

  const nextBackgroundWorkspaceThreadHydrationId =
    resolveNextWorkspaceThreadListHydrationId({
      workspaces,
      activeWorkspaceId,
      activeWorkspaceProjectionOwnerIds,
      hydratedWorkspaceIds: hydratedThreadListWorkspaceIdsRef.current,
      hydratingWorkspaceIds: hydratingThreadListWorkspaceIdsRef.current,
      loadingByWorkspace: threadListLoadingByWorkspace,
    });

  void hydrationCycle;

  useEffect(() => {
    if (!nextBackgroundWorkspaceThreadHydrationId) {
      return;
    }
    ensureWorkspaceThreadListLoaded(nextBackgroundWorkspaceThreadHydrationId, {
      preserveState: true,
    });
  }, [
    ensureWorkspaceThreadListLoaded,
    nextBackgroundWorkspaceThreadHydrationId,
  ]);

  return {
    ensureWorkspaceThreadListLoaded,
    hydratedThreadListWorkspaceIdsRef,
    listThreadsForWorkspaceTracked,
  };
}
