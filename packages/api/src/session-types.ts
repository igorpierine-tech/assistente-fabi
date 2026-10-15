import "express-session";
import type { UserRole } from "./services/users-db";

declare module "express-session" {
  interface SessionData {
    oauthState?: string;
    appUser?: { id: string; name: string; email: string; role: UserRole };
  }
}
