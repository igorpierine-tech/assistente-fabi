"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./VendasView.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
  created_at: string;
  updated_at: string;
}

interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
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
  paymentMethod: PaymentMethod | "";
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
  paymentMethod: "",
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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [saleRes, clientRes, catRes] = await Promise.all([
        fetch(`${API_URL}/sales`, { credentials: "include" }),
        fetch(`${API_URL}/clients`, { credentials: "include" }),
        fetch(`${API_URL}/catalog`, { credentials: "include" }),
      ]);
      if (saleRes.ok) setSales(await saleRes.json());
      if (clientRes.ok) setClients(await clientRes.json());
      if (catRes.ok) setCatalog(await catRes.json());
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function openNew() {
    setForm({ ...emptyForm, saleDate: new Date().toISOString().slice(0, 10) });
    setEditModal("new");
  }

  function openEdit(s: Sale) {
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
      paymentMethod: s.payment_method || "",
      installments: s.installments,
      saleDate: toDateInput(s.sale_date),
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
      paymentMethod: form.paymentMethod || null,
      installments: form.installments,
      saleDate: form.saleDate,
      notes: form.notes.trim() || null,
    };
    try {
      const url =
        editModal === "new"
          ? `${API_URL}/sales`
          : `${API_URL}/sales/${(editModal as Sale).id}`;
      const method = editModal === "new" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        credentials: "include",
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
    await fetch(`${API_URL}/sales/${s.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await fetchAll();
  }

  async function downloadContract(s: Sale) {
    setDownloadingId(s.id);
    try {
      const res = await fetch(`${API_URL}/sales/${s.id}/contract`, {
        credentials: "include",
      });
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
                    {s.payment_method ? METHOD_LABELS[s.payment_method] : "—"}
                    {s.installments > 1 && ` · ${s.installments}x`}
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

              <div className={styles.fieldRow3}>
                <div className={styles.field}>
                  <label>Valor (R$)</label>
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
                  <label>Parcelas</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={form.installments}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        installments: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label>Data</label>
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
                <label>Forma de pagamento</label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      paymentMethod: e.target.value as PaymentMethod | "",
                    })
                  }
                >
                  <option value="">—</option>
                  {METHOD_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
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
