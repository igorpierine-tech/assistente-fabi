import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.raizeseriquezas.app",
  appName: "Raízes e Riquezas",
  webDir: "out",
  server: {
    url: "https://app.raizeseriquezas.com.br",
    cleartext: false,
  },
  android: {
    buildOptions: {
      signingType: "apksigner",
    },
  },
};

export default config;
