import type { EngineType } from "../../../types";
import type { EngineDisplayInfo } from "../hooks/useEngineController";

const IMPLEMENTED_ENGINE_SET = new Set<EngineType>([
  "claude",
  "codex",
  "gemini",
  "opencode",
]);

export function isEngineImplemented(engine: EngineType): boolean {
  return IMPLEMENTED_ENGINE_SET.has(engine);
}

export function isEngineInstalled(
  engines: EngineDisplayInfo[],
  engine: EngineType,
): boolean {
  return engines.some((item) => item.type === engine && item.installed);
}

function findEngineInfo(
  engines: EngineDisplayInfo[],
  engine: EngineType,
): EngineDisplayInfo | null {
  return engines.find((item) => item.type === engine) ?? null;
}

export function isEngineSelectable(
  engines: EngineDisplayInfo[],
  engine: EngineType,
): boolean {
  const info = findEngineInfo(engines, engine);
  if (!isEngineImplemented(engine) || !info) {
    return false;
  }
  if (!info.availabilityState) {
    return info.installed;
  }
  return info.availabilityState === "ready";
}

export function getEngineAvailabilityStatusKey(
  engines: EngineDisplayInfo[],
  engine: EngineType,
): string | null {
  const info = findEngineInfo(engines, engine);
  if (!isEngineImplemented(engine)) {
    return "workspace.engineComingSoon";
  }
  if (info?.availabilityLabelKey) {
    return info.availabilityLabelKey;
  }
  if (!isEngineInstalled(engines, engine)) {
    return "sidebar.cliNotInstalled";
  }
  return null;
}
