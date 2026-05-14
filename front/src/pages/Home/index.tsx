import { chat, uploadGenerateReferenceImage } from '@/services/imageAgent';
import {
  AppstoreOutlined,
  BookOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { history } from '@umijs/max';
import {
  Button,
  Card,
  Dropdown,
  Empty,
  Typography,
  message,
  type UploadFile,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import { ChatBubble } from './components/ChatBubble';
import { ChatComposer, type ComposerOptions } from './components/ChatComposer';
import './index.less';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  taskId?: string;
  imageUrls?: string[];
  loading?: boolean;
};

const TASK_ID_STORAGE_KEY = 'image-agent:last-task-id';

const { Text } = Typography;

export default function HomePage() {
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [referenceFileList, setReferenceFileList] = useState<UploadFile[]>([]);
  const chatThreadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatThreadRef.current) return;
    chatThreadRef.current.scrollTo({
      top: chatThreadRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  const handleSend = async (options: ComposerOptions) => {
    const content = input.trim();
    const pendingReferenceFiles = referenceFileList
      .map((item) => item.originFileObj)
      .filter((item): item is File => item instanceof File);

    if ((!content && !pendingReferenceFiles.length) || sending) {
      return;
    }

    appendMessage({
      id: `${Date.now()}-user`,
      role: 'user',
      content: content || '请参考我上传的图片生成。',
    });
    setInput('');
    setSending(true);

    try {
      const uploadedImageUrls = pendingReferenceFiles.length
        ? await Promise.all(
            pendingReferenceFiles.map((file) =>
              uploadGenerateReferenceImage({ file }),
            ),
          )
        : [];

      const response = await chat({
        message: content || '请参考我上传的图片生成。',
        conversationId,
        imageUrls: uploadedImageUrls,
        size: options.size,
        n: options.n,
        metadata: {
          resolution: options.resolution,
        },
      });

      setConversationId(response.conversationId);
      setReferenceFileList([]);

      appendMessage({
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: response.message.content,
        taskId: response.taskId,
        loading: !!response.taskId,
      });

      if (response.taskId) {
        localStorage.setItem(TASK_ID_STORAGE_KEY, response.taskId);
      }
    } catch (error) {
      message.error('发送消息失败');
      appendMessage({
        id: `${Date.now()}-assistant-error`,
        role: 'assistant',
        content: error instanceof Error ? error.message : '发送消息失败',
      });
    } finally {
      setSending(false);
    }
  };

  const appendMessage = (messageItem: ChatMessage) => {
    setMessages((prev) => [...prev, messageItem]);
  };

  return (
    <div className="image-agent-page">
      <div className="image-agent-header">
        <div className="header-content">
          <h1 className="header-title">漫画家助手</h1>
          <p className="header-desc">通过对话描述需求，画出属于自己的漫画</p>
        </div>
        <div className="header-actions">
          {conversationId && (
            <div className="header-meta">
              <Text type="secondary">会话 ID:</Text>
              <Text code>{conversationId}</Text>
            </div>
          )}
        </div>
      </div>

      <div className="image-agent-container">
        <Card className="chat-card" title="对话" size="small">
          <div className="chat-thread" ref={chatThreadRef}>
            {messages.length ? (
              messages.map((item) => (
                <ChatBubble
                  key={item.id}
                  role={item.role}
                  content={item.content}
                  taskId={item.taskId}
                  imageUrls={item.imageUrls}
                  loading={item.loading}
                />
              ))
            ) : (
              <div className="chat-empty-state">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="开始对话"
                />
              </div>
            )}
          </div>
        </Card>

        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          loading={sending}
          referenceCount={referenceFileList.length}
          extraAction={
            <Dropdown
              trigger={['click']}
              placement="topRight"
              menu={{
                items: [
                  {
                    key: 'tasks',
                    icon: <SearchOutlined />,
                    label: '任务查询',
                    onClick: () => history.push('/tasks'),
                  },
                  {
                    key: 'styles',
                    icon: <BookOutlined />,
                    label: '风格库',
                    onClick: () => history.push('/styles'),
                  },
                ],
              }}
            >
              <Button className="workspace-trigger">
                <AppstoreOutlined />
                工作台
              </Button>
            </Dropdown>
          }
        />
      </div>
    </div>
  );
}
