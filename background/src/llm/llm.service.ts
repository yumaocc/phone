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
import {
  LLM_PROMPTS,
  GENERATE_IMAGE_TOOL_DESCRIPTION,
} from '../prompts/prompts';

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
            description: GENERATE_IMAGE_TOOL_DESCRIPTION,
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
    userId?: string,
    imageUrls: string[] = [],
    size?: string,
    n?: number,
    metadata?: GenerateImageMetadata,
  ): Promise<ChatResponseDto> {
    const currentConversationId = conversationId ?? randomUUID();
    // 为每个用户创建独立的会话 ID，格式：userId:conversationId
    const threadId = userId ? `${userId}:${currentConversationId}` : currentConversationId;

    const styleContext = await this.styleRagService.buildStyleContext(msg, userId);
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
          thread_id: threadId,
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
      LLM_PROMPTS.identity,
      LLM_PROMPTS.responsibility,
      LLM_PROMPTS.optimizationDimensions,
      LLM_PROMPTS.conversationContinuity,
      referenceImageCount
        ? LLM_PROMPTS.referenceImageWithImages(referenceImageCount)
        : LLM_PROMPTS.referenceImageWithoutImages,
      size
        ? LLM_PROMPTS.sizeSpecified(size)
        : LLM_PROMPTS.sizeNotSpecified,
      typeof n === 'number'
        ? LLM_PROMPTS.quantitySpecified(n)
        : LLM_PROMPTS.quantityNotSpecified,
      metadata?.resolution
        ? LLM_PROMPTS.resolutionSpecified(metadata.resolution)
        : LLM_PROMPTS.resolutionNotSpecified,
      metadata?.google_search
        ? LLM_PROMPTS.googleSearchEnabled
        : LLM_PROMPTS.googleSearchDisabled,
      metadata?.google_image_search
        ? LLM_PROMPTS.googleImageSearchEnabled
        : LLM_PROMPTS.googleImageSearchDisabled,
      LLM_PROMPTS.missingCriticalInfo,
      LLM_PROMPTS.missingSecondaryInfo,
      LLM_PROMPTS.toolCallInstruction,
      LLM_PROMPTS.sizeRecommendation,
      LLM_PROMPTS.responseStyle,
      LLM_PROMPTS.characterConsistency,
      LLM_PROMPTS.storyCoherence,
      LLM_PROMPTS.chineseAesthetic,
      styleContext
        ? LLM_PROMPTS.styleContextWithResults(styleContext)
        : LLM_PROMPTS.styleContextWithoutResults,
    ].join('\n\n');
  }
}
