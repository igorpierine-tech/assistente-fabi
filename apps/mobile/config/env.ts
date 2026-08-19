import { Platform } from "react-native";

const LOCAL_API_URL = Platform.select({
  android: "http://10.0.2.2:3001",
  default: "http://localhost:3001",
});

function normalizeApiUrl(value: string): string {
  const url = value.trim().replace(/\/+$/, "");

  if (!/^https?:\/\//i.test(url)) {
    throw new Error("EXPO_PUBLIC_API_URL deve começar com http:// ou https://");
  }

  if (!__DEV__ && !url.startsWith("https://")) {
    throw new Error("EXPO_PUBLIC_API_URL deve usar HTTPS em builds de produção");
  }

  return url;
}

export const API_URL = normalizeApiUrl(
  process.env.EXPO_PUBLIC_API_URL || LOCAL_API_URL || "http://localhost:3001"
);
