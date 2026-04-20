import { useCallback, useMemo, useRef, useState } from "react";

export type LoadingProgressDialogConfig = {
  title: string;
  message?: string | null;
};

type LoadingProgressDialogEntry = {
  id: string;
  epoch: number;
  title: string;
  message: string | null;
};

export function useLoadingProgressDialogState() {
  const [entries, setEntries] = useState<LoadingProgressDialogEntry[]>([]);
  const [hiddenUntilEpoch, setHiddenUntilEpoch] = useState(0);
  const entriesRef = useRef<LoadingProgressDialogEntry[]>([]);
  const nextRequestIdRef = useRef(0);
  const nextEpochRef = useRef(0);

  const updateEntries = useCallback(
    (
      updater: (
        previous: LoadingProgressDialogEntry[],
      ) => LoadingProgressDialogEntry[],
    ) => {
      setEntries((previous) => {
        const next = updater(previous);
        entriesRef.current = next;
        return next;
      });
    },
    [],
  );

  const showLoadingProgressDialog = useCallback(
    (config: LoadingProgressDialogConfig) => {
      const id = `loading-progress-${Date.now()}-${nextRequestIdRef.current++}`;
      const epoch = ++nextEpochRef.current;
      updateEntries((previous) => [
        ...previous,
        {
          id,
          epoch,
          title: config.title,
          message: config.message ?? null,
        },
      ]);
      return id;
    },
    [updateEntries],
  );

  const hideLoadingProgressDialog = useCallback(
    (requestId: string) => {
      updateEntries((previous) =>
        previous.filter((entry) => entry.id !== requestId),
      );
    },
    [updateEntries],
  );

  const dismissLoadingProgressDialog = useCallback(() => {
    setHiddenUntilEpoch((previous) =>
      entriesRef.current.reduce(
        (maxEpoch, entry) => Math.max(maxEpoch, entry.epoch),
        previous,
      ),
    );
  }, []);

  const loadingProgressDialog = useMemo(() => {
    const visibleEntries = entries.filter(
      (entry) => entry.epoch > hiddenUntilEpoch,
    );
    if (visibleEntries.length === 0) {
      return null;
    }
    const activeEntry = visibleEntries[visibleEntries.length - 1];
    return {
      title: activeEntry.title,
      message: activeEntry.message,
    };
  }, [entries, hiddenUntilEpoch]);

  return {
    loadingProgressDialog,
    showLoadingProgressDialog,
    hideLoadingProgressDialog,
    dismissLoadingProgressDialog,
  };
}
