import { z } from "zod/v4";

export const createPlanSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  periodicity: z.enum(["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "LIFETIME"]).default("ANNUAL"),
  priceInCents: z.number().int().min(0).optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updatePlanSchema = createPlanSchema.partial();

export const setPlanContentsSchema = z.object({
  programIds: z.array(z.string().uuid()).default([]),
  moduleIds: z.array(z.string().uuid()).default([]),
  lessonIds: z.array(z.string().uuid()).default([]),
});

export const createSubscriptionSchema = z.object({
  userId: z.string().uuid(),
  planId: z.string().uuid(),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  externalId: z.string().max(255).optional(),
});

export const updateSubscriptionSchema = z.object({
  status: z.enum(["ACTIVE", "CANCELED", "EXPIRED", "PAST_DUE"]).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  canceledAt: z.coerce.date().nullable().optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type SetPlanContentsInput = z.infer<typeof setPlanContentsSchema>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
