import { z } from "zod/v4";

export const signupSchema = z.object({
  email: z.email().max(255),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(128)
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter ao menos uma letra minúscula")
    .regex(/[0-9]/, "Senha deve conter ao menos um número"),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  orgName: z.string().min(2).max(200).optional(),
  lgpdConsent: z.literal(true, { message: "Consentimento LGPD é obrigatório" }),
});

export const loginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(128),
  tenantSlug: z.string().min(1).max(100),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.email().max(255),
  tenantSlug: z.string().min(1).max(100),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter ao menos uma letra minúscula")
    .regex(/[0-9]/, "Senha deve conter ao menos um número"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
