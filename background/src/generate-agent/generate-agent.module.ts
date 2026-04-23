import { Module } from '@nestjs/common';
import { GenerateAgentService } from './generate-agent.service';
import { GenerateAgentController } from './generate-agent.controller';

@Module({
  controllers: [GenerateAgentController],
  providers: [GenerateAgentService],
  exports: [GenerateAgentService],
})
export class GenerateAgentModule {}
