import z from 'zod';

export const StyleReferenceAnalysisDto = z.object({
  title: z.string(),
  summary: z.string(),
  styleTags: z.array(z.string()).default([]),
  colorTags: z.array(z.string()).default([]),
  compositionTags: z.array(z.string()).default([]),
  moodTags: z.array(z.string()).default([]),
  negativeTags: z.array(z.string()).default([]),
  retrievableText: z.string(),
});

export type StyleReferenceAnalysis = z.infer<typeof StyleReferenceAnalysisDto>;

export const StyleReferenceEntryDto = z.object({
  id: z.string(),
  originalName: z.string(),
  storedName: z.string(),
  mimeType: z.string(),
  localPath: z.string(),
  note: z.string().optional(),
  createdAt: z.string(),
  analysis: StyleReferenceAnalysisDto,
  content: z.string(),
  embedding: z.array(z.number()),
});

export type StyleReferenceEntry = z.infer<typeof StyleReferenceEntryDto>;

export const StyleReferenceSummaryDto = z.object({
  id: z.string(),
  originalName: z.string(),
  storedName: z.string(),
  mimeType: z.string(),
  note: z.string().optional(),
  createdAt: z.string(),
  analysis: StyleReferenceAnalysisDto,
});

export type StyleReferenceSummary = z.infer<typeof StyleReferenceSummaryDto>;

export const StyleReferenceSearchResultDto = StyleReferenceSummaryDto.extend({
  score: z.number(),
});

export type StyleReferenceSearchResult = z.infer<
  typeof StyleReferenceSearchResultDto
>;
