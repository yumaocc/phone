import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { LlmModule } from './llm/llm.module';
import { GenerateAgentModule } from './generate-agent/generate-agent.module';
import { StyleRagModule } from './style-rag/style-rag.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 设置为全局模块，这样就不用每个模块都导入了
    }),
    LlmModule,
    GenerateAgentModule,
    StyleRagModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
