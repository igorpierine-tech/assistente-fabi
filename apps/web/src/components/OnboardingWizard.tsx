"use client";

import { useState } from "react";
import styles from "./OnboardingWizard.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (SP, RJ, MG, ES, BA...)" },
  { value: "America/Cuiaba", label: "Cuiabá (MT, MS)" },
  { value: "America/Manaus", label: "Manaus (AM, RR, RO, AP)" },
  { value: "America/Belem", label: "Belém (PA, MA, TO)" },
  { value: "America/Recife", label: "Recife (PE, AL, SE, PB, RN, CE, PI)" },
  { value: "America/Fortaleza", label: "Fortaleza (CE)" },
  { value: "America/Bahia", label: "Salvador (BA)" },
  { value: "America/Araguaina", label: "Palmas (TO)" },
  { value: "America/Rio_Branco", label: "Rio Branco (AC)" },
  { value: "America/Noronha", label: "Fernando de Noronha" },
  { value: "America/Porto_Velho", label: "Porto Velho (RO)" },
  { value: "America/Boa_Vista", label: "Boa Vista (RR)" },
  { value: "America/Campo_Grande", label: "Campo Grande (MS)" },
  { value: "America/Eirunepe", label: "Eirunepé (AM)" },
  { value: "America/Maceio", label: "Maceió (AL)" },
  { value: "America/Santarem", label: "Santarém (PA)" },
];

interface OnboardingWizardProps {
  userName: string;
  onComplete: () => void;
}

export function OnboardingWizard({ userName, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState(userName || "");
  const [profession, setProfession] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleFinish() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/tenant/config`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          ownerName: ownerName.trim(),
          profession: profession.trim(),
          timezone,
          onboardingCompleted: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erro ao salvar configuração.");
        setSaving(false);
        return;
      }
      onComplete();
    } catch {
      setError("Erro de rede. Tente novamente.");
      setSaving(false);
    }
  }

  const canAdvanceStep0 = businessName.trim().length >= 2 && ownerName.trim().length >= 2;
  const canAdvanceStep1 = profession.trim().length >= 2;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.progress}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${styles.dot} ${i <= step ? styles.dotActive : ""}`} />
          ))}
        </div>

        {step === 0 && (
          <>
            <h1 className={styles.title}>Vamos configurar seu assistente</h1>
            <p className={styles.desc}>
              Conte-nos sobre o seu negócio para personalizar sua experiência.
            </p>

            <label className={styles.label}>
              Nome do negócio
              <input
                className={styles.input}
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ex: Studio Maria, Clínica Bem Estar..."
                maxLength={100}
                autoFocus
              />
            </label>

            <label className={styles.label}>
              Seu nome
              <input
                className={styles.input}
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Ex: Maria Silva"
                maxLength={100}
              />
            </label>

            <button
              className={styles.primaryBtn}
              disabled={!canAdvanceStep0}
              onClick={() => setStep(1)}
              type="button"
            >
              Continuar
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className={styles.title}>Sua área de atuação</h1>
            <p className={styles.desc}>
              Isso ajuda o assistente de IA a se comunicar de forma adequada com seus clientes.
            </p>

            <label className={styles.label}>
              Profissão ou área
              <input
                className={styles.input}
                type="text"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="Ex: Terapeuta, Nutricionista, Advogada..."
                maxLength={100}
                autoFocus
              />
            </label>

            <label className={styles.label}>
              Fuso horário
              <select
                className={styles.input}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.actions}>
              <button
                className={styles.secondaryBtn}
                onClick={() => setStep(0)}
                type="button"
              >
                Voltar
              </button>
              <button
                className={styles.primaryBtn}
                disabled={!canAdvanceStep1}
                onClick={() => setStep(2)}
                type="button"
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className={styles.title}>Tudo pronto!</h1>
            <p className={styles.desc}>
              Confira seus dados e comece a usar seu assistente.
            </p>

            <div className={styles.summary}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Negócio</span>
                <span className={styles.summaryValue}>{businessName}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Profissional</span>
                <span className={styles.summaryValue}>{ownerName}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Área</span>
                <span className={styles.summaryValue}>{profession}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Fuso horário</span>
                <span className={styles.summaryValue}>
                  {TIMEZONES.find((tz) => tz.value === timezone)?.label || timezone}
                </span>
              </div>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button
                className={styles.secondaryBtn}
                onClick={() => setStep(1)}
                type="button"
                disabled={saving}
              >
                Voltar
              </button>
              <button
                className={styles.primaryBtn}
                onClick={handleFinish}
                disabled={saving}
                type="button"
              >
                {saving ? "Salvando..." : "Começar a usar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
