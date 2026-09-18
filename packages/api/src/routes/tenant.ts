import { Router, type Router as ExpressRouter } from "express";
import { requireUser, sharedOwnerId } from "../middleware/auth";
import { getTenantConfig, upsertTenantConfig, type TenantConfigRow } from "../services/database";
import { requiredString, ValidationError } from "../services/validation";
import type { TenantConfig } from "@assistente-fabi/shared";
import "../session-types";

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
      owner_name: req.session.googleUser!.name || "",
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

export { router as tenantRouter };
