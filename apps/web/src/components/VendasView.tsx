"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./VendasView.module.css";
import { apiFetch } from "@/lib/api";

type PaymentMethod =
  | "pix"
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "transferencia"
  | "boleto"
  | "outro";

interface Sale {
  id: string;
  client_id: string | null;
  client_name: string;
  client_document: string | null;
  client_email: string | null;
  client_phone: string | null;
  catalog_item_id: string | null;
  item_name: string;
  amount_cents: number;
  payment_method: PaymentMethod | null;
  installments: number;
  sale_date: string;
  notes: string | null;
  contract_generated_at: string | null;
  zapsign_doc_token: string | null;
  zapsign_status: string | null;
  zapsign_sign_url: string | null;
  created_at: string;
  updated_at: string;
}

const SIGN_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Aguardando assinatura", color: "#b45309" },
  signed: { label: "Assinado", color: "#16a34a" },
  cancelled: { label: "Cancelado", color: "#dc2626" },
};

interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  document: string | null;
}

interface CatalogItem {
  id: string;
  name: string;
  price_cents: number;
  kind: string;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
  boleto: "Boleto",
  outro: "Outro",
};

const METHOD_OPTIONS: PaymentMethod[] = [
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
  "boleto",
  "outro",
];

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function centsToInput(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

type ClientMode = "existing" | "new";

interface PaymentEntry {
  method: PaymentMethod;
  amountInput: string;
  installments: number;
  date: string;
}

interface FormState {
  clientMode: ClientMode;
  clientId: string;
  clientName: string;
  clientDocument: string;
  clientEmail: string;
  clientPhone: string;
  catalogItemId: string;
  itemName: string;
  amountInput: string;
  paymentEntries: PaymentEntry[];
  installments: number;
  saleDate: string;
  notes: string;
  createClient: boolean;
}

const emptyForm: FormState = {
  clientMode: "existing",
  clientId: "",
  clientName: "",
  clientDocument: "",
  clientEmail: "",
  clientPhone: "",
  catalogItemId: "",
  itemName: "",
  amountInput: "",
  paymentEntries: [],
  installments: 1,
  saleDate: new Date().toISOString().slice(0, 10),
  notes: "",
  createClient: false,
};

export function VendasView() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<Sale | null | "new">(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sendingSignId, setSendingSignId] = useState<string | null>(null);
  const [checkingSignId, setCheckingSignId] = useState<string | null>(null);
  const [zapSignConfigured, setZapSignConfigured] = useState(false);
  const [nfseConfigured, setNfseConfigured] = useState(false);
  const [nfseStatuses, setNfseStatuses] = useState<Record<string, { status: string; numero?: string | null }>>({});
  const [emittingNfseId, setEmittingNfseId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [saleRes, clientRes, catRes] = await Promise.all([
        apiFetch("/sales"),
        apiFetch("/clients"),
        apiFetch("/catalog"),
      ]);
      if (saleRes.ok) setSales(await saleRes.json());
      if (clientRes.ok) setClients(await clientRes.json());
      if (catRes.ok) setCatalog(await catRes.json());
      try {
        const zsRes = await apiFetch("/sales/zapsign/status");
        if (zsRes.ok) {
          const zs = await zsRes.json();
          setZapSignConfigured(zs.configured);
        }
      } catch {}
      try {
        const nfseRes = await apiFetch("/nfse/status");
        if (nfseRes.ok) {
          const ns = await nfseRes.json();
          setNfseConfigured(ns.configured);
        }
      } catch {}
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  const fetchNfseStatuses = useCallback(async (saleList: Sale[]) => {
    const statuses: Record<string, { status: string; numero?: string | null }> = {};
    for (const s of saleList) {
      try {
        const res = await apiFetch(`/nfse/sale/${s.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data) {
            statuses[s.id] = { status: data.status, numero: data.numero_nfse };
          }
        }
      } catch {}
    }
    setNfseStatuses(statuses);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (sales.length > 0 && nfseConfigured) {
      fetchNfseStatuses(sales);
    }
  }, [sales, nfseConfigured, fetchNfseStatuses]);

  async function emitirNfse(s: Sale) {
    if (!confirm(`Emitir NFS-e para a venda "${s.item_name}" de ${(s.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}?`)) return;
    setEmittingNfseId(s.id);
    try {
      const res = await apiFetch("/nfse/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId: s.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`NFS-e emitida com sucesso!${data.invoice?.numero_nfse ? ` Numero: ${data.invoice.numero_nfse}` : ""}`);
        await fetchNfseStatuses(sales);
      } else {
        alert(data.error || "Falha ao emitir NFS-e");
      }
    } catch {
      alert("Erro ao emitir NFS-e");
    }
    setEmittingNfseId(null);
  }

  function openNew() {
    setForm({ ...emptyForm, saleDate: new Date().toISOString().slice(0, 10) });
    setEditModal("new");
  }

  function parsePaymentEntries(raw: string | null, fallbackAmount: number, fallbackInstallments: number, fallbackDate: string): PaymentEntry[] {
    if (!raw) return [];
    if (raw.startsWith("[")) {
      try {
        const arr = JSON.parse(raw) as Array<{ method: string; amount_cents: number; installments: number }>;
        if (Array.isArray(arr)) {
          return arr
            .filter((e) => METHOD_OPTIONS.includes(e.method as PaymentMethod))
            .map((e) => ({
              method: e.method as PaymentMethod,
              amountInput: centsToInput(e.amount_cents),
              installments: e.installments || 1,
              date: fallbackDate,
            }));
        }
      } catch {}
    }
    return raw
      .split(",")
      .map((m) => m.trim())
      .filter((m): m is PaymentMethod => METHOD_OPTIONS.includes(m as PaymentMethod))
      .map((m) => ({
        method: m,
        amountInput: centsToInput(fallbackAmount),
        installments: fallbackInstallments,
        date: fallbackDate,
      }));
  }

  function openEdit(s: Sale) {
    const dateStr = toDateInput(s.sale_date);
    setForm({
      clientMode: s.client_id ? "existing" : "new",
      clientId: s.client_id || "",
      clientName: s.client_name,
      clientDocument: s.client_document || "",
      clientEmail: s.client_email || "",
      clientPhone: s.client_phone || "",
      catalogItemId: s.catalog_item_id || "",
      itemName: s.item_name,
      amountInput: centsToInput(s.amount_cents),
      paymentEntries: parsePaymentEntries(s.payment_method, s.amount_cents, s.installments, dateStr),
      installments: s.installments,
      saleDate: dateStr,
      notes: s.notes || "",
      createClient: false,
    });
    setEditModal(s);
  }

  function onClientSelect(clientId: string) {
    const found = clients.find((c) => c.id === clientId);
    if (found) {
      setForm((f) => ({
        ...f,
        clientId,
        clientName: found.name,
        clientDocument: found.document || "",
        clientEmail: found.email || "",
        clientPhone: found.phone || "",
      }));
    } else {
      setForm((f) => ({ ...f, clientId: "" }));
    }
  }

  function onCatalogSelect(id: string) {
    const found = catalog.find((c) => c.id === id);
    if (found) {
      setForm((f) => ({
        ...f,
        catalogItemId: id,
        itemName: found.name,
        amountInput: centsToInput(found.price_cents),
      }));
    } else {
      setForm((f) => ({ ...f, catalogItemId: "" }));
    }
  }

  async function handleSave() {
    if (!form.clientName.trim() || !form.itemName.trim()) return;
    setSaving(true);
    const body = {
      clientId: form.clientMode === "existing" ? form.clientId || null : null,
      createClient: form.clientMode === "new" && form.createClient,
      clientName: form.clientName.trim(),
      clientDocument: form.clientDocument.trim() || null,
      clientEmail: form.clientEmail.trim() || null,
      clientPhone: form.clientPhone.trim() || null,
      catalogItemId: form.catalogItemId || null,
      itemName: form.itemName.trim(),
      amount: form.amountInput,
      paymentMethods: form.paymentEntries.length > 0
        ? form.paymentEntries.map((e) => ({
            method: e.method,
            amount: e.amountInput,
            installments: e.installments,
          }))
        : null,
      installments: form.installments,
      saleDate: form.saleDate,
      notes: form.notes.trim() || null,
    };
    try {
      const path =
        editModal === "new"
          ? "/sales"
          : `/sales/${(editModal as Sale).id}`;
      const method = editModal === "new" ? "POST" : "PUT";
      const res = await apiFetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditModal(null);
        await fetchAll();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Falha ao salvar");
      }
    } catch {
      // silent
    }
    setSaving(false);
  }

  async function handleDelete(s: Sale) {
    if (!confirm(`Excluir a venda de "${s.client_name}"?`)) return;
    await apiFetch(`/sales/${s.id}`, { method: "DELETE" });
    await fetchAll();
  }

  async function sendForSignature(s: Sale) {
    if (!s.client_email) {
      alert("O cliente precisa ter um e-mail cadastrado para receber o contrato.");
      return;
    }
    if (!confirm(`Enviar contrato de "${s.item_name}" para ${s.client_email} assinar via ZapSign?`)) return;
    setSendingSignId(s.id);
    try {
      const res = await apiFetch(`/sales/${s.id}/send-signature`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Falha ao enviar para assinatura");
      } else {
        alert("Contrato enviado para assinatura com sucesso!");
        await fetchAll();
      }
    } catch {
      alert("Erro ao enviar para assinatura");
    }
    setSendingSignId(null);
  }

  async function refreshSignatureStatus(s: Sale) {
    setCheckingSignId(s.id);
    try {
      const res = await apiFetch(`/sales/${s.id}/signature-status`);
      if (res.ok) {
        const data = await res.json();
        await fetchAll();
        if (data.status === "signed") {
          alert("Contrato assinado com sucesso!");
        } else if (data.status === "cancelled") {
          alert("Assinatura foi cancelada.");
        }
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Falha ao verificar status");
      }
    } catch {
      alert("Erro ao verificar status da assinatura");
    }
    setCheckingSignId(null);
  }

  async function downloadContract(s: Sale) {
    setDownloadingId(s.id);
    try {
      const res = await apiFetch(`/sales/${s.id}/contract`);
      if (!res.ok) {
        alert("Falha ao gerar o contrato");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = s.client_name.replace(/[^a-zA-Z0-9\-_ ]/g, "").slice(0, 40) || "contrato";
      a.download = `Contrato-${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      await fetchAll();
    } catch {
      alert("Erro ao baixar o contrato");
    }
    setDownloadingId(null);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Vendas</h2>
          <p className={styles.subtitle}>
            Registre suas vendas e gere contratos em PDF com um clique.
          </p>
        </div>
        <button className={styles.addBtn} onClick={openNew} type="button">
          + Nova venda
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Produto / Serviço</th>
              <th>Valor</th>
              <th>Pagamento</th>
              <th>Data</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  Carregando...
                </td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  Nenhuma venda cadastrada. Clique em &quot;+ Nova venda&quot; para começar.
                </td>
              </tr>
            ) : (
              sales.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className={styles.clientCol}>{s.client_name}</div>
                    {(s.client_document || s.client_phone) && (
                      <div className={styles.subCol}>
                        {[s.client_document, s.client_phone].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  <td>
                    <div>{s.item_name}</div>
                    {s.notes && <div className={styles.subCol}>{s.notes}</div>}
                  </td>
                  <td className={styles.amount}>{formatBRL(s.amount_cents)}</td>
                  <td className={styles.methodTag}>
                    {s.payment_method
                      ? (() => {
                          if (s.payment_method.startsWith("[")) {
                            try {
                              const entries = JSON.parse(s.payment_method) as Array<{ method: string; amount_cents: number; installments: number }>;
                              return entries.map((e) => {
                                const label = METHOD_LABELS[e.method as PaymentMethod] || e.method;
                                const inst = e.installments > 1 ? ` ${e.installments}x` : "";
                                return `${label} ${formatBRL(e.amount_cents)}${inst}`;
                              }).join("; ");
                            } catch {}
                          }
                          return s.payment_method.split(",").map((m) => METHOD_LABELS[m.trim() as PaymentMethod] || m.trim()).join(", ")
                            + (s.installments > 1 ? ` · ${s.installments}x` : "");
                        })()
                      : "—"}
                  </td>
                  <td>{formatDate(s.sale_date)}</td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={`${styles.iconOnly} ${
                          s.contract_generated_at ? styles.contractGenerated : ""
                        }`}
                        onClick={() => downloadContract(s)}
                        disabled={downloadingId === s.id}
                        type="button"
                        title={
                          s.contract_generated_at
                            ? `Contrato gerado em ${formatDate(s.contract_generated_at)} · clique para baixar novamente`
                            : "Gerar contrato em PDF"
                        }
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M6 2h6l4 4v10a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" />
                          <path d="M12 2v4h4" />
                          <path d="M8 12h4M8 15h4" />
                        </svg>
                        {downloadingId === s.id ? "..." : "Contrato"}
                      </button>
                      {zapSignConfigured && (
                        s.zapsign_status ? (
                          s.zapsign_status === "pending" ? (
                            <button
                              className={styles.signBadge}
                              style={{ color: SIGN_STATUS_LABELS.pending.color, cursor: "pointer", background: "transparent", border: `1px solid ${SIGN_STATUS_LABELS.pending.color}`, borderRadius: "6px", padding: "4px 10px", fontSize: "0.8rem", fontFamily: "inherit" }}
                              onClick={() => refreshSignatureStatus(s)}
                              disabled={checkingSignId === s.id}
                              title="Clique para atualizar o status da assinatura"
                              type="button"
                            >
                              {checkingSignId === s.id ? "Verificando..." : "⏳ Aguardando assinatura"}
                            </button>
                          ) : (
                            <span
                              className={styles.signBadge}
                              style={{ color: SIGN_STATUS_LABELS[s.zapsign_status]?.color || "#6b6152" }}
                              title={s.zapsign_sign_url ? `Link: ${s.zapsign_sign_url}` : undefined}
                            >
                              {s.zapsign_status === "signed" ? "✓ " : ""}
                              {SIGN_STATUS_LABELS[s.zapsign_status]?.label || s.zapsign_status}
                            </span>
                          )
                        ) : (
                          <button
                            className={styles.signBtn}
                            onClick={() => sendForSignature(s)}
                            disabled={sendingSignId === s.id}
                            type="button"
                            title="Enviar contrato para assinatura eletrônica via ZapSign"
                          >
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M14 2l4 4-9 9H5v-4L14 2z" />
                              <path d="M12 4l4 4" />
                            </svg>
                            {sendingSignId === s.id ? "Enviando..." : "Assinar"}
                          </button>
                        )
                      )}
                      {nfseConfigured && (
                        nfseStatuses[s.id] ? (
                          <span
                            className={`${styles.nfseBadge} ${
                              nfseStatuses[s.id].status === "rejeitada" ? styles.nfseBadgeRejected :
                              nfseStatuses[s.id].status === "cancelada" ? styles.nfseBadgeCancelled : ""
                            }`}
                            title={nfseStatuses[s.id].numero ? `NFS-e ${nfseStatuses[s.id].numero}` : undefined}
                          >
                            {nfseStatuses[s.id].status === "autorizada" ? "NFS-e" :
                             nfseStatuses[s.id].status === "processando" ? "Processando..." :
                             nfseStatuses[s.id].status === "rejeitada" ? "NFS-e rejeitada" :
                             nfseStatuses[s.id].status === "cancelada" ? "NFS-e cancelada" :
                             "NFS-e " + nfseStatuses[s.id].status}
                            {nfseStatuses[s.id].numero && ` #${nfseStatuses[s.id].numero}`}
                          </span>
                        ) : (
                          <button
                            className={styles.nfseBtn}
                            onClick={() => emitirNfse(s)}
                            disabled={emittingNfseId === s.id}
                            type="button"
                            title="Emitir NFS-e para esta venda"
                          >
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <rect x="3" y="3" width="14" height="14" rx="2" />
                              <path d="M7 7h6M7 10h6M7 13h3" />
                            </svg>
                            {emittingNfseId === s.id ? "Emitindo..." : "NFS-e"}
                          </button>
                        )
                      )}
                      <button
                        className={styles.iconBtn}
                        onClick={() => openEdit(s)}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        onClick={() => handleDelete(s)}
                        type="button"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editModal !== null && (
        <div className={styles.overlay} onClick={() => setEditModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {editModal === "new" ? "Nova venda" : "Editar venda"}
            </h3>
            <div className={styles.formGrid}>
              <div className={styles.modeToggle}>
                <button
                  type="button"
                  className={`${styles.modeBtn} ${
                    form.clientMode === "existing" ? styles.modeBtnActive : ""
                  }`}
                  onClick={() =>
                    setForm({ ...form, clientMode: "existing", createClient: false })
                  }
                >
                  Cliente cadastrado
                </button>
                <button
                  type="button"
                  className={`${styles.modeBtn} ${
                    form.clientMode === "new" ? styles.modeBtnActive : ""
                  }`}
                  onClick={() =>
                    setForm({
                      ...form,
                      clientMode: "new",
                      clientId: "",
                      clientName: "",
                    })
                  }
                >
                  Novo cliente
                </button>
              </div>

              {form.clientMode === "existing" ? (
                <div className={styles.field}>
                  <label>Selecione o cliente *</label>
                  <select
                    value={form.clientId}
                    onChange={(e) => onClientSelect(e.target.value)}
                  >
                    <option value="">— escolha —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className={styles.newClientBlock}>
                  <div className={styles.field}>
                    <label>Nome *</label>
                    <input
                      type="text"
                      value={form.clientName}
                      onChange={(e) =>
                        setForm({ ...form, clientName: e.target.value })
                      }
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label>CPF / Documento</label>
                      <input
                        type="text"
                        value={form.clientDocument}
                        onChange={(e) =>
                          setForm({ ...form, clientDocument: e.target.value })
                        }
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Telefone</label>
                      <input
                        type="text"
                        value={form.clientPhone}
                        onChange={(e) =>
                          setForm({ ...form, clientPhone: e.target.value })
                        }
                        placeholder="(65) 99999-9999"
                      />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>E-mail</label>
                    <input
                      type="email"
                      value={form.clientEmail}
                      onChange={(e) =>
                        setForm({ ...form, clientEmail: e.target.value })
                      }
                      placeholder="cliente@email.com"
                    />
                  </div>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.85rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.createClient}
                      onChange={(e) =>
                        setForm({ ...form, createClient: e.target.checked })
                      }
                    />
                    Salvar como novo cliente no cadastro
                  </label>
                </div>
              )}

              {catalog.length > 0 && (
                <div className={styles.field}>
                  <label>Produto/serviço do catálogo</label>
                  <select
                    value={form.catalogItemId}
                    onChange={(e) => onCatalogSelect(e.target.value)}
                  >
                    <option value="">— manual —</option>
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {formatBRL(c.price_cents)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.field}>
                <label>Nome do item *</label>
                <input
                  type="text"
                  value={form.itemName}
                  onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                  placeholder="Ex: Constelação familiar"
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Valor total (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.amountInput}
                    onChange={(e) =>
                      setForm({ ...form, amountInput: e.target.value })
                    }
                    placeholder="0,00"
                  />
                </div>
                <div className={styles.field}>
                  <label>Data da venda</label>
                  <input
                    type="date"
                    value={form.saleDate}
                    onChange={(e) =>
                      setForm({ ...form, saleDate: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label>Formas de pagamento</label>
                <div className={styles.checkboxGroup}>
                  {METHOD_OPTIONS.map((m) => (
                    <label key={m} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={form.paymentEntries.some((e) => e.method === m)}
                        onChange={(ev) => {
                          if (ev.target.checked) {
                            setForm({
                              ...form,
                              paymentEntries: [
                                ...form.paymentEntries,
                                { method: m, amountInput: "", installments: 1, date: form.saleDate },
                              ],
                            });
                          } else {
                            setForm({
                              ...form,
                              paymentEntries: form.paymentEntries.filter((e) => e.method !== m),
                            });
                          }
                        }}
                      />
                      {METHOD_LABELS[m]}
                    </label>
                  ))}
                </div>
                {form.paymentEntries.length > 0 && (
                  <div className={styles.paymentEntriesWrap}>
                    {form.paymentEntries.map((entry, idx) => (
                      <div key={entry.method} className={styles.paymentEntryRow}>
                        <span className={styles.paymentEntryLabel}>{METHOD_LABELS[entry.method]}</span>
                        <div className={styles.paymentEntryFields}>
                          <div className={styles.field}>
                            <label>Valor (R$)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={entry.amountInput}
                              onChange={(e) => {
                                const next = [...form.paymentEntries];
                                next[idx] = { ...entry, amountInput: e.target.value };
                                setForm({ ...form, paymentEntries: next });
                              }}
                              placeholder="0,00"
                            />
                          </div>
                          <div className={styles.field}>
                            <label>Parcelas</label>
                            <input
                              type="number"
                              min={1}
                              max={60}
                              value={entry.installments}
                              onChange={(e) => {
                                const next = [...form.paymentEntries];
                                next[idx] = { ...entry, installments: Math.max(1, Number(e.target.value) || 1) };
                                setForm({ ...form, paymentEntries: next });
                              }}
                            />
                          </div>
                          <div className={styles.field}>
                            <label>Data</label>
                            <input
                              type="date"
                              value={entry.date}
                              onChange={(e) => {
                                const next = [...form.paymentEntries];
                                next[idx] = { ...entry, date: e.target.value };
                                setForm({ ...form, paymentEntries: next });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.field}>
                <label>Observações (aparecem no contrato)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.btnSecondary}
                onClick={() => setEditModal(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleSave}
                disabled={
                  saving || !form.clientName.trim() || !form.itemName.trim()
                }
                type="button"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
