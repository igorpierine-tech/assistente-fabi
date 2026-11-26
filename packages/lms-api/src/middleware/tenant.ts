import { RequestHandler } from "express";
import { prisma } from "../config/prisma";

export const resolveTenant: RequestHandler = async (req, res, next) => {
  const slug =
    req.headers["x-tenant-slug"] as string | undefined ||
    req.query.tenant as string | undefined;

  if (!slug) {
    res.status(400).json({ error: "Tenant não identificado. Envie o header X-Tenant-Slug." });
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, active: true, plan: true },
  });

  if (!tenant || !tenant.active) {
    res.status(404).json({ error: "Organização não encontrada ou inativa." });
    return;
  }

  req.tenantId = tenant.id;
  next();
};
