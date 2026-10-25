import { useEffect, useId, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Info, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  useEffect(() => {
    if (typeof title === 'string') document.title = `${title} · HireMatch`;
  }, [title]);
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
            <ChevronLeft size={15} aria-hidden="true" />
            {back.label}
          </Link>
        )}
        <h1 className="page-title break-words">{title}</h1>
        {description && <div className="mt-1.5 max-w-prose text-ink-soft">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, description, actions, children, className = '', bodyClassName = 'panel-pad' }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={`panel min-w-0 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div>
            {title && <h2 className="section-title">{title}</h2>}
            {description && <p className="text-sm text-ink-soft">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Small accessible tooltip for definitions (hover, focus and tap). */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="rounded-full p-0.5 text-ink-faint hover:text-ink"
      >
        <Info size={14} aria-hidden="true" />
      </button>
      {open && (
        <span id={id} role="tooltip" className="absolute bottom-full left-1/2 z-30 mb-1.5 w-64 -translate-x-1/2 rounded-md bg-obsidian px-3 py-2 text-xs font-normal leading-relaxed text-ink-inverse shadow-pop">
          {children}
        </span>
      )}
    </span>
  );
}

export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (value: string) => void; placeholder: string; label: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
      <input type="search" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="control pl-9" />
    </div>
  );
}

export function Pagination({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm text-ink-soft">
      <span className="tabular">
        {offset + 1}–{Math.min(offset + limit, total)} of {total}
      </span>
      <div className="flex gap-1">
        <button type="button" className="inline-flex h-8 items-center gap-1 rounded border border-line bg-paper px-2.5 hover:bg-sunk disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(Math.max(0, offset - limit))}>
          <ChevronLeft size={14} /> Previous
        </button>
        <button type="button" className="inline-flex h-8 items-center gap-1 rounded border border-line bg-paper px-2.5 hover:bg-sunk disabled:opacity-40" disabled={page >= pages} onClick={() => onChange(offset + limit)}>
          Next <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
}

/** Debounce text input so list queries are not fired on every keystroke. */
export function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
