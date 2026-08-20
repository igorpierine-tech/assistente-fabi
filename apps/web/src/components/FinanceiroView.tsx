"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./FinanceiroView.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type PaymentMethod =
  | "pix"
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "transferencia"
  | "boleto"
  | "outro";

type Status = "pendente" | "pago" | "cancelado";

interface Receivable {
  id: string;
  appointment_id: string | null;
  catalog_item_id: string | null;
  client_id: string | null;
  client_name: string;
  item_name: string;
  amount_cents: number;
  service_date: string;
  due_date: string;
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  status: Status;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Summary {
  a_receber_cents: number;
  recebido_mes_cents: number;
  em_atraso_cents: number;
  a_receber_count: number;
  em_atraso_count: number;
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
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toDateInput(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function isOverdue(r: Receivable): boolean {
  if (r.status !== "pendente") return false;
  const today = new Date().toISOString().slice(0, 10);
  return r.due_date.slice(0, 10) < today;
}

type Filter = "todos" | "pendentes" | "pagos" | "atrasados";

interface FormState {
  clientName: string;
  itemName: string;
  catalogItemId: string;
  amountInput: string;
  serviceDate: string;
  dueDate: string;
  paymentMethod: PaymentMethod | "";
  status: Status;
  notes: string;
}

const emptyForm: FormState = {
  clientName: "",
  itemName: "",
  catalogItemId: "",
  amountInput: "",
  serviceDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  paymentMethod: "",
  status: "pendente",
  notes: "",
};

export function FinanceiroView() {
  const [items, setItems] = useState<Receivable[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("todos");
  const [editModal, setEditModal] = useState<Receivable | null | "new">(null);
  const [payingItem, setPayingItem] = useState<Receivable | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [payForm, setPayForm] = useState<{
    method: PaymentMethod | "";
    paidAt: string;
    amountInput: string;
  }>({ method: "pix", paidAt: new Date().toISOString().slice(0, 10), amountInput: "" });
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, sumRes, catRes] = await Promise.all([
        fetch(`${API_URL}/receivables`, { credentials: "include" }),
        fetch(`${API_URL}/receivables/summary`, { credentials: "include" }),
        fetch(`${API_URL}/catalog`, { credentials: "include" }),
      ]);
      if (listRes.ok) setItems(await listRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
      if (catRes.ok) setCatalog(await catRes.json());
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    if (filter === "pendentes")
      return items.filter((r) => r.status === "pendente" && !isOverdue(r));
    if (filter === "atrasados") return items.filter(isOverdue);
    if (filter === "pagos") return items.filter((r) => r.status === "pago");
    return items;
  }, [items, filter]);

  function openNew() {
    setForm(emptyForm);
    setEditModal("new");
  }

  function openEdit(r: Receivable) {
    setForm({
      clientName: r.client_name,
      itemName: r.item_name,
      catalogItemId: r.catalog_item_id || "",
      amountInput: centsToInput(r.amount_cents),
      serviceDate: toDateInput(r.service_date),
      dueDate: toDateInput(r.due_date),
      paymentMethod: r.payment_method || "",
      status: r.status,
      notes: r.notes || "",
    });
    setEditModal(r);
  }

  function openPay(r: Receivable) {
    setPayForm({
      method: r.payment_method || "pix",
      paidAt: new Date().toISOString().slice(0, 10),
      amountInput: centsToInput(r.amount_cents),
    });
    setPayingItem(r);
  }

  function onCatalogChange(value: string) {
    const found = catalog.find((c) => c.id === value);
    if (found) {
      setForm((f) => ({
        ...f,
        catalogItemId: value,
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
      clientName: form.clientName.trim(),
      itemName: form.itemName.trim(),
      catalogItemId: form.catalogItemId || null,
      amount: form.amountInput,
      serviceDate: form.serviceDate,
      dueDate: form.dueDate,
      paymentMethod: form.paymentMethod || null,
      status: form.status,
      paidAt: form.status === "pago" ? new Date().toISOString() : null,
      notes: form.notes.trim() || null,
    };
    try {
      const url =
        editModal === "new"
          ? `${API_URL}/receivables`
          : `${API_URL}/receivables/${(editModal as Receivable).id}`;
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
      }
    } catch {
      // silent
    }
    setSaving(false);
  }

  async function handleMarkPaid() {
    if (!payingItem || !payForm.method) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_URL}/receivables/${payingItem.id}/mark-paid`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentMethod: payForm.method,
            paidAt: new Date(payForm.paidAt + "T12:00:00").toISOString(),
            amount: payForm.amountInput,
          }),
        }
      );
      if (res.ok) {
        setPayingItem(null);
        await fetchAll();
      }
    } catch {
      // silent
    }
    setSaving(false);
  }

  async function handleReopen(r: Receivable) {
    if (!confirm("Reabrir este lançamento como pendente?")) return;
    await fetch(`${API_URL}/receivables/${r.id}/mark-pending`, {
      method: "POST",
      credentials: "include",
    });
    await fetchAll();
  }

  async function handleDelete(r: Receivable) {
    if (!confirm(`Excluir o lançamento de "${r.client_name}"?`)) return;
    await fetch(`${API_URL}/receivables/${r.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await fetchAll();
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Financeiro</h2>
          <p className={styles.subtitle}>
            Contas a receber geradas automaticamente a cada agendamento concluído.
          </p>
        </div>
        <button className={styles.addBtn} onClick={openNew} type="button">
          + Novo lançamento
        </button>
      </div>

      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>A receber</div>
          <div className={styles.summaryValue}>
            {summary ? formatBRL(summary.a_receber_cents) : "—"}
          </div>
          <div className={styles.summarySub}>
            {summary?.a_receber_count ?? 0} lançamento(s) pendente(s)
          </div>
        </div>
        <div className={`${styles.summaryCard} ${styles.summaryCardDanger}`}>
          <div className={styles.summaryLabel}>Em atraso</div>
          <div className={styles.summaryValue}>
            {summary ? formatBRL(summary.em_atraso_cents) : "—"}
          </div>
          <div className={styles.summarySub}>
            {summary?.em_atraso_count ?? 0} lançamento(s) vencido(s)
          </div>
        </div>
        <div className={`${styles.summaryCard} ${styles.summaryCardGood}`}>
          <div className={styles.summaryLabel}>Recebido no mês</div>
          <div className={styles.summaryValue}>
            {summary ? formatBRL(summary.recebido_mes_cents) : "—"}
          </div>
          <div className={styles.summarySub}>Somente pagos neste mês</div>
        </div>
      </div>

      <div className={styles.tabs}>
        {(["todos", "pendentes", "atrasados", "pagos"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`${styles.tab} ${filter === f ? styles.tabActive : ""}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Produto / Serviço</th>
              <th>Data</th>
              <th>Valor</th>
              <th>Pagamento</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className={styles.empty}>
                  Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.empty}>
                  Nenhum lançamento neste filtro.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const overdue = isOverdue(r);
                const statusLabel = overdue
                  ? "Atrasado"
                  : r.status.charAt(0).toUpperCase() + r.status.slice(1);
                const statusCls = overdue
                  ? styles.statusAtrasado
                  : r.status === "pago"
                  ? styles.statusPago
                  : r.status === "cancelado"
                  ? styles.statusCancelado
                  : styles.statusPendente;
                return (
                  <tr key={r.id}>
                    <td>
                      <div className={styles.itemCol}>{r.client_name}</div>
                    </td>
                    <td>
                      <div>{r.item_name}</div>
                      {r.notes && <div className={styles.itemSub}>{r.notes}</div>}
                    </td>
                    <td>
                      <div>{formatDate(r.service_date)}</div>
                      {r.due_date !== r.service_date && (
                        <div className={styles.itemSub}>
                          Vence {formatDate(r.due_date)}
                        </div>
                      )}
                    </td>
                    <td className={styles.amount}>{formatBRL(r.amount_cents)}</td>
                    <td className={styles.methodTag}>
                      {r.payment_method ? METHOD_LABELS[r.payment_method] : "—"}
                    </td>
                    <td>
                      <span className={`${styles.statusPill} ${statusCls}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {r.status !== "pago" && (
                          <button
                            className={`${styles.iconBtn} ${styles.iconBtnPrimary}`}
                            onClick={() => openPay(r)}
                            type="button"
                          >
                            Marcar pago
                          </button>
                        )}
                        {r.status === "pago" && (
                          <button
                            className={styles.iconBtn}
                            onClick={() => handleReopen(r)}
                            type="button"
                          >
                            Reabrir
                          </button>
                        )}
                        <button
                          className={styles.iconBtn}
                          onClick={() => openEdit(r)}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          onClick={() => handleDelete(r)}
                          type="button"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editModal !== null && (
        <div className={styles.overlay} onClick={() => setEditModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {editModal === "new" ? "Novo lançamento" : "Editar lançamento"}
            </h3>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Cliente *</label>
                <input
                  type="text"
                  value={form.clientName}
                  onChange={(e) =>
                    setForm({ ...form, clientName: e.target.value })
                  }
                  placeholder="Nome do cliente"
                  autoFocus
                />
              </div>
              {catalog.length > 0 && (
                <div className={styles.field}>
                  <label>Produto/serviço do catálogo</label>
                  <select
                    value={form.catalogItemId}
                    onChange={(e) => onCatalogChange(e.target.value)}
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
                  <label>Data do serviço *</label>
                  <input
                    type="date"
                    value={form.serviceDate}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        serviceDate: e.target.value,
                        dueDate: form.dueDate || e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Vencimento</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) =>
                      setForm({ ...form, dueDate: e.target.value })
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as Status })
                    }
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
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
                <label>Observações</label>
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

      {payingItem && (
        <div className={styles.overlay} onClick={() => setPayingItem(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Registrar pagamento</h3>
            <p className={styles.subtitle} style={{ marginBottom: 16 }}>
              {payingItem.client_name} · {payingItem.item_name}
            </p>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Forma de pagamento *</label>
                <select
                  value={payForm.method}
                  onChange={(e) =>
                    setPayForm({
                      ...payForm,
                      method: e.target.value as PaymentMethod,
                    })
                  }
                >
                  {METHOD_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Data do pagamento</label>
                  <input
                    type="date"
                    value={payForm.paidAt}
                    onChange={(e) =>
                      setPayForm({ ...payForm, paidAt: e.target.value })
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label>Valor recebido (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={payForm.amountInput}
                    onChange={(e) =>
                      setPayForm({ ...payForm, amountInput: e.target.value })
                    }
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.btnSecondary}
                onClick={() => setPayingItem(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleMarkPaid}
                disabled={saving || !payForm.method}
                type="button"
              >
                {saving ? "Salvando..." : "Confirmar pagamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
