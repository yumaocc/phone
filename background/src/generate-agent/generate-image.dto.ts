import z from 'zod';

export const GenerateImageUrlDto = z.union([
  z.string().url(),
  z.object({
    url: z.string().url(),
  }),
]);

export const GenerateImageDto = z.object({
  prompt: z.string().describe('已经优化后的完整图片生成提示词'),
  model: z.string().optional().describe('模型'),
  size: z.string().optional().describe('图像宽高比'),
  n: z.number().int().positive().optional().describe('生成图像的数量'),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('供应商额外配置'),
  image_urls: z
    .array(GenerateImageUrlDto)
    .optional()
    .describe('图生图依赖数组，既支持字符串 URL，也支持 { url } 结构'),
});

export type GenerateImageInput = z.infer<typeof GenerateImageDto>;

export const GenerateImageResponseDto = z
  .object({
    id: z.string(),
    object: z.literal('generation.task'),
    model: z.string(),
    status: z.enum(['queued', 'in_progress', 'completed', 'failed', 'pending']),
    progress: z.number().default(0),
    created_at: z.number(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .passthrough();

export type GenerateImageResponse = z.infer<typeof GenerateImageResponseDto>;

export const GenerateImageTaskResponseDto = GenerateImageResponseDto.extend({
  data: z.array(z.unknown()).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.unknown().optional(),
  message: z.string().optional(),
}).passthrough();

export type GenerateImageTaskResponse = z.infer<
  typeof GenerateImageTaskResponseDto
>;
