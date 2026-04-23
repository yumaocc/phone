import { request } from '@umijs/max';

export type DemoSessionMessage = {
  role: 'user' | 'assistant';
  content: string;
  prompt?: string;
  imageId?: string;
  createdAt: string;
};

export type DemoSession = {
  _id: string;
  title: string;
  messages: DemoSessionMessage[];
  currentPrompt?: string;
  currentImageId?: string;
  referenceAssetIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type DemoReferenceImage = {
  _id: string;
  sessionId: string;
  originalName: string;
  fileUrl: string;
  mimeType: string;
  analysisStatus: 'completed' | 'failed';
  analysisResult?: {
    summary: string;
    styleTags: string[];
    colors: string[];
    objects: string[];
    composition?: string;
    ocrText?: string;
    retrievableText: string;
    note?: string;
  };
  createdAt: string;
};

export type DemoGeneratedImage = {
  _id: string;
  sessionId: string;
  parentImageId?: string;
  prompt: string;
  negativePrompt?: string;
  model: string;
  size: string;
  imageUrl: string;
  revisionInstruction?: string;
  sourceReferenceAssetIds: string[];
  createdAt: string;
};

export type SessionDetailResponse = {
  session: DemoSession;
  referenceImages: DemoReferenceImage[];
  generatedImages: DemoGeneratedImage[];
};

export type ChatResponse = {
  sessionId: string;
  prompt: string;
  negativePrompt?: string;
  assistantReply: string;
  image: {
    id: string;
    imageUrl: string;
    size: string;
  };
  references: Array<{
    assetId: string;
    content: string;
    score: number;
    tags: string[];
  }>;
};

export async function createSession(title?: string) {
  return request<{ sessionId: string; title: string }>('/api/demo/session/create', {
    method: 'POST',
    data: title ? { title } : {},
  });
}

export async function getSessionDetail(sessionId: string) {
  return request<SessionDetailResponse>(`/api/demo/session/${sessionId}`, {
    method: 'GET',
  });
}

export async function chat(body: {
  sessionId: string;
  message: string;
  size?: string;
}) {
  return request<ChatResponse>('/api/demo/chat', {
    method: 'POST',
    data: body,
  });
}

export async function reviseImage(body: {
  sessionId: string;
  imageId: string;
  instruction: string;
  size?: string;
}) {
  return request<ChatResponse>('/api/demo/revise', {
    method: 'POST',
    data: body,
  });
}

export async function uploadReferenceImage(body: {
  sessionId: string;
  file: File;
  note?: string;
}) {
  const formData = new FormData();
  formData.append('sessionId', body.sessionId);
  formData.append('file', body.file);
  if (body.note?.trim()) {
    formData.append('note', body.note.trim());
  }

  const response = await fetch('/api/demo/reference/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || '上传参考图失败');
  }

  return response.json();
}
