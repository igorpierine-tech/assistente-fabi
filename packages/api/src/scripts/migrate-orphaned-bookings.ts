/**
 * Migration script: move orphaned booking_requests from the legacy database
 * to the correct tenant database.
 *
 * Background: public booking routes ran without tenant context, so
 * createBookingRequest() wrote to the legacy DB (assistente-fabi.db)
 * instead of the tenant DB (tenant_<slug>.db). The admin panel reads
 * from the tenant DB, so those requests were invisible.
 *
 * Usage (from the api package root, with the same env vars as the server):
 *   npx tsx src/scripts/migrate-orphaned-bookings.ts
 *
 * Add --dry-run to preview without writing.
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { databasePath, tenantDbPath } from "../config/persistence";
import { getMasterDb, listTenants } from "../services/master-db";

interface BookingRequestRow {
  id: string;
  user_id: string;
  session_type_id: string | null;
  session_type_name: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  client_notes: string | null;
  requested_start: string;
  requested_end: string;
  status: string;
  google_event_id: string | null;
  manage_token: string;
  responded_at: string | null;
  responded_reason: string | null;
  created_at: string;
}

interface BookingSettingsRow {
  user_id: string;
  slug: string;
}

const dryRun = process.argv.includes("--dry-run");

function main() {
  console.log("=== Migração de booking_requests órfãos ===");
  if (dryRun) console.log("(modo --dry-run: nenhuma escrita será feita)\n");
  else console.log();

  // 1. Open the legacy database
  const legacyPath = databasePath();
  let legacyDb: Database.Database;
  try {
    legacyDb = new Database(legacyPath, { readonly: dryRun });
  } catch (err) {
    console.error(`Não foi possível abrir o banco legado em ${legacyPath}:`, err);
    process.exit(1);
  }

  // 2. Read orphaned booking_requests from the legacy DB
  let orphanedRequests: BookingRequestRow[];
  try {
    orphanedRequests = legacyDb
      .prepare("SELECT * FROM booking_requests ORDER BY created_at ASC")
      .all() as BookingRequestRow[];
  } catch {
    console.log("Tabela booking_requests não existe no banco legado. Nada a migrar.");
    return;
  }

  if (orphanedRequests.length === 0) {
    console.log("Nenhum booking_request encontrado no banco legado. Nada a migrar.");
    return;
  }

  console.log(`Encontrados ${orphanedRequests.length} booking_request(s) no banco legado.\n`);

  // 3. Build a map: user_id → tenant slug (from booking_settings in each tenant DB)
  const tenants = listTenants();
  const userToTenant = new Map<string, { tenantSlug: string; tenantId: string }>();

  for (const tenant of tenants) {
    try {
      const tDb = new Database(tenantDbPath(tenant.slug), { readonly: true });
      const settings = tDb
        .prepare("SELECT user_id, slug FROM booking_settings")
        .all() as BookingSettingsRow[];
      for (const s of settings) {
        userToTenant.set(s.user_id, { tenantSlug: tenant.slug, tenantId: tenant.id });
      }
      tDb.close();
    } catch {
      // tenant DB may not exist yet
    }
  }

  // Also check legacy booking_settings for user_id hints
  try {
    const legacySettings = legacyDb
      .prepare("SELECT user_id, slug FROM booking_settings")
      .all() as BookingSettingsRow[];
    for (const s of legacySettings) {
      if (!userToTenant.has(s.user_id)) {
        // Try to match by checking which tenant has the same booking slug
        for (const tenant of tenants) {
          try {
            const tDb = new Database(tenantDbPath(tenant.slug), { readonly: true });
            const match = tDb
              .prepare("SELECT user_id FROM booking_settings WHERE slug = ?")
              .get(s.slug);
            tDb.close();
            if (match) {
              userToTenant.set(s.user_id, { tenantSlug: tenant.slug, tenantId: tenant.id });
              break;
            }
          } catch { /* skip */ }
        }
      }
    }
  } catch { /* no legacy settings */ }

  // 4. If only one tenant exists, default unmapped requests to it
  if (tenants.length === 1 && userToTenant.size === 0) {
    console.log(`Apenas 1 tenant (${tenants[0].slug}). Todas as solicitações serão movidas para ele.\n`);
  }

  // 5. Migrate each request
  let migrated = 0;
  let skipped = 0;
  let duplicates = 0;

  const tenantDbs = new Map<string, Database.Database>();
  function getTenantDatabase(slug: string): Database.Database {
    if (!tenantDbs.has(slug)) {
      tenantDbs.set(slug, new Database(tenantDbPath(slug)));
    }
    return tenantDbs.get(slug)!;
  }

  for (const req of orphanedRequests) {
    let target = userToTenant.get(req.user_id);

    // Fallback: single-tenant scenario
    if (!target && tenants.length === 1) {
      target = { tenantSlug: tenants[0].slug, tenantId: tenants[0].id };
    }

    if (!target) {
      console.log(`  SKIP: ${req.id} (${req.client_name}, ${req.created_at}) — sem tenant para user_id=${req.user_id}`);
      skipped++;
      continue;
    }

    console.log(
      `  ${dryRun ? "PREVIEW" : "MIGRAR"}: ${req.id} → tenant ${target.tenantSlug}` +
      ` | ${req.client_name} | ${req.session_type_name} | ${req.status} | ${req.created_at}`
    );

    if (dryRun) {
      migrated++;
      continue;
    }

    const tDb = getTenantDatabase(target.tenantSlug);

    // Check for duplicate (same id already in tenant DB)
    const existing = tDb.prepare("SELECT id FROM booking_requests WHERE id = ?").get(req.id);
    if (existing) {
      console.log(`    (já existe no tenant — pulando)`);
      duplicates++;
      continue;
    }

    tDb.prepare(
      `INSERT INTO booking_requests
       (id, user_id, session_type_id, session_type_name, client_name, client_email,
        client_phone, client_notes, requested_start, requested_end, status,
        google_event_id, manage_token, responded_at, responded_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.id,
      req.user_id,
      req.session_type_id,
      req.session_type_name,
      req.client_name,
      req.client_email,
      req.client_phone,
      req.client_notes,
      req.requested_start,
      req.requested_end,
      req.status,
      req.google_event_id,
      req.manage_token,
      req.responded_at,
      req.responded_reason,
      req.created_at,
    );

    migrated++;
  }

  // 6. Clean up orphans from legacy DB
  if (!dryRun && migrated > 0) {
    const migratedIds = orphanedRequests
      .filter((r) => userToTenant.has(r.user_id) || tenants.length === 1)
      .map((r) => r.id);
    if (migratedIds.length > 0) {
      const placeholders = migratedIds.map(() => "?").join(", ");
      legacyDb
        .prepare(`DELETE FROM booking_requests WHERE id IN (${placeholders})`)
        .run(...migratedIds);
      console.log(`\nRemovidos ${migratedIds.length} registro(s) do banco legado.`);
    }
  }

  // Close all DBs
  for (const db of tenantDbs.values()) db.close();
  legacyDb.close();

  console.log(`\n=== Resultado ===`);
  console.log(`  Migrados: ${migrated}`);
  console.log(`  Duplicados (já existiam): ${duplicates}`);
  console.log(`  Pulados (sem tenant): ${skipped}`);
  if (dryRun) console.log(`\n(--dry-run ativo — nenhuma escrita foi feita)`);
  else console.log(`\nMigração concluída.`);
}

main();
