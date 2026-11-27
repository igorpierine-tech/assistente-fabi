-- CreateEnum
CREATE TYPE "PlanPeriodicity" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'LIFETIME');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'EXPIRED', 'PAST_DUE');

-- CreateEnum
CREATE TYPE "GamificationEvent" AS ENUM ('LESSON_COMPLETED', 'LIVE_SESSION_ATTENDED', 'ASSESSMENT_SUBMITTED', 'STREAK_MILESTONE', 'PROGRAM_COMPLETED', 'MODULE_COMPLETED', 'ENROLLMENT_CREATED');

-- CreateEnum
CREATE TYPE "BadgeCategory" AS ENUM ('STRATEGY', 'CONSISTENCY', 'GOVERNANCE', 'LEADERSHIP', 'MILESTONE');

-- CreateEnum
CREATE TYPE "LeadershipTier" AS ENUM ('GESTORA_AUREA', 'LIDER_ESTRATEGICA', 'EXECUTIVA_ALTO_IMPACTO');

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "periodicity" "PlanPeriodicity" NOT NULL DEFAULT 'ANNUAL',
    "price_in_cents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_contents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "program_id" UUID,
    "module_id" UUID,
    "lesson_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "external_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event" "GamificationEvent" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "xp_reward" INTEGER NOT NULL,
    "badge_id" UUID,
    "conditions" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gamification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "current_tier" "LeadershipTier" NOT NULL DEFAULT 'GESTORA_AUREA',
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_activity_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gamification_profiles_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add category to badges
ALTER TABLE "badges" ADD COLUMN "category" "BadgeCategory" NOT NULL DEFAULT 'MILESTONE';

-- AlterTable: Enhance point_ledger with rule reference and idempotency
ALTER TABLE "point_ledger" ADD COLUMN "rule_id" UUID;
ALTER TABLE "point_ledger" RENAME COLUMN "entity_type" TO "reference_type";
ALTER TABLE "point_ledger" RENAME COLUMN "entity_id" TO "reference_id";

-- CreateIndex
CREATE INDEX "plans_tenant_id_idx" ON "plans"("tenant_id");
CREATE INDEX "plans_active_idx" ON "plans"("active");
CREATE UNIQUE INDEX "plans_tenant_id_slug_key" ON "plans"("tenant_id", "slug");

CREATE INDEX "plan_contents_plan_id_idx" ON "plan_contents"("plan_id");
CREATE INDEX "plan_contents_program_id_idx" ON "plan_contents"("program_id");
CREATE INDEX "plan_contents_module_id_idx" ON "plan_contents"("module_id");
CREATE INDEX "plan_contents_lesson_id_idx" ON "plan_contents"("lesson_id");

CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX "subscriptions_expires_at_idx" ON "subscriptions"("expires_at");

CREATE INDEX "gamification_rules_tenant_id_idx" ON "gamification_rules"("tenant_id");
CREATE INDEX "gamification_rules_event_idx" ON "gamification_rules"("event");

CREATE UNIQUE INDEX "gamification_profiles_user_id_key" ON "gamification_profiles"("user_id");

-- Idempotency constraint on point_ledger
CREATE UNIQUE INDEX "point_ledger_user_id_rule_id_reference_id_key" ON "point_ledger"("user_id", "rule_id", "reference_id");

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "plan_contents" ADD CONSTRAINT "plan_contents_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_contents" ADD CONSTRAINT "plan_contents_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_contents" ADD CONSTRAINT "plan_contents_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_contents" ADD CONSTRAINT "plan_contents_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gamification_rules" ADD CONSTRAINT "gamification_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gamification_rules" ADD CONSTRAINT "gamification_rules_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "gamification_profiles" ADD CONSTRAINT "gamification_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "gamification_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
