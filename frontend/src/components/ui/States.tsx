import type { ReactNode } from 'react';
import { AlertTriangle, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { ApiError, errorMessage } from '../../lib/api';
import { Button } from './Button';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function LoadingRows({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-ink-soft">
      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      {label ?? <span className="sr-only">Loading</span>}
    </span>
  );
}

export function EmptyState({ icon, title, description, action, compact = false }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-start rounded-lg border border-dashed border-line-strong bg-paper/60 ${compact ? 'p-5' : 'p-8 sm:p-10'}`}>
      {icon && <div className="mb-3 text-ink-faint">{icon}</div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <div className="mt-1 max-w-prose text-sm text-ink-soft">{description}</div>}
      {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const offline = error instanceof ApiError && error.isNetwork;
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-missing/30 bg-missing-wash/50 p-5">
      <div className="flex items-start gap-2.5">
        {offline ? <WifiOff size={18} className="mt-0.5 text-missing" /> : <AlertTriangle size={18} className="mt-0.5 text-missing" />}
        <div>
          <p className="font-semibold text-ink">{title ?? (notFound ? 'Not found' : offline ? 'Connection problem' : 'Could not load this')}</p>
          <p className="text-sm text-ink-soft">{notFound ? 'It may have been deleted, or the link is wrong.' : errorMessage(error)}</p>
        </div>
      </div>
      {onRetry && !notFound && (
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function InlineError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded border border-missing/30 bg-missing-wash/60 px-3 py-2 text-sm text-ink">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-missing" />
      {message}
    </p>
  );
}
