import { Link } from 'react-router-dom';

export function BrandMark({ size = 26, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="9" cy="13" r="6.5" fill="currentColor" />
      <circle cx="18" cy="13" r="4" fill="var(--accent)" />
    </svg>
  );
}

export default function Brand({ to = '/', onClick, size = 26 }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="inline-flex items-center gap-2 group select-none"
    >
      <span className="inline-flex items-center justify-center text-[var(--fg)] group-hover:text-[var(--fg-2)] transition-colors">
        <BrandMark size={size} />
      </span>
      <span className="font-sans font-bold text-[15px] tracking-tight leading-none text-[var(--fg)]">
        leagues<span className="text-[var(--accent)]">.lol</span>
      </span>
    </Link>
  );
}
