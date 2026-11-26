// The ledger cover for sign-in and setup: brand ink blue fills the screen and
// the form sits on the first leaf.
export function AuthCover({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-brand px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-white">
          <p className="display text-[3.6rem] font-bold leading-none" style={{ fontStretch: '125%', textShadow: '0 2px 0 rgba(0,0,0,0.18)' }}>Hisab</p>
          <p className="mt-3 text-lg text-white/75">{subtitle}</p>
        </div>
        <div className="leaf leaf-margin p-6 shadow-[0_18px_40px_rgba(10,20,40,0.35)]">{children}</div>
      </div>
    </div>
  );
}
