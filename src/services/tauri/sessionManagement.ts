import { invoke } from "@tauri-apps/api/core";

export interface WorkspaceSessionCatalogEntry {
  sessionId: string;
  canonicalSessionId?: string | null;
  workspaceId: string;
  workspaceLabel?: string | null;
  engine: string;
  title: string;
  updatedAt: number;
  archivedAt?: number | null;
  threadKind: string;
  source?: string | null;
  sourceLabel?: string | null;
  sizeBytes?: number | null;
  cwd?: string | null;
  attributionStatus?: "strict-match" | "inferred-related" | "unassigned" | null;
  attributionReason?: string | null;
  attributionConfidence?: "high" | "medium" | null;
  matchedWorkspaceId?: string | null;
  matchedWorkspaceLabel?: string | null;
}

export interface WorkspaceSessionCatalogQuery {
  keyword?: string | null;
  engine?: string | null;
  status?: "active" | "archived" | "all" | null;
}

export interface WorkspaceSessionCatalogPage {
  data: WorkspaceSessionCatalogEntry[];
  nextCursor?: string | null;
  partialSource?: string | null;
}

export interface WorkspaceSessionProjectionSummary {
  scopeKind: "project" | "worktree";
  ownerWorkspaceIds: string[];
  activeTotal: number;
  archivedTotal: number;
  allTotal: number;
  filteredTotal: number;
  partialSources?: string[];
}

export interface WorkspaceSessionBatchMutationResult {
  sessionId: string;
  ok: boolean;
  archivedAt?: number | null;
  error?: string | null;
  code?: string | null;
}

export interface WorkspaceSessionBatchMutationResponse {
  results: WorkspaceSessionBatchMutationResult[];
}

export async function listWorkspaceSessions(
  workspaceId: string,
  options?: {
    query?: WorkspaceSessionCatalogQuery | null;
    cursor?: string | null;
    limit?: number | null;
  },
): Promise<WorkspaceSessionCatalogPage> {
  return invoke<WorkspaceSessionCatalogPage>("list_workspace_sessions", {
    workspaceId,
    query: options?.query ?? null,
    cursor: options?.cursor ?? null,
    limit: options?.limit ?? null,
  });
}

export async function listGlobalCodexSessions(options?: {
  query?: WorkspaceSessionCatalogQuery | null;
  cursor?: string | null;
  limit?: number | null;
}): Promise<WorkspaceSessionCatalogPage> {
  return invoke<WorkspaceSessionCatalogPage>("list_global_codex_sessions", {
    query: options?.query ?? null,
    cursor: options?.cursor ?? null,
    limit: options?.limit ?? null,
  });
}

export async function listProjectRelatedCodexSessions(
  workspaceId: string,
  options?: {
    query?: WorkspaceSessionCatalogQuery | null;
    cursor?: string | null;
    limit?: number | null;
  },
): Promise<WorkspaceSessionCatalogPage> {
  return invoke<WorkspaceSessionCatalogPage>("list_project_related_codex_sessions", {
    workspaceId,
    query: options?.query ?? null,
    cursor: options?.cursor ?? null,
    limit: options?.limit ?? null,
  });
}

export async function getWorkspaceSessionProjectionSummary(
  workspaceId: string,
  options?: {
    query?: WorkspaceSessionCatalogQuery | null;
  },
): Promise<WorkspaceSessionProjectionSummary> {
  return invoke<WorkspaceSessionProjectionSummary>("get_workspace_session_projection_summary", {
    workspaceId,
    query: options?.query ?? null,
  });
}

export async function archiveWorkspaceSessions(
  workspaceId: string,
  sessionIds: string[],
): Promise<WorkspaceSessionBatchMutationResponse> {
  return invoke<WorkspaceSessionBatchMutationResponse>(
    "archive_workspace_sessions",
    {
      workspaceId,
      sessionIds,
    },
  );
}

export async function unarchiveWorkspaceSessions(
  workspaceId: string,
  sessionIds: string[],
): Promise<WorkspaceSessionBatchMutationResponse> {
  return invoke<WorkspaceSessionBatchMutationResponse>(
    "unarchive_workspace_sessions",
    {
      workspaceId,
      sessionIds,
    },
  );
}

export async function deleteWorkspaceSessions(
  workspaceId: string,
  sessionIds: string[],
): Promise<WorkspaceSessionBatchMutationResponse> {
  return invoke<WorkspaceSessionBatchMutationResponse>(
    "delete_workspace_sessions",
    {
      workspaceId,
      sessionIds,
    },
  );
}
