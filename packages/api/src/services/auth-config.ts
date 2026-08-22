/**
 * Auth configuration derived from environment variables.
 * - AUTHORIZED_EMAILS: comma-separated list of Google emails allowed to sign in.
 *   If empty, all Google-verified accounts can sign in (single-user default).
 * - WORKSPACE_ID: fixed identifier used as user_id in all database queries.
 *   When set, every authenticated user in the allowlist sees the same shared
 *   workspace. Without it, each Google user has their own private data.
 */

export function getAuthorizedEmails(): string[] {
  const raw = process.env.AUTHORIZED_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAuthorized(email: string | null | undefined): boolean {
  const list = getAuthorizedEmails();
  if (list.length === 0) return true;
  if (!email) return false;
  return list.includes(email.toLowerCase());
}

export function getWorkspaceId(): string | undefined {
  const value = process.env.WORKSPACE_ID?.trim();
  return value && value.length > 0 ? value : undefined;
}

/**
 * When a workspace is configured, this env var names the person whose
 * personal calendar should inherit any past workspace-owned appointments
 * (i.e., data created before per-user appointment scoping was introduced).
 * The reassignment runs each time this user signs in — idempotent.
 */
export function getPrimaryAppointmentOwnerEmail(): string | null {
  const value = process.env.PRIMARY_APPOINTMENT_OWNER_EMAIL?.trim().toLowerCase();
  return value && value.length > 0 ? value : null;
}
