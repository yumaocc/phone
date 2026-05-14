import { Body, Controller, Get, Post, Request } from '@nestjs/common';
import { ChatResponseDto } from './dto/chat-response.dto';
import { LlmService } from './llm.service';

@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post('/msg')
  message(
    @Request() req: any,
    @Body()
    body: {
      message?: string;
      conversationId?: string;
      imageUrls?: string[];
      size?: string;
      n?: number;
      metadata?: {
        resolution?: string;
        google_search?: boolean;
        google_image_search?: boolean;
      };
    },
  ): Promise<ChatResponseDto> {
    const userId = req?.userId;
    return this.llmService.message(
      body.message ?? '',
      body.conversationId,
      userId,
      body.imageUrls,
      body.size,
      body.n,
      body.metadata,
    );
  }

  @Get('/')
  get() {
    return '';
  }
}
