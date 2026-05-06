// Lightweight sparkline that takes a static data array.
// (For live ELO history, use the existing EloSparkline that fetches.)

export default function Sparkline({
  data,
  w = 120,
  h = 32,
  stroke = 'var(--good)',
  strokeWidth = 1.5,
  fill = null,
  className = '',
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const pts = data
    .map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ');
  const lastUp = data[data.length - 1] >= data[0];
  const c = stroke === 'auto' ? (lastUp ? 'var(--good)' : 'var(--bad)') : stroke;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: 'block' }}
      className={className}
    >
      {fill && <polygon points={`0,${h} ${pts} ${w},${h}`} fill={fill} opacity="0.18" />}
      <polyline
        points={pts}
        fill="none"
        stroke={c}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// A larger ELO line chart with axis ticks (for dashboard / profile)
export function EloChartStatic({ data, w = 720, h = 240, className = '' }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data) - 10;
  const max = Math.max(...data) + 10;
  const range = max - min || 1;
  const px = 40;
  const py = 20;
  const innerW = w - px * 2;
  const innerH = h - py * 2;
  const stepX = innerW / (data.length - 1);
  const pts = data.map((v, i) => [px + i * stepX, py + innerH - ((v - min) / range) * innerH]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L${pts[pts.length - 1][0]},${py + innerH} L${pts[0][0]},${py + innerH} Z`;
  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round(min + (range * i) / ticks));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }} className={className}>
      <defs>
        <linearGradient id="eloG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {tickVals.map((v, i) => {
        const y = py + innerH - (i / ticks) * innerH;
        return (
          <g key={i}>
            <line x1={px} y1={y} x2={px + innerW} y2={y} stroke="var(--line-soft)" strokeWidth="1" />
            <text
              x={px - 8}
              y={y + 3}
              fill="var(--fg-3)"
              fontFamily="JetBrains Mono, monospace"
              fontSize="10"
              letterSpacing="0.05em"
              textAnchor="end"
            >
              {v}
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#eloG)" />
      <path d={path} stroke="var(--accent)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.length > 0 && (
        <>
          <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="var(--accent)" />
          <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="10" fill="var(--accent)" opacity="0.18" />
        </>
      )}
    </svg>
  );
}
