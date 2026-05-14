import { QdrantClient } from '@qdrant/js-client-rest';

export function createQdrantClient(baseUrl: string): QdrantClient {
  return new QdrantClient({
    url: baseUrl,
  });
}
