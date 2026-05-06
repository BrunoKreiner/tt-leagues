// Abstract paddle + ball + trajectory motif. Floats freely — no surrounding card.

export default function HeroMotif() {
  return (
    <div
      className="relative w-full"
      style={{ aspectRatio: '4 / 3' }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 400 300"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="paddleG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.30 0.01 50)" />
            <stop offset="100%" stopColor="oklch(0.20 0.005 50)" />
          </linearGradient>
        </defs>
        {/* paddle face */}
        <circle cx="160" cy="150" r="100" fill="url(#paddleG)" stroke="var(--line)" />
        {/* handle */}
        <rect
          x="220"
          y="170"
          width="120"
          height="22"
          rx="6"
          transform="rotate(20 220 170)"
          fill="oklch(0.25 0.008 50)"
          stroke="var(--line)"
        />
        {/* dotted rubber */}
        {Array.from({ length: 10 }).map((_, r) =>
          Array.from({ length: 10 }).map((_, c) => {
            const cx = 110 + c * 10;
            const cy = 100 + r * 10;
            const d = Math.hypot(cx - 160, cy - 150);
            if (d > 88) return null;
            return <circle key={`${r}-${c}`} cx={cx} cy={cy} r="1.2" fill="oklch(0.40 0.008 50)" />;
          })
        )}
        {/* ball — animated float */}
        <circle cx="310" cy="80" r="22" fill="var(--accent)" className="tt-float" />
        <circle
          cx="310"
          cy="80"
          r="22"
          fill="none"
          stroke="oklch(0.85 0.10 40)"
          strokeWidth="0.5"
          opacity="0.4"
          className="tt-float"
        />
        {/* trajectory arc */}
        <path
          d="M 60 240 Q 200 30 310 80"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeDasharray="2 6"
          opacity="0.6"
        />
      </svg>
    </div>
  );
}
