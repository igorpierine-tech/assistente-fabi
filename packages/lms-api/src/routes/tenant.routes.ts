import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import {
  getTenantHandler,
  updateTenantHandler,
  listMembersHandler,
  inviteMemberHandler,
  removeMemberHandler,
  updateMemberRoleHandler,
} from "../controllers/tenant.controller";

export const tenantRouter: Router = Router();

tenantRouter.use(authenticate);

tenantRouter.get("/", getTenantHandler);
tenantRouter.patch("/", requireRole("OWNER", "ADMIN"), updateTenantHandler);

tenantRouter.get("/members", requireRole("OWNER", "ADMIN", "MENTOR"), listMembersHandler);
tenantRouter.post("/members", requireRole("OWNER", "ADMIN"), inviteMemberHandler);
tenantRouter.delete("/members/:id", requireRole("OWNER", "ADMIN"), removeMemberHandler);
tenantRouter.patch("/members/:id/role", requireRole("OWNER"), updateMemberRoleHandler);
