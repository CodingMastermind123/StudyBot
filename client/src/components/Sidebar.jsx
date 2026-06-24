import { useAuth } from "../context/AuthContext.jsx";
import WorkspaceSwitcher from "./WorkspaceSwitcher.jsx";
import WorkspacePanel from "./WorkspacePanel.jsx";

export default function Sidebar({
  workspaces,
  activeWorkspace,
  activeChatId,
  dataError,
  onSelectWorkspace,
  onCreateWorkspace,
  onAddDocument,
  onDeleteDocument,
  onCreateChat,
  onSelectChat,
  onDeleteChat,
  onDeleteWorkspace,
  onRenameWorkspace,
  onRecolorWorkspace,
}) {
  const { user, signOut } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="wordmark">StudyBot</span>
      </div>

      <div className="sidebar-nav">
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspace?.id ?? null}
          onSelect={onSelectWorkspace}
          onCreateWorkspace={onCreateWorkspace}
          onDeleteWorkspace={onDeleteWorkspace}
          onRenameWorkspace={onRenameWorkspace}
          onRecolorWorkspace={onRecolorWorkspace}
        />

        {activeWorkspace && (
          <>
            <div className="sidebar-divider" />
            <WorkspacePanel
              workspace={activeWorkspace}
              activeChatId={activeChatId}
              dataError={dataError}
              onAddDocument={onAddDocument}
              onDeleteDocument={onDeleteDocument}
              onCreateChat={onCreateChat}
              onSelectChat={onSelectChat}
              onDeleteChat={onDeleteChat}
            />
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <span className="sidebar-footer-email" title={user?.email}>
          {user?.email}
        </span>
        <button className="sidebar-footer-logout" onClick={signOut}>
          Log out
        </button>
      </div>
    </aside>
  );
}
