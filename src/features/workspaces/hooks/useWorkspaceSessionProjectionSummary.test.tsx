// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkspaceSessionProjectionSummary } from "../../../services/tauri";
import { useWorkspaceSessionProjectionSummary } from "./useWorkspaceSessionProjectionSummary";

vi.mock("../../../services/tauri", () => ({
  getWorkspaceSessionProjectionSummary: vi.fn(),
}));

describe("useWorkspaceSessionProjectionSummary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requests the normalized query for the selected workspace", async () => {
    vi.mocked(getWorkspaceSessionProjectionSummary).mockResolvedValue({
      scopeKind: "project",
      ownerWorkspaceIds: ["ws-1", "ws-2"],
      activeTotal: 8,
      archivedTotal: 2,
      allTotal: 10,
      filteredTotal: 8,
      partialSources: [],
    });

    const { result } = renderHook(() =>
      useWorkspaceSessionProjectionSummary({
        workspaceId: "ws-1",
        query: { keyword: "  bugfix ", engine: " codex ", status: "active" },
      }),
    );

    await waitFor(() => {
      expect(result.current.summary?.filteredTotal).toBe(8);
    });

    expect(getWorkspaceSessionProjectionSummary).toHaveBeenCalledWith("ws-1", {
      query: { keyword: "bugfix", engine: "codex", status: "active" },
    });
  });

  it("ignores stale responses after workspace selection is cleared", async () => {
    let resolveSummary:
      | ((value: {
          scopeKind: "project" | "worktree";
          ownerWorkspaceIds: string[];
          activeTotal: number;
          archivedTotal: number;
          allTotal: number;
          filteredTotal: number;
          partialSources?: string[];
        }) => void)
      | null = null;

    vi.mocked(getWorkspaceSessionProjectionSummary).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSummary = resolve;
        }),
    );

    const { result, rerender } = renderHook(
      ({ workspaceId }) =>
        useWorkspaceSessionProjectionSummary({
          workspaceId,
          query: { status: "active" },
        }),
      { initialProps: { workspaceId: "ws-1" as string | null } },
    );

    await waitFor(() => {
      expect(getWorkspaceSessionProjectionSummary).toHaveBeenCalledWith("ws-1", {
        query: { keyword: null, engine: null, status: "active" },
      });
    });

    rerender({ workspaceId: null });

    await act(async () => {
      resolveSummary?.({
        scopeKind: "project",
        ownerWorkspaceIds: ["ws-1"],
        activeTotal: 5,
        archivedTotal: 0,
        allTotal: 5,
        filteredTotal: 5,
        partialSources: [],
      });
      await Promise.resolve();
    });

    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("surfaces a readable error when the projection request fails", async () => {
    vi.mocked(getWorkspaceSessionProjectionSummary).mockRejectedValue(
      new Error("projection unavailable"),
    );

    const { result } = renderHook(() =>
      useWorkspaceSessionProjectionSummary({
        workspaceId: "ws-1",
        query: { keyword: "  archive  ", engine: " codex ", status: "all" },
      }),
    );

    await waitFor(() => {
      expect(result.current.error).toBe("projection unavailable");
    });

    expect(getWorkspaceSessionProjectionSummary).toHaveBeenCalledWith("ws-1", {
      query: { keyword: "archive", engine: "codex", status: "all" },
    });
    expect(result.current.summary).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
