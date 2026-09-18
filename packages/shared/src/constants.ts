// Default values — used as fallbacks when tenant config is not available.
// New code should pass tenant config explicitly instead of importing these.

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** @deprecated Use tenant config timezone instead */
export const TIMEZONE = DEFAULT_TIMEZONE;

export const BUFFER_MINUTES = 15;

export const DEFAULT_REMINDERS = [1440, 60]; // 24h e 1h antes

export const DEFAULT_BRAND = {
  name: "Assistente de Agenda",
  tagline: "Agenda, clientes e assistente inteligente",
  colors: {
    primary: "#7c3aed",
    primaryLight: "#a78bfa",
    secondary: "#c8a951",
    secondaryLight: "#E8D490",
    accent: "#6b8f5e",
    accentLight: "#A3C496",
    background: "#FBF8F3",
    backgroundDark: "#1A1612",
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

/** @deprecated Use DEFAULT_BRAND instead */
export const BRAND = DEFAULT_BRAND;

// Default color map for calendar events — keyed by arbitrary service slug.
// Tenants define their own colors via catalog_items.
export const DEFAULT_CALENDAR_COLORS: Record<string, string> = {
  "1": "#7986CB",
  "2": "#33B679",
  "3": "#8E24AA",
  "4": "#E67C73",
  "5": "#F6BF26",
  "6": "#F4511E",
  "7": "#039BE5",
  "8": "#616161",
  "9": "#3F51B5",
  "10": "#0B8043",
  "11": "#D50000",
};
