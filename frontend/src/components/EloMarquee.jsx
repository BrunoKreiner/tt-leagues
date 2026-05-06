import { useMemo } from 'react';

// Gentle, seedable random walk — smaller step → softer wave.
function generateRandomWalk({ count = 400, start = 1500, step = 4, min = 1380, max = 1620, seed = 42 }) {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const points = [];
  let v = start;
  for (let i = 0; i < count; i++) {
    const delta = (rand() - 0.5) * 2 * step;
    v = Math.max(min, Math.min(max, v + delta));
    points.push(v);
  }
  // Smoothly tail off to the start value over the last 8% so the marquee tile loop is seamless.
  const tail = Math.max(8, Math.floor(count * 0.08));
  for (let i = 0; i < tail; i++) {
    const t = i / tail;
    const idx = count - tail + i;
    points[idx] = points[idx] * (1 - t) + points[0] * t;
  }
  points[points.length - 1] = points[0];
  return points;
}

// Smooth a polyline into a Bezier path via midpoint quadratic curves.
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i][0] + pts[i + 1][0]) / 2;
    const yc = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${xc.toFixed(1)},${yc.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last[0].toFixed(1)},${last[1].toFixed(1)}`;
  return d;
}

export default function EloMarquee({
  height = 64,
  count = 400,
  pixelsPerPoint = 7,
  duration = 90,
  seed = 42,
}) {
  const data = useMemo(() => generateRandomWalk({ count, seed }), [count, seed]);
  const width = count * pixelsPerPoint;

  const path = useMemo(() => {
    const minV = Math.min(...data);
    const maxV = Math.max(...data);
    const range = maxV - minV || 1;
    const padY = 14;
    const innerH = height - padY * 2;
    const stepX = width / (data.length - 1);
    const pts = data.map((v, i) => [i * stepX, padY + innerH - ((v - minV) / range) * innerH]);
    return smoothPath(pts);
  }, [data, height, width]);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        height,
        // soft fade-out on either edge so the line "appears from nowhere"
        WebkitMaskImage:
          'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
        maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
      }}
      aria-hidden="true"
    >
      <div
        className="flex h-full items-center"
        style={{
          width: width * 2,
          animation: `tt-elo-marquee ${duration}s linear infinite`,
          willChange: 'transform',
        }}
      >
        {[0, 1].map((tile) => (
          <svg
            key={tile}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}
          >
            <path
              d={path}
              fill="none"
              stroke="var(--good)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />
          </svg>
        ))}
      </div>

      <style>{`
        @keyframes tt-elo-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
