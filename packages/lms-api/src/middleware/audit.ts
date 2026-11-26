import { RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

function extractUserAgent(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const ua = req.headers["user-agent"];
  if (typeof ua === "string") return ua.slice(0, 500);
  return undefined;
}

export function auditAction(action: string, entity?: string): RequestHandler {
  return async (req, _res, next) => {
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.userId,
          action,
          entity,
          entityId: typeof req.params.id === "string" ? req.params.id : undefined,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: extractUserAgent(req),
        },
      });
    } catch {
      // audit failures must not block the request
    }
    next();
  };
}

export async function logAudit(opts: {
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId,
        metadata: (opts.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        ipAddress: opts.ipAddress,
        userAgent: opts.userAgent?.slice(0, 500),
      },
    });
  } catch {
    // best-effort
  }
}
