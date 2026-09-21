import { v4 as uuidv4 } from "uuid";
import { createHash } from "node:crypto";
import { getDb } from "./database";

// --- Types ---

export interface ServiceDefinition {
  code: string;
  name: string;
  family: string;
  schema_fields: string;
  active: number;
  created_at: string;
}

export type TemplateType = "base" | "module" | "policy";
export type TemplateStatus = "draft" | "in_review" | "approved" | "published" | "retired";

export interface ContractTemplateVersion {
  id: string;
  user_id: string;
  type: TemplateType;
  service_code: string | null;
  version: string;
  name: string;
  content: string;
  schema_version: string;
  status: TemplateStatus;
  content_hash: string | null;
  author: string | null;
  reviewer: string | null;
  approved_by: string | null;
  published_at: string | null;
  changelog: string | null;
  created_at: string;
  updated_at: string;
}

export type ContractStatus = "draft" | "issued" | "awaiting_signature" | "completed" | "voided" | "expired" | "superseded";

export interface Contract {
  id: string;
  user_id: string;
  contract_number: string;
  sale_id: string | null;
  service_code: string;
  client_id: string | null;
  current_revision: number;
  status: ContractStatus;
  created_at: string;
  updated_at: string;
}

export interface ContractRevision {
  id: string;
  contract_id: string;
  revision_number: number;
  status: string;
  snapshot: string;
  base_version_id: string | null;
  module_version_id: string | null;
  policy_version_id: string | null;
  content_hash: string | null;
  issued_at: string | null;
  valid_until: string | null;
  superseded_by: string | null;
  created_at: string;
}

export interface ContractArtifact {
  id: string;
  revision_id: string;
  type: string;
  content: Buffer | null;
  mime_type: string;
  file_hash: string | null;
  created_at: string;
}

export interface ContractParty {
  id: string;
  revision_id: string;
  role: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  representative_name: string | null;
  representative_role: string | null;
  created_at: string;
}

// --- Service definitions ---

export function listServiceDefinitions(): ServiceDefinition[] {
  return getDb()
    .prepare(`SELECT * FROM service_definitions WHERE active = 1 ORDER BY family, name`)
    .all() as ServiceDefinition[];
}

export function getServiceDefinition(code: string): ServiceDefinition | undefined {
  return getDb()
    .prepare(`SELECT * FROM service_definitions WHERE code = ?`)
    .get(code) as ServiceDefinition | undefined;
}

// --- Template versions ---

export function listTemplateVersions(userId: string, type?: TemplateType, status?: TemplateStatus): ContractTemplateVersion[] {
  let sql = `SELECT * FROM contract_template_versions WHERE user_id = ?`;
  const params: unknown[] = [userId];
  if (type) { sql += ` AND type = ?`; params.push(type); }
  if (status) { sql += ` AND status = ?`; params.push(status); }
  sql += ` ORDER BY type, service_code, version DESC`;
  return getDb().prepare(sql).all(...params) as ContractTemplateVersion[];
}

export function getTemplateVersion(id: string): ContractTemplateVersion | undefined {
  return getDb()
    .prepare(`SELECT * FROM contract_template_versions WHERE id = ?`)
    .get(id) as ContractTemplateVersion | undefined;
}

export function getPublishedTemplate(userId: string, type: TemplateType, serviceCode?: string): ContractTemplateVersion | undefined {
  if (serviceCode) {
    return getDb()
      .prepare(`SELECT * FROM contract_template_versions WHERE user_id = ? AND type = ? AND service_code = ? AND status = 'published' ORDER BY version DESC LIMIT 1`)
      .get(userId, type, serviceCode) as ContractTemplateVersion | undefined;
  }
  return getDb()
    .prepare(`SELECT * FROM contract_template_versions WHERE user_id = ? AND type = ? AND service_code IS NULL AND status = 'published' ORDER BY version DESC LIMIT 1`)
    .get(userId, type) as ContractTemplateVersion | undefined;
}

export function createTemplateVersion(userId: string, data: {
  type: TemplateType;
  serviceCode?: string;
  version: string;
  name: string;
  content: string;
  author?: string;
}): ContractTemplateVersion {
  const id = uuidv4();
  const contentHash = createHash("sha256").update(data.content, "utf8").digest("hex");
  getDb().prepare(
    `INSERT INTO contract_template_versions (id, user_id, type, service_code, version, name, content, content_hash, author)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, data.type, data.serviceCode || null, data.version, data.name, data.content, contentHash, data.author || null);
  return getTemplateVersion(id)!;
}

export function updateTemplateStatus(id: string, status: TemplateStatus, actor?: string): void {
  const updates: string[] = [`status = ?`, `updated_at = datetime('now')`];
  const params: unknown[] = [status];
  if (status === "published") {
    updates.push(`published_at = datetime('now')`);
    if (actor) { updates.push(`approved_by = ?`); params.push(actor); }
  }
  if (status === "approved" && actor) {
    updates.push(`approved_by = ?`); params.push(actor);
  }
  if (status === "in_review" && actor) {
    updates.push(`reviewer = ?`); params.push(actor);
  }
  params.push(id);
  getDb().prepare(`UPDATE contract_template_versions SET ${updates.join(", ")} WHERE id = ?`).run(...params);
}

// --- Contracts ---

export function nextContractNumber(userId: string): string {
  const row = getDb()
    .prepare(`SELECT COUNT(*) as cnt FROM contracts WHERE user_id = ?`)
    .get(userId) as { cnt: number };
  const num = (row.cnt || 0) + 1;
  const year = new Date().getFullYear();
  return `${year}/${String(num).padStart(4, "0")}`;
}

export function listContracts(userId: string, filters?: { status?: string; serviceCode?: string }): Contract[] {
  let sql = `SELECT * FROM contracts WHERE user_id = ?`;
  const params: unknown[] = [userId];
  if (filters?.status) { sql += ` AND status = ?`; params.push(filters.status); }
  if (filters?.serviceCode) { sql += ` AND service_code = ?`; params.push(filters.serviceCode); }
  sql += ` ORDER BY created_at DESC`;
  return getDb().prepare(sql).all(...params) as Contract[];
}

export function getContract(userId: string, id: string): Contract | undefined {
  return getDb()
    .prepare(`SELECT * FROM contracts WHERE user_id = ? AND id = ?`)
    .get(userId, id) as Contract | undefined;
}

export function createContract(userId: string, data: {
  saleId?: string;
  serviceCode: string;
  clientId?: string;
}): Contract {
  const id = uuidv4();
  const contractNumber = nextContractNumber(userId);
  getDb().prepare(
    `INSERT INTO contracts (id, user_id, contract_number, sale_id, service_code, client_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, userId, contractNumber, data.saleId || null, data.serviceCode, data.clientId || null);
  return getContract(userId, id)!;
}

export function updateContractStatus(userId: string, id: string, status: ContractStatus): void {
  getDb().prepare(
    `UPDATE contracts SET status = ?, updated_at = datetime('now') WHERE user_id = ? AND id = ?`
  ).run(status, userId, id);
}

// --- Contract revisions ---

export function getRevision(revisionId: string): ContractRevision | undefined {
  return getDb()
    .prepare(`SELECT * FROM contract_revisions WHERE id = ?`)
    .get(revisionId) as ContractRevision | undefined;
}

export function getLatestRevision(contractId: string): ContractRevision | undefined {
  return getDb()
    .prepare(`SELECT * FROM contract_revisions WHERE contract_id = ? ORDER BY revision_number DESC LIMIT 1`)
    .get(contractId) as ContractRevision | undefined;
}

export function listRevisions(contractId: string): ContractRevision[] {
  return getDb()
    .prepare(`SELECT * FROM contract_revisions WHERE contract_id = ? ORDER BY revision_number ASC`)
    .all(contractId) as ContractRevision[];
}

export function createRevision(contractId: string, data: {
  revisionNumber: number;
  snapshot: string;
  baseVersionId?: string;
  moduleVersionId?: string;
  policyVersionId?: string;
}): ContractRevision {
  const id = uuidv4();
  const contentHash = createHash("sha256").update(data.snapshot, "utf8").digest("hex");
  getDb().prepare(
    `INSERT INTO contract_revisions (id, contract_id, revision_number, snapshot, base_version_id, module_version_id, policy_version_id, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, contractId, data.revisionNumber, data.snapshot, data.baseVersionId || null, data.moduleVersionId || null, data.policyVersionId || null, contentHash);
  return getRevision(id)!;
}

export function issueRevision(revisionId: string, validUntilDays?: number): void {
  const validUntil = validUntilDays
    ? `datetime('now', '+${Math.max(1, Math.min(365, validUntilDays))} days')`
    : null;
  getDb().prepare(
    `UPDATE contract_revisions SET status = 'issued', issued_at = datetime('now')${validUntil ? `, valid_until = ${validUntil}` : ""} WHERE id = ?`
  ).run(revisionId);
}

// --- Contract artifacts ---

export function saveArtifact(revisionId: string, type: string, content: Buffer, mimeType = "application/pdf"): ContractArtifact {
  const id = uuidv4();
  const fileHash = createHash("sha256").update(content).digest("hex");
  getDb().prepare(
    `INSERT INTO contract_artifacts (id, revision_id, type, content, mime_type, file_hash) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, revisionId, type, content, mimeType, fileHash);
  return getDb().prepare(`SELECT id, revision_id, type, mime_type, file_hash, created_at FROM contract_artifacts WHERE id = ?`).get(id) as ContractArtifact;
}

export function getArtifact(artifactId: string): ContractArtifact | undefined {
  return getDb()
    .prepare(`SELECT * FROM contract_artifacts WHERE id = ?`)
    .get(artifactId) as ContractArtifact | undefined;
}

export function getArtifactByType(revisionId: string, type: string): ContractArtifact | undefined {
  return getDb()
    .prepare(`SELECT * FROM contract_artifacts WHERE revision_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1`)
    .get(revisionId, type) as ContractArtifact | undefined;
}

// --- Contract parties ---

export function saveParty(revisionId: string, data: {
  role: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  representativeName?: string;
  representativeRole?: string;
}): ContractParty {
  const id = uuidv4();
  getDb().prepare(
    `INSERT INTO contract_parties (id, revision_id, role, name, document, email, phone, address, representative_name, representative_role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, revisionId, data.role, data.name, data.document || null, data.email || null, data.phone || null, data.address || null, data.representativeName || null, data.representativeRole || null);
  return getDb().prepare(`SELECT * FROM contract_parties WHERE id = ?`).get(id) as ContractParty;
}

export function listParties(revisionId: string): ContractParty[] {
  return getDb()
    .prepare(`SELECT * FROM contract_parties WHERE revision_id = ? ORDER BY role`)
    .all(revisionId) as ContractParty[];
}

// --- Contract audit ---

export function logContractEvent(data: {
  userId?: string;
  contractId?: string;
  revisionId?: string;
  action: string;
  details?: Record<string, unknown>;
}): void {
  const id = uuidv4();
  getDb().prepare(
    `INSERT INTO contract_audit (id, user_id, contract_id, revision_id, action, details) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, data.userId || null, data.contractId || null, data.revisionId || null, data.action, data.details ? JSON.stringify(data.details) : null);
}

// --- Contracts with joined data ---

export interface ContractWithDetails extends Contract {
  service_name: string;
  client_name: string | null;
  latest_revision_status: string | null;
}

export function listContractsWithDetails(userId: string, filters?: { status?: string; serviceCode?: string }): ContractWithDetails[] {
  let sql = `
    SELECT c.*,
           sd.name as service_name,
           cl.name as client_name,
           cr.status as latest_revision_status
    FROM contracts c
    LEFT JOIN service_definitions sd ON sd.code = c.service_code
    LEFT JOIN clients cl ON cl.id = c.client_id
    LEFT JOIN contract_revisions cr ON cr.contract_id = c.id AND cr.revision_number = c.current_revision
    WHERE c.user_id = ?`;
  const params: unknown[] = [userId];
  if (filters?.status) { sql += ` AND c.status = ?`; params.push(filters.status); }
  if (filters?.serviceCode) { sql += ` AND c.service_code = ?`; params.push(filters.serviceCode); }
  sql += ` ORDER BY c.created_at DESC`;
  return getDb().prepare(sql).all(...params) as ContractWithDetails[];
}
