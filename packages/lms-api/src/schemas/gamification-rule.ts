import { z } from "zod/v4";

const gamificationEventEnum = z.enum([
  "LESSON_COMPLETED",
  "LIVE_SESSION_ATTENDED",
  "ASSESSMENT_SUBMITTED",
  "STREAK_MILESTONE",
  "PROGRAM_COMPLETED",
  "MODULE_COMPLETED",
  "ENROLLMENT_CREATED",
]);

export const createRuleSchema = z.object({
  event: gamificationEventEnum,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  xpReward: z.number().int().min(0),
  badgeId: z.string().uuid().optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
});

export const updateRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  xpReward: z.number().int().min(0).optional(),
  badgeId: z.string().uuid().nullable().optional(),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
  active: z.boolean().optional(),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
