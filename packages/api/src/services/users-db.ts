import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { getDb } from "./database";

export type UserRole = "admin" | "gestor" | "colaborador" | "visualizador";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  role: UserRole;
  google_id: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<UserRow, "password_hash">;

function toSafe(row: UserRow): SafeUser {
  const { password_hash: _, ...safe } = row;
  return safe;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function getUserById(id: string): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id) as UserRow | undefined;
}

export function getUserByEmail(email: string): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .get(email) as UserRow | undefined;
}

export function getUserByGoogleId(googleId: string): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE google_id = ?")
    .get(googleId) as UserRow | undefined;
}

export function listUsers(): SafeUser[] {
  const rows = getDb()
    .prepare("SELECT * FROM users ORDER BY name")
    .all() as UserRow[];
  return rows.map(toSafe);
}

export async function createUser(data: {
  name: string;
  email: string;
  password?: string;
  role?: UserRole;
  googleId?: string;
}): Promise<SafeUser> {
  const id = uuidv4();
  const passwordHash = data.password ? await hashPassword(data.password) : null;
  getDb().prepare(
    `INSERT INTO users (id, name, email, password_hash, role, google_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, data.name, data.email.toLowerCase(), passwordHash, data.role || "colaborador", data.googleId || null);
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
  getDb().prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  const row = getUserById(id);
  return row ? toSafe(row) : undefined;
}

export async function updatePassword(id: string, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  getDb().prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(hash, id);
}

export function linkGoogleAccount(userId: string, googleId: string): void {
  getDb().prepare(
    "UPDATE users SET google_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(googleId, userId);
}

export function findOrCreateGoogleUser(googleUser: {
  id: string;
  name: string;
  email?: string;
}): SafeUser {
  const existing = getUserByGoogleId(googleUser.id);
  if (existing) return toSafe(existing);

  if (googleUser.email) {
    const byEmail = getUserByEmail(googleUser.email);
    if (byEmail) {
      linkGoogleAccount(byEmail.id, googleUser.id);
      return toSafe(getUserById(byEmail.id)!);
    }
  }

  const userCount = (getDb().prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number }).cnt;
  const role: UserRole = userCount === 0 ? "admin" : "colaborador";

  const id = uuidv4();
  getDb().prepare(
    `INSERT INTO users (id, name, email, role, google_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, googleUser.name, (googleUser.email || `${googleUser.id}@google.local`).toLowerCase(), role, googleUser.id);
  return toSafe(getUserById(id)!);
}

export function userCount(): number {
  return (getDb().prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number }).cnt;
}
