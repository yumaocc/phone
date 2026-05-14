import type { StyleReferenceSummary } from '@/services/imageAgent';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import {
  Button,
  Card,
  Empty,
  Input,
  Spin,
  Tag,
  Typography,
  Upload,
} from 'antd';

const { Text, Paragraph } = Typography;

export interface StylePanelProps {
  file: File | null;
  fileList: UploadFile[];
  onFileChange: (fileList: UploadFile[]) => void;
  note: string;
  onNoteChange: (note: string) => void;
  onUpload: () => void;
  loading?: boolean;
  uploading?: boolean;
  references: StyleReferenceSummary[];
}

export function StylePanel({
  file,
  fileList,
  onFileChange,
  note,
  onNoteChange,
  onUpload,
  loading,
  uploading,
  references,
}: StylePanelProps) {
  const uploadProps: UploadProps = {
    accept: 'image/*',
    beforeUpload: () => false,
    fileList,
    maxCount: 1,
    multiple: false,
    onChange: ({ fileList: nextFileList }) => {
      onFileChange(nextFileList.slice(-1));
    },
  };

  return (
    <div className="style-panel">
      <Card title="上传风格参考" size="small">
        <Upload.Dragger className="style-uploader" {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽图片</p>
        </Upload.Dragger>

        <Input.TextArea
          className="style-note-input"
          autoSize={{ minRows: 2, maxRows: 3 }}
          placeholder="可选备注"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
        />

        <div className="upload-actions">
          <Text type="secondary">
            {file ? `已选择：${file.name}` : '选择一张图片'}
          </Text>
          <Button
            type="primary"
            size="small"
            loading={uploading}
            onClick={onUpload}
            disabled={!file}
          >
            上传
          </Button>
        </div>
      </Card>

      <Card title="风格库" size="small" className="references-card">
        {loading ? (
          <div className="references-loading">
            <Spin />
          </div>
        ) : references.length === 0 ? (
          <Empty description="还没有风格参考" />
        ) : (
          <div className="references-list">
            {references.map((ref) => (
              <div key={ref.id} className="reference-item">
                <div className="item-header">
                  <Text strong>{ref.analysis.title}</Text>
                  <Text type="secondary" className="item-date">
                    {new Date(ref.createdAt).toLocaleDateString()}
                  </Text>
                </div>
                <Paragraph className="item-summary" ellipsis={{ rows: 2 }}>
                  {ref.analysis.summary}
                </Paragraph>
                <div className="item-tags">
                  {ref.analysis.styleTags.slice(0, 3).map((tag) => (
                    <Tag key={tag} size="small">
                      {tag}
                    </Tag>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
