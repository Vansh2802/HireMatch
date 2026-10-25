import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, CircleDashed, CircleHelp, Loader2, MinusCircle } from 'lucide-react';
import { STATUS_META, scoreTone } from '../../lib/format';
import type { ProcessingStatus, RequirementStatus } from '../../lib/types';

export type Tone = 'neutral' | 'accent' | 'met' | 'partial' | 'missing' | 'unknown' | 'dark';

const tones: Record<Tone, string> = {
  neutral: 'bg-sunk text-ink-soft',
  accent: 'bg-accent-wash text-accent-text',
  met: 'bg-met-wash text-met',
  partial: 'bg-partial-wash text-partial',
  missing: 'bg-missing-wash text-missing',
  unknown: 'bg-unknown-wash text-unknown',
  dark: 'bg-obsidian text-ink-inverse',
};

export function Badge({ tone = 'neutral', icon, children, className = '', title }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium leading-4 ${tones[tone]} ${className}`}>
      {icon}
      {children}
    </span>
  );
}

const statusIcons: Record<RequirementStatus, ReactNode> = {
  met: <CheckCircle2 size={13} aria-hidden="true" />,
  partial: <CircleDashed size={13} aria-hidden="true" />,
  not_found: <MinusCircle size={13} aria-hidden="true" />,
  unverifiable: <CircleHelp size={13} aria-hidden="true" />,
};

export function RequirementStatusBadge({ status, short = false }: { status: RequirementStatus; short?: boolean }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} icon={statusIcons[status]} title={meta.description}>
      {short ? meta.short : meta.label}
    </Badge>
  );
}

export function ProcessingBadge({ status }: { status: ProcessingStatus }) {
  if (status === 'processing')
    return (
      <Badge tone="unknown" icon={<Loader2 size={12} className="animate-spin" aria-hidden="true" />}>
        Processing
      </Badge>
    );
  if (status === 'failed')
    return (
      <Badge tone="missing" icon={<AlertCircle size={12} aria-hidden="true" />}>
        Failed
      </Badge>
    );
  return <Badge tone="met">Ready</Badge>;
}

/** Compact score display; "—" when no score could be produced. */
export function ScorePill({ score, className = '' }: { score: number | null | undefined; className?: string }) {
  const tone = scoreTone(score);
  const colors = { met: 'text-met border-met/30', partial: 'text-partial border-partial/30', missing: 'text-missing border-missing/30', unknown: 'text-unknown border-unknown/30' }[tone];
  return (
    <span
      className={`type-condensed tabular inline-flex h-7 min-w-[2.75rem] items-center justify-center rounded border bg-paper px-1.5 text-lg font-semibold ${colors} ${className}`}
      aria-label={score === null || score === undefined ? 'No score' : `Score ${score} out of 100`}
    >
      {score ?? '—'}
    </span>
  );
}
