import { request } from '@umijs/max';

const API_BASE_URL = process.env.UMI_APP_API_BASE_URL || 'http://localhost:3000';

export type ChatResponse = {
  conversationId: string;
  message: {
    role: 'assistant';
    content: string;
  };
  taskId?: string;
};

export type ImageTaskResponse = {
  id: string;
  object: string;
  model: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'pending';
  progress?: number;
  created_at: number;
  metadata?: Record<string, unknown>;
  data?: unknown[];
  result?: Record<string, unknown>;
  error?: unknown;
  message?: string;
};

export type StyleReferenceAnalysis = {
  title: string;
  summary: string;
  styleTags: string[];
  colorTags: string[];
  compositionTags: string[];
  moodTags: string[];
  negativeTags: string[];
  retrievableText: string;
};

export type StyleReferenceSummary = {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  note?: string;
  createdAt: string;
  analysis: StyleReferenceAnalysis;
};

export type GenerateMetadata = {
  resolution?: '0.5K' | '1K' | '2K' | '4K';
  google_search?: boolean;
  google_image_search?: boolean;
};

export async function chat(body: {
  message: string;
  conversationId?: string;
  imageUrls?: string[];
  size?: string;
  n?: number;
  metadata?: GenerateMetadata;
}) {
  return request<ChatResponse>(`${API_BASE_URL}/llm/msg`, {
    method: 'POST',
    data: body,
  });
}

export async function getImageTask(id: string) {
  return request<ImageTaskResponse>(`${API_BASE_URL}/generate-agent/get`, {
    method: 'GET',
    params: { id },
  });
}

export async function listStyleReferences() {
  return request<StyleReferenceSummary[]>(`${API_BASE_URL}/style-rag/list`, {
    method: 'GET',
  });
}

export async function uploadStyleReference(body: {
  file: File;
  note?: string;
}) {
  const formData = new FormData();
  formData.append('file', body.file);

  if (body.note?.trim()) {
    formData.append('note', body.note.trim());
  }

  const response = await fetch(`${API_BASE_URL}/style-rag/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();

    try {
      const parsed = JSON.parse(text) as { message?: unknown };
      const errorMessage = Array.isArray(parsed.message)
        ? parsed.message.join('，')
        : parsed.message;

      throw new Error(
        typeof errorMessage === 'string' ? errorMessage : '上传风格图失败',
      );
    } catch {
      throw new Error(text || '上传风格图失败');
    }
  }

  return (await response.json()) as StyleReferenceSummary;
}

export async function uploadGenerateReferenceImage(body: { file: File }) {
  const formData = new FormData();
  formData.append('file', body.file);

  const response = await fetch(`${API_BASE_URL}/generate-agent/upload`, {
    method: 'POST',
    body: formData,
  });

  const text = await response.text();

  if (!response.ok) {
    try {
      const parsed = JSON.parse(text) as { message?: unknown };
      const errorMessage = Array.isArray(parsed.message)
        ? parsed.message.join('，')
        : parsed.message;

      throw new Error(
        typeof errorMessage === 'string' ? errorMessage : '上传参考图失败',
      );
    } catch {
      throw new Error(text || '上传参考图失败');
    }
  }

  try {
    return JSON.parse(text) as string;
  } catch {
    return text;
  }
}
