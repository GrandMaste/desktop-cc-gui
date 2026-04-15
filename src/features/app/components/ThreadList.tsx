import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CSSProperties, MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import type { ThreadSummary } from "../../../types";
import { ProxyStatusBadge } from "../../../components/ProxyStatusBadge";
import { EngineIcon } from "../../engine/components/EngineIcon";
import { SharedSessionIcon } from "../../shared-session/components/SharedSessionIcon";
import { ThreadDeleteConfirmBubble } from "../../threads/components/ThreadDeleteConfirmBubble";

type ThreadStatusMap = Record<
  string,
  { isProcessing: boolean; hasUnread: boolean; isReviewing: boolean }
>;

type ThreadRow = {
  thread: ThreadSummary;
  depth: number;
};

type ThreadListProps = {
  workspaceId: string;
  pinnedRows: ThreadRow[];
  unpinnedRows: ThreadRow[];
  totalThreadRoots: number;
  isExpanded: boolean;
  nextCursor: string | null;
  isPaging: boolean;
  nested?: boolean;
  showLoadOlder?: boolean;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  systemProxyEnabled?: boolean;
  systemProxyUrl?: string | null;
  threadStatusById: ThreadStatusMap;
  getThreadTime: (thread: ThreadSummary) => string | null;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  isThreadAutoNaming: (workspaceId: string, threadId: string) => boolean;
  onToggleThreadPin?: (workspaceId: string, threadId: string) => void;
  onToggleExpanded: (workspaceId: string) => void;
  onLoadOlderThreads: (workspaceId: string) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onShowThreadMenu: (
    event: MouseEvent,
    workspaceId: string,
    threadId: string,
    canPin: boolean,
  ) => void;
  deleteConfirmThreadId?: string | null;
  deleteConfirmWorkspaceId?: string | null;
  deleteConfirmBusy?: boolean;
  onCancelDeleteConfirm?: () => void;
  onConfirmDeleteConfirm?: () => void;
};

const THREAD_SIZE_MIB = 1024 * 1024;
const THREAD_SIZE_TONE_THRESHOLDS = [
  { minBytes: 100 * THREAD_SIZE_MIB, className: "thread-size-tier-100m" },
  { minBytes: 50 * THREAD_SIZE_MIB, className: "thread-size-tier-50m" },
  { minBytes: 25 * THREAD_SIZE_MIB, className: "thread-size-tier-25m" },
  { minBytes: 15 * THREAD_SIZE_MIB, className: "thread-size-tier-15m" },
  { minBytes: 10 * THREAD_SIZE_MIB, className: "thread-size-tier-10m" },
  { minBytes: 8 * THREAD_SIZE_MIB, className: "thread-size-tier-8m" },
  { minBytes: 4 * THREAD_SIZE_MIB, className: "thread-size-tier-4m" },
  { minBytes: 2 * THREAD_SIZE_MIB, className: "thread-size-tier-2m" },
  { minBytes: 1 * THREAD_SIZE_MIB, className: "thread-size-tier-1m" },
] as const;

function formatThreadSize(sizeBytes: number | undefined) {
  if (!sizeBytes || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return null;
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = sizeBytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const maximumFractionDigits = unitIndex === 0 || value >= 100 ? 0 : 1;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value)} ${units[unitIndex]}`;
}

function getThreadSizeToneClass(sizeBytes: number | undefined) {
  if (!sizeBytes || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return "thread-size-tier-under-1m";
  }
  return (
    THREAD_SIZE_TONE_THRESHOLDS.find((tier) => sizeBytes >= tier.minBytes)?.className ??
    "thread-size-tier-under-1m"
  );
}

export function ThreadList({
  workspaceId,
  pinnedRows,
  unpinnedRows,
  totalThreadRoots,
  isExpanded,
  nextCursor,
  isPaging,
  nested,
  showLoadOlder = true,
  activeWorkspaceId,
  activeThreadId,
  systemProxyEnabled = false,
  systemProxyUrl = null,
  threadStatusById,
  getThreadTime,
  isThreadPinned,
  isThreadAutoNaming,
  onToggleThreadPin,
  onToggleExpanded,
  onLoadOlderThreads,
  onSelectThread,
  onShowThreadMenu,
  deleteConfirmThreadId = null,
  deleteConfirmWorkspaceId = null,
  deleteConfirmBusy = false,
  onCancelDeleteConfirm,
  onConfirmDeleteConfirm,
}: ThreadListProps) {
  const { t } = useTranslation();
  const indentUnit = nested ? 10 : 14;
  const renderThreadRow = ({ thread, depth }: ThreadRow) => {
    const relativeTime = getThreadTime(thread);
    const sizeLabel = formatThreadSize(thread.sizeBytes);
    const sizeToneClass = getThreadSizeToneClass(thread.sizeBytes);
    const indentStyle =
      depth > 0
        ? ({ "--thread-indent": `${depth * indentUnit}px` } as CSSProperties)
        : undefined;
    const status = threadStatusById[thread.id];
    const statusClass = status?.isReviewing
      ? "reviewing"
      : status?.isProcessing
        ? "processing"
        : status?.hasUnread
          ? "unread"
          : "ready";
    const isProcessing = Boolean(status?.isProcessing);
    const canPin = depth === 0;
    const isPinned = canPin && isThreadPinned(workspaceId, thread.id);
    const isAutoNaming = isThreadAutoNaming(workspaceId, thread.id);
    const showProxyBadge = systemProxyEnabled && isProcessing;
    const isSharedThread = thread.threadKind === "shared";
    const engineSource = thread.engineSource ?? "codex";
    const baseEngineTitle =
      engineSource === "claude"
        ? "Claude Code"
        : engineSource === "gemini"
          ? "Gemini"
          : engineSource === "opencode"
            ? "OpenCode"
            : "Codex";
    const engineTitle =
      isSharedThread
        ? `Shared Session · ${baseEngineTitle}`
        : baseEngineTitle;

    const isDeleteConfirmOpen =
      deleteConfirmWorkspaceId === workspaceId && deleteConfirmThreadId === thread.id;

    return (
      <Popover
        key={thread.id}
        open={isDeleteConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            onCancelDeleteConfirm?.();
          }
        }}
      >
        <Tooltip>
          <PopoverAnchor asChild>
            <TooltipTrigger
              delay={450}
              className={`thread-row ${
                workspaceId === activeWorkspaceId && thread.id === activeThreadId
                  ? "active"
                  : ""
              }${isDeleteConfirmOpen ? " has-delete-confirm" : ""}${
                canPin ? " has-pin-toggle" : ""
              }`}
              style={indentStyle}
              onClick={() => onSelectThread(workspaceId, thread.id)}
              onContextMenu={(event) =>
                onShowThreadMenu(event, workspaceId, thread.id, canPin)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectThread(workspaceId, thread.id);
                }
              }}
            >
              <span className={`thread-status ${statusClass}`} aria-hidden />
              {canPin && onToggleThreadPin && (
                <span
                  className={`thread-pin-toggle${isPinned ? " is-pinned" : ""}`}
                  role="button"
                  aria-label={isPinned ? t("threads.unpin") : t("threads.pin")}
                  title={isPinned ? t("threads.unpin") : t("threads.pin")}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleThreadPin(workspaceId, thread.id);
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  <span className="thread-pin-toggle-icon" aria-hidden />
                </span>
              )}
              <span
                className={`thread-engine-badge ${
                  isSharedThread ? "thread-engine-shared" : `thread-engine-${engineSource}`
                }${isProcessing ? " is-processing" : ""}`}
                title={engineTitle}
              >
                {isSharedThread ? (
                  <SharedSessionIcon size={12} />
                ) : (
                  <EngineIcon engine={engineSource} size={12} />
                )}
              </span>
              {showProxyBadge && (
                <ProxyStatusBadge
                  proxyUrl={systemProxyUrl}
                  label={t("threads.proxyBadge")}
                  variant="compact"
                  className="thread-proxy-badge"
                />
              )}
              <span className="thread-name">{thread.name}</span>
              <div className="thread-meta">
                {isAutoNaming && (
                  <span className="thread-auto-naming">{t("threads.autoNaming")}</span>
                )}
                {sizeLabel && (
                  <span
                    className={`thread-size ${sizeToneClass}`}
                    title={`${thread.sizeBytes?.toLocaleString()} B`}
                  >
                    {sizeLabel}
                  </span>
                )}
                {relativeTime && <span className="thread-time">{relativeTime}</span>}
              </div>
            </TooltipTrigger>
          </PopoverAnchor>
          <TooltipPopup
            side="top"
            align="start"
            sideOffset={4}
            className="max-w-[400px] break-words"
          >
            {thread.name}
          </TooltipPopup>
        </Tooltip>
        {isDeleteConfirmOpen && (
          <PopoverContent
            side="right"
            align="start"
            sideOffset={10}
            className="thread-delete-popover-shell"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <ThreadDeleteConfirmBubble
              threadName={thread.name}
              isDeleting={deleteConfirmBusy}
              onCancel={() => onCancelDeleteConfirm?.()}
              onConfirm={() => onConfirmDeleteConfirm?.()}
            />
          </PopoverContent>
        )}
      </Popover>
    );
  };

  return (
    <div className={`thread-list${nested ? " thread-list-nested" : ""}`}>
      {pinnedRows.map((row) => renderThreadRow(row))}
      {pinnedRows.length > 0 && unpinnedRows.length > 0 && (
        <div className="thread-list-separator" aria-hidden="true" />
      )}
      {unpinnedRows.map((row) => renderThreadRow(row))}
      {totalThreadRoots > 5 && (
        <button
          className="thread-more"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpanded(workspaceId);
          }}
        >
          {isExpanded ? t("threads.showLess") : t("threads.more")}
        </button>
      )}
      {showLoadOlder && nextCursor && (isExpanded || totalThreadRoots <= 5) && (
        <button
          className="thread-more"
          onClick={(event) => {
            event.stopPropagation();
            onLoadOlderThreads(workspaceId);
          }}
          disabled={isPaging}
        >
          {isPaging
            ? t("threads.loading")
            : totalThreadRoots === 0
              ? t("threads.searchOlder")
              : t("threads.loadOlder")}
        </button>
      )}
    </div>
  );
}
