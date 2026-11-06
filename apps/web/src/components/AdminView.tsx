"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch, API_URL } from "@/lib/api";
import styles from "./AdminView.module.css";

type AdminTab = "empresas" | "perfis" | "usuarios";
type TenantModalStep = "cnpj" | "form";

function formatCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

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
  const [tenantModalStep, setTenantModalStep] = useState<TenantModalStep>("cnpj");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AccessProfile | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [assigningUser, setAssigningUser] = useState<TenantUser | null>(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [editUserForm, setEditUserForm] = useState({ name: "", email: "" });

  // CNPJ lookup
  const [cnpjInput, setCnpjInput] = useState("");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState("");

  // Forms
  const [tenantForm, setTenantForm] = useState({
    name: "", slug: "", cnpj: "",
    endereco: "", cep: "", municipio: "", uf: "", telefone: "", emailEmpresa: "",
    adminName: "", adminEmail: "", adminPassword: "",
  });
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
  function openTenantModal() {
    setCnpjInput("");
    setCnpjError("");
    setCnpjLoading(false);
    setTenantModalStep("cnpj");
    setTenantForm({ name: "", slug: "", cnpj: "", endereco: "", cep: "", municipio: "", uf: "", telefone: "", emailEmpresa: "", adminName: "", adminEmail: "", adminPassword: "" });
    setShowTenantModal(true);
  }

  function closeTenantModal() {
    setShowTenantModal(false);
    setEditingTenant(null);
  }

  async function handleCnpjSearch() {
    const clean = cnpjInput.replace(/\D/g, "");
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
      const autoSlug = nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const addr = [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(", ");
      setTenantForm(f => ({
        ...f,
        name: nome,
        slug: autoSlug,
        cnpj: formatCnpj(clean),
        endereco: addr,
        cep: data.cep || "",
        municipio: data.municipio || "",
        uf: data.uf || "",
        telefone: data.telefone || "",
        emailEmpresa: data.email || "",
      }));
      setTenantModalStep("form");
    } catch {
      setCnpjError("Não foi possível consultar o CNPJ. Tente novamente.");
    }
    setCnpjLoading(false);
  }

  function handleSkipCnpj() {
    setTenantModalStep("form");
  }

  async function handleCreateTenant() {
    const { name, slug, adminName, adminEmail, adminPassword, cnpj, endereco, cep, municipio, uf, telefone, emailEmpresa } = tenantForm;
    if (!name || !slug) return;
    const res = await apiFetch("/system/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, slug,
        adminName: adminName || undefined, adminEmail: adminEmail || undefined, adminPassword: adminPassword || undefined,
        cnpj: cnpj || undefined, endereco: endereco || undefined, cep: cep || undefined,
        municipio: municipio || undefined, uf: uf || undefined,
        telefone: telefone || undefined, emailEmpresa: emailEmpresa || undefined,
      }),
    });
    if (res.ok) {
      closeTenantModal();
      await fetchTenants();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Erro ao criar empresa");
    }
  }

  function openEditTenantModal(tenant: Tenant) {
    setEditingTenant(tenant);
    setTenantModalStep("form");
    setTenantForm({
      name: tenant.name, slug: tenant.slug, cnpj: "",
      endereco: "", cep: "", municipio: "", uf: "", telefone: "", emailEmpresa: "",
      adminName: "", adminEmail: "", adminPassword: "",
    });
    setShowTenantModal(true);
  }

  async function handleUpdateTenant() {
    if (!editingTenant || !tenantForm.name || !tenantForm.slug) return;
    const res = await apiFetch(`/system/tenants/${editingTenant.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tenantForm.name, slug: tenantForm.slug }),
    });
    if (res.ok) {
      closeTenantModal();
      await fetchTenants();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Erro ao atualizar empresa");
    }
  }

  async function handleDeleteTenant(id: string) {
    if (!confirm("Deseja realmente desativar esta empresa? Ela ficará inativa mas os dados serão preservados.")) return;
    const res = await apiFetch(`/system/tenants/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      await fetchTenants();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Erro ao desativar empresa");
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

  function openEditUserModal(user: TenantUser) {
    setEditingUser(user);
    setEditUserForm({ name: user.name, email: user.email });
    setShowEditUserModal(true);
  }

  async function handleUpdateUser() {
    if (!selectedTenantId || !editingUser || !editUserForm.name || !editUserForm.email) return;
    const res = await apiFetch(`/system/tenants/${selectedTenantId}/users/${editingUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editUserForm.name, email: editUserForm.email }),
    });
    if (res.ok) {
      setShowEditUserModal(false);
      setEditingUser(null);
      await fetchTenantUsers(selectedTenantId);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Erro ao atualizar usuário");
    }
  }

  async function handleRemoveUser(userId: string) {
    if (!selectedTenantId) return;
    if (!confirm("Deseja remover este usuário da empresa?")) return;
    const res = await apiFetch(`/system/tenants/${selectedTenantId}/users/${userId}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      await fetchTenantUsers(selectedTenantId);
      await fetchTenants();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Erro ao remover usuário");
    }
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
            <button className={styles.addBtn} onClick={openTenantModal}>+ Nova Empresa</button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Slug</th>
                <th>Usuários</th>
                <th>Status</th>
                <th>Criada em</th>
                <th>Ações</th>
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
                  <td>
                    <div className={styles.profileActions}>
                      <button className={styles.btnSmall} onClick={() => openEditTenantModal(t)}>Editar</button>
                      <button className={styles.btnDanger} onClick={() => handleDeleteTenant(t.id)} style={{ padding: "4px 12px", fontSize: "0.78rem" }}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr><td colSpan={6} className={styles.empty}>Nenhuma empresa cadastrada</td></tr>
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
                      <div className={styles.profileActions}>
                        <button className={styles.btnSmall} onClick={() => openEditUserModal(u)}>Editar</button>
                        <button className={styles.btnSmall} onClick={() => handleToggleUserActive(u.id, !u.active)}>
                          {u.active ? "Desativar" : "Ativar"}
                        </button>
                        <button className={styles.btnDanger} onClick={() => handleRemoveUser(u.id)} style={{ padding: "4px 12px", fontSize: "0.78rem" }}>Remover</button>
                      </div>
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
        <div className={styles.overlay} onClick={closeTenantModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            {tenantModalStep === "cnpj" && !editingTenant ? (
              <>
                <h2 className={styles.modalTitle}>Nova Empresa</h2>
                <p className={styles.formHint}>Informe o CNPJ para buscar os dados automaticamente na Receita Federal</p>
                <div className={styles.formGroup}>
                  <label>CNPJ</label>
                  <div className={styles.cnpjRow}>
                    <input
                      value={cnpjInput}
                      onChange={e => { setCnpjInput(formatCnpj(e.target.value)); setCnpjError(""); }}
                      className={styles.input}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      onKeyDown={e => { if (e.key === "Enter") handleCnpjSearch(); }}
                    />
                    <button className={styles.addBtn} onClick={handleCnpjSearch} disabled={cnpjLoading}>
                      {cnpjLoading ? "Buscando..." : "Buscar"}
                    </button>
                  </div>
                  {cnpjError && <p className={styles.errorText}>{cnpjError}</p>}
                </div>
                <div className={styles.modalActions}>
                  <button className={styles.btnOutline} onClick={closeTenantModal}>Cancelar</button>
                  <button className={styles.btnOutline} onClick={handleSkipCnpj}>Preencher manualmente</button>
                </div>
              </>
            ) : (
              <>
                <h2 className={styles.modalTitle}>{editingTenant ? "Editar Empresa" : "Nova Empresa"}</h2>
                {tenantForm.cnpj && !editingTenant && (
                  <div className={styles.cnpjBadgeRow}>
                    <span className={styles.cnpjBadge}>CNPJ: {tenantForm.cnpj}</span>
                    <button className={styles.btnSmall} onClick={() => setTenantModalStep("cnpj")}>Alterar</button>
                  </div>
                )}
                <div className={styles.formRow}>
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
                </div>
                <div className={styles.formGroup}>
                  <label>Endereço</label>
                  <input value={tenantForm.endereco} onChange={e => setTenantForm(f => ({ ...f, endereco: e.target.value }))} className={styles.input} />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>CEP</label>
                    <input value={tenantForm.cep} onChange={e => setTenantForm(f => ({ ...f, cep: e.target.value }))} className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Município</label>
                    <input value={tenantForm.municipio} onChange={e => setTenantForm(f => ({ ...f, municipio: e.target.value }))} className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>UF</label>
                    <input value={tenantForm.uf} onChange={e => setTenantForm(f => ({ ...f, uf: e.target.value }))} className={styles.input} maxLength={2} />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Telefone</label>
                    <input value={tenantForm.telefone} onChange={e => setTenantForm(f => ({ ...f, telefone: e.target.value }))} className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Email da Empresa</label>
                    <input type="email" value={tenantForm.emailEmpresa} onChange={e => setTenantForm(f => ({ ...f, emailEmpresa: e.target.value }))} className={styles.input} />
                  </div>
                </div>
                {!editingTenant && (
                  <>
                    <hr className={styles.divider} />
                    <p className={styles.formHint}>Administrador (opcional)</p>
                    <div className={styles.formGroup}>
                      <label>Nome</label>
                      <input value={tenantForm.adminName} onChange={e => setTenantForm(f => ({ ...f, adminName: e.target.value }))} className={styles.input} />
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>Email</label>
                        <input type="email" value={tenantForm.adminEmail} onChange={e => setTenantForm(f => ({ ...f, adminEmail: e.target.value }))} className={styles.input} />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Senha</label>
                        <input type="password" value={tenantForm.adminPassword} onChange={e => setTenantForm(f => ({ ...f, adminPassword: e.target.value }))} className={styles.input} />
                      </div>
                    </div>
                  </>
                )}
                <div className={styles.modalActions}>
                  <button className={styles.btnOutline} onClick={closeTenantModal}>Cancelar</button>
                  <button className={styles.addBtn} onClick={editingTenant ? handleUpdateTenant : handleCreateTenant}>
                    {editingTenant ? "Salvar" : "Criar Empresa"}
                  </button>
                </div>
              </>
            )}
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

      {/* === MODAL: Editar Usuário === */}
      {showEditUserModal && editingUser && (
        <div className={styles.overlay} onClick={() => { setShowEditUserModal(false); setEditingUser(null); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Editar Usuário</h2>
            <div className={styles.formGroup}>
              <label>Nome *</label>
              <input value={editUserForm.name} onChange={e => setEditUserForm(f => ({ ...f, name: e.target.value }))} className={styles.input} />
            </div>
            <div className={styles.formGroup}>
              <label>Email *</label>
              <input type="email" value={editUserForm.email} onChange={e => setEditUserForm(f => ({ ...f, email: e.target.value }))} className={styles.input} />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnOutline} onClick={() => { setShowEditUserModal(false); setEditingUser(null); }}>Cancelar</button>
              <button className={styles.addBtn} onClick={handleUpdateUser}>Salvar</button>
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
