export interface CnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  atividade_principal: string;
  natureza_juridica: string;
}

export async function consultarCnpj(cnpj: string): Promise<CnpjData> {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) {
    throw new Error("CNPJ deve ter 14 dígitos");
  }

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("CNPJ não encontrado na base da Receita Federal");
    throw new Error(`Erro ao consultar CNPJ: ${res.status}`);
  }

  const data = await res.json() as Record<string, unknown>;

  const atividadePrincipal = Array.isArray(data.cnaes_secundarios)
    ? ""
    : "";
  const cnaeDesc = data.cnae_fiscal_descricao as string || "";

  return {
    cnpj: clean,
    razao_social: (data.razao_social as string) || "",
    nome_fantasia: (data.nome_fantasia as string) || "",
    situacao_cadastral: (data.descricao_situacao_cadastral as string) || "",
    logradouro: (data.logradouro as string) || "",
    numero: (data.numero as string) || "",
    complemento: (data.complemento as string) || "",
    bairro: (data.bairro as string) || "",
    municipio: (data.municipio as string) || "",
    uf: (data.uf as string) || "",
    cep: (data.cep as string) || "",
    telefone: (data.ddd_telefone_1 as string) || "",
    email: (data.email as string) || "",
    atividade_principal: cnaeDesc,
    natureza_juridica: (data.natureza_juridica as string) || "",
  };
}
