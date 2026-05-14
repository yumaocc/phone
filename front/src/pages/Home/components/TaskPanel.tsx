import type { ImageTaskResponse } from '@/services/imageAgent';
import {
  Alert,
  Button,
  Card,
  Empty,
  Image,
  Input,
  Spin,
  Tag,
  Typography,
} from 'antd';

const { Text } = Typography;

export interface TaskPanelProps {
  taskId: string;
  onTaskIdChange: (id: string) => void;
  onQuery: () => void;
  loading?: boolean;
  result?: ImageTaskResponse;
  imageUrls?: string[];
}

export function TaskPanel({
  taskId,
  onTaskIdChange,
  onQuery,
  loading,
  result,
  imageUrls = [],
}: TaskPanelProps) {
  return (
    <div className="task-panel">
      <Card title="图片任务查询" size="small">
        <div className="task-input-group">
          <Input
            placeholder="输入 taskId 查询"
            value={taskId}
            onChange={(e) => onTaskIdChange(e.target.value)}
            onPressEnter={onQuery}
          />
          <Button type="primary" loading={loading} onClick={onQuery}>
            查询
          </Button>
        </div>
      </Card>

      <Card title="任务结果" size="small" className="result-card">
        {loading ? (
          <div className="result-loading">
            <Spin />
          </div>
        ) : result ? (
          <div className="task-result">
            <div className="result-meta">
              <div className="meta-item">
                <Text type="secondary">状态</Text>
                <Tag
                  color={
                    result.status === 'completed'
                      ? 'success'
                      : result.status === 'failed'
                      ? 'error'
                      : 'processing'
                  }
                >
                  {result.status}
                </Tag>
              </div>
              <div className="meta-item">
                <Text type="secondary">进度</Text>
                <Text>{result.progress ?? 0}%</Text>
              </div>
            </div>

            {imageUrls.length > 0 ? (
              <div className="result-images">
                {imageUrls.map((url) => (
                  <Image key={url} src={url} className="result-image" />
                ))}
              </div>
            ) : (
              <Alert type="info" showIcon message="暂无生成的图片" />
            )}
          </div>
        ) : (
          <Empty description="查询结果会显示在这里" />
        )}
      </Card>
    </div>
  );
}
