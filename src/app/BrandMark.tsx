/** Uygulama ikonundaki "V" (asagi ok) rozeti + uygulama adi. */
export default function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="grid place-items-center size-8 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-content shadow-sm">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 4 L12 14 L19 4" />
          <path d="M6 20 H18" />
        </svg>
      </span>
      <span className="font-semibold tracking-tight leading-none">Vidra</span>
    </div>
  );
}
