// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { WorkspaceHome } from "./WorkspaceHome";

const baseWorkspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "desktop-cc-gui",
  path: "/Users/zhukunpeng/Desktop/desktop-cc-gui",
  connected: true,
  kind: "main",
  worktree: null,
  settings: {
    sidebarCollapsed: false,
  },
};

function renderWorkspaceHome(
  workspace: WorkspaceInfo,
  currentBranch: string | null,
) {
  return render(
    <WorkspaceHome
      workspace={workspace}
      currentBranch={currentBranch}
      recentThreads={[]}
      onSelectConversation={() => {}}
      onStartConversation={async () => {}}
      onContinueLatestConversation={() => {}}
      onStartGuidedConversation={async () => {}}
      onOpenSpecHub={() => {}}
      onRevealWorkspace={async () => {}}
      onDeleteConversations={async () => ({ succeededThreadIds: [], failed: [] })}
    />,
  );
}

describe("WorkspaceHome", () => {
  it("renders the centered workspace summary without a last-modified row", () => {
    const { container } = renderWorkspaceHome(baseWorkspace, "feature/ref-layout");

    expect(screen.getByRole("heading", { level: 1, name: "构建任何东西" })).toBeTruthy();
    expect(container.querySelector(".workspace-home-path-line")?.textContent)
      .toBe("/Users/zhukunpeng/Desktop/desktop-cc-gui");
    expect(container.querySelector(".workspace-home-path-name")?.textContent).toBe("desktop-cc-gui");
    expect(container.querySelector(".workspace-home-branch-line")?.textContent)
      .toContain("主分支(feature/ref-layout)");
    expect(screen.queryByText(/最后修改/i)).toBeNull();
  });

  it("uses the worktree label when the workspace is a worktree", () => {
    const { container } = renderWorkspaceHome(
      {
        ...baseWorkspace,
        kind: "worktree",
        worktree: { branch: "feature/worktree-home" },
      },
      null,
    );

    expect(container.querySelector(".workspace-home-branch-line")?.textContent)
      .toContain("工作树(feature/worktree-home)");
  });

  it("normalizes Windows paths when rendering the workspace summary", () => {
    const { container } = renderWorkspaceHome(
      {
        ...baseWorkspace,
        path: "C:\\Users\\demo\\Desktop\\desktop-cc-gui",
      },
      "feature/ref-layout",
    );

    expect(container.querySelector(".workspace-home-path-line")?.textContent)
      .toBe("C:/Users/demo/Desktop/desktop-cc-gui");
    expect(container.querySelector(".workspace-home-path-name")?.textContent)
      .toBe("desktop-cc-gui");
  });

  it("does not render an unknown branch placeholder when branch data is unavailable", () => {
    const { container } = renderWorkspaceHome(baseWorkspace, null);

    expect(container.querySelector(".workspace-home-branch-line")).toBeNull();
    expect(container.textContent).not.toContain("unknown");
  });
});
