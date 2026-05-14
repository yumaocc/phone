import { Module } from '@nestjs/common';
import { StyleRagController } from './style-rag.controller';
import { StyleRagService } from './style-rag.service';
import { QdrantModule } from '../qdrant/qdrant.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [QdrantModule, UserModule],
  controllers: [StyleRagController],
  providers: [StyleRagService],
  exports: [StyleRagService],
})
export class StyleRagModule {}
