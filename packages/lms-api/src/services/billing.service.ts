import { PlanTier } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError } from "./auth.service";

const PLAN_LIMITS: Record<PlanTier, { maxStudents: number; maxPrograms: number; maxStorageMb: number }> = {
  FREE: { maxStudents: 10, maxPrograms: 1, maxStorageMb: 500 },
  STARTER: { maxStudents: 50, maxPrograms: 5, maxStorageMb: 2000 },
  PRO: { maxStudents: 200, maxPrograms: 20, maxStorageMb: 10000 },
  ENTERPRISE: { maxStudents: 10000, maxPrograms: 100, maxStorageMb: 50000 },
};

const PRODUCT_TO_PLAN: Record<string, PlanTier> = {};
if (env.hotmartProductStarter) PRODUCT_TO_PLAN[env.hotmartProductStarter] = "STARTER";
if (env.hotmartProductPro) PRODUCT_TO_PLAN[env.hotmartProductPro] = "PRO";
if (env.hotmartProductEnterprise) PRODUCT_TO_PLAN[env.hotmartProductEnterprise] = "ENTERPRISE";

interface HotmartWebhookPayload {
  event: string;
  data: {
    product?: { id?: number; name?: string };
    buyer?: { email?: string; name?: string };
    purchase?: { transaction?: string; status?: string };
    subscription?: {
      subscriber?: { code?: string };
      status?: string;
    };
  };
}

function resolvePlan(productId: string | number | undefined): PlanTier | undefined {
  if (!productId) return undefined;
  return PRODUCT_TO_PLAN[String(productId)];
}

async function findTenantByBuyerEmail(email: string) {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), role: { in: ["OWNER", "ADMIN"] } },
    select: { tenantId: true },
  });
  return user?.tenantId ?? null;
}

export async function handleHotmartWebhook(payload: HotmartWebhookPayload, hottok: string) {
  if (!env.hotmartToken || hottok !== env.hotmartToken) {
    throw new AppError("Token de webhook inválido.", 401);
  }

  const { event, data } = payload;
  const buyerEmail = data.buyer?.email;
  const productId = data.product?.id;
  const subscriptionCode = data.subscription?.subscriber?.code || data.purchase?.transaction;
  const plan = resolvePlan(productId);

  if (!buyerEmail) {
    console.warn("[Hotmart Webhook] Evento sem email do comprador:", event);
    return;
  }

  const tenantId = await findTenantByBuyerEmail(buyerEmail);
  if (!tenantId) {
    console.warn("[Hotmart Webhook] Nenhum tenant encontrado para:", buyerEmail);
    return;
  }

  switch (event) {
    case "PURCHASE_COMPLETE":
    case "PURCHASE_APPROVED": {
      if (!plan) {
        console.warn("[Hotmart Webhook] Produto não mapeado:", productId);
        return;
      }
      const limits = PLAN_LIMITS[plan];
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { plan, ...limits, hotmartSubscriptionCode: subscriptionCode || null },
      });
      console.log(`[Hotmart Webhook] Plano ${plan} ativado para tenant ${tenantId}`);
      break;
    }

    case "PURCHASE_REFUNDED":
    case "PURCHASE_CHARGEBACK":
    case "SUBSCRIPTION_CANCELLATION": {
      const freeLimits = PLAN_LIMITS.FREE;
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { plan: "FREE", ...freeLimits, hotmartSubscriptionCode: null },
      });
      console.log(`[Hotmart Webhook] Plano revertido para FREE para tenant ${tenantId}`);
      break;
    }

    case "PURCHASE_DELAYED":
      console.log(`[Hotmart Webhook] Pagamento pendente (boleto) para tenant ${tenantId}`);
      break;

    default:
      console.log(`[Hotmart Webhook] Evento não tratado: ${event}`);
  }
}

export async function getTenantBilling(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: true,
      maxStudents: true,
      maxPrograms: true,
      maxStorageMb: true,
      trialEndsAt: true,
      hotmartSubscriptionCode: true,
      _count: {
        select: {
          users: { where: { role: "STUDENT" } },
          programs: true,
        },
      },
    },
  });

  if (!tenant) throw new AppError("Tenant não encontrado.", 404);

  return {
    plan: tenant.plan,
    limits: {
      maxStudents: tenant.maxStudents,
      maxPrograms: tenant.maxPrograms,
      maxStorageMb: tenant.maxStorageMb,
    },
    usage: {
      students: tenant._count.users,
      programs: tenant._count.programs,
    },
    trialEndsAt: tenant.trialEndsAt,
    hasSubscription: !!tenant.hotmartSubscriptionCode,
    checkoutUrls: {
      STARTER: env.hotmartCheckoutStarter || null,
      PRO: env.hotmartCheckoutPro || null,
      ENTERPRISE: env.hotmartCheckoutEnterprise || null,
    },
  };
}

export function getPlanLimits(plan: PlanTier) {
  return PLAN_LIMITS[plan];
}
