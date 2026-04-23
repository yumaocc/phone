import {
  Alert,
  Button,
  Card,
  Empty,
  Image,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  Upload,
  message,
  type UploadFile,
  type UploadProps,
} from 'antd';
import { InboxOutlined, PlusOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  chat,
  getImageTask,
  listStyleReferences,
  type ImageTaskResponse,
  type StyleReferenceSummary,
  type GenerateMetadata,
  uploadGenerateReferenceImage,
  uploadStyleReference,
} from '@/services/imageAgent';
import './index.less';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  taskId?: string;
};

type SidePanelMode = 'task' | 'rag';

const MAX_REFERENCE_IMAGES = 12;
const IMAGE_RATIO_OPTIONS = [
  '1:1',
  '3:2',
  '2:3',
  '4:3',
  '3:4',
  '16:9',
  '9:16',
  '5:4',
  '4:5',
  '21:9',
  '1:4',
  '4:1',
  '1:8',
  '8:1',
];
const RESOLUTION_OPTIONS: NonNullable<GenerateMetadata['resolution']>[] = [
  '0.5K',
  '1K',
  '2K',
  '4K',
];

const { Paragraph, Text, Title } = Typography;

function extractImageUrls(value: unknown): string[] {
  const urls = new Set<string>();

  const visit = (current: unknown, key = '') => {
    if (typeof current === 'string') {
      const normalizedKey = key.toLowerCase();
      const isHttp = /^https?:\/\//i.test(current);
      const isBase64Field =
        normalizedKey.includes('b64') || normalizedKey.includes('base64');
      const isImageLike =
        normalizedKey.includes('image') ||
        normalizedKey === 'url' ||
        normalizedKey.includes('file') ||
        normalizedKey.includes('src') ||
        /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(current);

      if (current.startsWith('data:image/') || (isHttp && isImageLike)) {
        urls.add(current);
        return;
      }

      if (
        isBase64Field &&
        !isHttp &&
        !current.startsWith('data:image/') &&
        current.length > 100
      ) {
        urls.add(`data:image/png;base64,${current}`);
      }
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item) => visit(item, key));
      return;
    }

    if (!current || typeof current !== 'object') {
      return;
    }

    Object.entries(current).forEach(([childKey, childValue]) => {
      visit(childValue, childKey);
    });
  };

  visit(value);

  return Array.from(urls);
}

export default function HomePage() {
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState('');
  const [querying, setQuerying] = useState(false);
  const [taskResult, setTaskResult] = useState<ImageTaskResponse>();
  const [activeSidePanel, setActiveSidePanel] = useState<SidePanelMode>('task');
  const [styleReferences, setStyleReferences] = useState<StyleReferenceSummary[]>([]);
  const [styleFile, setStyleFile] = useState<File | null>(null);
  const [styleFileList, setStyleFileList] = useState<UploadFile[]>([]);
  const [referenceFileList, setReferenceFileList] = useState<UploadFile[]>([]);
  const [selectedSize, setSelectedSize] = useState<string>();
  const [imageCount, setImageCount] = useState<number>(1);
  const [resolution, setResolution] =
    useState<NonNullable<GenerateMetadata['resolution']>>('1K');
  const [googleSearchEnabled, setGoogleSearchEnabled] = useState(false);
  const [googleImageSearchEnabled, setGoogleImageSearchEnabled] =
    useState(false);
  const [styleNote, setStyleNote] = useState('');
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleUploading, setStyleUploading] = useState(false);
  const chatThreadRef = useRef<HTMLDivElement>(null);

  const styleUploadProps: UploadProps = {
    accept: 'image/*',
    beforeUpload: () => false,
    fileList: styleFileList,
    maxCount: 1,
    multiple: false,
    onChange: ({ fileList }) => {
      const nextFileList = fileList.slice(-1);
      setStyleFileList(nextFileList);
      setStyleFile(nextFileList[0]?.originFileObj ?? null);
    },
  };

  const referenceUploadProps: UploadProps = {
    accept: 'image/*',
    beforeUpload: () => false,
    fileList: referenceFileList,
    listType: 'picture-card',
    maxCount: MAX_REFERENCE_IMAGES,
    multiple: true,
    onChange: ({ fileList }) => {
      setReferenceFileList(fileList.slice(0, MAX_REFERENCE_IMAGES));
    },
  };

  const imageUrls = useMemo(() => {
    if (!taskResult) {
      return [];
    }

    return extractImageUrls(taskResult);
  }, [taskResult]);

  useEffect(() => {
    if (!chatThreadRef.current) {
      return;
    }

    chatThreadRef.current.scrollTo({
      top: chatThreadRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  useEffect(() => {
    void loadStyleReferences();
  }, []);

  const appendMessage = (messageItem: ChatMessage) => {
    setMessages((prev) => [...prev, messageItem]);
  };

  const loadStyleReferences = async () => {
    setStyleLoading(true);

    try {
      const result = await listStyleReferences();
      setStyleReferences(result);
    } catch (error) {
      console.error(error);
    } finally {
      setStyleLoading(false);
    }
  };

  const handleSend = async () => {
    const content = input.trim();
    const pendingReferenceFiles = referenceFileList
      .map((item) => item.originFileObj)
      .filter((item): item is File => item instanceof File);
    const hasReferenceImages = pendingReferenceFiles.length > 0;

    if ((!content && !hasReferenceImages) || sending) {
      return;
    }

    const metaSummary = [
      hasReferenceImages ? `附带 ${pendingReferenceFiles.length} 张参考图` : '',
      selectedSize ? `比例 ${selectedSize}` : '',
      resolution ? `分辨率 ${resolution}` : '',
      imageCount > 1 ? `生成 ${imageCount} 张` : '',
      googleSearchEnabled ? 'Google 文字搜索' : '',
      googleImageSearchEnabled ? 'Google 图片搜索' : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const userMessageContent = metaSummary
      ? `${content || '请参考我上传的图片生成。'}\n[${metaSummary}]`
      : content;

    appendMessage({
      id: `${Date.now()}-user`,
      role: 'user',
      content: userMessageContent,
    });
    setInput('');
    setSending(true);

    try {
      const uploadedImageUrls = hasReferenceImages
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
        size: selectedSize,
        n: imageCount,
        metadata: {
          resolution,
          google_search: googleSearchEnabled,
          google_image_search: googleImageSearchEnabled,
        },
      });

      setConversationId(response.conversationId);
      setReferenceFileList([]);

      appendMessage({
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: response.message.content,
        taskId: response.taskId,
      });

      if (response.taskId) {
        setCurrentTaskId(response.taskId);
        setActiveSidePanel('task');
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

  const handleQueryTask = async () => {
    const taskId = currentTaskId.trim();

    if (!taskId || querying) {
      return;
    }

    setQuerying(true);

    try {
      const result = await getImageTask(taskId);
      setTaskResult(result);
    } catch (error) {
      message.error('查询图片任务失败');
      setTaskResult(undefined);
      console.error(error);
    } finally {
      setQuerying(false);
    }
  };

  const handleUploadStyle = async () => {
    if (!styleFile || styleUploading) {
      return;
    }

    setStyleUploading(true);

    try {
      const result = await uploadStyleReference({
        file: styleFile,
        note: styleNote,
      });

      setStyleReferences((prev) => [result, ...prev]);
      setStyleFile(null);
      setStyleFileList([]);
      setStyleNote('');
      message.success('风格参考图已入库');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '风格图上传失败');
    } finally {
      setStyleUploading(false);
    }
  };

  return (
    <div className="image-agent-page">
      <div className="image-agent-shell">
        <section className="top-strip">
          <div className="top-strip-main">
            <Tag className="hero-tag" bordered={false}>
              Image Agent
            </Tag>
            <Title level={1}>对话生成工作台</Title>
            <Paragraph className="hero-copy">
              先对话补全需求，再拿 `taskId` 查询图片任务。信息不够时，AI 会先追问。
            </Paragraph>
          </div>
          <div className="top-strip-meta">
            <div className="meta-pill">
              <span className="meta-label">Memory</span>
              <span className="meta-value">LangChain</span>
            </div>
            <div className="meta-pill">
              <span className="meta-label">Flow</span>
              <span className="meta-value">Chat + Query</span>
            </div>
            <div className="meta-pill meta-pill-wide">
              <span className="meta-label">Conversation</span>
              <span className="meta-value">{conversationId ?? '未开始'}</span>
            </div>
          </div>
        </section>

        <div className="workspace-grid">
          <Card className="panel-card chat-card" title="对话">
            <div className="chat-layout">
              <div className="chat-thread" ref={chatThreadRef}>
              {messages.length ? (
                messages.map((item) => (
                  <div
                    key={item.id}
                    className={`chat-bubble chat-bubble-${item.role}`}
                  >
                    <div className="chat-role">
                      {item.role === 'user' ? '你' : 'AI'}
                    </div>
                    <Paragraph className="chat-content">{item.content}</Paragraph>
                    {item.taskId ? (
                      <div className="chat-task-id">
                        <Text type="secondary">taskId:</Text>
                        <Text code>{item.taskId}</Text>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="先输入一句需求开始对话"
                />
              )}
              </div>

              <div className="chat-composer">
                <div className="chat-reference-section">
                  <div className="chat-reference-head">
                    <Text type="secondary">
                      参考图
                      {referenceFileList.length
                        ? ` ${referenceFileList.length}/${MAX_REFERENCE_IMAGES}`
                        : ''}
                    </Text>
                    <Text type="secondary">
                      最多 {MAX_REFERENCE_IMAGES} 张，发送时自动上传
                    </Text>
                  </div>
                  <div className="chat-generate-options">
                    <div className="chat-option-field">
                      <Text type="secondary">图片比例</Text>
                      <Select
                        allowClear
                        className="chat-option-control"
                        placeholder="未指定"
                        value={selectedSize}
                        onChange={(value) => setSelectedSize(value)}
                        options={IMAGE_RATIO_OPTIONS.map((value) => ({
                          label: value,
                          value,
                        }))}
                      />
                    </div>
                    <div className="chat-option-field">
                      <Text type="secondary">输出分辨率</Text>
                      <Select
                        className="chat-option-control"
                        value={resolution}
                        onChange={(value) => setResolution(value)}
                        options={RESOLUTION_OPTIONS.map((value) => ({
                          label: value,
                          value,
                        }))}
                      />
                    </div>
                    <div className="chat-option-field chat-option-count">
                      <Text type="secondary">生成张数</Text>
                      <InputNumber
                        min={1}
                        max={4}
                        precision={0}
                        value={imageCount}
                        onChange={(value) => setImageCount(value ?? 1)}
                      />
                    </div>
                  </div>
                  <div className="chat-enhance-options">
                    <div className="chat-enhance-item">
                      <div>
                        <Text>Google 文字搜索</Text>
                        <Paragraph className="chat-enhance-copy">
                          适合需要真实文字信息的图片。
                        </Paragraph>
                      </div>
                      <Switch
                        checked={googleSearchEnabled}
                        onChange={(checked) => {
                          setGoogleSearchEnabled(checked);
                          if (!checked) {
                            setGoogleImageSearchEnabled(false);
                          }
                        }}
                      />
                    </div>
                    <div className="chat-enhance-item">
                      <div>
                        <Text>Google 图片搜索</Text>
                        <Paragraph className="chat-enhance-copy">
                          需要和文字搜索一起开启。
                        </Paragraph>
                      </div>
                      <Switch
                        checked={googleImageSearchEnabled}
                        onChange={(checked) => {
                          setGoogleImageSearchEnabled(checked);
                          if (checked) {
                            setGoogleSearchEnabled(true);
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="chat-reference-upload-wrap">
                    <Upload
                      className="chat-reference-upload"
                      {...referenceUploadProps}
                    >
                      {referenceFileList.length >= MAX_REFERENCE_IMAGES ? null : (
                        <div className="chat-reference-trigger">
                          <PlusOutlined />
                          <span>添加参考图</span>
                        </div>
                      )}
                    </Upload>
                  </div>
                </div>
                <Input.TextArea
                  autoSize={{ minRows: 4, maxRows: 6 }}
                  placeholder="例如：画一个坐在窗边的少女，日系插画风格，但我还没想好背景。"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onPressEnter={(event) => {
                    if (!event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                />
                <div className="chat-actions">
                  <Text type="secondary">
                    按 Enter 发送，Shift + Enter 换行
                  </Text>
                  <Button type="primary" loading={sending} onClick={handleSend}>
                    发送消息
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <div className="side-column">
            <div className="side-panel-switch">
              <Button
                type={activeSidePanel === 'task' ? 'primary' : 'default'}
                onClick={() => setActiveSidePanel('task')}
              >
                图片任务
              </Button>
              <Button
                type={activeSidePanel === 'rag' ? 'primary' : 'default'}
                onClick={() => setActiveSidePanel('rag')}
              >
                风格库 RAG
              </Button>
            </div>

            {activeSidePanel === 'task' ? (
              <div className="side-panel-stack task-panel-stack">
                <Card className="panel-card query-card" title="图片任务查询">
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    <Input
                      placeholder="输入 taskId，或先通过对话自动带入"
                      value={currentTaskId}
                      onChange={(event) => setCurrentTaskId(event.target.value)}
                    />
                    <Button
                      type="primary"
                      loading={querying}
                      onClick={handleQueryTask}
                    >
                      查询任务
                    </Button>
                    <Alert
                      type="info"
                      showIcon
                      message="这里会保留当前任务状态和生成出来的图片。"
                    />
                  </Space>
                </Card>

                <Card className="panel-card result-card" title="任务结果">
                  <div className="result-scroll">
                    {querying ? <Spin /> : null}

                    {taskResult ? (
                      <div className="task-result">
                        <div className="task-meta">
                          <div>
                            <Text type="secondary">任务 ID</Text>
                            <div>
                              <Text code>{taskResult.id}</Text>
                            </div>
                          </div>
                          <div>
                            <Text type="secondary">状态</Text>
                            <div>
                              <Tag
                                color={
                                  taskResult.status === 'completed'
                                    ? 'success'
                                    : taskResult.status === 'failed'
                                      ? 'error'
                                      : 'processing'
                                }
                              >
                                {taskResult.status}
                              </Tag>
                            </div>
                          </div>
                          <div>
                            <Text type="secondary">模型</Text>
                            <div>{taskResult.model}</div>
                          </div>
                          <div>
                            <Text type="secondary">进度</Text>
                            <div>{taskResult.progress ?? 0}%</div>
                          </div>
                        </div>

                        {imageUrls.length ? (
                          <div className="image-grid">
                            {imageUrls.map((url) => (
                              <Image key={url} src={url} className="result-image" />
                            ))}
                          </div>
                        ) : (
                          <Alert
                            type="info"
                            showIcon
                            message="当前任务结果里还没有可展示的图片地址"
                          />
                        )}

                        <Card
                          size="small"
                          title="原始返回"
                          className="raw-result-card"
                        >
                          <pre>{JSON.stringify(taskResult, null, 2)}</pre>
                        </Card>
                      </div>
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="任务查询结果会展示在这里"
                      />
                    )}
                  </div>
                </Card>
              </div>
            ) : (
              <Card className="panel-card style-card" title="风格库 RAG">
                <div className="style-library">
                  <Paragraph className="style-card-hint">
                    上传参考图后，后端会先做风格分析和向量化，再本地入库；后续对话生成时会自动检索这些风格记忆。
                  </Paragraph>
                  <div className="style-upload-block">
                    <Upload.Dragger className="style-uploader" {...styleUploadProps}>
                      <p className="ant-upload-drag-icon">
                        <InboxOutlined />
                      </p>
                      <p className="ant-upload-text">点击或拖拽图片到这里</p>
                      <p className="ant-upload-hint">
                        支持单张风格参考图，上传后会加入本地风格库。
                      </p>
                    </Upload.Dragger>
                    <Input.TextArea
                      autoSize={{ minRows: 2, maxRows: 4 }}
                      placeholder="可选备注：例如喜欢这种低饱和、自然光、日系清透感。"
                      value={styleNote}
                      onChange={(event) => setStyleNote(event.target.value)}
                    />
                    <div className="style-upload-actions">
                      <Text type="secondary">
                        {styleFile ? `已选择：${styleFile.name}` : '选择一张风格参考图'}
                      </Text>
                      <Button
                        type="primary"
                        loading={styleUploading}
                        onClick={handleUploadStyle}
                        disabled={!styleFile}
                      >
                        上传入库
                      </Button>
                    </div>
                  </div>

                  <div className="style-reference-list">
                    {styleLoading ? <Spin /> : null}

                    {!styleLoading && !styleReferences.length ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="还没有风格参考图"
                      />
                    ) : null}

                    {styleReferences.map((reference) => (
                      <div key={reference.id} className="style-reference-item">
                        <div className="style-reference-head">
                          <Text strong>{reference.analysis.title}</Text>
                          <Text type="secondary">
                            {new Date(reference.createdAt).toLocaleString()}
                          </Text>
                        </div>
                        <Paragraph className="style-reference-summary">
                          {reference.analysis.summary}
                        </Paragraph>
                        <div className="style-reference-tags">
                          {reference.analysis.styleTags.slice(0, 4).map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
