export function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new ValidationError(`${field} deve ser texto`);
  const normalized = value.trim();
  if (normalized.length > max) throw new ValidationError(`${field} excede ${max} caracteres`);
  return normalized;
}

export function requiredString(value: unknown, field: string, max: number): string {
  const normalized = optionalString(value, field, max);
  if (!normalized) throw new ValidationError(`${field} é obrigatório`);
  return normalized;
}

export function optionalEmail(value: unknown): string | undefined {
  const email = optionalString(value, "E-mail", 254)?.toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("E-mail inválido");
  }
  return email;
}

export function requiredIsoDate(value: unknown, field: string): string {
  const date = requiredString(value, field, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(date) || Number.isNaN(Date.parse(date))) {
    throw new ValidationError(`${field} deve ser uma data ISO válida`);
  }
  return date;
}

export function optionalId(value: unknown, field = "ID"): string | undefined {
  const id = optionalString(value, field, 128);
  if (id && !/^[a-zA-Z0-9_-]+$/.test(id)) throw new ValidationError(`${field} inválido`);
  return id;
}

export class ValidationError extends Error {}
