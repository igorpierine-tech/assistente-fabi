"use client";

import { createContext, useContext } from "react";

export interface TenantConfig {
  businessName: string;
  ownerName: string;
  profession: string;
  tagline: string;
  timezone: string;
  locale: string;
  logoUrl: string | null;
  colors: { primary: string; secondary: string; accent: string };
  fonts: { heading: string; body: string };
  onboardingCompleted: boolean;
}

export const DEFAULT_TENANT_CONFIG: TenantConfig = {
  businessName: "Assistente de Agenda",
  ownerName: "",
  profession: "profissional",
  tagline: "Agenda, clientes e assistente inteligente",
  timezone: "America/Sao_Paulo",
  locale: "pt-BR",
  logoUrl: null,
  colors: { primary: "#7c3aed", secondary: "#d9b268", accent: "#2f4a2b" },
  fonts: { heading: "'Playfair Display', serif", body: "'Inter', sans-serif" },
  onboardingCompleted: false,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TenantContext = createContext<TenantConfig>(DEFAULT_TENANT_CONFIG) as any;

export function useTenant(): TenantConfig {
  return useContext<TenantConfig>(TenantContext);
}
