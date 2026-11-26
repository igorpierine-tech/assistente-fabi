import "dotenv/config";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Variável de ambiente ${key} não configurada.`);
  return value;
}

export const env = {
  port: parseInt(process.env.LMS_PORT || "3002", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: requireEnv("LMS_DATABASE_URL"),
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: requireEnv("JWT_REFRESH_SECRET"),
  jwtAccessExpiresIn: "15m",
  jwtRefreshExpiresIn: "7d",
  webUrl: process.env.LMS_WEB_URL || "http://localhost:3003",
  bcryptRounds: 12,
  maxLoginAttempts: 5,
  lockoutDurationMs: 15 * 60 * 1000,
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "Líder Áurea <noreply@lideraurea.com.br>",
} as const;
