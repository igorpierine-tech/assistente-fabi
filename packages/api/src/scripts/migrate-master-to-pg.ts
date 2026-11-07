/**
 * Migration script: SQLite master DB → PostgreSQL
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx src/scripts/migrate-master-to-pg.ts
 *
 * This script:
 * 1. Reads all data from the SQLite master DB
 * 2. Creates tables in PostgreSQL (if not exist)
 * 3. Copies tenants, users, google_tokens, user_tenants, access_profiles
 * 4. Seeds default plans (Starter, Professional, Enterprise)
 * 5. Creates subscriptions for existing tenants (status: "ativo")
 * 6. Validates row counts
 */
import "dotenv/config";
import { getMasterDb } from "../services/master-db";
import { getPgPool, initPgTables } from "../services/master-db-pg";
import { v4 as uuidv4 } from "uuid";

async function migrate() {
  console.log("=== Migração Master DB: SQLite → PostgreSQL ===\n");

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL não configurada");
    process.exit(1);
  }

  const sqlite = getMasterDb();
  const pg = getPgPool();

  // 1. Init PG tables
  console.log("[1/6] Criando tabelas no PostgreSQL...");
  await initPgTables();
  console.log("  ✓ Tabelas criadas\n");

  // 2. Migrate tenants
  console.log("[2/6] Migrando tenants...");
  const tenants = sqlite.prepare("SELECT * FROM tenants").all() as any[];
  for (const t of tenants) {
    await pg.query(
      `INSERT INTO tenants (id, slug, name, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [t.id, t.slug, t.name, t.active === 1, t.created_at, t.updated_at]
    );
  }
  console.log(`  ✓ ${tenants.length} tenants migrados\n`);

  // 3. Migrate users
  console.log("[3/6] Migrando users...");
  const users = sqlite.prepare("SELECT * FROM users").all() as any[];
  for (const u of users) {
    await pg.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, role, platform_role, google_id, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [u.id, u.tenant_id, u.name, u.email, u.password_hash, u.role, u.platform_role || "user", u.google_id, u.active === 1, u.created_at, u.updated_at]
    );
  }
  console.log(`  ✓ ${users.length} users migrados\n`);

  // 4. Migrate google_tokens
  console.log("[4/6] Migrando google_tokens, user_tenants, access_profiles...");
  const tokens = sqlite.prepare("SELECT * FROM google_tokens").all() as any[];
  for (const t of tokens) {
    await pg.query(
      `INSERT INTO google_tokens (user_id, access_token, refresh_token, expiry_date, scope, google_email, connected_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO NOTHING`,
      [t.user_id, t.access_token, t.refresh_token, t.expiry_date, t.scope, t.google_email, t.connected_at, t.updated_at]
    );
  }

  const userTenants = sqlite.prepare("SELECT * FROM user_tenants").all() as any[];
  for (const ut of userTenants) {
    await pg.query(
      `INSERT INTO user_tenants (user_id, tenant_id, role, active, profile_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, tenant_id) DO NOTHING`,
      [ut.user_id, ut.tenant_id, ut.role, ut.active === 1, ut.profile_id, ut.created_at]
    );
  }

  const profiles = sqlite.prepare("SELECT * FROM access_profiles").all() as any[];
  for (const p of profiles) {
    await pg.query(
      `INSERT INTO access_profiles (id, tenant_id, name, modules, is_default, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [p.id, p.tenant_id, p.name, p.modules, p.is_default === 1, p.created_at, p.updated_at]
    );
  }
  console.log(`  ✓ ${tokens.length} google_tokens, ${userTenants.length} user_tenants, ${profiles.length} access_profiles\n`);

  // 5. Seed plans
  console.log("[5/6] Criando planos padrão...");
  const plans = [
    { name: "Starter", slug: "starter", modules: ["inicio", "agenda", "clientes", "agendamentos"], maxUsers: 3, priceCents: 0 },
    { name: "Professional", slug: "professional", modules: ["inicio", "agenda", "assistente", "clientes", "agendamentos", "vendas", "contratos", "financeiro"], maxUsers: 10, priceCents: 9900 },
    { name: "Enterprise", slug: "enterprise", modules: ["inicio", "agenda", "assistente", "clientes", "agendamentos", "vendas", "contratos", "financeiro", "usuarios", "configuracoes", "admin"], maxUsers: null, priceCents: 19900 },
  ];

  const planIds: Record<string, string> = {};
  for (const plan of plans) {
    const id = uuidv4();
    const { rows } = await pg.query("SELECT id FROM plans WHERE slug = $1", [plan.slug]);
    if (rows.length > 0) {
      planIds[plan.slug] = rows[0].id;
      console.log(`  - Plano "${plan.name}" já existe`);
    } else {
      await pg.query(
        "INSERT INTO plans (id, name, slug, modules, max_users, price_cents) VALUES ($1, $2, $3, $4, $5, $6)",
        [id, plan.name, plan.slug, plan.modules, plan.maxUsers, plan.priceCents]
      );
      planIds[plan.slug] = id;
      console.log(`  ✓ Plano "${plan.name}" criado`);
    }
  }
  console.log("");

  // 6. Create subscriptions for existing tenants
  console.log("[6/6] Criando subscriptions para tenants existentes...");
  const enterprisePlanId = planIds["enterprise"];
  let subCount = 0;
  for (const t of tenants) {
    const { rows } = await pg.query("SELECT id FROM subscriptions WHERE tenant_id = $1", [t.id]);
    if (rows.length === 0) {
      await pg.query(
        "INSERT INTO subscriptions (id, tenant_id, plan_id, status) VALUES ($1, $2, $3, 'ativo')",
        [uuidv4(), t.id, enterprisePlanId]
      );
      subCount++;
    }
  }
  console.log(`  ✓ ${subCount} subscriptions criadas\n`);

  // Validation
  console.log("=== Validação ===");
  const pgTenants = (await pg.query("SELECT COUNT(*) as cnt FROM tenants")).rows[0].cnt;
  const pgUsers = (await pg.query("SELECT COUNT(*) as cnt FROM users")).rows[0].cnt;
  const pgProfiles = (await pg.query("SELECT COUNT(*) as cnt FROM access_profiles")).rows[0].cnt;
  console.log(`  SQLite: ${tenants.length} tenants, ${users.length} users, ${profiles.length} profiles`);
  console.log(`  PG:     ${pgTenants} tenants, ${pgUsers} users, ${pgProfiles} profiles`);

  if (parseInt(pgTenants) >= tenants.length && parseInt(pgUsers) >= users.length) {
    console.log("\n✓ Migração concluída com sucesso!");
  } else {
    console.log("\n⚠ Contagens divergem — verifique manualmente");
  }

  await pg.end();
}

migrate().catch(err => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
