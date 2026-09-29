import "express-session";
import type { Credentials } from "google-auth-library";
import type { UserRole } from "./services/users-db";

declare module "express-session" {
  interface SessionData {
    oauthState?: string;
    oauthPlatform?: string;
    googleTokens?: Credentials;
    googleUser?: { id: string; name: string; email?: string };
    appUser?: { id: string; name: string; email: string; role: UserRole };
  }
}
