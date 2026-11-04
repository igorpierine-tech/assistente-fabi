import { v4 as uuidv4 } from "uuid";
import { getDb } from "./database";

export interface NfseInvoice {
  id: string;
  user_id: string;
  sale_id: string | null;
  numero_nfse: string | null;
  chave_acesso: string | null;
  codigo_verificacao: string | null;
  status: string;
  valor_servico_cents: number;
  descricao_servico: string;
  tomador_nome: string;
  tomador_documento: string | null;
  tomador_email: string | null;
  dps_xml: string | null;
  nfse_xml: string | null;
  danfse_url: string | null;
  erro_mensagem: string | null;
  emitida_em: string | null;
  cancelada_em: string | null;
  created_at: string;
  updated_at: string;
}

export function listNfseInvoices(userId: string): NfseInvoice[] {
  return getDb()
    .prepare("SELECT * FROM nfse_invoices WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as NfseInvoice[];
}

export function getNfseInvoice(userId: string, id: string): NfseInvoice | undefined {
  return getDb()
    .prepare("SELECT * FROM nfse_invoices WHERE user_id = ? AND id = ?")
    .get(userId, id) as NfseInvoice | undefined;
}

export function getNfseInvoiceBySaleId(userId: string, saleId: string): NfseInvoice | undefined {
  return getDb()
    .prepare("SELECT * FROM nfse_invoices WHERE user_id = ? AND sale_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(userId, saleId) as NfseInvoice | undefined;
}

export function createNfseInvoice(
  userId: string,
  data: {
    sale_id?: string | null;
    valor_servico_cents: number;
    descricao_servico: string;
    tomador_nome: string;
    tomador_documento?: string | null;
    tomador_email?: string | null;
  }
): NfseInvoice {
  const id = uuidv4();
  getDb()
    .prepare(
      `INSERT INTO nfse_invoices
        (id, user_id, sale_id, valor_servico_cents, descricao_servico,
         tomador_nome, tomador_documento, tomador_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      userId,
      data.sale_id ?? null,
      data.valor_servico_cents,
      data.descricao_servico,
      data.tomador_nome,
      data.tomador_documento ?? null,
      data.tomador_email ?? null
    );
  return getNfseInvoice(userId, id)!;
}

export function updateNfseInvoice(
  userId: string,
  id: string,
  data: Partial<Pick<NfseInvoice, "numero_nfse" | "chave_acesso" | "codigo_verificacao" | "status" | "dps_xml" | "nfse_xml" | "danfse_url" | "erro_mensagem" | "emitida_em" | "cancelada_em">>
): NfseInvoice | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (fields.length === 0) return getNfseInvoice(userId, id);
  fields.push("updated_at = datetime('now')");
  values.push(userId, id);
  getDb()
    .prepare(`UPDATE nfse_invoices SET ${fields.join(", ")} WHERE user_id = ? AND id = ?`)
    .run(...values);
  return getNfseInvoice(userId, id);
}
