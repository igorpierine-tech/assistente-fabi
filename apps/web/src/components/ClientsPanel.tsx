"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./ClientsPanel.module.css";
import { apiFetch, API_URL } from "@/lib/api";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  document: string | null;
  tipo_pessoa: string | null;
  address: string | null;
  inscricao_estadual: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientForm {
  name: string;
  phone: string;
  email: string;
  notes: string;
  document: string;
  tipo_pessoa: string;
  address: string;
  inscricao_estadual: string;
}

const emptyForm: ClientForm = { name: "", phone: "", email: "", notes: "", document: "", tipo_pessoa: "PF", address: "", inscricao_estadual: "" };

export function ClientsPanel() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState("");

  const fetchClients = useCallback(async () => {
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await apiFetch(`/clients${q}`);
      if (res.ok) {
        setClients(await res.json());
      }
    } catch {
      // silent
    }
  }, [search]);

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
      document: client.document || "",
      tipo_pessoa: client.tipo_pessoa || "PF",
      address: client.address || "",
      inscricao_estadual: client.inscricao_estadual || "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);

    try {
      const path = editingClient ? `/clients/${editingClient.id}` : "/clients";
      const method = editingClient ? "PUT" : "POST";
      const res = await apiFetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          notes: form.notes.trim() || undefined,
          document: form.document.trim() || undefined,
          tipo_pessoa: form.tipo_pessoa || undefined,
          address: form.address.trim() || undefined,
          inscricao_estadual: form.inscricao_estadual.trim() || undefined,
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

    try {
      await apiFetch(`/clients/${client.id}`, { method: "DELETE" });
      fetchClients();
    } catch {
      // silent
    }
  }

  async function handleCnpjLookup() {
    const clean = form.document.replace(/\D/g, "");
    if (clean.length !== 14) {
      setCnpjError("CNPJ deve ter 14 dígitos");
      return;
    }
    setCnpjLoading(true);
    setCnpjError("");
    try {
      const res = await fetch(`${API_URL}/platform/cnpj/${clean}`);
      const data = await res.json();
      if (!res.ok) {
        setCnpjError(data.error || "Erro ao consultar CNPJ");
        setCnpjLoading(false);
        return;
      }
      const nome = data.nome_fantasia || data.razao_social || "";
      const addr = [data.logradouro, data.numero, data.complemento, data.bairro, data.municipio ? `${data.municipio}/${data.uf}` : "", data.cep].filter(Boolean).join(", ");
      setForm(f => ({
        ...f,
        name: nome || f.name,
        address: addr || f.address,
        phone: data.telefone || f.phone,
        email: data.email || f.email,
      }));
    } catch {
      setCnpjError("Não foi possível consultar o CNPJ");
    }
    setCnpjLoading(false);
  }

  const filtered = clients;

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
                  {client.document && <span>📄 {client.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"}: {client.document}</span>}
                  {client.tipo_pessoa === "PJ" && client.inscricao_estadual && <span>📋 IE: {client.inscricao_estadual}</span>}
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
                <label>{form.tipo_pessoa === "PJ" ? "Razão Social *" : "Nome *"}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={form.tipo_pessoa === "PJ" ? "Razão Social da empresa" : "Nome completo"}
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
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Tipo de pessoa</label>
                  <select
                    value={form.tipo_pessoa}
                    onChange={(e) => setForm({ ...form, tipo_pessoa: e.target.value })}
                  >
                    <option value="PF">Pessoa Física (PF)</option>
                    <option value="PJ">Pessoa Jurídica (PJ)</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>{form.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"}</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      value={form.document}
                      onChange={(e) => { setForm({ ...form, document: e.target.value }); setCnpjError(""); }}
                      placeholder={form.tipo_pessoa === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                      style={{ flex: 1 }}
                    />
                    {form.tipo_pessoa === "PJ" && (
                      <button
                        type="button"
                        className={styles.saveBtn}
                        onClick={handleCnpjLookup}
                        disabled={cnpjLoading}
                        style={{ whiteSpace: "nowrap", padding: "8px 14px", fontSize: "0.85rem" }}
                      >
                        {cnpjLoading ? "..." : "Buscar"}
                      </button>
                    )}
                  </div>
                  {cnpjError && <span style={{ color: "#c0392b", fontSize: "0.8rem", marginTop: "4px", display: "block" }}>{cnpjError}</span>}
                </div>
              </div>
              {form.tipo_pessoa === "PJ" && (
                <div className={styles.field}>
                  <label>Inscrição Estadual</label>
                  <input
                    type="text"
                    value={form.inscricao_estadual}
                    onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })}
                    placeholder="Inscrição Estadual ou ISENTO"
                  />
                </div>
              )}
              <div className={styles.field}>
                <label>Endereço</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Rua, número, bairro, cidade — UF, CEP"
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
