"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import styles from "./UsuariosView.module.css";

type UserRole = "admin" | "gestor" | "colaborador" | "visualizador";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: number;
  google_id: string | null;
  created_at: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "gestor", label: "Gestor" },
  { value: "colaborador", label: "Colaborador" },
  { value: "visualizador", label: "Visualizador" },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  colaborador: "Colaborador",
  visualizador: "Visualizador",
};

const ROLE_CLASS: Record<UserRole, string> = {
  admin: styles.roleAdmin,
  gestor: styles.roleGestor,
  colaborador: styles.roleColaborador,
  visualizador: styles.roleVisualizador,
};

type ModalMode = null | "create" | "edit" | "password";

export function UsuariosView() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("colaborador");
  const [formPassword, setFormPassword] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const res = await apiFetch("/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function openCreate() {
    setEditUser(null);
    setFormName("");
    setFormEmail("");
    setFormRole("colaborador");
    setFormPassword("");
    setFormActive(true);
    setFormError("");
    setModal("create");
  }

  function openEdit(user: UserRow) {
    setEditUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormActive(user.active === 1);
    setFormError("");
    setModal("edit");
  }

  function openPassword(user: UserRow) {
    setEditUser(user);
    setFormPassword("");
    setFormError("");
    setModal("password");
  }

  function closeModal() {
    setModal(null);
    setEditUser(null);
    setFormError("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      setFormError("Nome e e-mail são obrigatórios.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const res = await apiFetch("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword || undefined,
          role: formRole,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || "Erro ao criar usuário.");
        return;
      }
      closeModal();
      loadUsers();
    } catch {
      setFormError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    setFormError("");
    try {
      const res = await apiFetch(`/users/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole,
          active: formActive,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || "Erro ao atualizar.");
        return;
      }
      closeModal();
      loadUsers();
    } catch {
      setFormError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    if (!formPassword || formPassword.length < 6) {
      setFormError("Senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const res = await apiFetch(`/users/${editUser.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: formPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || "Erro ao atualizar senha.");
        return;
      }
      closeModal();
    } catch {
      setFormError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className={styles.loading}>Carregando usuários...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Usuários</h1>
          <p className={styles.subtitle}>
            {users.length} usuário{users.length !== 1 ? "s" : ""} cadastrado{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button className={styles.addBtn} onClick={openCreate} type="button">
          + Novo usuário
        </button>
      </div>

      {users.length === 0 ? (
        <div className={styles.empty}>Nenhum usuário cadastrado.</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`${styles.roleBadge} ${ROLE_CLASS[u.role] || ""}`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
                <td>
                  <span className={u.active ? styles.statusActive : styles.statusInactive}>
                    {u.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td>
                  <button className={styles.actionBtn} onClick={() => openEdit(u)} type="button">
                    Editar
                  </button>
                  <button className={styles.actionBtn} onClick={() => openPassword(u)} type="button">
                    Senha
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(modal === "create" || modal === "edit") && (
        <div className={styles.modal} onClick={closeModal}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>
              {modal === "create" ? "Novo Usuário" : "Editar Usuário"}
            </h2>
            <form onSubmit={modal === "create" ? handleCreate : handleEdit}>
              {formError && <div className={styles.formError}>{formError}</div>}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nome</label>
                <input
                  className={styles.formInput}
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>E-mail</label>
                <input
                  className={styles.formInput}
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Perfil</label>
                <select
                  className={styles.formSelect}
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {modal === "create" && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Senha (opcional)</label>
                  <input
                    className={styles.formInput}
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}

              {modal === "edit" && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Status</label>
                  <select
                    className={styles.formSelect}
                    value={formActive ? "1" : "0"}
                    onChange={(e) => setFormActive(e.target.value === "1")}
                  >
                    <option value="1">Ativo</option>
                    <option value="0">Inativo</option>
                  </select>
                </div>
              )}

              <div className={styles.modalActions}>
                <button className={styles.btnSecondary} type="button" onClick={closeModal}>
                  Cancelar
                </button>
                <button className={styles.btnPrimary} type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === "password" && editUser && (
        <div className={styles.modal} onClick={closeModal}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Alterar Senha</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: "0 0 16px" }}>
              {editUser.name} ({editUser.email})
            </p>
            <form onSubmit={handlePassword}>
              {formError && <div className={styles.formError}>{formError}</div>}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nova senha</label>
                <input
                  className={styles.formInput}
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
              <div className={styles.modalActions}>
                <button className={styles.btnSecondary} type="button" onClick={closeModal}>
                  Cancelar
                </button>
                <button className={styles.btnPrimary} type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Atualizar senha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
