"use client";

import Image from "next/image";

interface LogoProps {
  size?: number;
}

export function LogoIcon({ size = 36 }: LogoProps) {
  return (
    <Image
      src="/logo-icon.png"
      alt="Raízes e Riquezas"
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
      priority
    />
  );
}

export function LogoFull({ size = 80 }: LogoProps) {
  return (
    <Image
      src="/logo-full.png"
      alt="Raízes e Riquezas"
      width={size}
      height={Math.round(size * 1.4)}
      style={{ objectFit: "contain" }}
      priority
    />
  );
}
