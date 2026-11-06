import path from "node:path";

function persistenceDirectory(): string {
  const configured = process.env.PERSISTENCE_DIR?.trim();
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error("PERSISTENCE_DIR deve apontar para um volume persistente em produção.");
  }
  return path.resolve(configured || path.join(process.cwd(), "packages/api/data"));
}

export function databasePath(): string {
  return path.resolve(process.env.DB_PATH || path.join(persistenceDirectory(), "assistente-fabi.db"));
}

export function masterDbPath(): string {
  return path.resolve(process.env.MASTER_DB_PATH || path.join(persistenceDirectory(), "master.db"));
}

export function tenantDbPath(slug: string): string {
  const safe = slug.replace(/[^a-z0-9_-]/gi, "");
  return path.join(persistenceDirectory(), `tenant_${safe}.db`);
}

export function sessionFilePath(): string {
  return path.resolve(process.env.SESSION_FILE || path.join(persistenceDirectory(), "sessions.enc.json"));
}
