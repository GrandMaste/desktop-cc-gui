// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEngineController } from "./useEngineController";
import {
  detectEngines,
  getActiveEngine,
  getEngineModels,
  getOpenCodeCommandsList,
  isWebServiceRuntime,
  switchEngine,
} from "../../../services/tauri";
import type { EngineStatus } from "../../../types";
import { STORAGE_KEYS as PROVIDER_STORAGE_KEYS } from "../../composer/types/provider";

vi.mock("../../../services/tauri", () => ({
  detectEngines: vi.fn(),
  getActiveEngine: vi.fn(),
  getEngineModels: vi.fn(),
  getOpenCodeCommandsList: vi.fn(),
  isWebServiceRuntime: vi.fn(),
  switchEngine: vi.fn(),
}));

const detectEnginesMock = vi.mocked(detectEngines);
const getActiveEngineMock = vi.mocked(getActiveEngine);
const getEngineModelsMock = vi.mocked(getEngineModels);
const getOpenCodeCommandsListMock = vi.mocked(getOpenCodeCommandsList);
const isWebServiceRuntimeMock = vi.mocked(isWebServiceRuntime);
const switchEngineMock = vi.mocked(switchEngine);

describe("useEngineController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    isWebServiceRuntimeMock.mockReturnValue(false);
    getOpenCodeCommandsListMock.mockResolvedValue([]);
    switchEngineMock.mockResolvedValue(undefined);
  });

  it("preserves default flag when custom claude model overrides same id", async () => {
    const claudeModels: EngineStatus["models"] = [
      {
        id: "claude-sonnet-4-6",
        displayName: "Sonnet 4.6",
        description: "default",
        isDefault: true,
      },
      {
        id: "claude-haiku-4-5",
        displayName: "Haiku 4.5",
        description: "",
        isDefault: false,
      },
    ];
    detectEnginesMock.mockResolvedValue([
      {
        engineType: "claude",
        installed: true,
        version: "1.0.0",
        binPath: null,
        features: {
          streaming: true,
          reasoning: true,
          toolUse: true,
          imageInput: true,
          sessionContinuation: true,
        },
        models: claudeModels,
        error: null,
      },
    ]);
    getActiveEngineMock.mockResolvedValue("claude");
    getEngineModelsMock.mockResolvedValue(claudeModels);
    window.localStorage.setItem(
      PROVIDER_STORAGE_KEYS.CLAUDE_CUSTOM_MODELS,
      JSON.stringify([
        {
          id: "claude-sonnet-4-6",
          label: "Custom Sonnet Alias",
          description: "custom",
        },
      ]),
    );

    const { result } = renderHook(() =>
      useEngineController({ activeWorkspace: null }),
    );

    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    await waitFor(() =>
      expect(result.current.engineModelsAsOptions.length).toBeGreaterThan(0),
    );

    const sonnet = result.current.engineModelsAsOptions.find(
      (model) => model.id === "claude-sonnet-4-6",
    );
    expect(sonnet).toBeDefined();
    expect(sonnet?.displayName).toBe("Custom Sonnet Alias");
    expect(sonnet?.isDefault).toBe(true);
  });

  it("loads legacy claude custom model entries even when label is missing", async () => {
    const claudeModels: EngineStatus["models"] = [
      {
        id: "claude-sonnet-4-6",
        displayName: "Sonnet 4.6",
        description: "default",
        isDefault: true,
      },
    ];
    detectEnginesMock.mockResolvedValue([
      {
        engineType: "claude",
        installed: true,
        version: "1.0.0",
        binPath: null,
        features: {
          streaming: true,
          reasoning: true,
          toolUse: true,
          imageInput: true,
          sessionContinuation: true,
        },
        models: claudeModels,
        error: null,
      },
    ]);
    getActiveEngineMock.mockResolvedValue("claude");
    getEngineModelsMock.mockResolvedValue(claudeModels);
    window.localStorage.setItem(
      PROVIDER_STORAGE_KEYS.CLAUDE_CUSTOM_MODELS,
      JSON.stringify([
        {
          id: "GLM-5.1",
        },
      ]),
    );

    const { result } = renderHook(() =>
      useEngineController({ activeWorkspace: null }),
    );

    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    await waitFor(() =>
      expect(result.current.engineModelsAsOptions.length).toBeGreaterThan(0),
    );

    const legacyModel = result.current.engineModelsAsOptions.find(
      (model) => model.id === "GLM-5.1",
    );
    expect(legacyModel).toBeDefined();
    expect(legacyModel?.displayName).toBe("GLM-5.1");
  });

  it("filters invalid/duplicate claude custom models while keeping valid legacy entries", async () => {
    const claudeModels: EngineStatus["models"] = [
      {
        id: "claude-sonnet-4-6",
        displayName: "Sonnet 4.6",
        description: "default",
        isDefault: true,
      },
    ];
    detectEnginesMock.mockResolvedValue([
      {
        engineType: "claude",
        installed: true,
        version: "1.0.0",
        binPath: null,
        features: {
          streaming: true,
          reasoning: true,
          toolUse: true,
          imageInput: true,
          sessionContinuation: true,
        },
        models: claudeModels,
        error: null,
      },
    ]);
    getActiveEngineMock.mockResolvedValue("claude");
    getEngineModelsMock.mockResolvedValue(claudeModels);
    window.localStorage.setItem(
      PROVIDER_STORAGE_KEYS.CLAUDE_CUSTOM_MODELS,
      JSON.stringify([
        { id: "GLM-5.1", label: "GLM", description: "ok" },
        { id: "GLM-5.1", label: "GLM duplicated", description: "dup" },
        { id: "provider/model:202603[beta]" },
        { id: "bad model with spaces", label: "invalid" },
        null,
        { foo: "bar" },
      ]),
    );

    const { result } = renderHook(() =>
      useEngineController({ activeWorkspace: null }),
    );

    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    await waitFor(() =>
      expect(result.current.engineModelsAsOptions.length).toBeGreaterThan(0),
    );

    const glmModels = result.current.engineModelsAsOptions.filter(
      (model) => model.id === "GLM-5.1",
    );
    expect(glmModels).toHaveLength(1);
    expect(glmModels[0]?.displayName).toBe("GLM");

    const bracketModel = result.current.engineModelsAsOptions.find(
      (model) => model.id === "provider/model:202603[beta]",
    );
    expect(bracketModel).toBeDefined();
    expect(bracketModel?.displayName).toBe("provider/model:202603[beta]");

    const invalidModel = result.current.engineModelsAsOptions.find(
      (model) => model.id === "bad model with spaces",
    );
    expect(invalidModel).toBeUndefined();
  });
});
