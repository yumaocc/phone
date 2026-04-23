export interface AssistantMessageDto {
  role: 'assistant';
  content: string;
}

export interface ChatResponseDto {
  conversationId: string;
  message: AssistantMessageDto;
  taskId?: string;
}
