export const EVENT_TYPE_LABELS: Record<string, string> = {
  constelacao: "Constelacao",
  consultoria_financeira: "Consultoria Financeira",
  planejamento: "Planejamento",
  reuniao: "Reuniao",
  bloqueio_pessoal: "Bloqueio Pessoal",
  evento_curso: "Evento / Curso",
  mentoria_individual: "Mentoria Individual",
  mentoria_grupo: "Mentoria em Grupo",
  mentoria_adesao: "Mentoria Adesao",
  empresa_diagnostico_inicial: "Diagnostico Empresarial",
  equipes_diagnostico_inicial: "Diagnostico de Equipes",
  diagnostico_financeiro: "Diagnostico Financeiro",
  diagnostico_empresarial: "Diagnostico Empresarial",
  lider_aurea: "Lider Aurea",
  outro: "Outro",
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  constelacao: "#b8873a",
  consultoria_financeira: "#0e8a7d",
  planejamento: "#2f6b3a",
  reuniao: "#3b6fa0",
  bloqueio_pessoal: "#8a8a8a",
  evento_curso: "#7b4ea3",
  mentoria_individual: "#c06040",
  mentoria_grupo: "#a34271",
  mentoria_adesao: "#d45d79",
  empresa_diagnostico_inicial: "#d4852f",
  equipes_diagnostico_inicial: "#6b8c42",
  diagnostico_financeiro: "#4a5aad",
  diagnostico_empresarial: "#d4852f",
  lider_aurea: "#b55090",
  outro: "#777",
};

export const EVENT_TYPE_CALENDAR_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  constelacao: { bg: "#FFF3E0", border: "#b8873a", text: "#7c5e2c" },
  consultoria_financeira: { bg: "#E0F2F1", border: "#0e8a7d", text: "#065f56" },
  planejamento: { bg: "#E8F5E9", border: "#2f6b3a", text: "#1b4d25" },
  reuniao: { bg: "#E3F2FD", border: "#3b6fa0", text: "#1a4a73" },
  bloqueio_pessoal: { bg: "#F5F5F5", border: "#8a8a8a", text: "#555" },
  evento_curso: { bg: "#F3E5F5", border: "#7b4ea3", text: "#4a2070" },
  mentoria_individual: { bg: "#FBE9E7", border: "#c06040", text: "#8c3520" },
  mentoria_grupo: { bg: "#FCE4EC", border: "#a34271", text: "#6d1d45" },
  mentoria_adesao: { bg: "#FCE4EC", border: "#d45d79", text: "#8c2040" },
  empresa_diagnostico_inicial: { bg: "#FFF3E0", border: "#d4852f", text: "#8c5510" },
  equipes_diagnostico_inicial: { bg: "#F1F8E9", border: "#6b8c42", text: "#3d5c20" },
  diagnostico_financeiro: { bg: "#E8EAF6", border: "#4a5aad", text: "#2a357a" },
  diagnostico_empresarial: { bg: "#FFF3E0", border: "#d4852f", text: "#8c5510" },
  lider_aurea: { bg: "#F8E0EE", border: "#b55090", text: "#7a2060" },
  outro: { bg: "#FAFAFA", border: "#999", text: "#555" },
};

export function getEventTypeLabel(type: string): string {
  if (EVENT_TYPE_LABELS[type]) return EVENT_TYPE_LABELS[type];
  return type
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getEventTypeColor(type: string): string {
  return EVENT_TYPE_COLORS[type] || "#777";
}

export function getEventTypeCalendarColors(type: string): { bg: string; border: string; text: string } {
  return EVENT_TYPE_CALENDAR_COLORS[type] || { bg: "#FAFAFA", border: "#999", text: "#555" };
}
