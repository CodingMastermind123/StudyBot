import { isOverDocLimit } from "../lib/storage.js";
import DocumentList from "./DocumentList.jsx";
import ChatList from "./ChatList.jsx";

export default function WorkspacePanel({
  workspace,
  activeChatId,
  dataError,
  onAddDocument,
  onDeleteDocument,
  onCreateChat,
  onSelectChat,
  onDeleteChat,
}) {
  const overLimit = isOverDocLimit(workspace);

  return (
    <div className="workspace-panel">
      {dataError && (
        <div className="banner error quota-banner">{dataError}</div>
      )}
      {overLimit && (
        <div className="banner info quota-banner">
          This workspace's documents exceed 3 MB — large documents cost more tokens to send to Claude.
        </div>
      )}

      <DocumentList
        workspace={workspace}
        onAddDocument={onAddDocument}
        onDeleteDocument={onDeleteDocument}
      />

      <ChatList
        workspace={workspace}
        activeChatId={activeChatId}
        onSelectChat={onSelectChat}
        onCreateChat={onCreateChat}
        onDeleteChat={onDeleteChat}
      />
    </div>
  );
}
