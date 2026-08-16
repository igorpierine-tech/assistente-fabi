import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authenticateWithToken, initSession, checkAuth } from "../lib/api";

WebBrowser.maybeCompleteAuthSession();

const C = {
  primary: "#1a2e18",
  primaryLight: "#2f4a2b",
  secondary: "#b8873a",
  gold: "#d9b268",
  goldLight: "#e8c880",
  bg: "#f4ede0",
  surface: "#fdfaf3",
  text: "#1a2e18",
  textLight: "#f4ede0",
  textMuted: "#6b6152",
  textWarm: "#8a7f6a",
  border: "#c8bfae",
};

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
];

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  userInfoEndpoint: "https://www.googleapis.com/oauth2/v3/userinfo",
};

export default function LoginScreen() {
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: "raizeseriquezas" });

  useEffect(() => {
    (async () => {
      await initSession();
      const user = await checkAuth();
      if (user) {
        await AsyncStorage.setItem("fabi_userName", user.name || "Usuário");
        router.replace("/(tabs)/assistente");
      }
      setLoading(false);
    })();
  }, []);

  async function handleGoogleLogin() {
    try {
      setLoggingIn(true);

      const request = new AuthSession.AuthRequest({
        clientId: "SEU_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
        redirectUri,
        scopes: GOOGLE_SCOPES,
        responseType: AuthSession.ResponseType.Token,
        usePKCE: false,
      });

      const result = await request.promptAsync(discovery);

      if (result.type === "success" && result.authentication) {
        const token = result.authentication.accessToken;
        const authResult = await authenticateWithToken(token);
        if (authResult) {
          await AsyncStorage.setItem("fabi_userName", authResult.user?.name || "Usuário");
          await AsyncStorage.setItem("fabi_accessToken", token);
          router.replace("/(tabs)/assistente");
        } else {
          Alert.alert("Erro", "Não foi possível autenticar com o servidor.");
        }
      } else if (result.type === "cancel") {
        // user cancelled
      } else {
        Alert.alert("Erro", "Não foi possível autenticar com o Google. Tente novamente.");
      }
    } catch (error) {
      Alert.alert(
        "Google Login",
        "Para usar o login com Google, configure o GOOGLE_CLIENT_ID no código e registre o redirect URI no Google Cloud Console:\n\n" + redirectUri
      );
    } finally {
      setLoggingIn(false);
    }
  }

  if (loading) {
    return (
      <LinearGradient colors={["#1a2e18", "#12160f"]} style={s.container}>
        <ActivityIndicator size="large" color={C.gold} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#1a2e18", "#12160f"]} style={s.container}>
      <SafeAreaView style={s.inner}>
        <Image source={require("../../assets/images/logo-full.png")} style={s.logo} resizeMode="contain" />

        <View style={s.bottom}>
          <Text style={s.title}>Bem-vinda,{"\n"}<Text style={s.titleGold}>Fabiana.</Text></Text>
          <Text style={s.desc}>
            Gerencie sua agenda por voz ou texto. Consulte compromissos, agende atendimentos e organize sua semana.
          </Text>

          <TouchableOpacity style={s.goldBtn} onPress={handleGoogleLogin} disabled={loggingIn}>
            {loggingIn ? (
              <ActivityIndicator color={C.primary} />
            ) : (
              <Text style={s.goldBtnText}>Entrar com Google</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.darkBtn} onPress={() => router.replace("/(tabs)/assistente")}>
            <Text style={s.darkBtnText}>Explorar modo demonstração</Text>
          </TouchableOpacity>

          <Text style={s.footer}>Já tem conta? <Text style={s.footerLink}>Entrar</Text></Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, padding: 32, justifyContent: "space-between" },
  logo: { width: 200, height: 260, alignSelf: "center", marginTop: 30 },
  bottom: { gap: 16 },
  title: { fontFamily: "serif", fontSize: 44, lineHeight: 48, color: C.textLight },
  titleGold: { color: C.gold, fontStyle: "italic" },
  desc: { fontSize: 15, lineHeight: 23, color: C.border, maxWidth: 300 },
  goldBtn: { padding: 16, backgroundColor: C.gold, borderRadius: 16, alignItems: "center", minHeight: 52, justifyContent: "center" },
  goldBtnText: { fontSize: 15, fontWeight: "600", color: "#12160f" },
  darkBtn: { padding: 16, backgroundColor: "rgba(217,178,104,0.12)", borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(217,178,104,0.2)" },
  darkBtnText: { fontSize: 15, fontWeight: "500", color: C.gold },
  footer: { textAlign: "center", fontSize: 13, color: C.textWarm },
  footerLink: { color: C.gold },
});
