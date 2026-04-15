import type { SharedSessionSupportedEngine } from "../utils/sharedSessionEngines";

export type SharedSessionNativeBinding = {
  workspaceId: string;
  sharedThreadId: string;
  nativeThreadId: string;
  engine: SharedSessionSupportedEngine;
};

const sharedBindingsByNativeKey = new Map<string, SharedSessionNativeBinding>();

function toBindingKey(workspaceId: string, nativeThreadId: string) {
  return `${workspaceId}::${nativeThreadId}`;
}

export function registerSharedSessionNativeBinding(binding: SharedSessionNativeBinding) {
  sharedBindingsByNativeKey.set(
    toBindingKey(binding.workspaceId, binding.nativeThreadId),
    binding,
  );
}

export function resolveSharedSessionBindingByNativeThread(
  workspaceId: string,
  nativeThreadId: string,
) {
  return sharedBindingsByNativeKey.get(toBindingKey(workspaceId, nativeThreadId)) ?? null;
}

export function rebindSharedSessionNativeThread(params: {
  workspaceId: string;
  oldNativeThreadId: string;
  newNativeThreadId: string;
}) {
  const oldKey = toBindingKey(params.workspaceId, params.oldNativeThreadId);
  const existing = sharedBindingsByNativeKey.get(oldKey);
  if (!existing) {
    return null;
  }
  sharedBindingsByNativeKey.delete(oldKey);
  const next = {
    ...existing,
    nativeThreadId: params.newNativeThreadId,
  };
  sharedBindingsByNativeKey.set(
    toBindingKey(params.workspaceId, params.newNativeThreadId),
    next,
  );
  return next;
}

export function clearSharedSessionBindingsForSharedThread(
  workspaceId: string,
  sharedThreadId: string,
) {
  const keysToDelete: string[] = [];
  sharedBindingsByNativeKey.forEach((binding, key) => {
    if (binding.workspaceId === workspaceId && binding.sharedThreadId === sharedThreadId) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => {
    sharedBindingsByNativeKey.delete(key);
  });
}
