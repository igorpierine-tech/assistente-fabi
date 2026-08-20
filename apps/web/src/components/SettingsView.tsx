"use client";

import { useState } from "react";
import { CatalogPanel } from "./CatalogPanel";
import { BookingSettingsPanel } from "./BookingSettingsPanel";
import styles from "./SettingsView.module.css";

type Section = "catalog" | "booking";

export function SettingsView() {
  const [section, setSection] = useState<Section>("catalog");

  return (
    <div className={styles.wrap}>
      <nav className={styles.tabs}>
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
      </nav>

      <div className={styles.content}>
        {section === "catalog" ? <CatalogPanel /> : <BookingSettingsPanel />}
      </div>
    </div>
  );
}
