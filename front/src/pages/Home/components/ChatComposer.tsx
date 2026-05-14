import type { GenerateMetadata } from '@/services/imageAgent';
import type { ReactNode } from 'react';
import { Button, Input, InputNumber, Select, Space, Typography } from 'antd';
import { useState } from 'react';

const { Text } = Typography;

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

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (options: ComposerOptions) => void;
  loading?: boolean;
  referenceCount?: number;
  extraAction?: ReactNode;
}

export interface ComposerOptions {
  size?: string;
  resolution: NonNullable<GenerateMetadata['resolution']>;
  n: number;
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  loading,
  referenceCount,
  extraAction,
}: ChatComposerProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [size, setSize] = useState<string>();
  const [resolution, setResolution] =
    useState<NonNullable<GenerateMetadata['resolution']>>('1K');
  const [count, setCount] = useState(1);

  const handleSend = () => {
    onSend({ size, resolution, n: count });
  };

  return (
    <div className="chat-composer">
      {showAdvanced && (
        <div className="composer-options">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div className="option-row">
              <Text type="secondary">图片比例</Text>
              <Select
                allowClear
                placeholder="未指定"
                value={size}
                onChange={setSize}
                options={IMAGE_RATIO_OPTIONS.map((v) => ({
                  label: v,
                  value: v,
                }))}
                style={{ flex: 1 }}
              />
            </div>
            <div className="option-row">
              <Text type="secondary">分辨率</Text>
              <Select
                value={resolution}
                onChange={setResolution}
                options={RESOLUTION_OPTIONS.map((v) => ({
                  label: v,
                  value: v,
                }))}
                style={{ flex: 1 }}
              />
            </div>
            <div className="option-row">
              <Text type="secondary">生成张数</Text>
              <InputNumber
                min={1}
                max={4}
                precision={0}
                value={count}
                onChange={(v) => setCount(v ?? 1)}
                style={{ flex: 1 }}
              />
            </div>
          </Space>
        </div>
      )}

      <div className="composer-input-wrap">
        <Input.TextArea
          autoSize={{ minRows: 3, maxRows: 6 }}
          placeholder="例如：画一个坐在窗边的少女，日系插画风格"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
      </div>

      <div className="composer-actions">
        <div className="actions-left">
          {referenceCount ? (
            <Text type="secondary">已添加 {referenceCount} 张参考图</Text>
          ) : null}
        </div>
        <div className="actions-right">
          <Button
            type="text"
            size="small"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '隐藏' : '显示'}高级选项
          </Button>
          {extraAction}
          <Button type="primary" loading={loading} onClick={handleSend}>
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}
