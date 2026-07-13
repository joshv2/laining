import { RecordingSource } from "@prisma/client";
import { z } from "zod";

export const createRecordingSchema = z.object({
  primaryPasukId: z.string().min(1),
  rangeStartPasukId: z.string().min(1),
  rangeEndPasukId: z.string().min(1),
  source: z.nativeEnum(RecordingSource),
  nussach: z.string().min(1),
  nussachCustom: z.string().max(100).optional(),
  storageKey: z.string().min(1),
  publicUrl: z.string().url(),
  durationMs: z.number().int().positive(),
});

export type CreateRecordingInput = z.infer<typeof createRecordingSchema>;

export function normalizeNussach(input: { nussach: string; nussachCustom?: string }): {
  nussach: string;
  nussachCustom?: string;
} {
  return {
    nussach: input.nussach.trim(),
    nussachCustom: input.nussachCustom?.trim() || undefined,
  };
}
