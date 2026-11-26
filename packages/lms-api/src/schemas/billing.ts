import { z } from "zod/v4";

export const hotmartWebhookSchema = z.object({
  event: z.string(),
  data: z.object({
    product: z.object({ id: z.number().optional(), name: z.string().optional() }).optional(),
    buyer: z.object({ email: z.string().optional(), name: z.string().optional() }).optional(),
    purchase: z.object({ transaction: z.string().optional(), status: z.string().optional() }).optional(),
    subscription: z.object({
      subscriber: z.object({ code: z.string().optional() }).optional(),
      status: z.string().optional(),
    }).optional(),
  }),
});

export type HotmartWebhookInput = z.infer<typeof hotmartWebhookSchema>;
