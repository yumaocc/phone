import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { createQdrantClient } from './qdrant.config';

@Module({
  providers: [
    {
      provide: QdrantClient,
      useFactory: (configService: ConfigService) => {
        const baseUrl =
          configService.get<string>('QDRANT_URL') || 'http://localhost:6333';
        return createQdrantClient(baseUrl);
      },
      inject: [ConfigService],
    },
  ],
  exports: [QdrantClient],
})
export class QdrantModule {}
