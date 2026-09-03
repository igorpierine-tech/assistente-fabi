import { Platform } from "react-native";

const LOCAL_API_URL = Platform.select({
  android: "http://10.0.2.2:3001",
  default: "http://localhost:3001",
});

/**
 * Normalize the API URL. Historically this threw for missing/invalid values,
 * which crashed the JS bundle at module-load time — before any React
 * component could render, resulting in a splash screen followed by an
 * immediate close on Android. We now log a warning and fall back to the
 * platform default so the app always boots.
 */
function normalizeApiUrl(raw: string | undefined | null): string {
  const value = (raw || LOCAL_API_URL || "http://localhost:3001").trim().replace(/\/+$/, "");

  if (!/^https?:\/\//i.test(value)) {
    // eslint-disable-next-line no-console
    console.warn(
      `EXPO_PUBLIC_API_URL sem esquema válido ("${value}"), usando fallback local.`
    );
    return LOCAL_API_URL || "http://localhost:3001";
  }

  if (!__DEV__ && !value.startsWith("https://")) {
    // eslint-disable-next-line no-console
    console.warn(
      `EXPO_PUBLIC_API_URL não é HTTPS em build de produção ("${value}"). O app ainda vai tentar, mas conexões seguras são recomendadas.`
    );
  }

  return value;
}

export const API_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);
