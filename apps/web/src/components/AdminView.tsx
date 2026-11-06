"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import styles from "./AdminView.module.css";

type AdminTab = "empresas" | "perfis" | "usuarios";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  active: number;
  userCount: number;
  created_at: string;
}

interface SystemModule {
  id: string;
  label: string;
  description: string;
}

interface AccessProfile {
  id: string;
  tenant_id: string;
  name: string;
  modules: string[];
  is_default: number;
}

interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: string;
  active: number;
  profileId: string | null;
  profileName: string | null;
}

export function AdminView() {
  const [tab, setTab] = useState<AdminTab>("empresas");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AccessProfile | null>(null);
  const [assigningUser, setAssigningUser] = useState<TenantUser | null>(null);

  // Forms
  const [tenantForm, setTenantForm] = useState({ name: "", slug: "", adminName: "", adminEmail: "", adminPassword: "" });
  const [profileForm, setProfileForm] = useState({ name: "", modules: [] as string[] });
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", profileId: "" });

  const fetchTenants = useCallback(async () => {
    try {
      const res = await apiFetch("/system/tenants");
      if (res.ok) setTenants(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchModules = useCallback(async () => {
    try {
      const res = await apiFetch("/system/modules");
      if (res.ok) setModules(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await apiFetch("/system/profiles");
      if (res.ok) setProfiles(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchTenantUsers = useCallback(async (tenantId: string) => {
    try {
      const res = await apiFetch(`/system/tenants/${tenantId}/users`);
      if (res.ok) setTenantUsers(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchTenants(), fetchModules(), fetchProfiles()]).then(() => setLoading(false));
  }, [fetchTenants, fetchModules, fetchProfiles]);

  useEffect(() => {
    if (selectedTenantId) fetchTenantUsers(selectedTenantId);
  }, [selectedTenantId, fetchTenantUsers]);

  // --- Tenant actions ---
  async function handleCreateTenant() {
    const { name, slug, adminName, adminEmail, adminPassword } = tenantForm;
    if (!name || !slug) return;
    const res = await apiFetch("/system/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, adminName: adminName || undefined, adminEmail: adminEmail || undefined, adminPassword: adminPassword || undefined }),
    });
    if (res.ok) {
      setShowTenantModal(false);
      setTenantForm({ name: "", slug: "", adminName: "", adminEmail: "", adminPassword: "" });
      await fetchTenants();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Erro ao criar empresa");
    }
  }

  // --- Profile actions ---
  function openProfileModal(profile?: AccessProfile) {
    if (profile) {
      setEditingProfile(profile);
      setProfileForm({ name: profile.name, modules: [...profile.modules] });
    } else {
      setEditingProfile(null);
      setProfileForm({ name: "", modules: [] });
    }
    setShowProfileModal(true);
  }

  function toggleModule(moduleId: string) {
    setProfileForm(prev => ({
      ...prev,
      modules: prev.modules.includes(moduleId)
        ? prev.modules.filter(m => m !== moduleId)
        : [...prev.modules, moduleId],
    }));
  }

  async function handleSaveProfile() {
    if (!profileForm.name) return;
    const body = { name: profileForm.name, modules: profileForm.modules };
    const res = editingProfile
      ? await apiFetch(`/system/profiles/${editingProfile.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await apiFetch("/system/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
    if (res.ok) {
      setShowProfileModal(false);
      setEditingProfile(null);
      await fetchProfiles();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Erro ao salvar perfil");
    }
  }

  async function handleDeleteProfile(id: string) {
    if (!confirm("Deseja realmente excluir este perfil?")) return;
    const res = await apiFetch(`/system/profiles/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      await fetchProfiles();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Erro ao excluir perfil");
    }
  }

  // --- User actions ---
  async function handleAddUser() {
    if (!selectedTenantId || !userForm.name || !userForm.email || !userForm.password) return;
    const res = await apiFetch(`/system/tenants/${selectedTenantId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: userForm.name,
        email: userForm.email,
        password: userForm.password,
        profileId: userForm.profileId || undefined,
      }),
    });
    if (res.ok) {
      setShowUserModal(false);
      setUserForm({ name: "", email: "", password: "", profileId: "" });
      await fetchTenantUsers(selectedTenantId);
      await fetchTenants();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Erro ao adicionar usuário");
    }
  }

  async function handleAssignProfile(userId: string, profileId: string | null) {
    if (!selectedTenantId) return;
    await apiFetch(`/system/tenants/${selectedTenantId}/users/${userId}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    });
    setAssigningUser(null);
    await fetchTenantUsers(selectedTenantId);
  }

  async function handleToggleUserActive(userId: string, active: boolean) {
    if (!selectedTenantId) return;
    await apiFetch(`/system/tenants/${selectedTenantId}/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    await fetchTenantUsers(selectedTenantId);
  }

  if (loading) {
    return <div className={styles.container}><p>Carregando...</p></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Administração do Sistema</h1>
          <p className={styles.subtitle}>Gerencie empresas, perfis de acesso e usuários</p>
        </div>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "empresas" ? styles.tabActive : ""}`} onClick={() => setTab("empresas")}>
          Empresas
        </button>
        <button className={`${styles.tab} ${tab === "perfis" ? styles.tabActive : ""}`} onClick={() => setTab("perfis")}>
          Perfis de Acesso
        </button>
        <button className={`${styles.tab} ${tab === "usuarios" ? styles.tabActive : ""}`} onClick={() => { setTab("usuarios"); if (!selectedTenantId && tenants.length > 0) setSelectedTenantId(tenants[0].id); }}>
          Usuários por Empresa
        </button>
      </div>

      {/* === EMPRESAS === */}
      {tab === "empresas" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionCount}>{tenants.length} empresa{tenants.length !== 1 ? "s" : ""}</span>
            <button className={styles.addBtn} onClick={() => setShowTenantModal(true)}>+ Nova Empresa</button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Slug</th>
                <th>Usuários</th>
                <th>Status</th>
                <th>Criada em</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id}>
                  <td className={styles.cellBold}>{t.name}</td>
                  <td><code className={styles.slug}>{t.slug}</code></td>
                  <td>{t.userCount}</td>
                  <td><span className={`${styles.badge} ${t.active ? styles.badgeActive : styles.badgeInactive}`}>{t.active ? "Ativa" : "Inativa"}</span></td>
                  <td className={styles.cellMuted}>{new Date(t.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr><td colSpan={5} className={styles.empty}>Nenhuma empresa cadastrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* === PERFIS DE ACESSO === */}
      {tab === "perfis" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionCount}>{profiles.length} perfil(is)</span>
            <button className={styles.addBtn} onClick={() => openProfileModal()}>+ Novo Perfil</button>
          </div>
          <div className={styles.profileGrid}>
            {profiles.map(p => (
              <div key={p.id} className={styles.profileCard}>
                <div className={styles.profileCardHeader}>
                  <h3 className={styles.profileName}>{p.name}</h3>
                  {p.is_default ? (
                    <span className={styles.defaultBadge}>Padrão</span>
                  ) : null}
                </div>
                <div className={styles.profileModules}>
                  {p.modules.map(mId => {
                    const mod = modules.find(m => m.id === mId);
                    return mod ? (
                      <span key={mId} className={styles.modulePill}>{mod.label}</span>
                    ) : null;
                  })}
                  {p.modules.length === 0 && <span className={styles.cellMuted}>Nenhum módulo</span>}
                </div>
                <div className={styles.profileActions}>
                  <button className={styles.btnOutline} onClick={() => openProfileModal(p)}>Editar</button>
                  {!p.is_default && (
                    <button className={styles.btnDanger} onClick={() => handleDeleteProfile(p.id)}>Excluir</button>
                  )}
                </div>
              </div>
            ))}
            {profiles.length === 0 && <p className={styles.empty}>Nenhum perfil criado</p>}
          </div>
        </div>
      )}

      {/* === USUÁRIOS POR EMPRESA === */}
      {tab === "usuarios" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.tenantSelect}>
              <label>Empresa:</label>
              <select
                value={selectedTenantId || ""}
                onChange={e => setSelectedTenantId(e.target.value || null)}
                className={styles.select}
              >
                <option value="">Selecione...</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            {selectedTenantId && (
              <button className={styles.addBtn} onClick={() => setShowUserModal(true)}>+ Adicionar Usuário</button>
            )}
          </div>

          {selectedTenantId && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {tenantUsers.map(u => (
                  <tr key={u.id}>
                    <td className={styles.cellBold}>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      {assigningUser?.id === u.id ? (
                        <select
                          value={assigningUser.profileId || ""}
                          onChange={e => handleAssignProfile(u.id, e.target.value || null)}
                          className={styles.selectInline}
                          autoFocus
                          onBlur={() => setAssigningUser(null)}
                        >
                          <option value="">Sem perfil (padrão)</option>
                          {profiles.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        <button className={styles.profileBtn} onClick={() => setAssigningUser(u)}>
                          {u.profileName || "Padrão"}
                        </button>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${u.active ? styles.badgeActive : styles.badgeInactive}`}>
                        {u.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <button className={styles.btnSmall} onClick={() => handleToggleUserActive(u.id, !u.active)}>
                        {u.active ? "Desativar" : "Ativar"}
                      </button>
                    </td>
                  </tr>
                ))}
                {tenantUsers.length === 0 && (
                  <tr><td colSpan={5} className={styles.empty}>Nenhum usuário nesta empresa</td></tr>
                )}
              </tbody>
            </table>
          )}
          {!selectedTenantId && <p className={styles.empty}>Selecione uma empresa para ver seus usuários</p>}
        </div>
      )}

      {/* === MODAL: Nova Empresa === */}
      {showTenantModal && (
        <div className={styles.overlay} onClick={() => setShowTenantModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Nova Empresa</h2>
            <div className={styles.formGroup}>
              <label>Nome da Empresa *</label>
              <input
                value={tenantForm.name}
                onChange={e => {
                  const name = e.target.value;
                  const autoSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                  setTenantForm(f => ({ ...f, name, slug: autoSlug }));
                }}
                className={styles.input}
                placeholder="Ex: Clínica Exemplo"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Slug (identificador) *</label>
              <input
                value={tenantForm.slug}
                onChange={e => setTenantForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                className={styles.input}
                placeholder="ex: clinica-exemplo"
              />
            </div>
            <hr className={styles.divider} />
            <p className={styles.formHint}>Administrador (opcional)</p>
            <div className={styles.formGroup}>
              <label>Nome</label>
              <input value={tenantForm.adminName} onChange={e => setTenantForm(f => ({ ...f, adminName: e.target.value }))} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label>Email</label>
              <input type="email" value={tenantForm.adminEmail} onChange={e => setTenantForm(f => ({ ...f, adminEmail: e.target.value }))} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label>Senha</label>
              <input type="password" value={tenantForm.adminPassword} onChange={e => setTenantForm(f => ({ ...f, adminPassword: e.target.value }))} className={styles.input} />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnOutline} onClick={() => setShowTenantModal(false)}>Cancelar</button>
              <button className={styles.addBtn} onClick={handleCreateTenant}>Criar Empresa</button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Perfil de Acesso === */}
      {showProfileModal && (
        <div className={styles.overlay} onClick={() => { setShowProfileModal(false); setEditingProfile(null); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingProfile ? "Editar Perfil" : "Novo Perfil"}</h2>
            <div className={styles.formGroup}>
              <label>Nome do Perfil *</label>
              <input
                value={profileForm.name}
                onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                className={styles.input}
                placeholder="Ex: Recepcionista"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Módulos disponíveis</label>
              <div className={styles.moduleGrid}>
                {modules.map(m => (
                  <label key={m.id} className={styles.moduleCheck}>
                    <input
                      type="checkbox"
                      checked={profileForm.modules.includes(m.id)}
                      onChange={() => toggleModule(m.id)}
                    />
                    <div>
                      <span className={styles.moduleLabel}>{m.label}</span>
                      <span className={styles.moduleDesc}>{m.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnOutline} onClick={() => { setShowProfileModal(false); setEditingProfile(null); }}>Cancelar</button>
              <button className={styles.addBtn} onClick={handleSaveProfile}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Adicionar Usuário === */}
      {showUserModal && (
        <div className={styles.overlay} onClick={() => setShowUserModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Adicionar Usuário</h2>
            <div className={styles.formGroup}>
              <label>Nome *</label>
              <input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label>Email *</label>
              <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label>Senha *</label>
              <input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label>Perfil de Acesso</label>
              <select value={userForm.profileId} onChange={e => setUserForm(f => ({ ...f, profileId: e.target.value }))} className={styles.select}>
                <option value="">Perfil padrão</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnOutline} onClick={() => setShowUserModal(false)}>Cancelar</button>
              <button className={styles.addBtn} onClick={handleAddUser}>Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
