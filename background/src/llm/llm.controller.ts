import { Body, Controller, Get, Post } from '@nestjs/common';
import { ChatResponseDto } from './dto/chat-response.dto';
import { LlmService } from './llm.service';

@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post('/msg')
  message(
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
    return this.llmService.message(
      body.message ?? '',
      body.conversationId,
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
