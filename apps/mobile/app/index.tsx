import { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "../config/env";
import { exchangeLoginCode } from "../services/auth";

const C = {
  primary: "#5E4B37",
  primaryLight: "#8B7355",
  secondary: "#C4A265",
  bg: "#FBF8F3",
  surface: "#FFFFFF",
  text: "#2C2418",
  textMuted: "#8B8078",
  border: "#E8E0D4",
};

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_URL}/auth/google?platform=mobile`,
        "assistente-fabi://auth/callback"
      );

      if (result.type === "success" && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get("code");
        if (!code) throw new Error("Código de login ausente");
        await exchangeLoginCode(code);
        router.replace("/(tabs)/assistente");
      }
    } catch (error) {
      Alert.alert("Erro", "Não foi possível fazer login. Tente novamente.");
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.card}>
        <Image source={require("../assets/logo-full.png")} style={s.logo} resizeMode="contain" />
        <Text style={s.title}>Raízes e Riquezas</Text>
        <Text style={s.tagline}>Desbloqueie suas Raízes, Cultive sua Riqueza.</Text>
        <Text style={s.subtitle}>Agenda, clientes e assistente inteligente</Text>
        <Text style={s.desc}>
          Gerencie sua agenda por voz ou texto. Consulte compromissos, agende atendimentos e organize sua semana.
        </Text>

        <TouchableOpacity style={s.googleBtn} onPress={handleGoogleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={C.text} />
          ) : (
            <Text style={s.googleText}>Entrar com Google</Text>
          )}
        </TouchableOpacity>

        <View style={s.divider}>
          <View style={s.line} />
          <Text style={s.dividerText}>ou</Text>
          <View style={s.line} />
        </View>

        <TouchableOpacity style={s.demoBtn} onPress={() => router.replace("/(tabs)/assistente")}>
          <Text style={s.demoText}>Explorar modo demonstração</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg, padding: 24 },
  card: { backgroundColor: C.surface, borderRadius: 20, padding: 36, width: "100%", maxWidth: 400, alignItems: "center", elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16 },
  logo: { width: 100, height: 140, marginBottom: 12 },
  title: { fontFamily: "serif", fontSize: 24, fontWeight: "600", color: C.primary, marginBottom: 4 },
  tagline: { fontSize: 13, color: C.secondary, fontStyle: "italic", marginBottom: 4 },
  subtitle: { fontSize: 16, color: C.textMuted, fontWeight: "500", marginBottom: 16 },
  desc: { fontSize: 14, color: C.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  googleBtn: { width: "100%", padding: 14, borderRadius: 12, borderWidth: 2, borderColor: C.border, alignItems: "center" },
  googleText: { fontSize: 15, color: C.text, fontWeight: "500" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16, width: "100%" },
  line: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 13, color: C.textMuted },
  demoBtn: { width: "100%", padding: 14, borderRadius: 12, backgroundColor: C.primary, alignItems: "center" },
  demoText: { fontSize: 15, color: "#F5F0E8", fontWeight: "500" },
});
