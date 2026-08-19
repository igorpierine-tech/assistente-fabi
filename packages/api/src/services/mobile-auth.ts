import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type PendingLogin = {
  expiresAt: number;
  sessionId: string;
  user: { id: string; name: string; email?: string };
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

export function signSessionId(sessionId: string, secret: string): string {
  const signature = createHmac("sha256", secret)
    .update(sessionId)
    .digest("base64")
    .replace(/=+$/, "");
  return `${sessionId}.${signature}`;
}

export function isValidSignedSession(token: string, secret: string): boolean {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;
  const sessionId = token.slice(0, separator);
  const expected = signSessionId(sessionId, secret);
  const left = Buffer.from(expected);
  const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}
