import { defineRailway, preserve, project, service } from "railway/iac";

export const partial = "api";

export default defineRailway(() => {
  const lms_api = service("lms-api", {
    preDeploy: "cd packages/lms-api && npx prisma migrate deploy",
    start: "cd packages/lms-api && node dist/server.js",
    healthcheck: "/health",
    env: {
      EMAIL_FROM: preserve(),
      HOTMART_CHECKOUT_PRO: preserve(),
      HOTMART_PRODUCT_PRO: preserve(),
      HOTMART_TOKEN: preserve(),
      JWT_ACCESS_SECRET: preserve(),
      JWT_REFRESH_SECRET: preserve(),
      LMS_DATABASE_URL: preserve(),
      LMS_PORT: preserve(),
      LMS_WEB_URL: preserve(),
      NIXPACKS_NO_DETECT: preserve(),
      NODE_ENV: preserve(),
      RAILWAY_DOCKERFILE_PATH: preserve(),
      RESEND_API_KEY: preserve(),
    },
  });

  return project("lms-lider-aurea", {
    resources: [lms_api],
  });
});
