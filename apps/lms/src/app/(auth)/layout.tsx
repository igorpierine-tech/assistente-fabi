export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-green-dark relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-green-dark via-green-mid to-green-dark opacity-90" />
        <div className="relative z-10 max-w-md px-12 text-center">
          <div className="mb-8">
            <span className="text-gold font-serif text-5xl font-bold italic">Líder</span>
            <span className="text-gold-light font-serif text-5xl font-light ml-2">Áurea</span>
          </div>
          <p className="text-gold/70 text-lg leading-relaxed font-light">
            Plataforma de Formação Executiva
          </p>
          <div className="mt-10 flex items-center justify-center gap-2">
            <div className="h-px w-10 bg-gold/30" />
            <span className="text-gold/50 text-xs uppercase tracking-[0.3em] font-medium">
              Raízes e Riquezas
            </span>
            <div className="h-px w-10 bg-gold/30" />
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
