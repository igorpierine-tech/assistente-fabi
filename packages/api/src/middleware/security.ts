import type { NextFunction, Request, RequestHandler, Response } from "express";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

export function rateLimit(options: { windowMs: number; max: number; prefix: string }): RequestHandler {
  return (req, res, next) => {
    const identity = req.session?.googleUser?.id || req.ip || req.socket.remoteAddress || "unknown";
    const key = `${options.prefix}:${identity}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader("RateLimit-Limit", options.max);
    res.setHeader("RateLimit-Remaining", Math.max(0, options.max - bucket.count));
    res.setHeader("RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));
    if (bucket.count > options.max) {
      res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
      res.status(429).json({ error: "Muitas requisições. Tente novamente mais tarde." });
      return;
    }
    if (buckets.size > 10_000) {
      for (const [storedKey, stored] of buckets) {
        if (stored.resetAt <= now) buckets.delete(storedKey);
      }
    }
    next();
  };
}

export function requireTrustedOrigin(allowedOrigins: ReadonlySet<string>): RequestHandler {
  return (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      next();
      return;
    }
    // Native clients authenticate with a signed bearer token and do not send Origin.
    if (req.get("authorization")?.startsWith("Bearer ")) {
      next();
      return;
    }
    const origin = req.get("origin");
    if (!origin && req.path === "/auth/mobile/exchange") {
      next();
      return;
    }
    const ownOrigin = `${req.protocol}://${req.get("host")}`;
    if (!origin || (!allowedOrigins.has(origin) && origin !== ownOrigin)) {
      res.status(403).json({ error: "Origem não autorizada" });
      return;
    }
    next();
  };
}
