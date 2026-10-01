import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authenticatedFetch } from "../../services/auth";
import { RR } from "../../config/theme";

type Role = "admin" | "gestor" | "colaborador" | "visualizador";

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  colaborador: "Colaborador",
  visualizador: "Visualizador",
};

const ROLE_COLORS: Record<Role, string> = {
  admin: RR.forest,
  gestor: RR.gold,
  colaborador: RR.leaf,
  visualizador: RR.muted,
};

const ROLES: Role[] = ["admin", "gestor", "colaborador", "visualizador"];

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return `${p[0]?.[0] || ""}${p.length > 1 ? p[p.length - 1][0] : ""}`.toUpperCase();
}

export default function UsuariosScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<Role>("colaborador");

  // Edit modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<Role>("colaborador");
  const [editActive, setEditActive] = useState(true);

  // Password modal
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await authenticatedFetch("/users");
      if (!res.ok) throw new Error("Falha ao carregar usuários");
      setUsers(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setCreateName("");
    setCreateEmail("");
    setCreatePassword("");
    setCreateRole("colaborador");
    setShowCreate(true);
  }

  function openEdit(user: User) {
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditActive(user.active);
    setEditUser(user);
  }

  function openPassword(user: User) {
    setNewPassword("");
    setConfirmPassword("");
    setPasswordUser(user);
  }

  async function handleCreate() {
    if (!createName.trim() || !createEmail.trim() || !createPassword.trim()) {
      Alert.alert("Campos obrigatórios", "Preencha nome, e-mail e senha.");
      return;
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          email: createEmail.trim().toLowerCase(),
          password: createPassword,
          role: createRole,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao criar usuário");
      }
      setShowCreate(false);
      load(true);
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    if (!editUser || !editName.trim() || !editEmail.trim()) {
      Alert.alert("Campos obrigatórios", "Preencha nome e e-mail.");
      return;
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch(`/users/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim().toLowerCase(),
          role: editRole,
          active: editActive,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao atualizar usuário");
      }
      setEditUser(null);
      load(true);
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!passwordUser || !newPassword.trim()) {
      Alert.alert("Campo obrigatório", "Informe a nova senha.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Senhas diferentes", "A confirmação não confere com a senha digitada.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Senha curta", "A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch(`/users/${passwordUser.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao alterar senha");
      }
      setPasswordUser(null);
      Alert.alert("Senha alterada", "A nova senha foi salva com sucesso.");
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.root} edges={["bottom"]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>ADMINISTRAÇÃO</Text>
          <Text style={s.title}>Usuários</Text>
        </View>
        <View style={s.total}>
          <Text style={s.totalText}>{users.length}</Text>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={RR.gold} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={RR.gold}
            />
          }
        >
          {error ? (
            <View style={s.notice}>
              <Text style={s.noticeTitle}>Ops</Text>
              <Text style={s.noticeText}>{error}</Text>
            </View>
          ) : users.length === 0 ? (
            <View style={s.notice}>
              <Text style={s.noticeTitle}>Nenhum usuário cadastrado</Text>
              <Text style={s.noticeText}>
                Toque no botão + para adicionar o primeiro usuário.
              </Text>
            </View>
          ) : (
            users.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={s.card}
                onPress={() => openEdit(user)}
                onLongPress={() => openPassword(user)}
                activeOpacity={0.7}
              >
                <View style={s.cardRow}>
                  <View
                    style={[
                      s.avatar,
                      { backgroundColor: user.active ? ROLE_COLORS[user.role] : RR.muted },
                    ]}
                  >
                    <Text style={s.avatarText}>{initials(user.name)}</Text>
                  </View>
                  <View style={s.cardInfo}>
                    <View style={s.nameRow}>
                      <Text
                        style={[s.userName, !user.active && s.userNameInactive]}
                        numberOfLines={1}
                      >
                        {user.name}
                      </Text>
                      {!user.active && (
                        <View style={s.inactiveBadge}>
                          <Text style={s.inactiveBadgeText}>Inativo</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.userEmail} numberOfLines={1}>{user.email}</Text>
                    <View style={s.badgeRow}>
                      <View
                        style={[
                          s.roleBadge,
                          { backgroundColor: `${ROLE_COLORS[user.role]}18` },
                        ]}
                      >
                        <Text style={[s.roleBadgeText, { color: ROLE_COLORS[user.role] }]}>
                          {ROLE_LABELS[user.role]}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={s.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={openCreate} activeOpacity={0.85}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create User Modal */}
      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetTop}>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={s.close}>‹</Text>
              </TouchableOpacity>
              <Text style={s.sheetLabel}>NOVO USUÁRIO</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView style={s.form} keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>NOME</Text>
              <TextInput
                style={s.fieldInput}
                value={createName}
                onChangeText={setCreateName}
                placeholder="Nome completo"
                placeholderTextColor={RR.muted}
                autoCapitalize="words"
              />

              <Text style={s.fieldLabel}>E-MAIL</Text>
              <TextInput
                style={s.fieldInput}
                value={createEmail}
                onChangeText={setCreateEmail}
                placeholder="email@exemplo.com"
                placeholderTextColor={RR.muted}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={s.fieldLabel}>SENHA</Text>
              <TextInput
                style={s.fieldInput}
                value={createPassword}
                onChangeText={setCreatePassword}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={RR.muted}
                secureTextEntry
              />

              <Text style={s.fieldLabel}>PERFIL</Text>
              <View style={s.roleGrid}>
                {ROLES.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      s.roleOption,
                      createRole === role && {
                        backgroundColor: `${ROLE_COLORS[role]}18`,
                        borderColor: ROLE_COLORS[role],
                      },
                    ]}
                    onPress={() => setCreateRole(role)}
                  >
                    <Text
                      style={[
                        s.roleOptionText,
                        createRole === role && { color: ROLE_COLORS[role] },
                      ]}
                    >
                      {ROLE_LABELS[role]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[s.primaryBtn, saving && s.primaryBtnDisabled]}
                onPress={handleCreate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={RR.goldLight} />
                ) : (
                  <Text style={s.primaryBtnText}>Criar usuário</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        visible={!!editUser}
        animationType="slide"
        transparent
        onRequestClose={() => setEditUser(null)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetTop}>
              <TouchableOpacity onPress={() => setEditUser(null)}>
                <Text style={s.close}>‹</Text>
              </TouchableOpacity>
              <Text style={s.sheetLabel}>EDITAR USUÁRIO</Text>
              <View style={{ width: 24 }} />
            </View>
            {editUser && (
              <ScrollView style={s.form} keyboardShouldPersistTaps="handled">
                <Text style={s.fieldLabel}>NOME</Text>
                <TextInput
                  style={s.fieldInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nome completo"
                  placeholderTextColor={RR.muted}
                  autoCapitalize="words"
                />

                <Text style={s.fieldLabel}>E-MAIL</Text>
                <TextInput
                  style={s.fieldInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="email@exemplo.com"
                  placeholderTextColor={RR.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={s.fieldLabel}>PERFIL</Text>
                <View style={s.roleGrid}>
                  {ROLES.map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        s.roleOption,
                        editRole === role && {
                          backgroundColor: `${ROLE_COLORS[role]}18`,
                          borderColor: ROLE_COLORS[role],
                        },
                      ]}
                      onPress={() => setEditRole(role)}
                    >
                      <Text
                        style={[
                          s.roleOptionText,
                          editRole === role && { color: ROLE_COLORS[role] },
                        ]}
                      >
                        {ROLE_LABELS[role]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={s.switchRow}>
                  <View>
                    <Text style={s.switchLabel}>Usuário ativo</Text>
                    <Text style={s.switchHint}>
                      {editActive
                        ? "Este usuário pode acessar o sistema"
                        : "Este usuário está bloqueado"}
                    </Text>
                  </View>
                  <Switch
                    value={editActive}
                    onValueChange={setEditActive}
                    trackColor={{ false: RR.sand, true: `${RR.forest}66` }}
                    thumbColor={editActive ? RR.forest : RR.muted}
                  />
                </View>

                <TouchableOpacity
                  style={[s.primaryBtn, saving && s.primaryBtnDisabled]}
                  onPress={handleEdit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={RR.goldLight} />
                  ) : (
                    <Text style={s.primaryBtnText}>Salvar alterações</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.secondaryBtn}
                  onPress={() => {
                    setEditUser(null);
                    openPassword(editUser);
                  }}
                >
                  <Text style={s.secondaryBtnText}>Alterar senha</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={!!passwordUser}
        animationType="slide"
        transparent
        onRequestClose={() => setPasswordUser(null)}
      >
        <View style={s.overlay}>
          <View style={s.sheetSmall}>
            <View style={s.sheetTop}>
              <TouchableOpacity onPress={() => setPasswordUser(null)}>
                <Text style={s.close}>‹</Text>
              </TouchableOpacity>
              <Text style={s.sheetLabel}>ALTERAR SENHA</Text>
              <View style={{ width: 24 }} />
            </View>
            {passwordUser && (
              <View style={s.form}>
                <Text style={s.passwordUserName}>{passwordUser.name}</Text>
                <Text style={s.passwordUserEmail}>{passwordUser.email}</Text>

                <Text style={[s.fieldLabel, { marginTop: 20 }]}>NOVA SENHA</Text>
                <TextInput
                  style={s.fieldInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={RR.muted}
                  secureTextEntry
                />

                <Text style={s.fieldLabel}>CONFIRMAR SENHA</Text>
                <TextInput
                  style={s.fieldInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repita a nova senha"
                  placeholderTextColor={RR.muted}
                  secureTextEntry
                />

                <TouchableOpacity
                  style={[s.primaryBtn, saving && s.primaryBtnDisabled]}
                  onPress={handleChangePassword}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={RR.goldLight} />
                  ) : (
                    <Text style={s.primaryBtnText}>Salvar nova senha</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: RR.ivory },
  header: {
    padding: 20,
    paddingTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: { color: RR.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  title: { color: RR.forest, fontFamily: "serif", fontSize: 32, marginTop: 2 },
  total: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: RR.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  totalText: { color: RR.goldLight, fontWeight: "700" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 9, paddingBottom: 100 },
  notice: {
    backgroundColor: RR.white,
    padding: 24,
    borderRadius: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: RR.line,
  },
  noticeTitle: { color: RR.forest, fontFamily: "serif", fontSize: 18 },
  noticeText: { color: RR.muted, textAlign: "center", lineHeight: 20, fontSize: 14 },

  // Card
  card: {
    backgroundColor: RR.white,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RR.line,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: RR.cream, fontFamily: "serif", fontSize: 17, fontStyle: "italic" },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userName: { color: RR.forest, fontSize: 15, fontWeight: "700", flexShrink: 1 },
  userNameInactive: { color: RR.muted },
  userEmail: { color: RR.muted, fontSize: 12, marginTop: 2 },
  badgeRow: { flexDirection: "row", marginTop: 6 },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleBadgeText: { fontSize: 11, fontWeight: "700" },
  inactiveBadge: {
    backgroundColor: "rgba(107,97,82,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inactiveBadgeText: { color: RR.muted, fontSize: 10, fontWeight: "600" },
  chevron: { color: RR.gold, fontSize: 25 },

  // FAB
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: RR.forest,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: RR.goldLight, fontSize: 30, fontWeight: "300", marginTop: -2 },

  // Modal shared
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,.35)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "92%",
    minHeight: "72%",
    backgroundColor: RR.ivory,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingBottom: 24,
  },
  sheetSmall: {
    maxHeight: "65%",
    backgroundColor: RR.ivory,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingBottom: 24,
  },
  sheetTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
  },
  close: { color: RR.forest, fontSize: 32 },
  sheetLabel: { color: RR.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.4 },

  // Form
  form: { paddingHorizontal: 20 },
  fieldLabel: {
    color: RR.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: RR.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RR.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: RR.ink,
    fontSize: 15,
  },

  // Role selector
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: RR.line,
    backgroundColor: RR.white,
  },
  roleOptionText: { color: RR.body, fontSize: 13, fontWeight: "600" },

  // Switch
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    backgroundColor: RR.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RR.line,
    padding: 14,
  },
  switchLabel: { color: RR.forest, fontSize: 15, fontWeight: "600" },
  switchHint: { color: RR.muted, fontSize: 12, marginTop: 2 },

  // Buttons
  primaryBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: RR.forest,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: RR.goldLight, fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RR.gold,
    alignItems: "center",
  },
  secondaryBtnText: { color: RR.forest, fontSize: 14, fontWeight: "600" },

  // Password modal extras
  passwordUserName: {
    color: RR.forest,
    fontFamily: "serif",
    fontSize: 22,
    textAlign: "center",
  },
  passwordUserEmail: {
    color: RR.muted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 2,
  },
});
