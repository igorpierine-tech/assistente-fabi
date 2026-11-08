import { Router, type Router as ExpressRouter } from "express";
import {
  createTenant,
  getTenantBySlug,
  createMasterUser,
  getMasterUserByEmail,
} from "../services/master-db";
import { hashPassword } from "../services/users-db";
import { getTenantDb, upsertTenantConfig } from "../services/database";
import { consultarCnpj } from "../services/cnpj-lookup";
import { rateLimit } from "../middleware/security";
import { tenantContext } from "../services/tenant-context";
import { requiredString, optionalString, optionalEmail } from "../services/validation";

const router: ExpressRouter = Router();

const registerLimiter = rateLimit({ prefix: "register", windowMs: 60 * 60_000, max: 10 });
const cnpjLimiter = rateLimit({ prefix: "cnpj", windowMs: 60_000, max: 15 });

router.get("/cnpj/:cnpj", cnpjLimiter, async (req, res) => {
  try {
    const data = await consultarCnpj(req.params.cnpj);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao consultar CNPJ";
    res.status(400).json({ error: message });
  }
});

router.post("/register", registerLimiter, async (req, res) => {
  const body = req.body || {};
  const cnpj = requiredString(body.cnpj, "cnpj", 30);
  const razaoSocial = requiredString(body.razaoSocial, "razaoSocial", 300);
  const nomeFantasia = optionalString(body.nomeFantasia, "nomeFantasia", 300);
  const endereco = optionalString(body.endereco, "endereco", 500);
  const cep = optionalString(body.cep, "cep", 20);
  const municipio = optionalString(body.municipio, "municipio", 100);
  const uf = optionalString(body.uf, "uf", 2);
  const telefone = optionalString(body.telefone, "telefone", 30);
  const emailEmpresa = optionalEmail(body.emailEmpresa);
  const adminName = requiredString(body.adminName, "adminName", 200);
  const adminEmail = requiredString(body.adminEmail, "adminEmail", 254).toLowerCase();
  const adminPassword = requiredString(body.adminPassword, "adminPassword", 128);
  if (adminPassword.length < 8) {
    res.status(400).json({ error: "Senha deve ter no mínimo 8 caracteres" });
    return;
  }

  const cleanCnpj = String(cnpj).replace(/\D/g, "");
  if (cleanCnpj.length !== 14) {
    res.status(400).json({ error: "CNPJ inválido" });
    return;
  }

  const slug = cleanCnpj;
  const existing = getTenantBySlug(slug);
  if (existing) {
    res.status(409).json({ error: "Esta empresa já está cadastrada na plataforma" });
    return;
  }

  const existingUser = getMasterUserByEmail(adminEmail);
  if (existingUser) {
    res.status(409).json({ error: "Já existe um usuário com esse e-mail" });
    return;
  }

  try {
    const tenant = createTenant({ name: razaoSocial, slug });

    tenantContext.run({ tenantId: tenant.id, tenantSlug: tenant.slug }, () => {
      getTenantDb(tenant.slug);

      const workspaceId = tenant.id;
      upsertTenantConfig(workspaceId, {
        business_name: nomeFantasia || razaoSocial,
        owner_name: adminName,
        razao_social: razaoSocial,
        cnpj: cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
        endereco: endereco || null,
        cep: cep || null,
        email_comercial: emailEmpresa || null,
        telefone_comercial: telefone || null,
        onboarding_completed: 1,
      });
    });

    const passwordHash = await hashPassword(adminPassword);
    const user = createMasterUser({
      tenantId: tenant.id,
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: "admin",
    });

    res.status(201).json({
      success: true,
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      admin: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Erro ao registrar empresa:", err);
    res.status(500).json({ error: "Erro interno ao registrar empresa" });
  }
});

export { router as platformRouter };
