import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "../config/env";
import { exchangeLoginCode, hasSession } from "../services/auth";
import { RR } from "../config/theme";

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // If a session already exists, jump straight into the app.
  useEffect(() => {
    let active = true;
    (async () => {
      const has = await hasSession().catch(() => false);
      if (!active) return;
      if (has) {
        router.replace("/(tabs)/inicio");
      } else {
        setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
        router.replace("/(tabs)/inicio");
      }
    } catch (error) {
      Alert.alert(
        "Erro",
        "Não foi possível fazer login. Verifique sua conexão e se seu e-mail está autorizado."
      );
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator color={RR.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.card}>
        <Image
          source={require("../assets/logo-raizes-mobile.png")}
          style={s.logo}
          resizeMode="contain"
        />
        <Text style={s.title}>
          Bem-vinda,{"\n"}
          <Text style={s.titleItalic}>Fabiana.</Text>
        </Text>
        <Text style={s.desc}>
          Sua agenda, seus clientes e um assistente de IA — tudo num só lugar.
        </Text>

        <TouchableOpacity
          style={s.googleBtn}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={RR.forest} />
          ) : (
            <Text style={s.googleText}>Entrar com Google</Text>
          )}
        </TouchableOpacity>

        <Text style={s.footer}>
          Conecte sua conta Google para acessar seu Calendar.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: RR.forest,
    padding: 24,
  },
  card: {
    backgroundColor: "rgba(253, 250, 243, 0.06)",
    borderRadius: 20,
    padding: 32,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(217, 178, 104, 0.18)",
  },
  logo: { width: 200, height: 160, marginBottom: 12 },
  title: {
    fontFamily: "serif",
    fontSize: 26,
    color: RR.cream,
    marginBottom: 12,
    textAlign: "center",
    lineHeight: 34,
  },
  titleItalic: { fontStyle: "italic", color: RR.goldLight },
  desc: {
    fontSize: 14,
    color: RR.cream,
    opacity: 0.75,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 26,
  },
  googleBtn: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    backgroundColor: RR.goldLight,
    alignItems: "center",
  },
  googleText: { fontSize: 16, color: RR.forest, fontWeight: "700" },
  footer: {
    fontSize: 12,
    color: RR.cream,
    opacity: 0.55,
    textAlign: "center",
    marginTop: 18,
  },
});
