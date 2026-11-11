import { z } from "zod";

export const askFiltersSchema = z
  .object({
    country: z.string().trim().max(80).optional(),
    yearFrom: z.number().int().min(1900).max(2100).optional(),
    yearTo: z.number().int().min(1900).max(2100).optional(),
    includeInternational: z.boolean().optional(),
    includeEthiopia: z.boolean().optional(),
  })
  .refine((filters) => filters.yearFrom === undefined || filters.yearTo === undefined || filters.yearFrom <= filters.yearTo, {
    message: "yearFrom must be less than or equal to yearTo",
  });

export const askRequestSchema = z.object({
  question: z.string().trim().min(8).max(2000),
  filters: askFiltersSchema.optional(),
});

export const ingestMetadataSchema = z.object({
  title: z.string().trim().min(1).max(500),
  externalId: z.string().trim().min(1).max(200).optional(),
  authors: z.array(z.string().trim().min(1)).max(40).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  journal: z.string().trim().max(300).optional(),
  abstract: z.string().trim().max(20000).optional(),
  sourceUrl: z.string().trim().url().optional(),
  scope: z.enum(["ethiopia", "international"]).optional(),
  diseaseTags: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
});

export const ingestJsonSchema = z.object({
  externalId: z.string().trim().min(1).max(200).optional(),
  metadata: ingestMetadataSchema.optional(),
});

export type AskRequestInput = z.infer<typeof askRequestSchema>;
export type IngestMetadataInput = z.infer<typeof ingestMetadataSchema>;
