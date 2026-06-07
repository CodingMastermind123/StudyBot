import WorkspaceSwitcher from "./WorkspaceSwitcher.jsx";
import WorkspacePanel from "./WorkspacePanel.jsx";

export default function Sidebar({
  workspaces,
  activeWorkspace,
  activeChatId,
  quotaError,
  onSelectWorkspace,
  onCreateWorkspace,
  onAddDocument,
  onDeleteDocument,
  onCreateChat,
  onSelectChat,
  onDeleteChat,
  onDeleteWorkspace,
}) {
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
        />

        {activeWorkspace && (
          <>
            <div className="sidebar-divider" />
            <WorkspacePanel
              workspace={activeWorkspace}
              activeChatId={activeChatId}
              quotaError={quotaError}
              onAddDocument={onAddDocument}
              onDeleteDocument={onDeleteDocument}
              onCreateChat={onCreateChat}
              onSelectChat={onSelectChat}
              onDeleteChat={onDeleteChat}
            />
          </>
        )}
      </div>

    </aside>
  );
}
