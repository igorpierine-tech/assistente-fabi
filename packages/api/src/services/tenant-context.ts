import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantCtx {
  tenantId: string;
  tenantSlug: string;
}

export const tenantContext = new AsyncLocalStorage<TenantCtx>();

export function getCurrentTenant(): TenantCtx | undefined {
  return tenantContext.getStore();
}

export function requireCurrentTenant(): TenantCtx {
  const ctx = tenantContext.getStore();
  if (!ctx) throw new Error("Nenhum tenant ativo no contexto da requisição");
  return ctx;
}
