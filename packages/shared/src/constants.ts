import type { AppointmentType } from "./types";

export const TIMEZONE = "America/Cuiaba";

export const APPOINTMENT_DURATIONS: Record<AppointmentType, number> = {
  constelacao: 90,
  consultoria_financeira: 60,
  planejamento: 60,
  reuniao: 30,
  bloqueio_pessoal: 0,
  evento_curso: 120,
  outro: 60,
};

export const BUFFER_MINUTES = 15;

export const DEFAULT_REMINDERS = [1440, 60]; // 24h e 1h antes

export const CALENDAR_COLORS: Record<AppointmentType, string> = {
  constelacao: "#8B5E3C",
  consultoria_financeira: "#C8A951",
  planejamento: "#6B8F5E",
  reuniao: "#5E7E8B",
  bloqueio_pessoal: "#9E9E9E",
  evento_curso: "#8B6B5E",
  outro: "#7E7E7E",
};

export const APPOINTMENT_LABELS: Record<AppointmentType, string> = {
  constelacao: "Constelação",
  consultoria_financeira: "Consultoria Financeira",
  planejamento: "Planejamento",
  reuniao: "Reunião",
  bloqueio_pessoal: "Bloqueio Pessoal",
  evento_curso: "Evento / Curso",
  outro: "Outro",
};

export const BRAND = {
  name: "Raízes e Riquezas",
  tagline: "Assistente da Fabi",
  colors: {
    primary: "#5E4B37",       // Marrom raiz — cor principal
    primaryLight: "#8B7355",  // Marrom claro
    secondary: "#C8A951",     // Dourado — riqueza
    secondaryLight: "#E8D490",// Dourado claro
    accent: "#6B8F5E",        // Verde folha — natureza
    accentLight: "#A3C496",   // Verde claro
    background: "#FBF8F3",    // Off-white quente
    backgroundDark: "#1A1612",// Fundo escuro
    surface: "#FFFFFF",
    surfaceDark: "#2A2420",
    text: "#2C2418",
    textLight: "#F5F0E8",
    textMuted: "#8B8078",
    border: "#E8E0D4",
    borderDark: "#3A3430",
    error: "#C75050",
    success: "#5E8B5E",
    warning: "#C8A951",
  },
  fonts: {
    heading: "'Playfair Display', serif",
    body: "'Inter', sans-serif",
  },
} as const;
