import { describe, expect, it } from "vitest";
import { resolveClaudePendingThreadModelRefreshKey } from "./claudeModelRefresh";

describe("resolveClaudePendingThreadModelRefreshKey", () => {
  it("returns null for non-claude engines", () => {
    const key = resolveClaudePendingThreadModelRefreshKey({
      activeEngine: "codex",
      activeThreadId: "claude-pending-1",
      activeWorkspaceId: "ws-1",
    });
    expect(key).toBeNull();
  });

  it("returns null for non-pending claude thread ids", () => {
    const key = resolveClaudePendingThreadModelRefreshKey({
      activeEngine: "claude",
      activeThreadId: "claude:session-1",
      activeWorkspaceId: "ws-1",
    });
    expect(key).toBeNull();
  });

  it("builds refresh key for pending claude thread ids", () => {
    const key = resolveClaudePendingThreadModelRefreshKey({
      activeEngine: "claude",
      activeThreadId: "claude-pending-123",
      activeWorkspaceId: "ws-1",
    });
    expect(key).toBe("ws-1:claude-pending-123");
  });

  it("falls back to unknown workspace id when workspace is empty", () => {
    const key = resolveClaudePendingThreadModelRefreshKey({
      activeEngine: "claude",
      activeThreadId: "claude-pending-xyz",
      activeWorkspaceId: null,
    });
    expect(key).toBe("unknown:claude-pending-xyz");
  });
});
