/** Logo Niagaaja: ikon gelombang-N + wordmark. Vektor, jadi tajam di semua ukuran. */
export function Logo({ height = 36, white = false, className = "" }: { height?: number; white?: boolean; className?: string }) {
  const navy = white ? "#ffffff" : "#10365C";
  const blue = white ? "#ffffff" : "#2A7DC1";
  const w = Math.round(height * 3.6);
  return (
    <svg width={w} height={height} viewBox="0 0 360 100" role="img" aria-label="Niagaaja" className={className}>
      <path d="M16 84 C16 40 50 40 66 60 C82 80 114 80 114 38" fill="none" stroke={blue} strokeWidth="19" strokeLinecap="round" />
      <circle cx="138" cy="30" r="11" fill={navy} />
      <text x="158" y="72" fontFamily="var(--font-poppins), Poppins, system-ui, sans-serif" fontSize="56" fontWeight="800" fill={navy} letterSpacing="-1">niaga<tspan fill={blue}>aja</tspan></text>
    </svg>
  );
}
