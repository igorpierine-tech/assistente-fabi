"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./CatalogPanel.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type CatalogKind = "produto" | "servico";

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  kind: CatalogKind;
  price_cents: number;
  duration_minutes: number | null;
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface FormState {
  name: string;
  description: string;
  kind: CatalogKind;
  priceInput: string;
  durationInput: string;
  active: boolean;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  kind: "servico",
  priceInput: "",
  durationInput: "",
  active: true,
};

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

export function CatalogPanel() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/catalog`, { credentials: "include" });
      if (res.ok) {
        setItems(await res.json());
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(item: CatalogItem) {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description || "",
      kind: item.kind,
      priceInput: centsToInput(item.price_cents),
      durationInput: item.duration_minutes ? String(item.duration_minutes) : "",
      active: item.active === 1,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      kind: form.kind,
      price: form.priceInput,
      durationMinutes: form.kind === "servico" ? form.durationInput : null,
      active: form.active,
    };
    try {
      const url = editing
        ? `${API_URL}/catalog/${editing.id}`
        : `${API_URL}/catalog`;
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowModal(false);
        fetchItems();
      }
    } catch {
      // silent
    }
    setSaving(false);
  }

  async function handleDelete(item: CatalogItem) {
    if (!confirm(`Excluir "${item.name}"?`)) return;
    try {
      await fetch(`${API_URL}/catalog/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      fetchItems();
    } catch {
      // silent
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Produtos e serviços</h2>
          <p className={styles.subtitle}>
            Cadastre os itens do seu catálogo com valores e duração.
          </p>
        </div>
        <button className={styles.addBtn} onClick={openNew} type="button">
          + Novo item
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Duração</th>
              <th>Status</th>
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
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  Nenhum item cadastrado ainda. Clique em &quot;+ Novo item&quot; para começar.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className={styles.nameCell}>{item.name}</div>
                    {item.description && (
                      <div className={styles.description}>{item.description}</div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`${styles.kindTag} ${
                        item.kind === "produto" ? styles.kindTagProduto : ""
                      }`}
                    >
                      {item.kind === "produto" ? "Produto" : "Serviço"}
                    </span>
                  </td>
                  <td className={styles.price}>{formatBRL(item.price_cents)}</td>
                  <td className={styles.duration}>
                    {item.duration_minutes ? `${item.duration_minutes} min` : "—"}
                  </td>
                  <td>
                    <span
                      className={`${styles.status} ${
                        item.active ? "" : styles.statusInactive
                      }`}
                    />
                    {item.active ? "Ativo" : "Inativo"}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.iconBtn}
                        onClick={() => openEdit(item)}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        onClick={() => handleDelete(item)}
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

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {editing ? "Editar item" : "Novo item"}
            </h3>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Constelação familiar"
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label>Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Detalhes opcionais que aparecem para o cliente"
                />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Tipo</label>
                  <select
                    value={form.kind}
                    onChange={(e) =>
                      setForm({ ...form, kind: e.target.value as CatalogKind })
                    }
                  >
                    <option value="servico">Serviço</option>
                    <option value="produto">Produto</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Valor (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.priceInput}
                    onChange={(e) =>
                      setForm({ ...form, priceInput: e.target.value })
                    }
                    placeholder="0,00"
                  />
                </div>
              </div>
              {form.kind === "servico" && (
                <div className={styles.field}>
                  <label>Duração (minutos)</label>
                  <input
                    type="number"
                    min={5}
                    max={600}
                    value={form.durationInput}
                    onChange={(e) =>
                      setForm({ ...form, durationInput: e.target.value })
                    }
                    placeholder="Ex: 60"
                  />
                </div>
              )}
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                />
                Item ativo
              </label>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.btnSecondary}
                onClick={() => setShowModal(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
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
