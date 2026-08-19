import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ErrorBoundary } from "../components/ErrorBoundary";

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FBF8F3" } }} />
    </ErrorBoundary>
  );
}
