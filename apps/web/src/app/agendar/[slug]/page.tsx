import type { Metadata } from "next";
import { BookingPage } from "./BookingPage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "Agendar — Raízes e Riquezas",
    description: `Agende sua sessão · ${slug}`,
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  return <BookingPage slug={slug} />;
}
