import { Link } from 'react-router-dom';

/** Wordmark: an "H" whose crossbar ends in the accent dot (the match). */
export function Brand({ to = '/', inverse = false, onClick }: { to?: string; inverse?: boolean; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="inline-flex items-center gap-2" aria-label="HireMatch home">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill={inverse ? 'rgb(var(--ink-inverse))' : 'rgb(var(--obsidian))'} />
        <path d="M9 8v16M9 16h8M17 8v16" stroke={inverse ? 'rgb(var(--obsidian))' : 'rgb(var(--ink-inverse))'} strokeWidth="3" strokeLinecap="round" />
        <circle cx="24" cy="21" r="3.2" fill="rgb(var(--accent))" />
      </svg>
      <span className={`type-condensed text-xl font-semibold tracking-tight ${inverse ? 'text-ink-inverse' : 'text-ink'}`}>HireMatch</span>
    </Link>
  );
}
