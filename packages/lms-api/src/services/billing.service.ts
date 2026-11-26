import Stripe from "stripe";
import { PlanTier } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError } from "./auth.service";

const stripe = new Stripe(env.stripeSecretKey);

const PLAN_LIMITS: Record<PlanTier, { maxStudents: number; maxPrograms: number; maxStorageMb: number }> = {
  FREE: { maxStudents: 10, maxPrograms: 1, maxStorageMb: 500 },
  STARTER: { maxStudents: 50, maxPrograms: 5, maxStorageMb: 2000 },
  PRO: { maxStudents: 200, maxPrograms: 20, maxStorageMb: 10000 },
  ENTERPRISE: { maxStudents: 10000, maxPrograms: 100, maxStorageMb: 50000 },
};

const PRICE_TO_PLAN: Record<string, PlanTier> = {};
if (env.stripePriceStarter) PRICE_TO_PLAN[env.stripePriceStarter] = "STARTER";
if (env.stripePricePro) PRICE_TO_PLAN[env.stripePricePro] = "PRO";
if (env.stripePriceEnterprise) PRICE_TO_PLAN[env.stripePriceEnterprise] = "ENTERPRISE";

async function getOrCreateCustomer(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError("Tenant não encontrado.", 404);

  if (tenant.stripeCustomerId) return tenant.stripeCustomerId;

  const owner = await prisma.user.findFirst({
    where: { tenantId, role: "OWNER" },
    include: { profile: true },
  });

  const customer = await stripe.customers.create({
    name: tenant.name,
    email: owner?.email,
    metadata: { tenantId, tenantSlug: tenant.slug },
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession(tenantId: string, plan: "STARTER" | "PRO" | "ENTERPRISE") {
  const priceMap: Record<string, string> = {
    STARTER: env.stripePriceStarter,
    PRO: env.stripePricePro,
    ENTERPRISE: env.stripePriceEnterprise,
  };

  const priceId = priceMap[plan];
  if (!priceId) throw new AppError("Plano inválido ou preço não configurado.", 400);

  const customerId = await getOrCreateCustomer(tenantId);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.webUrl}/dashboard/settings/billing?success=true`,
    cancel_url: `${env.webUrl}/dashboard/settings/billing?canceled=true`,
    metadata: { tenantId },
  });

  return { url: session.url };
}

export async function createPortalSession(tenantId: string) {
  const customerId = await getOrCreateCustomer(tenantId);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.webUrl}/dashboard/settings/billing`,
  });

  return { url: session.url };
}

export async function handleWebhook(payload: Buffer, signature: string) {
  const event = stripe.webhooks.constructEvent(payload, signature, env.stripeWebhookSecret);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription && session.metadata?.tenantId) {
        await prisma.tenant.update({
          where: { id: session.metadata.tenantId },
          data: { stripeSubscriptionId: session.subscription as string },
        });
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price?.id;
      const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined;

      if (plan && sub.metadata?.tenantId) {
        const limits = PLAN_LIMITS[plan];
        await prisma.tenant.update({
          where: { id: sub.metadata.tenantId },
          data: {
            plan,
            ...limits,
            stripeSubscriptionId: sub.id,
          },
        });
      } else if (plan) {
        const tenant = await prisma.tenant.findUnique({
          where: { stripeCustomerId: sub.customer as string },
        });
        if (tenant) {
          const limits = PLAN_LIMITS[plan];
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: { plan, ...limits, stripeSubscriptionId: sub.id },
          });
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const tenant = sub.metadata?.tenantId
        ? await prisma.tenant.findUnique({ where: { id: sub.metadata.tenantId } })
        : await prisma.tenant.findUnique({ where: { stripeCustomerId: sub.customer as string } });

      if (tenant) {
        const limits = PLAN_LIMITS.FREE;
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            plan: "FREE",
            ...limits,
            stripeSubscriptionId: null,
          },
        });
      }
      break;
    }
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
      stripeSubscriptionId: true,
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
    hasSubscription: !!tenant.stripeSubscriptionId,
  };
}

export function getPlanLimits(plan: PlanTier) {
  return PLAN_LIMITS[plan];
}
