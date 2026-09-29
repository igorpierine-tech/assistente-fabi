"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./ContratosView.module.css";
import { apiFetch } from "@/lib/api";

interface ServiceDef {
  code: string;
  name: string;
  family: string;
}

interface ContractRow {
  id: string;
  contract_number: string;
  service_code: string;
  service_name: string;
  client_name: string | null;
  status: string;
  current_revision: number;
  created_at: string;
}

interface Sale {
  id: string;
  client_name: string;
  item_name: string;
  amount_cents: number;
  client_email: string | null;
}

interface Clausula {
  id: string;
  titulo: string;
  texto: string;
}

interface ContractSnapshot {
  service_code: string;
  service_name: string;
  contract_number: string;
  contratante: {
    nome: string;
    documento: string | null;
    email: string | null;
    telefone: string | null;
    endereco: string | null;
    tipo_pessoa: string | null;
    inscricao_estadual: string | null;
  };
  financeiro: {
    valor_total_centavos: number;
    forma_pagamento: string | null;
    parcelas: number;
    resumo_pagamento: string;
  };
  clausulas_base: Clausula[];
  modulo_especifico: Clausula[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  issued: "Emitido",
  awaiting_signature: "Aguardando assinatura",
  completed: "Concluído",
  voided: "Cancelado",
  expired: "Expirado",
  superseded: "Substituído",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b6152",
  issued: "#2563eb",
  awaiting_signature: "#d97706",
  completed: "#16a34a",
  voided: "#dc2626",
  expired: "#9ca3af",
  superseded: "#9ca3af",
};

const METHOD_OPTIONS = [
  { value: "", label: "Selecione..." },
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "transferencia", label: "Transferência bancária" },
  { value: "boleto", label: "Boleto bancário" },
  { value: "outro", label: "Outro" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

async function api(path: string, opts?: RequestInit) {
  const res = await apiFetch(path, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res;
}

export function ContratosView() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [services, setServices] = useState<ServiceDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"servico" | "venda">("servico");
  const [selectedService, setSelectedService] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [creating, setCreating] = useState(false);

  const [issuingId, setIssuingId] = useState("");

  // Editor state
  const [editingContract, setEditingContract] = useState<ContractRow | null>(null);
  const [snapshot, setSnapshot] = useState<ContractSnapshot | null>(null);
  const [editContratante, setEditContratante] = useState({ nome: "", documento: "", email: "", telefone: "", endereco: "", tipo_pessoa: "PF", inscricao_estadual: "" });
  const [editFinanceiro, setEditFinanceiro] = useState({ valor: "", forma_pagamento: "", parcelas: "1" });
  const [editClausulas, setEditClausulas] = useState<Clausula[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [collapsedClauses, setCollapsedClauses] = useState<Set<number>>(new Set());
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        api("/contracts"),
        api("/contracts/services"),
      ]);
      setContracts(await cRes.json());
      setServices(await sRes.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchSales = useCallback(async () => {
    try {
      const res = await api("/sales");
      setSales(await res.json());
    } catch (_) { /* ignore */ }
  }, []);

  const openCreate = () => {
    setShowCreate(true);
    setCreateMode("servico");
    setSelectedService(services[0]?.code || "");
    setSelectedSaleId("");
    fetchSales();
  };

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const body: Record<string, unknown> = {};
      if (createMode === "venda" && selectedSaleId) {
        body.saleId = selectedSaleId;
      } else if (selectedService) {
        body.serviceCode = selectedService;
      }
      const res = await api("/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setShowCreate(false);
      await fetchAll();
      // Open editor for the new draft
      if (data.contract) {
        openEditor(data.contract);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const openEditor = async (contract: ContractRow) => {
    setEditingContract(contract);
    setLoadingEditor(true);
    setError("");
    setCollapsedClauses(new Set());
    try {
      const res = await api(`/contracts/${contract.id}`);
      const data = await res.json();
      const snap: ContractSnapshot = JSON.parse(data.revision.snapshot);
      setSnapshot(snap);

      setEditContratante({
        nome: snap.contratante.nome || "",
        documento: snap.contratante.documento || "",
        email: snap.contratante.email || "",
        telefone: snap.contratante.telefone || "",
        endereco: snap.contratante.endereco || "",
        tipo_pessoa: snap.contratante.tipo_pessoa || "PF",
        inscricao_estadual: snap.contratante.inscricao_estadual || "",
      });

      setEditFinanceiro({
        valor: snap.financeiro.valor_total_centavos > 0
          ? (snap.financeiro.valor_total_centavos / 100).toFixed(2)
          : "",
        forma_pagamento: snap.financeiro.forma_pagamento || "",
        parcelas: String(snap.financeiro.parcelas || 1),
      });

      const isAdesao = snap.service_code === "mentoria_adesao";
      const clausulas = isAdesao
        ? snap.modulo_especifico
        : [...snap.clausulas_base, ...snap.modulo_especifico];
      setEditClausulas(clausulas.map(c => ({ ...c })));
    } catch (e) {
      setError((e as Error).message);
      setEditingContract(null);
    } finally {
      setLoadingEditor(false);
    }
  };

  const handleSaveSnapshot = async () => {
    if (!editingContract || !snapshot) return;
    setSaving(true);
    setError("");
    try {
      const valorCentavos = Math.round(parseFloat(editFinanceiro.valor || "0") * 100);

      await api(`/contracts/${editingContract.id}/snapshot`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contratante: {
            nome: editContratante.nome,
            documento: editContratante.documento || null,
            email: editContratante.email || null,
            telefone: editContratante.telefone || null,
            endereco: editContratante.endereco || null,
            tipo_pessoa: editContratante.tipo_pessoa,
            inscricao_estadual: editContratante.inscricao_estadual || null,
          },
          financeiro: {
            valor_total_centavos: valorCentavos,
            forma_pagamento: editFinanceiro.forma_pagamento || null,
            parcelas: parseInt(editFinanceiro.parcelas) || 1,
          },
          clausulas: editClausulas,
        }),
      });
      await fetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleIssueFromEditor = async () => {
    if (!editingContract) return;
    await handleSaveSnapshot();
    setIssuingId(editingContract.id);
    setError("");
    try {
      await api(`/contracts/${editingContract.id}/issue`, { method: "POST" });
      await fetchAll();
      setEditingContract(null);
      setSnapshot(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIssuingId("");
    }
  };

  const handleIssue = async (id: string) => {
    setIssuingId(id);
    setError("");
    try {
      await api(`/contracts/${id}/issue`, { method: "POST" });
      await fetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIssuingId("");
    }
  };

  const handleDownload = async (id: string, contractNumber: string) => {
    try {
      const res = await apiFetch(`/contracts/${id}/pdf`);
      if (!res.ok) throw new Error("Falha ao baixar PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Contrato-${contractNumber.replace("/", "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleVoid = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar este contrato?")) return;
    setError("");
    try {
      await api(`/contracts/${id}/void`, { method: "POST" });
      await fetchAll();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const autoResizeTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);

  const toggleClause = (index: number) => {
    setCollapsedClauses(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const collapseAll = () => {
    setCollapsedClauses(new Set(editClausulas.map((_, i) => i)));
  };

  const expandAll = () => {
    setCollapsedClauses(new Set());
  };

  const updateClausula = (index: number, field: "titulo" | "texto", value: string) => {
    setEditClausulas(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    if (field === "texto") {
      const el = textareaRefs.current.get(index);
      if (el) requestAnimationFrame(() => autoResizeTextarea(el));
    }
  };

  if (loading) return <div className={styles.container}><p>Carregando...</p></div>;

  // --- Editor view ---
  if (editingContract && snapshot) {
    const isAdesao = snapshot.service_code === "mentoria_adesao";
    const tituloContrato = isAdesao ? "CONTRATO DE ADESÃO" : "CONTRATO DE PRESTAÇÃO DE SERVIÇOS";
    const isDraft = editingContract.status === "draft";

    return (
      <div className={styles.container}>
        <div className={styles.editorHeader}>
          <button className={styles.backBtn} onClick={() => { setEditingContract(null); setSnapshot(null); }}>
            ← Voltar
          </button>
          <div>
            <h2 className={styles.title}>{tituloContrato}</h2>
            <p className={styles.subtitle}>
              Nº {snapshot.contract_number} — {snapshot.service_name}
              <span
                className={styles.statusBadge}
                style={{ color: STATUS_COLORS[editingContract.status] || "#6b6152", borderColor: STATUS_COLORS[editingContract.status] || "#6b6152", marginLeft: 12 }}
              >
                {STATUS_LABELS[editingContract.status] || editingContract.status}
              </span>
            </p>
          </div>
          {isDraft && (
            <div className={styles.editorActions}>
              <button className={styles.btnSecondary} onClick={handleSaveSnapshot} disabled={saving}>
                {saving ? "Salvando..." : "Salvar rascunho"}
              </button>
              <button
                className={styles.iconOnly}
                onClick={() => handleDownload(editingContract.id, editingContract.contract_number)}
                title="Visualizar PDF"
              >
                PDF
              </button>
              <button
                className={styles.issueBtn}
                onClick={handleIssueFromEditor}
                disabled={issuingId === editingContract.id}
              >
                {issuingId === editingContract.id ? "Emitindo..." : "Emitir contrato"}
              </button>
            </div>
          )}
        </div>

        {error && <div className={styles.errorBanner}>{error}<button onClick={() => setError("")}>×</button></div>}

        {loadingEditor ? (
          <p>Carregando contrato...</p>
        ) : (
          <div className={styles.editorBody}>
            {/* Dados do contratante */}
            <section className={styles.editorSection}>
              <h3 className={styles.sectionTitle}>Dados do Contratante</h3>
              <div className={styles.editorGrid}>
                <div className={styles.field}>
                  <label>Nome / Razão Social</label>
                  <input
                    type="text"
                    value={editContratante.nome}
                    onChange={e => setEditContratante(p => ({ ...p, nome: e.target.value }))}
                    disabled={!isDraft}
                    placeholder="Nome completo ou razão social"
                  />
                </div>
                <div className={styles.field}>
                  <label>Tipo de pessoa</label>
                  <select
                    value={editContratante.tipo_pessoa}
                    onChange={e => setEditContratante(p => ({ ...p, tipo_pessoa: e.target.value }))}
                    disabled={!isDraft}
                  >
                    <option value="PF">Pessoa Física</option>
                    <option value="PJ">Pessoa Jurídica</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>{editContratante.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"}</label>
                  <input
                    type="text"
                    value={editContratante.documento}
                    onChange={e => setEditContratante(p => ({ ...p, documento: e.target.value }))}
                    disabled={!isDraft}
                    placeholder={editContratante.tipo_pessoa === "PJ" ? "00.000.000/0001-00" : "000.000.000-00"}
                  />
                </div>
                {editContratante.tipo_pessoa === "PJ" && (
                  <div className={styles.field}>
                    <label>Inscrição Estadual</label>
                    <input
                      type="text"
                      value={editContratante.inscricao_estadual}
                      onChange={e => setEditContratante(p => ({ ...p, inscricao_estadual: e.target.value }))}
                      disabled={!isDraft}
                    />
                  </div>
                )}
                <div className={styles.field}>
                  <label>E-mail</label>
                  <input
                    type="email"
                    value={editContratante.email}
                    onChange={e => setEditContratante(p => ({ ...p, email: e.target.value }))}
                    disabled={!isDraft}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className={styles.field}>
                  <label>Telefone</label>
                  <input
                    type="text"
                    value={editContratante.telefone}
                    onChange={e => setEditContratante(p => ({ ...p, telefone: e.target.value }))}
                    disabled={!isDraft}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label>Endereço</label>
                  <input
                    type="text"
                    value={editContratante.endereco}
                    onChange={e => setEditContratante(p => ({ ...p, endereco: e.target.value }))}
                    disabled={!isDraft}
                    placeholder="Rua, número, bairro, cidade/UF"
                  />
                </div>
              </div>
            </section>

            {/* Dados financeiros */}
            <section className={styles.editorSection}>
              <h3 className={styles.sectionTitle}>Dados Financeiros</h3>
              <div className={styles.editorGrid}>
                <div className={styles.field}>
                  <label>Valor total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFinanceiro.valor}
                    onChange={e => setEditFinanceiro(p => ({ ...p, valor: e.target.value }))}
                    disabled={!isDraft}
                    placeholder="0,00"
                  />
                </div>
                <div className={styles.field}>
                  <label>Forma de pagamento</label>
                  <select
                    value={editFinanceiro.forma_pagamento}
                    onChange={e => setEditFinanceiro(p => ({ ...p, forma_pagamento: e.target.value }))}
                    disabled={!isDraft}
                  >
                    {METHOD_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Parcelas</label>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    value={editFinanceiro.parcelas}
                    onChange={e => setEditFinanceiro(p => ({ ...p, parcelas: e.target.value }))}
                    disabled={!isDraft}
                  />
                </div>
              </div>
            </section>

            {/* Cláusulas */}
            <section className={styles.editorSection}>
              <div className={styles.clausulasHeader}>
                <h3 className={styles.sectionTitle} style={{ margin: 0, border: "none", paddingBottom: 0 }}>
                  Cláusulas do Contrato ({editClausulas.length})
                </h3>
                <div className={styles.clausulasToggle}>
                  <button type="button" className={styles.toggleAllBtn} onClick={expandAll}>Expandir todas</button>
                  <button type="button" className={styles.toggleAllBtn} onClick={collapseAll}>Recolher todas</button>
                </div>
              </div>
              {editClausulas.map((c, i) => {
                const isCollapsed = collapsedClauses.has(i);
                return (
                  <div key={c.id} className={styles.clausulaCard}>
                    <div
                      className={styles.clausulaCardHeader}
                      onClick={() => toggleClause(i)}
                    >
                      <span className={styles.clausulaToggleIcon}>{isCollapsed ? "▶" : "▼"}</span>
                      <span className={styles.clausulaHeaderTitle}>{c.titulo || `Cláusula ${i + 1}`}</span>
                    </div>
                    {!isCollapsed && (
                      <div className={styles.clausulaCardBody}>
                        <input
                          className={styles.clausulaTitulo}
                          value={c.titulo}
                          onChange={e => updateClausula(i, "titulo", e.target.value)}
                          disabled={!isDraft}
                        />
                        <textarea
                          className={styles.clausulaTexto}
                          ref={el => {
                            if (el) {
                              textareaRefs.current.set(i, el);
                              autoResizeTextarea(el);
                            }
                          }}
                          value={c.texto}
                          onChange={e => updateClausula(i, "texto", e.target.value)}
                          disabled={!isDraft}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            {isDraft && (
              <div className={styles.editorFooter}>
                <button className={styles.btnSecondary} onClick={handleSaveSnapshot} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar rascunho"}
                </button>
                <button
                  className={styles.btnPrimary}
                  onClick={handleIssueFromEditor}
                  disabled={issuingId === editingContract.id}
                >
                  {issuingId === editingContract.id ? "Emitindo..." : "Emitir contrato"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- List view ---
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Contratos</h2>
          <p className={styles.subtitle}>
            Motor de contratos com {services.length} tipos de serviço
          </p>
        </div>
        <button className={styles.addBtn} onClick={openCreate}>+ Novo Contrato</button>
      </div>

      {error && <div className={styles.errorBanner}>{error}<button onClick={() => setError("")}>×</button></div>}

      {contracts.length === 0 ? (
        <div className={styles.empty}>
          Nenhum contrato criado ainda. Clique em &quot;+ Novo Contrato&quot; para começar.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Serviço</th>
                <th>Cliente</th>
                <th>Status</th>
                <th>Rev.</th>
                <th>Data</th>
                <th style={{ textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c.id} style={{ cursor: c.status === "draft" ? "pointer" : undefined }} onClick={() => { if (c.status === "draft") openEditor(c); }}>
                  <td className={styles.numberCol}>{c.contract_number}</td>
                  <td>{c.service_name || c.service_code}</td>
                  <td className={styles.clientCol}>{c.client_name || "—"}</td>
                  <td>
                    <span
                      className={styles.statusBadge}
                      style={{ color: STATUS_COLORS[c.status] || "#6b6152", borderColor: STATUS_COLORS[c.status] || "#6b6152" }}
                    >
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>{c.current_revision}</td>
                  <td>{formatDate(c.created_at)}</td>
                  <td>
                    <div className={styles.actions} onClick={e => e.stopPropagation()}>
                      {c.status === "draft" && (
                        <button
                          className={styles.iconOnly}
                          onClick={() => openEditor(c)}
                          title="Editar minuta"
                        >
                          Editar
                        </button>
                      )}
                      <button
                        className={styles.iconOnly}
                        onClick={() => handleDownload(c.id, c.contract_number)}
                        title="Baixar PDF"
                      >
                        PDF
                      </button>
                      {c.status === "draft" && (
                        <button
                          className={styles.issueBtn}
                          onClick={() => handleIssue(c.id)}
                          disabled={issuingId === c.id}
                        >
                          {issuingId === c.id ? "Emitindo..." : "Emitir"}
                        </button>
                      )}
                      {c.status !== "voided" && c.status !== "completed" && (
                        <button
                          className={`${styles.iconOnly} ${styles.iconBtnDanger}`}
                          onClick={() => handleVoid(c.id)}
                          title="Cancelar contrato"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className={styles.overlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Novo Contrato</h3>

            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeBtn} ${createMode === "servico" ? styles.modeBtnActive : ""}`}
                onClick={() => setCreateMode("servico")}
              >
                Por serviço
              </button>
              <button
                className={`${styles.modeBtn} ${createMode === "venda" ? styles.modeBtnActive : ""}`}
                onClick={() => setCreateMode("venda")}
              >
                A partir de venda
              </button>
            </div>

            <div className={styles.formGrid}>
              {createMode === "servico" ? (
                <div className={styles.field}>
                  <label>Tipo de serviço</label>
                  <select
                    value={selectedService}
                    onChange={e => setSelectedService(e.target.value)}
                  >
                    {services.map(s => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className={styles.field}>
                  <label>Venda</label>
                  <select
                    value={selectedSaleId}
                    onChange={e => setSelectedSaleId(e.target.value)}
                  >
                    <option value="">Selecione uma venda...</option>
                    {sales.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.client_name} — {s.item_name} ({(s.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setShowCreate(false)}>Cancelar</button>
              <button
                className={styles.btnPrimary}
                onClick={handleCreate}
                disabled={creating || (createMode === "venda" && !selectedSaleId) || (createMode === "servico" && !selectedService)}
              >
                {creating ? "Criando..." : "Criar contrato"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
