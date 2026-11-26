import { z } from "zod/v4";

export const createCheckoutSchema = z.object({
  plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
