import { describe, expect, it } from "vitest";
import type { KanbanTask } from "../types";
import {
  buildTaskChain,
  findTaskDownstream,
  resolveChainedDragBlockedReason,
  validateChainSelection,
} from "./chaining";

function createTask(id: string, overrides: Partial<KanbanTask> = {}): KanbanTask {
  const now = 1_700_000_000_000;
  return {
    id,
    workspaceId: "/workspace",
    panelId: "panel-1",
    title: id,
    description: "",
    status: "todo",
    engineType: "claude",
    modelId: null,
    branchName: "main",
    images: [],
    autoStart: false,
    sortOrder: now,
    threadId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("kanban chaining utils", () => {
  it("rejects non-todo task as downstream", () => {
    const tasks = [createTask("A"), createTask("B", { status: "done" })];
    const result = validateChainSelection({
      tasks,
      taskId: "B",
      status: "done",
      previousTaskId: "A",
      scheduleMode: "manual",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("chain_requires_todo_task");
  });

  it("rejects upstream with multiple downstream tasks", () => {
    const tasks = [
      createTask("A"),
      createTask("B", {
        chain: { groupId: "A", previousTaskId: "A" },
      }),
      createTask("C"),
    ];
    const result = validateChainSelection({
      tasks,
      taskId: "C",
      status: "todo",
      previousTaskId: "A",
      scheduleMode: "manual",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("chain_multi_downstream");
  });

  it("allows rebinding when old downstream is already done", () => {
    const tasks = [
      createTask("A"),
      createTask("B", {
        status: "done",
        chain: { groupId: "A", previousTaskId: "A" },
      }),
      createTask("C"),
    ];
    const result = validateChainSelection({
      tasks,
      taskId: "C",
      status: "todo",
      previousTaskId: "A",
      scheduleMode: "manual",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects cycle when selecting upstream", () => {
    const tasks = [
      createTask("A", {
        chain: { groupId: "A", previousTaskId: "C" },
      }),
      createTask("B", {
        chain: { groupId: "A", previousTaskId: "A" },
      }),
      createTask("C", {
        chain: { groupId: "A", previousTaskId: "B" },
      }),
    ];
    const result = validateChainSelection({
      tasks,
      taskId: "A",
      status: "todo",
      previousTaskId: "C",
      scheduleMode: "manual",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("chain_cycle_detected");
  });

  it("builds chain metadata with inherited group id", () => {
    const tasks = [
      createTask("A", {
        chain: { groupId: "group-1", previousTaskId: null, groupCode: "321" },
      }),
      createTask("B"),
    ];
    const chain = buildTaskChain(tasks, "A");
    expect(chain?.groupId).toBe("group-1");
    expect(chain?.previousTaskId).toBe("A");
    expect(chain?.groupCode).toBe("321");
  });

  it("generates a 3-digit group code for new chain groups", () => {
    const tasks = [createTask("A"), createTask("B")];
    const chain = buildTaskChain(tasks, "A");
    expect(chain?.groupId).toBe("A");
    expect(chain?.groupCode).toMatch(/^\d{3}$/);
  });

  it("finds only todo downstream task for auto chained execution", () => {
    const tasks = [
      createTask("A"),
      createTask("B", {
        status: "done",
        chain: { groupId: "A", previousTaskId: "A" },
      }),
      createTask("C", {
        status: "todo",
        chain: { groupId: "A", previousTaskId: "A" },
      }),
    ];
    const downstream = findTaskDownstream(tasks, "A");
    expect(downstream?.id).toBe("C");
  });

  it("blocks chained task dragging to inprogress manually", () => {
    const task = createTask("B", {
      chain: { groupId: "A", previousTaskId: "A" },
    });
    expect(resolveChainedDragBlockedReason(task, "todo", "inprogress")).toBe("chain_requires_head_trigger");
  });

  it("blocks chained task dragging to testing/done without completed execution", () => {
    const task = createTask("B", {
      chain: { groupId: "A", previousTaskId: "A" },
      execution: { startedAt: null, finishedAt: null },
    });
    expect(resolveChainedDragBlockedReason(task, "todo", "testing")).toBe("chain_requires_execution_completion");
    expect(resolveChainedDragBlockedReason(task, "todo", "done")).toBe("chain_requires_execution_completion");
  });

  it("allows chained task dragging to testing/done after completed execution", () => {
    const task = createTask("B", {
      chain: { groupId: "A", previousTaskId: "A" },
      execution: { startedAt: 1000, finishedAt: 2000 },
    });
    expect(resolveChainedDragBlockedReason(task, "inprogress", "testing")).toBeNull();
    expect(resolveChainedDragBlockedReason(task, "inprogress", "done")).toBeNull();
  });

  it("allows chained task in testing dragging back to todo", () => {
    const task = createTask("B", {
      status: "testing",
      chain: { groupId: "A", previousTaskId: "A" },
      execution: { startedAt: 1000, finishedAt: 2000 },
    });
    expect(resolveChainedDragBlockedReason(task, "testing", "todo")).toBeNull();
  });

  it("blocks completed chained task dragging back to todo", () => {
    const task = createTask("B", {
      status: "done",
      chain: { groupId: "A", previousTaskId: "A" },
      execution: { startedAt: 1000, finishedAt: 2000 },
    });
    expect(resolveChainedDragBlockedReason(task, "done", "todo")).toBe(
      "chain_completed_cannot_back_to_todo",
    );
  });

  it("blocks completed chain head dragging back to todo", () => {
    const task = createTask("A", {
      status: "done",
      execution: { startedAt: 1000, finishedAt: 2000 },
    });
    expect(resolveChainedDragBlockedReason(task, "done", "inprogress", { isTaskInChain: true })).toBe(
      "chain_completed_status_locked",
    );
  });

  it("allows non-chained completed task dragging back to todo", () => {
    const task = createTask("X", {
      status: "done",
      execution: { startedAt: 1000, finishedAt: 2000 },
    });
    expect(resolveChainedDragBlockedReason(task, "done", "todo")).toBeNull();
  });

  it("allows testing head task to be dragged to inprogress for re-execution", () => {
    const task = createTask("A", {
      status: "testing",
      execution: { startedAt: 1000, finishedAt: 2000 },
    });
    expect(resolveChainedDragBlockedReason(task, "testing", "inprogress", { isTaskInChain: true })).toBeNull();
  });
});
