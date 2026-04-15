import { describe, expect, it } from "vitest";
import {
  clearSharedSessionBindingsForSharedThread,
  registerSharedSessionNativeBinding,
  rebindSharedSessionNativeThread,
  resolveSharedSessionBindingByNativeThread,
} from "./sharedSessionBridge";

describe("sharedSessionBridge", () => {
  it("registers and resolves native thread bindings for shared sessions", () => {
    registerSharedSessionNativeBinding({
      workspaceId: "ws-1",
      sharedThreadId: "shared:thread-1",
      nativeThreadId: "claude-pending-shared-1",
      engine: "claude",
    });

    expect(
      resolveSharedSessionBindingByNativeThread("ws-1", "claude-pending-shared-1"),
    ).toEqual({
      workspaceId: "ws-1",
      sharedThreadId: "shared:thread-1",
      nativeThreadId: "claude-pending-shared-1",
      engine: "claude",
    });

    clearSharedSessionBindingsForSharedThread("ws-1", "shared:thread-1");
  });

  it("rebinds pending native thread ids to finalized session ids", () => {
    registerSharedSessionNativeBinding({
      workspaceId: "ws-2",
      sharedThreadId: "shared:thread-2",
      nativeThreadId: "claude-pending-shared-1",
      engine: "claude",
    });

    const rebound = rebindSharedSessionNativeThread({
      workspaceId: "ws-2",
      oldNativeThreadId: "claude-pending-shared-1",
      newNativeThreadId: "claude:session-1",
    });

    expect(rebound?.nativeThreadId).toBe("claude:session-1");
    expect(
      resolveSharedSessionBindingByNativeThread("ws-2", "claude:session-1")?.sharedThreadId,
    ).toBe("shared:thread-2");
    expect(resolveSharedSessionBindingByNativeThread("ws-2", "claude-pending-shared-1")).toBeNull();

    clearSharedSessionBindingsForSharedThread("ws-2", "shared:thread-2");
  });
});
