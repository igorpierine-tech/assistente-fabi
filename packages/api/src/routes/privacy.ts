import { Router, type Router as ExpressRouter } from "express";
import { requireUser } from "../middleware/auth";
import { deleteUserData, exportUserData, getPrivacyConsent, recordPrivacyConsent } from "../services/database";
import { requiredString, ValidationError } from "../services/validation";

const router: ExpressRouter = Router();
const PRIVACY_VERSION = process.env.PRIVACY_POLICY_VERSION || "2026-08-18";
router.use(requireUser);

router.get("/status", (req, res) => {
  const consent = getPrivacyConsent(req.session.googleUser!.id, PRIVACY_VERSION);
  res.setHeader("Cache-Control", "no-store");
  res.json({ version: PRIVACY_VERSION, accepted: Boolean(consent && !consent.revoked_at), consent: consent || null });
});

router.post("/consent", (req, res) => {
  if (req.body?.accepted !== true) throw new ValidationError("O aceite deve ser confirmado explicitamente");
  const version = requiredString(req.body?.version, "Versão", 32);
  if (version !== PRIVACY_VERSION) throw new ValidationError("Versão da política de privacidade desatualizada");
  recordPrivacyConsent(req.session.googleUser!.id, version);
  res.status(204).end();
});

router.get("/export", (req, res) => {
  const user = req.session.googleUser!;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", `attachment; filename="assistente-fabi-dados-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ exportedAt: new Date().toISOString(), user, data: exportUserData(user.id) });
});

router.delete("/account", async (req, res, next) => {
  try {
    if (req.body?.confirmation !== "EXCLUIR") {
      throw new ValidationError("Confirmação de exclusão inválida");
    }
    const userId = req.session.googleUser!.id;
    const googleToken = req.session.googleTokens?.refresh_token || req.session.googleTokens?.access_token;
    if (googleToken) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(googleToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }).catch(() => undefined);
    }
    deleteUserData(userId);
    req.session.destroy((error) => {
      if (error) {
        res.status(500).json({ error: "Dados excluídos, mas não foi possível encerrar a sessão" });
        return;
      }
      res.status(204).end();
    });
  } catch (error) {
    next(error);
  }
});

export { router as privacyRouter };
