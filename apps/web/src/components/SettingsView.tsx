"use client";

import { useState } from "react";
import { BookingSettingsPanel } from "./BookingSettingsPanel";
import { GoogleCalendarSettings } from "./GoogleCalendarSettings";
import { NfseSettings } from "./NfseSettings";
import styles from "./SettingsView.module.css";

type Section = "booking" | "calendar" | "nfse";

export function SettingsView() {
  const [section, setSection] = useState<Section>("booking");

  return (
    <div className={styles.wrap}>
      <nav className={styles.tabs}>
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
        {section === "booking" && <BookingSettingsPanel />}
        {section === "calendar" && <GoogleCalendarSettings />}
        {section === "nfse" && <NfseSettings />}
      </div>
    </div>
  );
}
