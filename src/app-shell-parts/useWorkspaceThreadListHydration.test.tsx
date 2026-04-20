// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../types";
import { useWorkspaceThreadListHydration } from "./useWorkspaceThreadListHydration";

function createWorkspace(id: string): WorkspaceInfo {
  return {
    id,
    name: id,
    path: `/tmp/${id}`,
    connected: true,
    settings: { sidebarCollapsed: false },
  };
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("useWorkspaceThreadListHydration", () => {
  it("progresses to the next background workspace after the current hydration attempt settles", async () => {
    const workspaces = [createWorkspace("ws-1"), createWorkspace("ws-2")];
    const deferredFirst = createDeferred();
    const listThreadsForWorkspace = vi
      .fn<
        (
          workspace: WorkspaceInfo,
          options?: { preserveState?: boolean; includeOpenCodeSessions?: boolean },
        ) => Promise<void>
      >()
      .mockImplementationOnce(async () => {
        await deferredFirst.promise;
      })
      .mockResolvedValue(undefined);

    renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: null,
        activeWorkspaceProjectionOwnerIds: [],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
      expect(listThreadsForWorkspace).toHaveBeenCalledWith(
        workspaces[0],
        expect.objectContaining({ preserveState: true }),
      );
    });

    expect(listThreadsForWorkspace).not.toHaveBeenCalledWith(
      workspaces[1],
      expect.anything(),
    );

    deferredFirst.resolve();

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(2);
      expect(listThreadsForWorkspace).toHaveBeenNthCalledWith(
        2,
        workspaces[1],
        expect.objectContaining({ preserveState: true }),
      );
    });
  });
});
