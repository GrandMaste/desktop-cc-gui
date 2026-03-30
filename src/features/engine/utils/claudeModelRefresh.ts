import type { EngineType } from "../../../types";

type ResolveClaudePendingThreadModelRefreshKeyInput = {
  activeEngine: EngineType;
  activeThreadId: string | null | undefined;
  activeWorkspaceId: string | null | undefined;
};

export function resolveClaudePendingThreadModelRefreshKey(
  input: ResolveClaudePendingThreadModelRefreshKeyInput,
): string | null {
  if (input.activeEngine !== "claude") {
    return null;
  }
  const threadId = input.activeThreadId?.trim() ?? "";
  if (!threadId.startsWith("claude-pending-")) {
    return null;
  }
  return `${input.activeWorkspaceId ?? "unknown"}:${threadId}`;
}
