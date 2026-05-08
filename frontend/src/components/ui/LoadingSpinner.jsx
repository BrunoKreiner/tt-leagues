import { BrandMark } from '@/components/layout/Brand';

// Branded loading indicator — a still ping-pong ball with the leagues.lol
// logo + wordmark printed on it, plus orbital ink marks circling around it
// (arcs and dots tangent to the perimeter, like the impact-frame streaks the
// hero SpinningBall throws off when it spins). The ink rotation conveys the
// motion; the ball stays still so the brand stays legible.
//
// Pure CSS / SVG — no Three.js, no WebGL context.
const LoadingSpinner = ({ size = 'default', className = '' }) => {
  const px = { sm: 22, default: 44, md: 56, lg: 72 }[size] ?? 44;
  const showWordmark = px >= 32;

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
        {/* Static ball + decal (logo + wordmark stays put) */}
        <span className="tt-loading-ball-shape">
          <span className="tt-loading-decal">
            <BrandMark size={Math.round(px * 0.42)} />
            {showWordmark && (
              <span className="tt-loading-wordmark">
                leagues<span className="tt-loading-wordmark-accent">.lol</span>
              </span>
            )}
          </span>
        </span>

        {/* Orbital ink streaks — rotate around the ball to imply spin */}
        <svg
          className="tt-loading-ink"
          viewBox="-100 -100 200 200"
          aria-hidden="true"
        >
          <g className="tt-loading-ink-spin">
            <path d="M 30 -52 A 60 60 0 0 1 56 -22" />
            <path d="M -56 16 A 58 58 0 0 1 -34 44" strokeOpacity="0.78" />
            <path d="M -64 -16 A 66 66 0 0 1 -42 -52" strokeOpacity="0.58" strokeWidth="2.2" />
            <path d="M 58 24 A 62 62 0 0 1 36 54" strokeOpacity="0.6" strokeWidth="2.4" />
            <circle cx="-22" cy="-62" r="2.6" fillOpacity="0.78" />
            <circle cx="64" cy="-4" r="1.6" fillOpacity="0.6" />
            <circle cx="14" cy="66" r="2" fillOpacity="0.55" />
          </g>
        </svg>
      </span>
    </div>
  );
};

export default LoadingSpinner;
