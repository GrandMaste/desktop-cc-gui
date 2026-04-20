import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getWorkspaceSessionProjectionSummary,
  type WorkspaceSessionCatalogQuery,
  type WorkspaceSessionProjectionSummary,
} from "../../../services/tauri";

type UseWorkspaceSessionProjectionSummaryOptions = {
  workspaceId: string | null;
  query?: WorkspaceSessionCatalogQuery | null;
  enabled?: boolean;
};

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeQuery(query?: WorkspaceSessionCatalogQuery | null): WorkspaceSessionCatalogQuery {
  return {
    keyword: query?.keyword?.trim() || null,
    engine: query?.engine?.trim() || null,
    status: query?.status ?? "active",
  };
}

export function useWorkspaceSessionProjectionSummary({
  workspaceId,
  query,
  enabled = true,
}: UseWorkspaceSessionProjectionSummaryOptions) {
  const [summary, setSummary] = useState<WorkspaceSessionProjectionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestSeqRef = useRef(0);
  const normalizedQuery = useMemo(() => normalizeQuery(query), [query]);

  const load = useCallback(async () => {
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;

    if (!enabled || !workspaceId) {
      setSummary(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const nextSummary = await getWorkspaceSessionProjectionSummary(workspaceId, {
        query: normalizedQuery,
      });
      if (requestSeqRef.current !== requestId) {
        return;
      }
      setSummary(nextSummary);
      setError(null);
    } catch (incomingError) {
      if (requestSeqRef.current !== requestId) {
        return;
      }
      setSummary(null);
      setError(normalizeErrorMessage(incomingError));
    } finally {
      if (requestSeqRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [enabled, normalizedQuery, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    summary,
    error,
    isLoading,
    reload: load,
  };
}
