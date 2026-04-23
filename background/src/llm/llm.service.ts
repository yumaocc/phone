import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AIMessage, BaseMessage, ToolMessage } from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent, summarizationMiddleware, tool } from 'langchain';
import { GenerateAgentService } from '../generate-agent/generate-agent.service';
import {
  GenerateImageDto,
  GenerateImageInput,
} from '../generate-agent/generate-image.dto';
import { StyleRagService } from '../style-rag/style-rag.service';
import { type ChatResponseDto } from './dto/chat-response.dto';

type GenerateImageMetadata = {
  resolution?: string;
  google_search?: boolean;
  google_image_search?: boolean;
};

@Injectable()
export class LlmService {
  private readonly checkpointer = new MemorySaver();

  constructor(
    private configService: ConfigService,
    private generateAgentService: GenerateAgentService,
    private styleRagService: StyleRagService,
  ) {}

  create(
    systemPrompt: string,
    imageUrls: string[] = [],
    size?: string,
    n?: number,
    metadata?: GenerateImageMetadata,
  ) {
    const model = new ChatOpenAI({
      apiKey: this.configService.get<string>('QWEN_API_KEY')!,
      model: this.configService.get<string>('QWEN_CHAT_MODEL')!,
      configuration: {
        baseURL: this.configService.get<string>('QWEN_BASE_URL'),
      },
    });

    const agent = createAgent({
      model,
      checkpointer: this.checkpointer,
      middleware: [
        summarizationMiddleware({
          model,
          trigger: { tokens: 10000, messages: 20 },
          keep: { messages: 12 },
        }),
      ],
      tools: [
        tool(
          async (input: GenerateImageInput) => {
            const task = await this.generateAgentService.generateImage({
              ...input,
              ...(imageUrls.length ? { image_urls: imageUrls } : {}),
              ...(size ? { size } : {}),
              ...(typeof n === 'number' ? { n } : {}),
              ...(metadata ? { metadata } : {}),
            });
            return { taskId: task.id };
          },
          {
            name: 'generate_image',
            description:
              '根据已经补全的信息创建图片生成任务。必须提供经过优化后的完整 prompt，不要直接照抄用户原句；如果用户要求参考已有图片，可以通过 image_urls 传入图片 URL。该工具只返回 taskId，前端会基于 taskId 查询最终图片结果。',
            schema: GenerateImageDto,
          },
        ),
      ],
      systemPrompt: systemPrompt,
    });
    return agent;
  }

  async message(
    msg: string,
    conversationId?: string,
    imageUrls: string[] = [],
    size?: string,
    n?: number,
    metadata?: GenerateImageMetadata,
  ): Promise<ChatResponseDto> {
    const currentConversationId = conversationId ?? randomUUID();
    const styleContext = await this.styleRagService.buildStyleContext(msg);
    const agent = this.create(
      this.buildSystemPrompt(styleContext, imageUrls.length, size, n, metadata),
      imageUrls,
      size,
      n,
      metadata,
    );
    const userMessage = msg.trim() || '请参考我上传的图片生成图像。';

    const result = await agent.invoke(
      {
        messages: [{ role: 'user', content: userMessage }],
      },
      {
        configurable: {
          thread_id: currentConversationId,
        },
      },
    );
    const assistantContent = this.getAssistantContent(result.messages);
    const taskId = this.getTaskId(result.messages);

    return {
      conversationId: currentConversationId,
      message: {
        role: 'assistant',
        content:
          assistantContent ||
          (taskId
            ? `图片任务已创建，请使用 taskId ${taskId} 查询结果。`
            : '我暂时没能生成有效回复，请重试。'),
      },
      taskId,
    };
  }

  private getAssistantContent(messages: BaseMessage[]): string {
    const assistantMessage = [...messages].reverse().find((message) => {
      if (!AIMessage.isInstance(message)) {
        return false;
      }

      return !message.tool_calls?.length && message.text.trim();
    });

    return assistantMessage?.text.trim() ?? '';
  }

  private getTaskId(messages: BaseMessage[]): string | undefined {
    const toolMessage = [...messages].reverse().find((message) => {
      return (
        ToolMessage.isInstance(message) && message.name === 'generate_image'
      );
    });

    if (!toolMessage) {
      return undefined;
    }

    try {
      const result = JSON.parse(toolMessage.text) as { taskId?: unknown };

      return typeof result.taskId === 'string' ? result.taskId : undefined;
    } catch {
      return undefined;
    }
  }

  private buildSystemPrompt(
    styleContext: string,
    referenceImageCount: number,
    size?: string,
    n?: number,
    metadata?: GenerateImageMetadata,
  ): string {
    return [
      '你的回答必须使用中文。你是一个资深的 AI 绘画提示词专家，同时也是图片生成助手。',
      '你的核心职责不是照抄用户原话，而是先理解用户意图，再把用户输入优化成适合生图模型直接使用的高质量提示词。',
      '优化提示词时，你要优先整合这些维度：主体、场景、动作、构图、镜头或视角、风格、光线、色彩、氛围、材质细节、画面质量、需要避免的问题，如果缺少关键信息，应该即使向用户提问，补充关键词，然后再去做提示词的生成。',
      '如果用户是在已有对话基础上追加修改，你必须保留已经确认的关键信息，只修改用户这次明确要求调整的部分。',
      referenceImageCount
        ? `当前这轮请求在底层已经附带了 ${referenceImageCount} 张参考图。你不需要再向用户索取图片，也不要说“没有收到参考图”。如果用户本轮意图依赖参考图，请直接基于这些参考图来组织提示词；系统会在调用 generate_image 时自动把参考图传入 image_urls。`
        : '当前这轮请求没有附带参考图。',
      size
        ? `当前这轮请求在界面上已经指定图片比例为 ${size}。你不需要再追问比例，也不要自行修改这个参数；系统会在调用 generate_image 时自动传入。`
        : '当前这轮请求没有在界面上指定图片比例，如果用户也没有明确说明，你可以根据画面用途自行判断合适比例。',
      typeof n === 'number'
        ? `当前这轮请求在界面上已经指定生成数量为 ${n} 张。你不需要再追问张数，也不要自行修改这个参数；系统会在调用 generate_image 时自动传入。`
        : '当前这轮请求没有在界面上指定生成数量。',
      metadata?.resolution
        ? `当前这轮请求在界面上已经指定输出分辨率为 ${metadata.resolution}。你不需要再追问分辨率，也不要自行修改这个参数；系统会在调用 generate_image 时自动传入 metadata.resolution。`
        : '当前这轮请求没有在界面上指定输出分辨率。',
      metadata?.google_search
        ? '当前这轮请求已开启 Google 文字搜索增强。系统会在调用 generate_image 时自动传入 metadata.google_search=true。'
        : '当前这轮请求未开启 Google 文字搜索增强。',
      metadata?.google_image_search
        ? '当前这轮请求已开启 Google 图片搜索增强。系统会在调用 generate_image 时自动传入 metadata.google_image_search=true。'
        : '当前这轮请求未开启 Google 图片搜索增强。',
      '如果关键信息缺失，并且会明显影响生成结果，例如主体不明确、场景冲突、风格方向差异很大、比例用途会显著影响构图，你必须先追问 1 到 2 个最关键的问题，暂时不要调用 generate_image。',
      '如果只是次要信息缺失，例如镜头轻微细节、局部材质、少量装饰元素，你可以自行补全合理默认值，并直接继续生成。',
      '当信息足够时，你必须调用 generate_image。传入工具的 prompt 必须是你优化后的完整提示词，而不是用户原始输入。',
      '只有在界面没有指定比例时，你才需要根据画面方向顺便给出合理的 size。例如人物海报或手机壁纸更适合 9:16，通用头像或社媒封面可用 1:1，横向场景更适合 16:9。',
      '调用工具成功后，你对用户的回复要简洁，只需要说明你已经优化提示词并创建了图片任务，不要把冗长的完整提示词原样全部贴给用户，除非用户明确要求查看。',
      styleContext
        ? `以下是你当前检索到的长期风格记忆，请优先参考这些风格特征来完善提示词，但不要把这些检索文本原样复述给用户：\n\n${styleContext}`
        : '当前还没有检索到可用的长期风格记忆。',
    ].join('\n\n');
  }
}
