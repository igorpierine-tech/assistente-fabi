"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./ClientsPanel.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientForm {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

const emptyForm: ClientForm = { name: "", phone: "", email: "", notes: "" };

interface ClientsPanelProps {
  isDemo?: boolean;
}

const DEMO_CLIENTS: Client[] = [
  { id: "d1", name: "Maria Valentina", phone: "(65) 99123-4567", email: "maria@email.com", notes: "Constelação familiar", created_at: "", updated_at: "" },
  { id: "d2", name: "Ana Paula", phone: "(65) 99234-5678", email: "ana.paula@email.com", notes: "Consultoria financeira", created_at: "", updated_at: "" },
  { id: "d3", name: "Juliana Costa", phone: "(65) 99345-6789", email: "juliana@email.com", notes: null, created_at: "", updated_at: "" },
];

export function ClientsPanel({ isDemo }: ClientsPanelProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchClients = useCallback(async () => {
    if (isDemo) {
      setClients(DEMO_CLIENTS);
      return;
    }
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`${API_URL}/clients${q}`, { credentials: "include" });
      if (res.ok) {
        setClients(await res.json());
      }
    } catch {
      // silent
    }
  }, [isDemo, search]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  function openNew() {
    setEditingClient(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setForm({
      name: client.name,
      phone: client.phone || "",
      email: client.email || "",
      notes: client.notes || "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);

    if (isDemo) {
      if (editingClient) {
        setClients((prev) =>
          prev.map((c) =>
            c.id === editingClient.id
              ? { ...c, name: form.name, phone: form.phone || null, email: form.email || null, notes: form.notes || null }
              : c
          )
        );
      } else {
        setClients((prev) => [
          ...prev,
          { id: `d${Date.now()}`, name: form.name, phone: form.phone || null, email: form.email || null, notes: form.notes || null, created_at: "", updated_at: "" },
        ]);
      }
      setShowModal(false);
      setSaving(false);
      return;
    }

    try {
      const url = editingClient ? `${API_URL}/clients/${editingClient.id}` : `${API_URL}/clients`;
      const method = editingClient ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        fetchClients();
      }
    } catch {
      // silent
    }
    setSaving(false);
  }

  async function handleDelete(client: Client) {
    if (!confirm(`Excluir o cliente "${client.name}"?`)) return;

    if (isDemo) {
      setClients((prev) => prev.filter((c) => c.id !== client.id));
      return;
    }

    try {
      await fetch(`${API_URL}/clients/${client.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      fetchClients();
    } catch {
      // silent
    }
  }

  const filtered = search && isDemo
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
      )
    : clients;

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <h2 className={styles.title}>Clientes</h2>
        <input
          className={styles.searchBox}
          type="text"
          placeholder="Buscar por nome, email ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={styles.addBtn} onClick={openNew}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Novo Cliente
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>👤</p>
          <p>{search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((client) => (
            <div key={client.id} className={styles.card} onClick={() => openEdit(client)}>
              <div className={styles.cardInfo}>
                <h3>{client.name}</h3>
                <div className={styles.cardMeta}>
                  {client.phone && <span>📞 {client.phone}</span>}
                  {client.email && <span>✉️ {client.email}</span>}
                  {client.notes && <span>📝 {client.notes}</span>}
                </div>
              </div>
              <div className={styles.cardActions}>
                <button
                  className={styles.editBtn}
                  onClick={(e) => { e.stopPropagation(); openEdit(client); }}
                >
                  Editar
                </button>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); handleDelete(client); }}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingClient ? "Editar Cliente" : "Novo Cliente"}</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className={styles.form}>
              <div className={styles.field}>
                <label>Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome completo"
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label>Telefone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(65) 99999-9999"
                />
              </div>
              <div className={styles.field}>
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="cliente@email.com"
                />
              </div>
              <div className={styles.field}>
                <label>Observações</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Anotações sobre o cliente..."
                />
              </div>
            </div>
            <div className={styles.formActions}>
              <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
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
