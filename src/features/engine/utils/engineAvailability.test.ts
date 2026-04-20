import { describe, expect, it } from "vitest";
import type { EngineDisplayInfo } from "../hooks/useEngineController";
import {
  getEngineAvailabilityStatusKey,
  isEngineSelectable,
} from "./engineAvailability";

function makeEngine(
  overrides: Partial<EngineDisplayInfo> = {},
): EngineDisplayInfo {
  return {
    type: "codex",
    displayName: "Codex CLI",
    shortName: "Codex",
    installed: true,
    version: "0.98.0",
    error: null,
    ...overrides,
  };
}

describe("engineAvailability", () => {
  it("keeps legacy installed-only engine entries selectable", () => {
    expect(isEngineSelectable([makeEngine()], "codex")).toBe(true);
  });

  it("reports loading status when availability state is pending", () => {
    const loadingEngine = makeEngine({
      installed: false,
      version: null,
      availabilityState: "loading",
      availabilityLabelKey: "workspace.engineStatusLoading",
    });

    expect(isEngineSelectable([loadingEngine], "codex")).toBe(false);
    expect(getEngineAvailabilityStatusKey([loadingEngine], "codex")).toBe(
      "workspace.engineStatusLoading",
    );
  });
});
