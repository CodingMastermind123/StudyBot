import { isOverDocLimit } from "../lib/storage.js";
import DocumentList from "./DocumentList.jsx";
import ChatList from "./ChatList.jsx";

export default function WorkspacePanel({
  workspace,
  activeChatId,
  quotaError,
  onAddDocument,
  onDeleteDocument,
  onCreateChat,
  onSelectChat,
  onDeleteChat,
}) {
  const overLimit = isOverDocLimit(workspace);

  return (
    <div className="workspace-panel">
      {(overLimit || quotaError) && (
        <div className="banner info quota-banner">
          {quotaError
            ? quotaError
            : "This workspace's documents exceed 3 MB — older browsers may fail to save. Consider removing a document."}
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
