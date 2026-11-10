import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { getMasterDb } from "./master-db";

export type UserRole = "admin" | "gestor" | "colaborador" | "visualizador";

export interface UserRow {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  password_hash: string | null;
  role: UserRole;
  platform_role: string;
  google_id: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<UserRow, "password_hash" | "platform_role">;

function toSafe(row: UserRow): SafeUser {
  const { password_hash: _, platform_role: __, ...safe } = row;
  return safe;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function getUserById(id: string): UserRow | undefined {
  return getMasterDb()
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id) as UserRow | undefined;
}

export function getUserByIdAndTenant(id: string, tenantId: string): UserRow | undefined {
  return getMasterDb()
    .prepare("SELECT * FROM users WHERE id = ? AND tenant_id = ?")
    .get(id, tenantId) as UserRow | undefined;
}

export function getUserByEmail(email: string): UserRow | undefined {
  return getMasterDb()
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .get(email) as UserRow | undefined;
}

export function getUserByGoogleId(googleId: string): UserRow | undefined {
  return getMasterDb()
    .prepare("SELECT * FROM users WHERE google_id = ?")
    .get(googleId) as UserRow | undefined;
}

export function listUsers(tenantId?: string): SafeUser[] {
  if (tenantId) {
    const rows = getMasterDb()
      .prepare("SELECT * FROM users WHERE tenant_id = ? ORDER BY name")
      .all(tenantId) as UserRow[];
    return rows.map(toSafe);
  }
  const rows = getMasterDb()
    .prepare("SELECT * FROM users ORDER BY name")
    .all() as UserRow[];
  return rows.map(toSafe);
}

export async function createUser(data: {
  tenantId: string;
  name: string;
  email: string;
  password?: string;
  role?: UserRole;
  googleId?: string;
}): Promise<SafeUser> {
  const id = uuidv4();
  const passwordHash = data.password ? await hashPassword(data.password) : null;
  getMasterDb().prepare(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, role, google_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.tenantId, data.name, data.email.toLowerCase(), passwordHash, data.role || "colaborador", data.googleId || null);
  return toSafe(getUserById(id)!);
}

export function updateUser(id: string, data: Partial<{
  name: string;
  email: string;
  role: UserRole;
  active: number;
  googleId: string;
}>): SafeUser | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.email !== undefined) { fields.push("email = ?"); values.push(data.email.toLowerCase()); }
  if (data.role !== undefined) { fields.push("role = ?"); values.push(data.role); }
  if (data.active !== undefined) { fields.push("active = ?"); values.push(data.active); }
  if (data.googleId !== undefined) { fields.push("google_id = ?"); values.push(data.googleId); }
  if (fields.length === 0) return getUserById(id) ? toSafe(getUserById(id)!) : undefined;
  fields.push("updated_at = datetime('now')");
  values.push(id);
  getMasterDb().prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  const row = getUserById(id);
  return row ? toSafe(row) : undefined;
}

export async function updatePassword(id: string, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  getMasterDb().prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(hash, id);
}

export function linkGoogleAccount(userId: string, googleId: string): void {
  getMasterDb().prepare(
    "UPDATE users SET google_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(googleId, userId);
}

export function findOrCreateGoogleUser(
  tenantId: string,
  googleUser: {
    id: string;
    name: string;
    email?: string;
  }
): SafeUser {
  const existing = getUserByGoogleId(googleUser.id);
  if (existing) return toSafe(existing);

  if (googleUser.email) {
    const byEmail = getUserByEmail(googleUser.email);
    if (byEmail) {
      linkGoogleAccount(byEmail.id, googleUser.id);
      return toSafe(getUserById(byEmail.id)!);
    }
  }

  const tenantUsers = (getMasterDb().prepare("SELECT COUNT(*) as cnt FROM users WHERE tenant_id = ?").get(tenantId) as { cnt: number }).cnt;
  const role: UserRole = tenantUsers === 0 ? "admin" : "colaborador";

  const id = uuidv4();
  getMasterDb().prepare(
    `INSERT INTO users (id, tenant_id, name, email, role, google_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, tenantId, googleUser.name, (googleUser.email || `${googleUser.id}@google.local`).toLowerCase(), role, googleUser.id);
  return toSafe(getUserById(id)!);
}

export function userCount(): number {
  return (getMasterDb().prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number }).cnt;
}
