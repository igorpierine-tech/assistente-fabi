-- DropIndex
DROP INDEX IF EXISTS "tenants_stripe_customer_id_key";

-- AlterTable: replace Stripe fields with Hotmart
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "stripe_customer_id";
ALTER TABLE "tenants" RENAME COLUMN "stripe_subscription_id" TO "hotmart_subscription_code";

-- CreateIndex
CREATE UNIQUE INDEX "tenants_hotmart_subscription_code_key" ON "tenants"("hotmart_subscription_code");
