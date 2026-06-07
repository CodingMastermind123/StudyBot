import MessageContent from "./MessageContent.jsx";

export default function MessageBubble({ role, content }) {
  return (
    <div className={`message ${role}`}>
      <div className="message-body">
        <MessageContent role={role} content={content} />
      </div>
    </div>
  );
}
