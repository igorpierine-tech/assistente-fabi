"use client";

import { useState } from "react";
import { CatalogPanel } from "./CatalogPanel";
import { BookingSettingsPanel } from "./BookingSettingsPanel";
import { GoogleCalendarSettings } from "./GoogleCalendarSettings";
import { NfseSettings } from "./NfseSettings";
import { EmpresaSettings } from "./EmpresaSettings";
import styles from "./SettingsView.module.css";

type Section = "empresa" | "catalog" | "booking" | "calendar" | "nfse";

export function SettingsView() {
  const [section, setSection] = useState<Section>("empresa");

  return (
    <div className={styles.wrap}>
      <nav className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${section === "empresa" ? styles.tabActive : ""}`}
          onClick={() => setSection("empresa")}
        >
          Empresa
        </button>
        <button
          type="button"
          className={`${styles.tab} ${section === "catalog" ? styles.tabActive : ""}`}
          onClick={() => setSection("catalog")}
        >
          Produtos e serviços
        </button>
        <button
          type="button"
          className={`${styles.tab} ${section === "booking" ? styles.tabActive : ""}`}
          onClick={() => setSection("booking")}
        >
          Página de agendamento
        </button>
        <button
          type="button"
          className={`${styles.tab} ${section === "calendar" ? styles.tabActive : ""}`}
          onClick={() => setSection("calendar")}
        >
          Google Calendar
        </button>
        <button
          type="button"
          className={`${styles.tab} ${section === "nfse" ? styles.tabActive : ""}`}
          onClick={() => setSection("nfse")}
        >
          NFS-e
        </button>
      </nav>

      <div className={styles.content}>
        {section === "empresa" && <EmpresaSettings />}
        {section === "catalog" && <CatalogPanel />}
        {section === "booking" && <BookingSettingsPanel />}
        {section === "calendar" && <GoogleCalendarSettings />}
        {section === "nfse" && <NfseSettings />}
      </div>
    </div>
  );
}
