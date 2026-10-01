import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "../config/env";
import { exchangeLoginCode, hasSession, loginWithEmail } from "../services/auth";
import { RR } from "../config/theme";

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
    return () => { active = false; };
  }, []);

  async function handleEmailLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Preencha todos os campos", "Informe seu e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
      router.replace("/(tabs)/inicio");
    } catch (error) {
      Alert.alert("Erro no login", error instanceof Error ? error.message : "Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  }

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
      Alert.alert("Erro", "Não foi possível fazer login com Google.");
      console.error("Google login error:", error);
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ width: "100%", maxWidth: 400, alignItems: "center" }}
      >
        <View style={s.card}>
          <Image
            source={require("../assets/logo-raizes-mobile.png")}
            style={s.logo}
            resizeMode="contain"
          />
          <Text style={s.title}>
            Assistente{"\n"}
            <Text style={s.titleItalic}>da Fabi</Text>
          </Text>
          <Text style={s.desc}>
            Sua agenda, seus clientes e um assistente de IA — tudo num só lugar.
          </Text>

          <TextInput
            style={s.input}
            placeholder="E-mail"
            placeholderTextColor="rgba(253,250,243,0.4)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />
          <TextInput
            style={s.input}
            placeholder="Senha"
            placeholderTextColor="rgba(253,250,243,0.4)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete="password"
          />

          <TouchableOpacity
            style={s.loginBtn}
            onPress={handleEmailLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={RR.forest} />
            ) : (
              <Text style={s.loginText}>Entrar</Text>
            )}
          </TouchableOpacity>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>ou</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity
            style={s.googleBtn}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <Text style={s.googleText}>Entrar com Google</Text>
          </TouchableOpacity>

          <Text style={s.footer}>Raízes e Riquezas</Text>
        </View>
      </KeyboardAvoidingView>
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
    marginBottom: 22,
  },
  input: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(253,250,243,0.08)",
    borderWidth: 1,
    borderColor: "rgba(217,178,104,0.2)",
    color: RR.cream,
    fontSize: 15,
    marginBottom: 10,
  },
  loginBtn: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    backgroundColor: RR.goldLight,
    alignItems: "center",
    marginTop: 4,
  },
  loginText: { fontSize: 16, color: RR.forest, fontWeight: "700" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(217,178,104,0.2)" },
  dividerText: { color: RR.cream, opacity: 0.5, fontSize: 12 },
  googleBtn: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(217,178,104,0.3)",
    alignItems: "center",
  },
  googleText: { fontSize: 14, color: RR.cream, fontWeight: "600" },
  footer: {
    fontSize: 12,
    color: RR.cream,
    opacity: 0.55,
    textAlign: "center",
    marginTop: 18,
  },
});
