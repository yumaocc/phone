import { Module } from '@nestjs/common';
import { StyleRagController } from './style-rag.controller';
import { StyleRagService } from './style-rag.service';

@Module({
  controllers: [StyleRagController],
  providers: [StyleRagService],
  exports: [StyleRagService],
})
export class StyleRagModule {}
