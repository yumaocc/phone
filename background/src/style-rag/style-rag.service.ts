import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import {
  StyleReferenceAnalysisDto,
  type StyleReferenceEntry,
  type StyleReferenceSearchResult,
  StyleReferenceSearchResultDto,
  type StyleReferenceSummary,
  StyleReferenceSummaryDto,
} from './style-rag.dto';
import { STYLE_RAG_PROMPTS } from '../prompts/prompts';

@Injectable()
export class StyleRagService implements OnModuleInit {
  private readonly collectionName = 'style_references';
  private readonly logger = new Logger(StyleRagService.name);
  private readonly uploadDir = path.join(
    process.cwd(),
    'local-data',
    'style-rag',
    'uploads',
  );
  private embeddings: OpenAIEmbeddings | null = null;
  private entriesCache: Map<string, StyleReferenceEntry> = new Map();
  private qdrantAvailable = false;

  constructor(
    private configService: ConfigService,
    private qdrantClient: QdrantClient,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initializeCollection();
  }

  private async initializeCollection(): Promise<void> {
    try {
      await this.qdrantClient.getCollection(this.collectionName);
      this.qdrantAvailable = true;
    } catch {
      try {
        // Qwen embedding model uses 1024 dimensions
        const embeddingDim = 1024;
        await this.qdrantClient.createCollection(this.collectionName, {
          vectors: {
            size: embeddingDim,
            distance: 'Cosine',
          },
        });
        this.qdrantAvailable = true;
      } catch (error) {
        this.qdrantAvailable = false;
        this.logger.warn(
          `Qdrant unavailable, style RAG disabled during this run: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private getEmbeddings(): OpenAIEmbeddings {
    if (!this.embeddings) {
      const modelName = this.getEmbeddingModelName();
      if (!modelName) {
        throw new BadRequestException(
          '未配置嵌入模型，请设置 QWEN_EMBEDDING_MODEL 或 EMBEDDING_MODEL',
        );
      }

      this.embeddings = new OpenAIEmbeddings({
        apiKey: this.configService.get<string>('QWEN_API_KEY')!,
        model: modelName,
        configuration: {
          baseURL: this.configService.get<string>('QWEN_BASE_URL'),
        },
      });
    }

    return this.embeddings;
  }

  async uploadStyleReference(
    file:
      | { originalname: string; mimetype: string; buffer: Buffer }
      | undefined,
    userId: string,
    note?: string,
    isPublic: boolean = false,
  ): Promise<StyleReferenceSummary> {
    if (!this.qdrantAvailable) {
      throw new InternalServerErrorException(
        'Qdrant 不可用，暂时无法上传风格参考图',
      );
    }

    if (!file) {
      throw new BadRequestException('请先上传图片文件');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('仅支持图片文件');
    }

    // 限制文件大小为 10MB，防止内存溢出
    const maxFileSize = 10 * 1024 * 1024;
    if (file.buffer.length > maxFileSize) {
      throw new BadRequestException('文件大小不能超过 10MB');
    }

    await this.ensureUploadDir();

    const extension =
      path.extname(file.originalname) || this.getExtension(file.mimetype);
    const storedName = `${randomUUID()}${extension}`;
    const localPath = path.join(this.uploadDir, storedName);

    await fs.writeFile(localPath, file.buffer);

    const analysis = await this.analyzeImage(file.buffer, file.mimetype, note);
    const content = this.buildRetrievableContent(analysis, note);
    const embedding = await this.embedText(content);

    const entry: StyleReferenceEntry = {
      id: randomUUID(),
      originalName: file.originalname,
      storedName,
      mimeType: file.mimetype,
      localPath,
      note: note?.trim() || undefined,
      createdAt: new Date().toISOString(),
      analysis,
      content,
      embedding,
    };

    // Store in Qdrant，包含用户 ID 和公开状态
    await this.qdrantClient.upsert(this.collectionName, {
      points: [
        {
          id: this.stringToId(entry.id),
          vector: embedding,
          payload: {
            id: entry.id,
            userId,
            isPublic,
            originalName: entry.originalName,
            storedName: entry.storedName,
            mimeType: entry.mimeType,
            localPath: entry.localPath,
            note: entry.note,
            createdAt: entry.createdAt,
            analysis: JSON.stringify(entry.analysis),
            content: entry.content,
          },
        },
      ],
    });

    // 更新缓存，确保新上传的参考图立即可用
    this.entriesCache.set(entry.id, entry);

    return this.toSummary(entry);
  }

  async listStyleReferences(userId: string): Promise<StyleReferenceSummary[]> {
    const entries = await this.getAllEntries();
    // 只返回该用户的参考或公开的参考
    const filtered = entries.filter(
      (entry) =>
        (entry as any).userId === userId || (entry as any).isPublic === true,
    );
    return filtered.map((entry) => this.toSummary(entry));
  }

  async searchStyleReferences(
    query: string,
    userId?: string,
    limit = 3,
  ): Promise<StyleReferenceSearchResult[]> {
    const trimmedQuery = query.trim();

    if (
      !trimmedQuery ||
      !this.getEmbeddingModelName() ||
      !this.qdrantAvailable
    ) {
      return [];
    }

    const queryEmbedding = await this.embedText(trimmedQuery);

    // 设置相关度阈值为 0.5，确保只返回相关度较高的参考
    // 对于漫画参考，相关度太低的结果会误导生成
    const results = await this.qdrantClient.search(this.collectionName, {
      vector: queryEmbedding,
      limit,
      score_threshold: 0.5,
      // 如果提供了 userId，则过滤该用户的参考或公开参考
      filter: userId
        ? {
            must: [
              {
                should: [
                  { key: 'userId', match: { value: userId } },
                  { key: 'isPublic', match: { value: true } },
                ],
              },
            ],
          }
        : undefined,
    });

    return results.map((result) => {
      const payload = result.payload as Record<string, unknown>;
      const analysis = JSON.parse(payload.analysis as string);

      return StyleReferenceSearchResultDto.parse({
        id: payload.id,
        originalName: payload.originalName,
        storedName: payload.storedName,
        mimeType: payload.mimeType,
        note: payload.note,
        createdAt: payload.createdAt,
        analysis,
        score: result.score,
      });
    });
  }

  async buildStyleContext(query: string, userId?: string, limit = 3): Promise<string> {
    const references = await this.searchStyleReferences(query, userId, limit);

    if (!references.length) {
      return '';
    }

    return references
      .map((reference, index) => {
        const blocks = [
          `漫画参考 ${index + 1}（相关度 ${(reference.score * 100).toFixed(1)}%）`,
          `标题：${reference.analysis.title}`,
          `摘要：${reference.analysis.summary}`,
        ];

        // 只在有内容时才添加标签，避免"无"的重复
        if (reference.analysis.styleTags.length > 0) {
          blocks.push(`美术风格：${reference.analysis.styleTags.join('、')}`);
        }

        if (reference.analysis.colorTags.length > 0) {
          blocks.push(`色彩基调：${reference.analysis.colorTags.join('、')}`);
        }

        if (reference.analysis.compositionTags.length > 0) {
          blocks.push(`分镜构图：${reference.analysis.compositionTags.join('、')}`);
        }

        if (reference.analysis.moodTags.length > 0) {
          blocks.push(`故事氛围：${reference.analysis.moodTags.join('、')}`);
        }

        if (reference.analysis.negativeTags.length > 0) {
          blocks.push(`应避免：${reference.analysis.negativeTags.join('、')}`);
        }

        if (reference.note) {
          blocks.push(`用户备注：${reference.note}`);
        }

        return blocks.join('\n');
      })
      .join('\n\n');
  }

  private async analyzeImage(buffer: Buffer, mimeType: string, note?: string) {
    const model = new ChatOpenAI({
      apiKey: this.configService.get<string>('QWEN_API_KEY')!,
      model:
        this.configService.get<string>('QWEN_VISION_MODEL') ??
        this.configService.get<string>('QWEN_CHAT_MODEL')!,
      configuration: {
        baseURL: this.configService.get<string>('QWEN_BASE_URL'),
      },
    });

    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    const response = await model.invoke([
      {
        role: 'system',
        content: STYLE_RAG_PROMPTS.systemPrompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: STYLE_RAG_PROMPTS.userPromptTemplate(note),
          },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl,
            },
          },
        ],
      },
    ]);

    return StyleReferenceAnalysisDto.parse(this.parseJson(response.text));
  }

  private async embedText(text: string): Promise<number[]> {
    return this.getEmbeddings().embedQuery(text);
  }

  private getEmbeddingModelName(): string | undefined {
    return (
      this.configService.get<string>('QWEN_EMBEDDING_MODEL') ??
      this.configService.get<string>('EMBEDDING_MODEL')
    );
  }

  private buildRetrievableContent(
    analysis: StyleReferenceEntry['analysis'],
    note?: string,
  ): string {
    const sections = [
      `标题：${analysis.title}`,
      `摘要：${analysis.summary}`,
      `风格标签：${analysis.styleTags.join('、') || '无'}`,
      `配色标签：${analysis.colorTags.join('、') || '无'}`,
      `构图标签：${analysis.compositionTags.join('、') || '无'}`,
      `氛围标签：${analysis.moodTags.join('、') || '无'}`,
      `负面标签：${analysis.negativeTags.join('、') || '无'}`,
      `向量检索文本：${analysis.retrievableText}`,
    ];

    if (note?.trim()) {
      sections.push(`用户备注：${note.trim()}`);
    }

    return sections.join('\n');
  }

  private async ensureUploadDir(): Promise<void> {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  private async getAllEntries(): Promise<StyleReferenceEntry[]> {
    if (!this.qdrantAvailable) {
      return [];
    }

    // 如果缓存已有数据，直接返回
    if (this.entriesCache.size > 0) {
      return Array.from(this.entriesCache.values());
    }

    // 从 Qdrant 加载所有条目
    const results = await this.qdrantClient.scroll(this.collectionName, {
      limit: 1000,
      with_vector: true,
    });

    const entries: StyleReferenceEntry[] = results.points.map((point) => {
      const payload = point.payload as Record<string, unknown>;
      const vector = Array.isArray(point.vector) ? point.vector : [];
      return {
        id: payload.id as string,
        originalName: payload.originalName as string,
        storedName: payload.storedName as string,
        mimeType: payload.mimeType as string,
        localPath: payload.localPath as string,
        note: (payload.note as string) || undefined,
        createdAt: payload.createdAt as string,
        analysis: JSON.parse(payload.analysis as string),
        content: payload.content as string,
        embedding: vector as number[],
      };
    });

    // 填充缓存，后续新上传的参考图会通过 uploadStyleReference 更新缓存
    entries.forEach((entry) => this.entriesCache.set(entry.id, entry));
    return entries;
  }

  private toSummary(entry: StyleReferenceEntry): StyleReferenceSummary {
    return StyleReferenceSummaryDto.parse({
      id: entry.id,
      originalName: entry.originalName,
      storedName: entry.storedName,
      mimeType: entry.mimeType,
      note: entry.note,
      createdAt: entry.createdAt,
      analysis: entry.analysis,
    });
  }

  private getExtension(mimeType: string): string {
    if (mimeType === 'image/png') {
      return '.png';
    }

    if (mimeType === 'image/webp') {
      return '.webp';
    }

    if (mimeType === 'image/gif') {
      return '.gif';
    }

    return '.jpg';
  }

  private parseJson(text: string): unknown {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
    const candidate = fenced?.[1] ?? trimmed;

    try {
      return JSON.parse(candidate);
    } catch (error) {
      throw new InternalServerErrorException({
        message: '风格分析结果不是合法 JSON',
        raw: text,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private stringToId(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
