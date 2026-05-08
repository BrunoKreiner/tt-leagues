import { BrandMark } from '@/components/layout/Brand';

// Branded loading indicator — a ping-pong ball with the leagues.lol logo +
// wordmark "printed" on its surface, rotating around the Y axis like the
// hero SpinningBall but as a CSS-only element (cheap enough to use for
// every Suspense fallback / inline loader). Two decals (front + back) are
// each rendered with `backface-visibility: hidden`, so the brand is always
// visible regardless of rotation phase. No WebGL / Three.js — instant render.
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
        <span className="tt-loading-ball-shape">
          <span className="tt-loading-rotor">
            <Decal size={px} showWordmark={showWordmark} />
            <Decal size={px} showWordmark={showWordmark} back />
          </span>
        </span>
      </span>
    </div>
  );
};

function Decal({ size, showWordmark, back = false }) {
  return (
    <span className={`tt-loading-decal${back ? ' tt-loading-decal-back' : ''}`}>
      <BrandMark size={Math.round(size * 0.42)} />
      {showWordmark && (
        <span className="tt-loading-wordmark">
          leagues<span className="tt-loading-wordmark-accent">.lol</span>
        </span>
      )}
    </span>
  );
}

export default LoadingSpinner;
