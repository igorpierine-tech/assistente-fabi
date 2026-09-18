"use client";

import Image from "next/image";
import { useTenant } from "@/lib/tenant-context";

interface LogoProps {
  size?: number;
}

export function LogoIcon({ size = 36 }: LogoProps) {
  const tenant = useTenant();
  return (
    <Image
      src="/logo-icon.png"
      alt={tenant.businessName}
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
      priority
    />
  );
}

export function LogoFull({ size = 80 }: LogoProps) {
  const tenant = useTenant();
  return (
    <Image
      src="/logo-full.png"
      alt={tenant.businessName}
      width={size}
      height={Math.round(size * 1.4)}
      style={{ objectFit: "contain" }}
      priority
    />
  );
}
