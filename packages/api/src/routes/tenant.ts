import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import { requireUser, sharedOwnerId } from "../middleware/auth";
import { getTenantConfig, upsertTenantConfig, getDb, type TenantConfigRow } from "../services/database";
import { requiredString, ValidationError } from "../services/validation";
import type { TenantConfig } from "@assistente-fabi/shared";
import "../session-types";

const MAGIC_BYTES: Record<string, (buf: Buffer) => boolean> = {
  "image/png": (b) => b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  "image/svg+xml": (b) => {
    const head = b.toString("utf-8", 0, Math.min(256, b.length)).trimStart();
    return head.startsWith("<") || head.startsWith("<?xml");
  },
  "image/x-icon": (b) => b.length >= 4 && b[0] === 0x00 && b[1] === 0x00 && (b[2] === 0x01 || b[2] === 0x02) && b[3] === 0x00,
  "image/vnd.microsoft.icon": (b) => b.length >= 4 && b[0] === 0x00 && b[1] === 0x00 && (b[2] === 0x01 || b[2] === 0x02) && b[3] === 0x00,
};

function verifyMagicBytes(buffer: Buffer, claimedMime: string): boolean {
  const checker = MAGIC_BYTES[claimedMime];
  if (!checker) return false;
  return checker(buffer);
}

function sanitizeSvg(buffer: Buffer): Buffer {
  let svg = buffer.toString("utf-8");
  // Remove script tags, event handlers, and javascript: URIs
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, "");
  svg = svg.replace(/<script[\s\S]*?\/>/gi, "");
  svg = svg.replace(/\bon\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, "");
  svg = svg.replace(/javascript\s*:/gi, "blocked:");
  svg = svg.replace(/data\s*:\s*text\/html/gi, "blocked:");
  svg = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  svg = svg.replace(/<foreignObject[\s\S]*?\/>/gi, "");
  svg = svg.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  svg = svg.replace(/<embed[\s\S]*?<\/embed>/gi, "");
  svg = svg.replace(/<object[\s\S]*?<\/object>/gi, "");
  svg = svg.replace(/<use[\s\S]*?href\s*=\s*["'](?!#)[^"']*["']/gi, (match) => {
    return match.replace(/href\s*=\s*["'][^"']*["']/, 'href="#blocked"');
  });
  return Buffer.from(svg, "utf-8");
}

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router: ExpressRouter = Router();
router.use(requireUser);

function toPublicConfig(row: TenantConfigRow): TenantConfig {
  return {
    businessName: row.business_name,
    ownerName: row.owner_name,
    profession: row.profession,
    tagline: row.tagline,
    timezone: row.timezone,
    locale: row.locale,
    logoUrl: row.logo_url,
    colors: {
      primary: row.primary_color,
      secondary: row.secondary_color,
      accent: row.accent_color,
    },
    fonts: {
      heading: row.heading_font,
      body: row.body_font,
    },
    onboardingCompleted: row.onboarding_completed === 1,
  };
}

const VALID_TIMEZONES = new Set([
  "America/Sao_Paulo", "America/Cuiaba", "America/Manaus", "America/Belem",
  "America/Fortaleza", "America/Recife", "America/Bahia", "America/Rio_Branco",
  "America/Porto_Velho", "America/Boa_Vista", "America/Campo_Grande",
  "America/Maceio", "America/Noronha", "America/Araguaina",
]);

router.get("/config", (req, res) => {
  const ownerId = sharedOwnerId(req);
  const row = getTenantConfig(ownerId);
  if (!row) {
    const defaults = upsertTenantConfig(ownerId, {
      owner_name: req.session.appUser!.name || "",
    });
    res.json(toPublicConfig(defaults));
    return;
  }
  res.json(toPublicConfig(row));
});

router.put("/config", (req, res) => {
  const ownerId = sharedOwnerId(req);
  const body = req.body;
  if (!body || typeof body !== "object") {
    throw new ValidationError("Corpo da requisição inválido");
  }

  const update: Record<string, unknown> = {};

  if (body.businessName !== undefined) {
    update.business_name = requiredString(body.businessName, "Nome do negócio", 100);
  }
  if (body.ownerName !== undefined) {
    update.owner_name = requiredString(body.ownerName, "Nome do profissional", 100);
  }
  if (body.profession !== undefined) {
    update.profession = typeof body.profession === "string" ? body.profession.slice(0, 200) : "";
  }
  if (body.tagline !== undefined) {
    update.tagline = typeof body.tagline === "string" ? body.tagline.slice(0, 200) : "";
  }
  if (body.timezone !== undefined) {
    const tz = String(body.timezone);
    if (!VALID_TIMEZONES.has(tz)) {
      throw new ValidationError("Timezone inválido");
    }
    update.timezone = tz;
  }
  if (body.logoUrl !== undefined) {
    update.logo_url = typeof body.logoUrl === "string" ? body.logoUrl.slice(0, 500) : null;
  }
  if (body.colors !== undefined && typeof body.colors === "object") {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    if (body.colors.primary && hexPattern.test(body.colors.primary)) {
      update.primary_color = body.colors.primary;
    }
    if (body.colors.secondary && hexPattern.test(body.colors.secondary)) {
      update.secondary_color = body.colors.secondary;
    }
    if (body.colors.accent && hexPattern.test(body.colors.accent)) {
      update.accent_color = body.colors.accent;
    }
  }
  if (body.fonts !== undefined && typeof body.fonts === "object") {
    if (typeof body.fonts.heading === "string") {
      update.heading_font = body.fonts.heading.slice(0, 100);
    }
    if (typeof body.fonts.body === "string") {
      update.body_font = body.fonts.body.slice(0, 100);
    }
  }
  if (body.customPrompt !== undefined) {
    update.custom_prompt = typeof body.customPrompt === "string" ? body.customPrompt.slice(0, 2000) : null;
  }
  if (body.onboardingCompleted === true) {
    update.onboarding_completed = 1;
  }

  const updated = upsertTenantConfig(ownerId, update);
  res.json(toPublicConfig(updated));
});

// --- Branding / White-label ---

router.get("/branding/logo", (req, res) => {
  const ownerId = sharedOwnerId(req);
  const row = getTenantConfig(ownerId);
  if (!row?.logo_data || !row.logo_mime) {
    res.status(404).json({ error: "Logo não configurado" });
    return;
  }
  res.set("Content-Type", row.logo_mime);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(row.logo_data);
});

router.post("/branding/logo", logoUpload.single("logo"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhum arquivo enviado ou formato inválido. Use PNG, JPG, WebP ou SVG (máx 2MB)." });
    return;
  }
  if (!verifyMagicBytes(req.file.buffer, req.file.mimetype)) {
    res.status(400).json({ error: "Conteúdo do arquivo não corresponde ao tipo declarado" });
    return;
  }
  const ownerId = sharedOwnerId(req);
  const fileBuffer = req.file.mimetype === "image/svg+xml" ? sanitizeSvg(req.file.buffer) : req.file.buffer;
  getDb().prepare(
    `UPDATE tenant_config SET logo_data = ?, logo_mime = ?, updated_at = datetime('now') WHERE user_id = ?`
  ).run(fileBuffer, req.file.mimetype, ownerId);
  upsertTenantConfig(ownerId, { logo_url: `/tenant/branding/logo?t=${Date.now()}` });
  res.json({ ok: true, logoUrl: `/tenant/branding/logo?t=${Date.now()}` });
});

router.delete("/branding/logo", (req, res) => {
  const ownerId = sharedOwnerId(req);
  getDb().prepare(
    `UPDATE tenant_config SET logo_data = NULL, logo_mime = NULL, logo_url = NULL, updated_at = datetime('now') WHERE user_id = ?`
  ).run(ownerId);
  res.json({ ok: true });
});

router.get("/branding/favicon", (req, res) => {
  const ownerId = sharedOwnerId(req);
  const row = getTenantConfig(ownerId);
  if (!row?.favicon_data || !row.favicon_mime) {
    res.status(404).json({ error: "Favicon não configurado" });
    return;
  }
  res.set("Content-Type", row.favicon_mime);
  res.set("Cache-Control", "public, max-age=3600");
  res.send(row.favicon_data);
});

router.post("/branding/favicon", logoUpload.single("favicon"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhum arquivo enviado ou formato inválido. Use PNG, ICO ou SVG (máx 2MB)." });
    return;
  }
  if (!verifyMagicBytes(req.file.buffer, req.file.mimetype)) {
    res.status(400).json({ error: "Conteúdo do arquivo não corresponde ao tipo declarado" });
    return;
  }
  const ownerId = sharedOwnerId(req);
  const fileBuffer = req.file.mimetype === "image/svg+xml" ? sanitizeSvg(req.file.buffer) : req.file.buffer;
  getDb().prepare(
    `UPDATE tenant_config SET favicon_data = ?, favicon_mime = ?, updated_at = datetime('now') WHERE user_id = ?`
  ).run(fileBuffer, req.file.mimetype, ownerId);
  res.json({ ok: true });
});

// --- Company / Empresa data (for NFS-e and contracts) ---

router.get("/empresa", (req, res) => {
  const ownerId = sharedOwnerId(req);
  const row = getTenantConfig(ownerId);
  if (!row) {
    res.json({});
    return;
  }
  res.json({
    razaoSocial: row.razao_social || "",
    cnpj: row.cnpj || "",
    inscricaoEstadual: row.inscricao_estadual || "",
    inscricaoMunicipal: row.inscricao_municipal || "",
    endereco: row.endereco || "",
    enderecoLogradouro: row.endereco_logradouro || "",
    enderecoNumero: row.endereco_numero || "",
    enderecoComplemento: row.endereco_complemento || "",
    enderecoBairro: row.endereco_bairro || "",
    enderecoUf: row.endereco_uf || "",
    cep: row.cep || "",
    telefone: row.telefone_comercial || "",
    email: row.email_comercial || "",
    representanteQualificacao: row.representante_qualificacao || "",
  });
});

router.put("/empresa", (req, res) => {
  const ownerId = sharedOwnerId(req);
  const body = req.body;
  if (!body || typeof body !== "object") {
    throw new ValidationError("Corpo da requisição inválido");
  }

  const update: Record<string, unknown> = {};

  if (body.razaoSocial !== undefined) update.razao_social = String(body.razaoSocial).slice(0, 200) || null;
  if (body.cnpj !== undefined) update.cnpj = String(body.cnpj).slice(0, 20) || null;
  if (body.inscricaoEstadual !== undefined) update.inscricao_estadual = String(body.inscricaoEstadual).slice(0, 20) || null;
  if (body.inscricaoMunicipal !== undefined) update.inscricao_municipal = String(body.inscricaoMunicipal).slice(0, 20) || null;
  if (body.endereco !== undefined) update.endereco = String(body.endereco).slice(0, 300) || null;
  if (body.enderecoLogradouro !== undefined) update.endereco_logradouro = String(body.enderecoLogradouro).slice(0, 200) || null;
  if (body.enderecoNumero !== undefined) update.endereco_numero = String(body.enderecoNumero).slice(0, 20) || null;
  if (body.enderecoComplemento !== undefined) update.endereco_complemento = String(body.enderecoComplemento).slice(0, 100) || null;
  if (body.enderecoBairro !== undefined) update.endereco_bairro = String(body.enderecoBairro).slice(0, 100) || null;
  if (body.enderecoUf !== undefined) update.endereco_uf = String(body.enderecoUf).slice(0, 2) || null;
  if (body.cep !== undefined) update.cep = String(body.cep).slice(0, 10) || null;
  if (body.telefone !== undefined) update.telefone_comercial = String(body.telefone).slice(0, 20) || null;
  if (body.email !== undefined) update.email_comercial = String(body.email).slice(0, 100) || null;
  if (body.representanteQualificacao !== undefined) update.representante_qualificacao = String(body.representanteQualificacao).slice(0, 200) || null;

  const updated = upsertTenantConfig(ownerId, update);
  res.json({
    razaoSocial: updated.razao_social || "",
    cnpj: updated.cnpj || "",
    inscricaoEstadual: updated.inscricao_estadual || "",
    inscricaoMunicipal: updated.inscricao_municipal || "",
    endereco: updated.endereco || "",
    enderecoLogradouro: updated.endereco_logradouro || "",
    enderecoNumero: updated.endereco_numero || "",
    enderecoComplemento: updated.endereco_complemento || "",
    enderecoBairro: updated.endereco_bairro || "",
    enderecoUf: updated.endereco_uf || "",
    cep: updated.cep || "",
    telefone: updated.telefone_comercial || "",
    email: updated.email_comercial || "",
    representanteQualificacao: updated.representante_qualificacao || "",
  });
});

export { router as tenantRouter };
