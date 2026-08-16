import "express-session";
import type { Credentials } from "google-auth-library";

declare module "express-session" {
  interface SessionData {
    oauthState?: string;
    oauthPlatform?: string;
    googleTokens?: Credentials;
    googleUser?: { id: string; name: string; email?: string };
  }
}
