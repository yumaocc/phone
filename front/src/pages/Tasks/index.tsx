import { LeftOutlined } from '@ant-design/icons';
import { getImageTask, type ImageTaskResponse } from '@/services/imageAgent';
import { Button, Card, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { history } from '@umijs/max';
import { TaskPanel } from '../Home/components/TaskPanel';
import '../Home/index.less';
const TASK_ID_STORAGE_KEY = 'image-agent:last-task-id';

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

export default function TasksPage() {
  const [taskId, setTaskId] = useState('');
  const [querying, setQuerying] = useState(false);
  const [taskResult, setTaskResult] = useState<ImageTaskResponse>();
  const pollingIntervalRef = useRef<NodeJS.Timeout>();

  const imageUrls = useMemo(() => {
    if (!taskResult) return [];
    return extractImageUrls(taskResult);
  }, [taskResult]);

  useEffect(() => {
    const cachedTaskId = localStorage.getItem(TASK_ID_STORAGE_KEY);
    if (cachedTaskId) {
      setTaskId(cachedTaskId);
    }
  }, []);

  useEffect(() => {
    if (!taskId.trim()) {
      return;
    }
    localStorage.setItem(TASK_ID_STORAGE_KEY, taskId.trim());
  }, [taskId]);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const queryTask = async (targetTaskId: string) => {
    setQuerying(true);
    try {
      const result = await getImageTask(targetTaskId);
      setTaskResult(result);

      const resultImages = extractImageUrls(result);
      if (
        resultImages.length > 0 ||
        result.status === 'completed' ||
        result.status === 'failed'
      ) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = undefined;
        }
      }
    } catch (error) {
      message.error('查询图片任务失败');
    } finally {
      setQuerying(false);
    }
  };

  const handleQueryTask = async () => {
    const trimmedTaskId = taskId.trim();
    if (!trimmedTaskId) return;

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    await queryTask(trimmedTaskId);
    pollingIntervalRef.current = setInterval(() => {
      void queryTask(trimmedTaskId);
    }, 2000);
  };

  return (
    <div className="image-agent-page">
      <div className="image-agent-header page-header">
        <div className="header-single-row">
          <Button
            icon={<LeftOutlined />}
            className="back-button"
            onClick={() => history.push('/home')}
          >
            返回
          </Button>
          <h1 className="header-title">任务查询</h1>
        </div>
      </div>

      <div className="image-agent-container">
        <Card className="workspace-card" title="任务工作台" size="small">
          <TaskPanel
            taskId={taskId}
            onTaskIdChange={setTaskId}
            onQuery={handleQueryTask}
            loading={querying}
            result={taskResult}
            imageUrls={imageUrls}
          />
        </Card>
      </div>
    </div>
  );
}
