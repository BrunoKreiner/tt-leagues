import { lazy, Suspense } from 'react';
import { BrandMark } from '@/components/layout/Brand';

// Heavy 3D loader is code-split so it only ships when actually rendered.
const BallLoader = lazy(() => import('@/components/BallLoader'));

// Branded loading indicator — the same ping-pong ball that the logged-out
// hero throws around. For page-level loaders we render the auto-spinning
// 3D ball (Three.js); for tiny inline spinners (button content, sm size,
// h-4/h-5 sized icons) we fall back to a still ball with rotating ink
// streaks to avoid spinning up a WebGL context per button.
const LoadingSpinner = ({ size = 'default', className = '' }) => {
  const px = { sm: 22, default: 36, md: 48, lg: 64 }[size] ?? 36;

  // Use min-h-[200px] by default to vertically center in page-level contexts.
  // Callers can override via className (e.g. small inline spinners pass their own height).
  const hasHeight = /\b(min-h-|h-)\[/.test(className) || /\bmin-h-/.test(className);
  const heightClass = hasHeight ? '' : (size === 'sm' ? '' : 'min-h-[200px]');

  // Detect inline / sized-down usage (e.g. `mr-2 h-4 w-4` inside a button).
  // For those we skip Three.js — a 16px WebGL canvas is wasteful and the
  // wordmark texture wouldn't be legible anyway.
  const isInline = /\b(h|w)-\d+\b/.test(className);
  const useGL = size !== 'sm' && !isInline;

  return (
    <div className={`flex items-center justify-center ${heightClass} ${className}`}>
      {useGL ? (
        <Suspense fallback={<CssBall size={px} />}>
          <BallLoader size={px} />
        </Suspense>
      ) : (
        <CssBall size={px} />
      )}
    </div>
  );
};

// Pure CSS / SVG fallback — a still ping-pong ball with the leagues.lol brand
// mark on its surface and orbital ink streaks rotating around it.
function CssBall({ size }) {
  return (
    <span
      className="tt-loading-wrap"
      style={{ '--tt-loading-size': `${size}px` }}
      role="status"
      aria-label="Loading"
    >
      <span className="tt-loading-ball-shape">
        <BrandMark size={Math.round(size * 0.55)} />
      </span>
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
  );
}

export default LoadingSpinner;
