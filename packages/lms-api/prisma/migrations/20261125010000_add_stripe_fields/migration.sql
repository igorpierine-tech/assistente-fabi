-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "stripe_customer_id" VARCHAR(255);
ALTER TABLE "tenants" ADD COLUMN "stripe_subscription_id" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_stripe_customer_id_key" ON "tenants"("stripe_customer_id");
