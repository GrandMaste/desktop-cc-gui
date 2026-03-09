import type { MouseEvent } from "react";
import type { WorkspaceInfo } from "../../../types";
import Folder from "lucide-react/dist/esm/icons/folder";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import { isDefaultWorkspacePath } from "../../workspaces/utils/defaultWorkspace";

type WorkspaceCardProps = {
  workspace: WorkspaceInfo;
  workspaceName?: React.ReactNode;
  isActive: boolean;
  hasPrimaryActiveThread: boolean;
  isCollapsed: boolean;
  onSelectWorkspace: (id: string) => void;
  onShowWorkspaceMenu: (event: MouseEvent, workspace: WorkspaceInfo) => void;
  onToggleWorkspaceCollapse: (workspaceId: string, collapsed: boolean) => void;
  children?: React.ReactNode;
};

export function WorkspaceCard({
  workspace,
  workspaceName,
  isActive,
  hasPrimaryActiveThread,
  isCollapsed,
  onSelectWorkspace,
  onShowWorkspaceMenu,
  onToggleWorkspaceCollapse,
  children,
}: WorkspaceCardProps) {
  const isDefaultWorkspace = isDefaultWorkspacePath(workspace.path);

  const handleRowClick = () => {
    onSelectWorkspace(workspace.id);
    onToggleWorkspaceCollapse(workspace.id, !isCollapsed);
  };

  return (
    <div className={`workspace-card ${isActive ? "is-active" : ""}`}>
      <div
        className={`workspace-row ${
          isActive
            ? hasPrimaryActiveThread
              ? "context-active"
              : "active"
            : ""
        }`}
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onContextMenu={(event) => onShowWorkspaceMenu(event, workspace)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleRowClick();
          }
        }}
      >
        <div className="workspace-header-content">
          <button className="workspace-folder-btn">
            {isDefaultWorkspace ? (
              isActive ? (
                <FolderOpen className="default-workspace-folder-icon" aria-hidden />
              ) : (
                <Folder className="default-workspace-folder-icon" aria-hidden />
              )
            ) : (
              isActive ? (
                <span className="codicon codicon-folder-opened" style={{ fontSize: "16px" }} />
              ) : (
                <span className="codicon codicon-folder" style={{ fontSize: "16px" }} />
              )
            )}
          </button>

          <span className="workspace-name-text">{workspaceName ?? workspace.name}</span>
          {isDefaultWorkspace ? (
            <span className="default-workspace-badge" aria-label="Default Workspace">
              Default
            </span>
          ) : null}

          <div className="workspace-actions">
            <button
              className="workspace-action-btn"
              onClick={(event) => onShowWorkspaceMenu(event, workspace)}
              aria-label="Workspace Actions"
              title="Workspace Actions"
            >
              <span className="codicon codicon-add" style={{ fontSize: "14px" }} />
            </button>
          </div>
        </div>
      </div>
      {children ? <div className="workspace-children">{children}</div> : null}
    </div>
  );
}
