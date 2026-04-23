import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { GenerateAgentModule } from '../generate-agent/generate-agent.module';
import { StyleRagModule } from '../style-rag/style-rag.module';

@Module({
  imports: [GenerateAgentModule, StyleRagModule],
  controllers: [LlmController],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
