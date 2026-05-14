import { Skeleton, Image } from 'antd';
import './ChatBubble.less';

export interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  taskId?: string;
  imageUrls?: string[];
  loading?: boolean;
}

export function ChatBubble({ role, content, taskId, imageUrls, loading }: ChatBubbleProps) {
  return (
    <div className={`chat-bubble chat-bubble-${role}`}>
      <div className="chat-role">{role === 'user' ? '你' : 'AI'}</div>
      <div className="chat-content">{content}</div>

      {loading && (
        <div className="chat-loading">
          <Skeleton.Image active style={{ width: 200, height: 200 }} />
        </div>
      )}

      {imageUrls && imageUrls.length > 0 && (
        <div className="chat-images">
          <Image.PreviewGroup>
            {imageUrls.map((url, index) => (
              <Image key={index} src={url} alt={`生成的图片 ${index + 1}`} />
            ))}
          </Image.PreviewGroup>
        </div>
      )}

      {taskId ? (
        <div className="chat-task-id">
          <span className="task-label">taskId:</span>
          <code>{taskId}</code>
        </div>
      ) : null}
    </div>
  );
}
