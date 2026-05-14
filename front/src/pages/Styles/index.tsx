import { LeftOutlined } from '@ant-design/icons';
import { listStyleReferences, uploadStyleReference, type StyleReferenceSummary } from '@/services/imageAgent';
import { Button, Card, message, type UploadFile } from 'antd';
import { useEffect, useState } from 'react';
import { history } from '@umijs/max';
import { StylePanel } from '../Home/components/StylePanel';
import '../Home/index.less';

export default function StylesPage() {
  const [styleReferences, setStyleReferences] = useState<StyleReferenceSummary[]>([]);
  const [styleFile, setStyleFile] = useState<File | null>(null);
  const [styleFileList, setStyleFileList] = useState<UploadFile[]>([]);
  const [styleNote, setStyleNote] = useState('');
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleUploading, setStyleUploading] = useState(false);

  useEffect(() => {
    void loadStyleReferences();
  }, []);

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

  const handleUploadStyle = async () => {
    if (!styleFile || styleUploading) return;

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
      <div className="image-agent-header page-header">
        <div className="header-single-row">
          <Button
            icon={<LeftOutlined />}
            className="back-button"
            onClick={() => history.push('/home')}
          >
            返回
          </Button>
          <h1 className="header-title">风格库</h1>
        </div>
      </div>

      <div className="image-agent-container">
        <Card className="workspace-card" title="风格工作台" size="small">
          <StylePanel
            file={styleFile}
            fileList={styleFileList}
            onFileChange={(fileList) => {
              setStyleFileList(fileList);
              setStyleFile(fileList[0]?.originFileObj ?? null);
            }}
            note={styleNote}
            onNoteChange={setStyleNote}
            onUpload={handleUploadStyle}
            loading={styleLoading}
            uploading={styleUploading}
            references={styleReferences}
          />
        </Card>
      </div>
    </div>
  );
}
