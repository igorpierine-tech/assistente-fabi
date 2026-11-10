import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type PendingLogin = {
  expiresAt: number;
  sessionId: string;
  user: {
    id: string;
    name: string;
    email?: string;
    appUser?: { id: string; name: string; email: string; role: string };
  };
};

const pendingLogins = new Map<string, PendingLogin>();
const LOGIN_TTL_MS = 2 * 60 * 1000;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("base64url");
}

export function createMobileLogin(sessionId: string, user: PendingLogin["user"]): string {
  for (const [key, login] of pendingLogins) {
    if (login.expiresAt <= Date.now()) pendingLogins.delete(key);
  }
  const code = randomBytes(32).toString("base64url");
  pendingLogins.set(hashCode(code), { sessionId, user, expiresAt: Date.now() + LOGIN_TTL_MS });
  return code;
}

export function consumeMobileLogin(code: string): PendingLogin | null {
  const key = hashCode(code);
  const login = pendingLogins.get(key);
  pendingLogins.delete(key);

  if (!login || login.expiresAt <= Date.now()) return null;
  return login;
}

const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function signSessionId(sessionId: string, secret: string): string {
  const payload = `${sessionId}:${Date.now()}`;
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64")
    .replace(/=+$/, "");
  return `${payload}.${signature}`;
}

export function isValidSignedSession(token: string, secret: string): boolean {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;
  const payload = token.slice(0, separator);
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64")
    .replace(/=+$/, "");
  const left = Buffer.from(`${payload}.${expected}`);
  const right = Buffer.from(token);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  const colonIdx = payload.lastIndexOf(":");
  if (colonIdx <= 0) return true;
  const issuedAt = Number(payload.slice(colonIdx + 1));
  if (!Number.isFinite(issuedAt)) return true;
  return Date.now() - issuedAt < TOKEN_MAX_AGE_MS;
}
