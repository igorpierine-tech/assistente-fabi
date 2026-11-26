import { RequestHandler } from "express";
import { z } from "zod/v4";

export function validate(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = z.prettifyError(result.error);
      res.status(400).json({ error: "Dados inválidos.", details: errors });
      return;
    }
    req.body = result.data;
    next();
  };
}
