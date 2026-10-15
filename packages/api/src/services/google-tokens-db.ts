import { getDb } from "./database";
import type { Credentials } from "google-auth-library";

export interface GoogleTokenRow {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expiry_date: number | null;
  scope: string | null;
  google_email: string | null;
  connected_at: string;
  updated_at: string;
}

export function saveGoogleTokens(
  userId: string,
  tokens: Credentials,
  googleEmail?: string
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO google_tokens (user_id, access_token, refresh_token, expiry_date, scope, google_email)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, google_tokens.refresh_token),
      expiry_date = excluded.expiry_date,
      scope = excluded.scope,
      google_email = COALESCE(excluded.google_email, google_tokens.google_email),
      updated_at = datetime('now')
  `).run(
    userId,
    tokens.access_token || "",
    tokens.refresh_token || "",
    tokens.expiry_date ?? null,
    tokens.scope ?? null,
    googleEmail ?? null
  );
}

export function getGoogleTokens(userId: string): Credentials | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM google_tokens WHERE user_id = ?").get(userId) as GoogleTokenRow | undefined;
  if (!row) return null;
  return {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expiry_date: row.expiry_date,
  };
}

export function getGoogleTokenRow(userId: string): GoogleTokenRow | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM google_tokens WHERE user_id = ?").get(userId) as GoogleTokenRow) ?? null;
}

export function updateGoogleTokens(userId: string, tokens: Credentials): void {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];
  if (tokens.access_token) { sets.push("access_token = ?"); values.push(tokens.access_token); }
  if (tokens.refresh_token) { sets.push("refresh_token = ?"); values.push(tokens.refresh_token); }
  if (tokens.expiry_date) { sets.push("expiry_date = ?"); values.push(tokens.expiry_date); }
  values.push(userId);
  db.prepare(`UPDATE google_tokens SET ${sets.join(", ")} WHERE user_id = ?`).run(...values);
}

export function deleteGoogleTokens(userId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM google_tokens WHERE user_id = ?").run(userId);
}
