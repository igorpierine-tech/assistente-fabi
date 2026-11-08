import { z } from "zod";

// --- Primitives ---

const email = z.string().trim().toLowerCase().email("E-mail inválido").max(254);
const password = z.string().min(8, "Senha deve ter no mínimo 8 caracteres").max(128);
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,100}$/, "Slug inválido (2-100 chars, a-z 0-9 _ -)");
const name = z.string().trim().min(1, "Nome é obrigatório").max(200);
const isoDate = z.string().refine(v => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !Number.isNaN(Date.parse(v)), "Data ISO inválida");
const moduleId = z.string().min(1).max(50);

// --- Auth ---

export const loginSchema = z.object({
  email: email,
  password: z.string().min(1, "Senha é obrigatória"),
  tenantSlug: z.string().optional(),
});

export const selectTenantSchema = z.object({
  tenantSlug: z.string().min(1, "Slug da empresa é obrigatório"),
});

// --- Platform (public) ---

export const registerSchema = z.object({
  cnpj: z.string().min(1, "CNPJ é obrigatório").max(30),
  razaoSocial: z.string().trim().min(1, "Razão social é obrigatória").max(300),
  nomeFantasia: z.string().trim().max(300).optional(),
  endereco: z.string().max(500).optional(),
  cep: z.string().max(20).optional(),
  municipio: z.string().max(100).optional(),
  uf: z.string().max(2).optional(),
  telefone: z.string().max(30).optional(),
  emailEmpresa: email.optional(),
  adminName: name,
  adminEmail: email,
  adminPassword: password,
});

// --- System Admin: Tenants ---

export const createTenantSchema = z.object({
  name: name,
  slug: slug,
  adminName: z.string().trim().max(200).optional(),
  adminEmail: email.optional(),
  adminPassword: password.optional(),
  cnpj: z.string().max(30).optional(),
  inscricaoMunicipal: z.string().max(30).optional(),
  endereco: z.string().max(500).optional(),
  cep: z.string().max(20).optional(),
  municipio: z.string().max(100).optional(),
  uf: z.string().max(2).optional(),
  telefone: z.string().max(30).optional(),
  emailEmpresa: email.optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().trim().max(200).optional(),
  slug: z.string().trim().max(100).optional(),
  cnpj: z.string().max(30).optional(),
  inscricaoMunicipal: z.string().max(30).optional(),
  endereco: z.string().max(500).optional(),
  cep: z.string().max(20).optional(),
  municipio: z.string().max(100).optional(),
  uf: z.string().max(2).optional(),
  telefone: z.string().max(30).optional(),
  emailEmpresa: email.optional(),
});

// --- System Admin: Users ---

export const createTenantUserSchema = z.object({
  name: name,
  email: email,
  password: password,
  profileId: z.string().max(128).optional(),
});

export const updateTenantUserSchema = z.object({
  active: z.boolean().optional(),
  name: z.string().trim().max(200).optional(),
  email: email.optional(),
});

// --- System Admin: Profiles ---

export const createProfileSchema = z.object({
  name: name,
  modules: z.array(moduleId).min(1, "Selecione pelo menos um módulo"),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().max(200).optional(),
  modules: z.array(moduleId).optional(),
});

// --- System Admin: Plans ---

export const createPlanSchema = z.object({
  name: name,
  slug: slug,
  modules: z.array(moduleId).min(1, "Selecione pelo menos um módulo"),
  maxUsers: z.number().int().positive().nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
});

export const updatePlanSchema = z.object({
  name: z.string().trim().max(200).optional(),
  slug: z.string().trim().max(100).optional(),
  modules: z.array(moduleId).optional(),
  maxUsers: z.number().int().positive().nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

// --- System Admin: Subscriptions ---

export const createSubscriptionSchema = z.object({
  tenantId: z.string().min(1, "tenantId é obrigatório"),
  planId: z.string().min(1, "planId é obrigatório"),
  status: z.enum(["trial", "ativo"]).optional(),
  trialEndsAt: z.string().optional(),
});

export const updateSubscriptionSchema = z.object({
  planId: z.string().optional(),
  status: z.enum(["trial", "ativo", "bloqueado", "cancelado"]).optional(),
  blockedReason: z.string().max(500).optional(),
});

// --- System Admin: Set password ---

export const setPasswordSchema = z.object({
  email: email,
  password: password,
});

// --- Appointments ---

const appointmentStatus = z.enum(["previsto", "confirmado", "em_andamento", "concluido", "cancelado"]);

export const createAppointmentSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório").max(200),
  type: z.string().trim().max(50).optional(),
  clientId: z.string().max(128).optional(),
  clientName: z.string().max(200).optional(),
  startTime: isoDate,
  endTime: isoDate,
  notes: z.string().max(5000).optional(),
  status: appointmentStatus.optional(),
}).refine(d => !d.endTime || !d.startTime || Date.parse(d.endTime) > Date.parse(d.startTime), {
  message: "Fim deve ser posterior ao início",
  path: ["endTime"],
});

export const updateAppointmentSchema = z.object({
  title: z.string().trim().max(200).optional(),
  type: z.string().trim().max(50).optional(),
  clientId: z.string().max(128).nullable().optional(),
  clientName: z.string().max(200).nullable().optional(),
  startTime: isoDate.optional(),
  endTime: isoDate.optional(),
  notes: z.string().max(5000).nullable().optional(),
  status: appointmentStatus.optional(),
});

// --- Clients ---

export const createClientSchema = z.object({
  name: name,
  phone: z.string().max(30).optional(),
  email: email.optional(),
  notes: z.string().max(5000).optional(),
});

export const updateClientSchema = z.object({
  name: z.string().trim().max(200).optional(),
  phone: z.string().max(30).nullable().optional(),
  email: email.nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
