import { BrandMark } from '@/components/layout/Brand';

// Branded loading indicator — a small ping-pong ball with the leagues.lol
// mark printed on it, rotating in place. Mirrors the hero SpinningBall
// component but in a CSS-only form so it's cheap to use everywhere.
const LoadingSpinner = ({ size = 'default', className = '' }) => {
  const px = { sm: 18, default: 32, lg: 52 }[size] ?? 32;

  // Use min-h-[200px] by default to vertically center in page-level contexts.
  // Callers can override via className (e.g. small inline spinners pass their own height).
  const hasHeight = /\b(min-h-|h-)\[/.test(className) || /\bmin-h-/.test(className);
  const heightClass = hasHeight ? '' : (size === 'sm' ? '' : 'min-h-[200px]');

  return (
    <div className={`flex items-center justify-center ${heightClass} ${className}`}>
      <span
        className="tt-loading-ball"
        style={{ width: px, height: px }}
        role="status"
        aria-label="Loading"
      >
        <span className="tt-loading-mark" style={{ color: 'oklch(0.16 0.04 30)' }}>
          <BrandMark size={Math.round(px * 0.6)} />
        </span>
      </span>
    </div>
  );
};

export default LoadingSpinner;
