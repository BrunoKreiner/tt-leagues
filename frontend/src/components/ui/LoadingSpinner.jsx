import { BrandMark } from '@/components/layout/Brand';

// Branded loading indicator — a still ping-pong ball with the leagues.lol
// brand mark on its surface, surrounded by orbital ink streaks (arcs +
// dots) that rotate around it. Same impact-frame language the hero
// SpinningBall throws off when it spins. Pure CSS / SVG — no WebGL.
const LoadingSpinner = ({ size = 'default', className = '' }) => {
  const px = { sm: 22, default: 36, md: 48, lg: 64 }[size] ?? 36;

  // Use min-h-[200px] by default to vertically center in page-level contexts.
  // Callers can override via className (e.g. small inline spinners pass their own height).
  const hasHeight = /\b(min-h-|h-)\[/.test(className) || /\bmin-h-/.test(className);
  const heightClass = hasHeight ? '' : (size === 'sm' ? '' : 'min-h-[200px]');

  return (
    <div className={`flex items-center justify-center ${heightClass} ${className}`}>
      <span
        className="tt-loading-wrap"
        style={{ '--tt-loading-size': `${px}px` }}
        role="status"
        aria-label="Loading"
      >
        {/* Static ball with brand mark on its surface */}
        <span className="tt-loading-ball-shape">
          <BrandMark size={Math.round(px * 0.55)} />
        </span>

        {/* Orbital ink streaks — rotate around the ball perimeter */}
        <svg
          className="tt-loading-ink"
          viewBox="-100 -100 200 200"
          aria-hidden="true"
        >
          <g className="tt-loading-ink-spin">
            <path d="M 28 -64 A 70 70 0 0 1 60 -36" />
            <path d="M -62 26 A 67 67 0 0 1 -38 60" strokeOpacity="0.78" />
            <path d="M -72 -22 A 75 75 0 0 1 -50 -56" strokeOpacity="0.6" strokeWidth="2.2" />
            <path d="M 64 32 A 71 71 0 0 1 38 64" strokeOpacity="0.55" strokeWidth="2.4" />
            <circle cx="-18" cy="-78" r="3" fillOpacity="0.78" />
            <circle cx="80" cy="-6" r="2" fillOpacity="0.6" />
            <circle cx="14" cy="84" r="2.4" fillOpacity="0.55" />
          </g>
        </svg>
      </span>
    </div>
  );
};

export default LoadingSpinner;
