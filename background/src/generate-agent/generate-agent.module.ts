import { Module } from '@nestjs/common';
import { GenerateAgentService } from './generate-agent.service';
import { GenerateAgentController } from './generate-agent.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  controllers: [GenerateAgentController],
  providers: [GenerateAgentService],
  exports: [GenerateAgentService],
})
export class GenerateAgentModule {}
