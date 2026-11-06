"use client";

import styles from "./TenantSelector.module.css";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  role: string;
}

interface TenantSelectorProps {
  userName: string;
  tenants: Tenant[];
  onSelect: (tenantSlug: string) => void;
  loading?: boolean;
}

export function TenantSelector({ userName, tenants, onSelect, loading }: TenantSelectorProps) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          Olá, <em>{userName.split(" ")[0]}</em>
        </h1>
        <p className={styles.desc}>Selecione a empresa que deseja acessar</p>

        <div className={styles.list}>
          {tenants.map((t) => (
            <button
              key={t.id}
              className={styles.tenantBtn}
              onClick={() => onSelect(t.slug)}
              disabled={loading}
            >
              <div className={styles.tenantIcon}>
                {t.name.charAt(0).toUpperCase()}
              </div>
              <div className={styles.tenantInfo}>
                <span className={styles.tenantName}>{t.name}</span>
                <span className={styles.tenantRole}>{t.role}</span>
              </div>
              <svg className={styles.arrow} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="8 5 13 10 8 15" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
