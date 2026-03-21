import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Droppable } from "@hello-pangea/dnd";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { KanbanColumnDef, KanbanTask, KanbanTaskStatus } from "../types";
import { KanbanCard } from "./KanbanCard";
import { chainPositionOfTask } from "../utils/chaining";

type KanbanColumnProps = {
  column: KanbanColumnDef;
  tasks: KanbanTask[];
  allTasks: KanbanTask[];
  selectedTaskId: string | null;
  taskProcessingMap: Record<string, { isProcessing: boolean; startedAt: number | null }>;
  onAddTask: () => void;
  onDeleteTask: (taskId: string) => void;
  onToggleSchedulePausedTask: (task: KanbanTask) => void;
  onCancelOrBlockTask: (task: KanbanTask) => void;
  onSelectTask: (task: KanbanTask) => void;
  onEditTask?: (task: KanbanTask) => void;
  onVisibleTaskIdsChange?: (columnId: KanbanTaskStatus, taskIds: string[]) => void;
};

type TaskGroupKind = "recurring" | "chain";

type TaskGroupMeta = {
  key: string;
  kind: TaskGroupKind;
  groupId: string | null;
  groupCode: string | null;
  groupBadgeStyle: CSSProperties;
  count: number;
};

type TaskGroupRef = {
  key: string;
  kind: TaskGroupKind;
};

type TaskRenderBlock =
  | { type: "single"; task: KanbanTask }
  | { type: "group"; meta: TaskGroupMeta; tasks: KanbanTask[] };

type RecurringGroupDescriptor = {
  signature: string;
  seriesId: string | null;
};

function resolveRecurringGroupDescriptor(task: KanbanTask): RecurringGroupDescriptor | null {
  const schedule = task.schedule;
  if (
    schedule?.mode !== "recurring" ||
    schedule.recurringExecutionMode !== "new_thread"
  ) {
    return null;
  }
  const signature = [
    task.workspaceId,
    task.panelId,
    task.title,
    String(schedule.interval ?? 1),
    schedule.unit ?? "days",
    schedule.newThreadResultMode ?? "pass",
  ].join("|");
  const seriesId =
    typeof schedule.seriesId === "string" && schedule.seriesId.trim().length > 0
      ? schedule.seriesId.trim()
      : null;
  return { signature, seriesId };
}

function resolveChainGroupCode(allTasks: KanbanTask[], groupId: string): string {
  const existingCode = allTasks.find(
    (task) => task.chain?.groupId === groupId && /^\d{3}$/.test(task.chain?.groupCode ?? ""),
  )?.chain?.groupCode;
  if (existingCode) {
    return existingCode;
  }

  // Stable fallback for legacy data without groupCode.
  let hash = 0;
  for (const ch of groupId) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return `${(hash % 900) + 100}`;
}

function hashGroupSeed(seed: string): number {
  let hash = 0;
  for (const ch of seed) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function resolveRecurringGroupCode(seed: string): string {
  return `${(hashGroupSeed(seed) % 900) + 100}`;
}

function resolveGroupBadgeStyle(seed: string): CSSProperties {
  const hue = hashGroupSeed(seed) % 360;
  return {
    ["--kanban-group-code-bg" as string]: `hsla(${hue}, 90%, 62%, 0.16)`,
    ["--kanban-group-code-border" as string]: `hsla(${hue}, 78%, 56%, 0.62)`,
    ["--kanban-group-code-text" as string]: `hsl(${hue}, 68%, 44%)`,
  };
}

function resolveTaskChainGroupId(allTasks: KanbanTask[], task: KanbanTask): string | null {
  if (task.chain?.groupId) {
    return task.chain.groupId;
  }
  return (
    allTasks.find((entry) => entry.chain?.previousTaskId === task.id)?.chain?.groupId ??
    null
  );
}

function resolveRecurringRunIndex(task: KanbanTask): number | null {
  const schedule = task.schedule;
  if (schedule?.mode !== "recurring" || schedule.recurringExecutionMode !== "new_thread") {
    return null;
  }
  const completedRounds = Math.max(0, schedule.completedRounds ?? 0);
  if (task.status === "testing" || task.status === "done") {
    return Math.max(1, completedRounds);
  }
  return completedRounds + 1;
}

function resolveTaskSerialOrder(tasks: KanbanTask[], task: KanbanTask): number | null {
  const chainGroupId = resolveTaskChainGroupId(tasks, task);
  if (chainGroupId) {
    return chainPositionOfTask(tasks, task.id);
  }
  return resolveRecurringRunIndex(task);
}

export function KanbanColumn({
  column,
  tasks,
  allTasks,
  selectedTaskId,
  taskProcessingMap,
  onAddTask,
  onDeleteTask,
  onToggleSchedulePausedTask,
  onCancelOrBlockTask,
  onSelectTask,
  onEditTask,
  onVisibleTaskIdsChange,
}: KanbanColumnProps) {
  const { t } = useTranslation();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const renderBlocks = useMemo<TaskRenderBlock[]>(() => {
    const chainGroupByTaskId = new Map<string, string>();
    for (const task of allTasks) {
      if (!task.chain?.groupId) {
        continue;
      }
      chainGroupByTaskId.set(task.id, task.chain.groupId);
      if (task.chain.previousTaskId) {
        chainGroupByTaskId.set(task.chain.previousTaskId, task.chain.groupId);
      }
    }

    const taskGroupByTaskId = new Map<string, TaskGroupRef>();
    const groupedTaskIdsByKey = new Map<string, string[]>();
    const groupedKindByKey = new Map<string, TaskGroupKind>();

    const recurringDescriptors = new Map<string, RecurringGroupDescriptor>();
    const recurringSeriesBySignature = new Map<string, Set<string>>();
    for (const task of tasks) {
      const descriptor = resolveRecurringGroupDescriptor(task);
      if (!descriptor) {
        continue;
      }
      recurringDescriptors.set(task.id, descriptor);
      if (descriptor.seriesId) {
        const current = recurringSeriesBySignature.get(descriptor.signature) ?? new Set<string>();
        current.add(descriptor.seriesId);
        recurringSeriesBySignature.set(descriptor.signature, current);
      }
    }

    for (const task of tasks) {
      const recurringDescriptor = recurringDescriptors.get(task.id);
      if (recurringDescriptor) {
        const signatureSeries = recurringSeriesBySignature.get(recurringDescriptor.signature);
        const hasSingleSeries = (signatureSeries?.size ?? 0) === 1;
        const preferredSeriesId =
          recurringDescriptor.seriesId ??
          (hasSingleSeries ? Array.from(signatureSeries as Set<string>)[0] : null);
        const recurringGroupKey = preferredSeriesId
          ? `recurring:${preferredSeriesId}`
          : `recurring:sig:${recurringDescriptor.signature}`;
        taskGroupByTaskId.set(task.id, { key: recurringGroupKey, kind: "recurring" });
        groupedKindByKey.set(recurringGroupKey, "recurring");
        groupedTaskIdsByKey.set(recurringGroupKey, [
          ...(groupedTaskIdsByKey.get(recurringGroupKey) ?? []),
          task.id,
        ]);
        continue;
      }

      const chainGroupId = task.chain?.groupId ?? chainGroupByTaskId.get(task.id);
      if (!chainGroupId) {
        continue;
      }
      const chainGroupKey = `chain:${chainGroupId}`;
      taskGroupByTaskId.set(task.id, { key: chainGroupKey, kind: "chain" });
      groupedKindByKey.set(chainGroupKey, "chain");
      groupedTaskIdsByKey.set(chainGroupKey, [
        ...(groupedTaskIdsByKey.get(chainGroupKey) ?? []),
        task.id,
      ]);
    }

    const groupMetaByKey = new Map<string, TaskGroupMeta>();
    for (const [groupKey, taskIds] of groupedTaskIdsByKey.entries()) {
      if (taskIds.length < 2) {
        continue;
      }
      const kind = groupedKindByKey.get(groupKey) ?? "chain";
      groupMetaByKey.set(groupKey, {
        key: groupKey,
        kind,
        groupId: kind === "chain" ? groupKey.replace(/^chain:/, "") : null,
        groupCode:
          kind === "chain"
            ? resolveChainGroupCode(allTasks, groupKey.replace(/^chain:/, ""))
            : resolveRecurringGroupCode(groupKey),
        groupBadgeStyle: resolveGroupBadgeStyle(groupKey),
        count: taskIds.length,
      });
    }

    const tasksById = new Map(tasks.map((task) => [task.id, task]));
    const groupedTasksByKey = new Map<string, KanbanTask[]>();
    for (const [groupKey, taskIds] of groupedTaskIdsByKey.entries()) {
      const groupedTasks = taskIds
        .map((taskId) => tasksById.get(taskId))
        .filter((task): task is KanbanTask => Boolean(task));
      groupedTasksByKey.set(groupKey, groupedTasks);
    }

    const consumedTaskIds = new Set<string>();
    const blocks: TaskRenderBlock[] = [];
    for (const task of tasks) {
      if (consumedTaskIds.has(task.id)) {
        continue;
      }
      const groupRef = taskGroupByTaskId.get(task.id);
      const groupMeta = groupRef ? groupMetaByKey.get(groupRef.key) : undefined;
      if (!groupMeta) {
        consumedTaskIds.add(task.id);
        blocks.push({ type: "single", task });
        continue;
      }

      const groupTasks = (groupedTasksByKey.get(groupMeta.key) ?? []).slice();
      groupTasks.sort((a, b) => {
        const serialA = resolveTaskSerialOrder(allTasks, a);
        const serialB = resolveTaskSerialOrder(allTasks, b);
        if (serialA !== null && serialB !== null && serialA !== serialB) {
          return serialA - serialB;
        }
        if (serialA !== null && serialB === null) {
          return -1;
        }
        if (serialA === null && serialB !== null) {
          return 1;
        }
        return a.sortOrder - b.sortOrder;
      });
      for (const groupedTask of groupTasks) {
        consumedTaskIds.add(groupedTask.id);
      }
      blocks.push({ type: "group", meta: groupMeta, tasks: groupTasks });
    }
    const groupedBlocks = blocks.filter(
      (block): block is Extract<TaskRenderBlock, { type: "group" }> =>
        block.type === "group",
    );
    const singleBlocks = blocks.filter(
      (block): block is Extract<TaskRenderBlock, { type: "single" }> =>
        block.type === "single",
    );
    return [...groupedBlocks, ...singleBlocks];
  }, [tasks, allTasks]);

  const visibleTaskIds = useMemo(() => {
    const ids: string[] = [];
    for (const block of renderBlocks) {
      if (block.type === "single") {
        ids.push(block.task.id);
        continue;
      }
      const defaultCollapsed = column.id === "testing" || column.id === "done";
      const isCollapsed = collapsedGroups[block.meta.key] ?? defaultCollapsed;
      if (!isCollapsed) {
        for (const task of block.tasks) {
          ids.push(task.id);
        }
      }
    }
    return ids;
  }, [column.id, collapsedGroups, renderBlocks]);

  useEffect(() => {
    if (!onVisibleTaskIdsChange) {
      return;
    }
    onVisibleTaskIdsChange(column.id, visibleTaskIds);
  }, [column.id, onVisibleTaskIdsChange, visibleTaskIds]);

  return (
    <div className="kanban-column">
      <div className="kanban-column-header">
        <div className="kanban-column-header-left">
          <span
            className="kanban-column-dot"
            style={{ backgroundColor: column.color }}
          />
          <span className="kanban-column-name">{t(column.labelKey)}</span>
          {tasks.length > 0 && (
            <span className="kanban-column-count">{tasks.length}</span>
          )}
        </div>
        <button
          className="kanban-icon-btn"
          onClick={onAddTask}
          aria-label={t("kanban.board.addTask")}
        >
          <Plus size={16} />
        </button>
      </div>
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            className={`kanban-column-body${snapshot.isDraggingOver ? " is-dragging-over" : ""}`}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {(() => {
              let draggableIndex = 0;
              return renderBlocks.map((block) => {
                if (block.type === "single") {
                  const task = block.task;
                  const chainGroupId = resolveTaskChainGroupId(allTasks, task);
                  const chainGroupCode =
                    chainGroupId ? resolveChainGroupCode(allTasks, chainGroupId) : null;
                  const chainGroupBadgeStyle = chainGroupId
                    ? resolveGroupBadgeStyle(`chain:${chainGroupId}`)
                    : undefined;
                  const recurringDescriptor = resolveRecurringGroupDescriptor(task);
                  const recurringGroupKey = recurringDescriptor
                    ? recurringDescriptor.seriesId
                      ? `recurring:${recurringDescriptor.seriesId}`
                      : `recurring:sig:${recurringDescriptor.signature}`
                    : null;
                  const recurringGroupCode = recurringGroupKey
                    ? resolveRecurringGroupCode(recurringGroupKey)
                    : null;
                  const recurringGroupBadgeStyle = recurringGroupKey
                    ? resolveGroupBadgeStyle(recurringGroupKey)
                    : undefined;
                  const displayGroupCode = recurringGroupCode ?? chainGroupCode;
                  const displayGroupCodePrefix = recurringGroupCode ? "$" : "#";
                  const displayGroupBadgeStyle = recurringGroupBadgeStyle ?? chainGroupBadgeStyle;
                  const chainOrderIndex = chainGroupId
                    ? chainPositionOfTask(allTasks, task.id)
                    : null;
                  const card = (
                    <KanbanCard
                      task={task}
                      index={draggableIndex}
                      chainGroupCode={displayGroupCode}
                      chainGroupCodePrefix={displayGroupCodePrefix}
                      chainGroupBadgeStyle={displayGroupBadgeStyle}
                      chainOrderIndex={chainOrderIndex}
                      isSelected={task.id === selectedTaskId}
                      isProcessing={taskProcessingMap[task.id]?.isProcessing ?? false}
                      processingStartedAt={taskProcessingMap[task.id]?.startedAt ?? null}
                      onSelect={() => onSelectTask(task)}
                      onDelete={() => onDeleteTask(task.id)}
                      onToggleSchedulePaused={() => onToggleSchedulePausedTask(task)}
                      onCancelOrBlock={() => onCancelOrBlockTask(task)}
                      onEdit={onEditTask ? () => onEditTask(task) : undefined}
                    />
                  );
                  draggableIndex += 1;
                  return <Fragment key={task.id}>{card}</Fragment>;
                }

                const { meta, tasks: groupedTasks } = block;
                const defaultCollapsed = column.id === "testing" || column.id === "done";
                const isCollapsed = collapsedGroups[meta.key] ?? defaultCollapsed;
                const groupLabel =
                  meta.kind === "recurring"
                    ? t("kanban.task.group.recurring")
                    : t("kanban.task.group.chain");

                return (
                  <div
                    key={meta.key}
                    className={`kanban-task-group-panel${meta.kind === "chain" ? " is-chain" : " is-recurring"}`}
                  >
                    <button
                      type="button"
                      className="kanban-task-group-header"
                      onClick={() =>
                        setCollapsedGroups((prev) => ({
                          ...prev,
                          [meta.key]: !(prev[meta.key] ?? defaultCollapsed),
                        }))
                      }
                    >
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <span className="kanban-task-group-title">{groupLabel}</span>
                      {meta.groupCode && (
                        <span className="kanban-task-group-code" style={meta.groupBadgeStyle}>
                          {meta.kind === "chain" ? `#${meta.groupCode}` : `$${meta.groupCode}`}
                        </span>
                      )}
                      <span className="kanban-task-group-count">
                        {t("kanban.task.group.count", { count: meta.count })}
                      </span>
                    </button>
                    {!isCollapsed && groupedTasks.map((task) => {
                      const taskChainGroupId = resolveTaskChainGroupId(allTasks, task);
                      const chainOrderIndex = taskChainGroupId
                        ? chainPositionOfTask(allTasks, task.id)
                        : null;
                      const card = (
                        <KanbanCard
                          key={task.id}
                          task={task}
                          index={draggableIndex}
                          chainGroupCode={meta.groupCode}
                          chainGroupCodePrefix={meta.kind === "recurring" ? "$" : "#"}
                          chainGroupBadgeStyle={meta.groupBadgeStyle}
                          chainOrderIndex={chainOrderIndex}
                          isSelected={task.id === selectedTaskId}
                          isProcessing={taskProcessingMap[task.id]?.isProcessing ?? false}
                          processingStartedAt={taskProcessingMap[task.id]?.startedAt ?? null}
                          onSelect={() => onSelectTask(task)}
                          onDelete={() => onDeleteTask(task.id)}
                          onToggleSchedulePaused={() => onToggleSchedulePausedTask(task)}
                          onCancelOrBlock={() => onCancelOrBlockTask(task)}
                          onEdit={onEditTask ? () => onEditTask(task) : undefined}
                        />
                      );
                      draggableIndex += 1;
                      return card;
                    })}
                  </div>
                );
              });
            })()}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
