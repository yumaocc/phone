import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import {
  StyleReferenceAnalysisDto,
  type StyleReferenceEntry,
  StyleReferenceEntryDto,
  type StyleReferenceSearchResult,
  StyleReferenceSearchResultDto,
  type StyleReferenceSummary,
  StyleReferenceSummaryDto,
} from './style-rag.dto';

@Injectable()
export class StyleRagService {
  private readonly storageDir = path.join(
    process.cwd(),
    'local-data',
    'style-rag',
  );
  private readonly uploadDir = path.join(this.storageDir, 'uploads');
  private readonly indexFile = path.join(this.storageDir, 'styles.json');
  private entriesCache: StyleReferenceEntry[] | null = null;

  constructor(private configService: ConfigService) {}

  // 接收一张风格参考图，完成分析、向量化并写入本地索引。
  async uploadStyleReference(
    file:
      | { originalname: string; mimetype: string; buffer: Buffer }
      | undefined,
    note?: string,
  ): Promise<StyleReferenceSummary> {
    if (!file) {
      throw new BadRequestException('请先上传图片文件');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('仅支持图片文件');
    }

    await this.ensureStorage();

    const extension =
      path.extname(file.originalname) || this.getExtension(file.mimetype);
    const storedName = `${randomUUID()}${extension}`;
    const localPath = path.join(this.uploadDir, storedName);

    await fs.writeFile(localPath, file.buffer);

    const analysis = await this.analyzeImage(file.buffer, file.mimetype, note);
    const content = this.buildRetrievableContent(analysis, note);
    const embedding = await this.embedText(content);
    const entries = await this.loadEntries();

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

    entries.unshift(entry);
    await this.saveEntries(entries);

    return this.toSummary(entry);
  }

  // 返回当前已经入库的风格参考图摘要列表。
  async listStyleReferences(): Promise<StyleReferenceSummary[]> {
    const entries = await this.loadEntries();

    return entries.map((entry) => this.toSummary(entry));
  }

  // 对用户查询做向量检索，返回最相关的风格参考结果。
  async searchStyleReferences(
    query: string,
    limit = 3,
  ): Promise<StyleReferenceSearchResult[]> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return [];
    }

    const embeddingModelName = this.getEmbeddingModelName();

    if (!embeddingModelName) {
      return [];
    }

    const entries = await this.loadEntries();

    if (!entries.length) {
      return [];
    }

    const queryEmbedding = await this.embedText(trimmedQuery);

    return entries
      .map((entry) => ({
        ...this.toSummary(entry),
        score: this.cosineSimilarity(queryEmbedding, entry.embedding),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .filter((entry) => entry.score > 0)
      .map((entry) => StyleReferenceSearchResultDto.parse(entry));
  }

  // 将检索结果整理成可注入给模型的风格上下文文本。
  async buildStyleContext(query: string, limit = 3): Promise<string> {
    const references = await this.searchStyleReferences(query, limit);

    if (!references.length) {
      return '';
    }

    return references
      .map((reference, index) => {
        const blocks = [
          `风格参考 ${index + 1}（相关度 ${reference.score.toFixed(3)}）`,
          `标题：${reference.analysis.title}`,
          `摘要：${reference.analysis.summary}`,
          `风格标签：${reference.analysis.styleTags.join('、') || '无'}`,
          `配色：${reference.analysis.colorTags.join('、') || '无'}`,
          `构图：${reference.analysis.compositionTags.join('、') || '无'}`,
          `氛围：${reference.analysis.moodTags.join('、') || '无'}`,
          `避免：${reference.analysis.negativeTags.join('、') || '无'}`,
        ];

        if (reference.note) {
          blocks.push(`用户备注：${reference.note}`);
        }

        return blocks.join('\n');
      })
      .join('\n\n');
  }

  // 调用视觉模型分析图片，并约束返回结构化 JSON。
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
        content:
          '你是一个图片风格分析助手。请分析用户提供的风格参考图，并严格返回 JSON，不要输出任何额外说明。JSON 字段必须包含：title、summary、styleTags、colorTags、compositionTags、moodTags、negativeTags、retrievableText。',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              `请从风格、配色、构图、光线、材质、氛围、适合延续的审美方向、应避免的问题等角度分析这张图片。` +
              `如果用户有备注，也要一起纳入分析。用户备注：${note?.trim() || '无'}` +
              '请确保 retrievableText 是适合做向量检索的中文自然语言总结。',
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

  // 将文本转换成向量，供后续相似度检索使用。
  private async embedText(text: string): Promise<number[]> {
    const modelName = this.getEmbeddingModelName();

    if (!modelName) {
      throw new BadRequestException(
        '未配置嵌入模型，请设置 QWEN_EMBEDDING_MODEL 或 EMBEDDING_MODEL',
      );
    }

    const embeddings = new OpenAIEmbeddings({
      apiKey: this.configService.get<string>('QWEN_API_KEY')!,
      model: modelName,
      configuration: {
        baseURL: this.configService.get<string>('QWEN_BASE_URL'),
      },
    });

    return embeddings.embedQuery(text);
  }

  // 统一读取当前可用的嵌入模型名称。
  private getEmbeddingModelName(): string | undefined {
    return (
      this.configService.get<string>('QWEN_EMBEDDING_MODEL') ??
      this.configService.get<string>('EMBEDDING_MODEL')
    );
  }

  // 把分析结果和用户备注拼成更适合向量检索的文本。
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

  // 确保本地目录和索引文件已经创建。
  private async ensureStorage(): Promise<void> {
    await fs.mkdir(this.uploadDir, { recursive: true });

    try {
      await fs.access(this.indexFile);
    } catch {
      await fs.writeFile(this.indexFile, '[]', 'utf8');
    }
  }

  // 从本地 JSON 读取风格索引，并在内存中缓存结果。
  private async loadEntries(): Promise<StyleReferenceEntry[]> {
    if (this.entriesCache) {
      return this.entriesCache;
    }

    await this.ensureStorage();

    const raw = await fs.readFile(this.indexFile, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const entries = StyleReferenceEntryDto.array().parse(parsed);

    this.entriesCache = entries;
    return entries;
  }

  // 将最新索引写回本地文件，同时刷新内存缓存。
  private async saveEntries(entries: StyleReferenceEntry[]): Promise<void> {
    this.entriesCache = entries;

    await fs.writeFile(
      this.indexFile,
      JSON.stringify(entries, null, 2),
      'utf8',
    );
  }

  // 把完整索引项转换成前端展示用的摘要结构。
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

  // 根据 MIME 类型推导本地落盘时的文件扩展名。
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

  // 兼容模型返回的代码块文本，并解析出 JSON 对象。
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

  // 计算两个向量的余弦相似度，用于检索排序。
  private cosineSimilarity(left: number[], right: number[]): number {
    if (!left.length || !right.length || left.length !== right.length) {
      return 0;
    }

    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;

    for (let index = 0; index < left.length; index += 1) {
      dot += left[index] * right[index];
      leftNorm += left[index] * left[index];
      rightNorm += right[index] * right[index];
    }

    if (!leftNorm || !rightNorm) {
      return 0;
    }

    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
  }
}
