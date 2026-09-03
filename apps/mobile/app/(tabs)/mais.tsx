import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { clearSession } from "../../services/auth";
import { RR } from "../../config/theme";

interface MenuItem {
  label: string;
  sub: string;
  icon: string;
  route: string;
}

const ITEMS: MenuItem[] = [
  {
    label: "Pedidos de agendamento",
    sub: "Solicitações da página pública",
    icon: "◇",
    route: "/(tabs)/agendamentos",
  },
  {
    label: "Vendas",
    sub: "Vendas registradas + contratos PDF",
    icon: "✦",
    route: "/(tabs)/vendas",
  },
  {
    label: "Financeiro",
    sub: "Contas a receber, resumo do mês",
    icon: "$",
    route: "/(tabs)/financeiro",
  },
  {
    label: "Catálogo",
    sub: "Produtos e serviços",
    icon: "◆",
    route: "/(tabs)/catalogo",
  },
];

export default function MaisScreen() {
  function logout() {
    Alert.alert("Sair", "Deseja encerrar sua sessão?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await clearSession();
          router.replace("/");
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={s.root} edges={["bottom"]}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.eyebrow}>ATALHOS</Text>
        <Text style={s.title}>Mais</Text>

        <View style={s.grid}>
          {ITEMS.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={s.card}
              onPress={() => router.push(item.route as never)}
            >
              <View style={s.iconBox}>
                <Text style={s.icon}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardLabel}>{item.label}</Text>
                <Text style={s.cardSub}>{item.sub}</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.logout} onPress={logout}>
          <Text style={s.logoutText}>Sair da conta</Text>
        </TouchableOpacity>

        <Text style={s.footer}>Raízes e Riquezas · Assistente da Fabi</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: RR.ivory },
  content: { padding: 20, paddingBottom: 40 },
  eyebrow: { color: RR.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  title: { color: RR.forest, fontFamily: "serif", fontSize: 32, marginTop: 2 },
  grid: { marginTop: 24, gap: 10 },
  card: {
    backgroundColor: RR.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RR.line,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(184,135,58,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { color: RR.gold, fontSize: 22 },
  cardLabel: { color: RR.forest, fontSize: 15, fontWeight: "700" },
  cardSub: { color: RR.muted, fontSize: 12, marginTop: 2 },
  chevron: { color: RR.gold, fontSize: 26 },
  logout: {
    alignSelf: "center",
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  logoutText: { color: RR.muted, fontWeight: "600", fontSize: 13 },
  footer: {
    color: RR.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 20,
    opacity: 0.7,
  },
});
