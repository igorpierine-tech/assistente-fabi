"use client";

import { useState } from "react";
import { CatalogPanel } from "./CatalogPanel";
import { BookingSettingsPanel } from "./BookingSettingsPanel";
import { GoogleCalendarSettings } from "./GoogleCalendarSettings";
import styles from "./SettingsView.module.css";

type Section = "catalog" | "booking" | "calendar";

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
        <button
          type="button"
          className={`${styles.tab} ${section === "calendar" ? styles.tabActive : ""}`}
          onClick={() => setSection("calendar")}
        >
          Google Calendar
        </button>
      </nav>

      <div className={styles.content}>
        {section === "catalog" && <CatalogPanel />}
        {section === "booking" && <BookingSettingsPanel />}
        {section === "calendar" && <GoogleCalendarSettings />}
      </div>
    </div>
  );
}
