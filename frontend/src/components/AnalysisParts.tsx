import { useMemo, useState } from 'react';
import { ArrowUpRight, CircleAlert, Lightbulb } from 'lucide-react';
import { CATEGORY_LABEL, STATUS_META } from '../lib/format';
import type { ActionItem, AnalysisResult, ComponentResult, RequirementResult, RequirementStatus } from '../lib/types';
import { Badge, RequirementStatusBadge } from './ui/Badge';
import { InfoTip } from './ui/Layout';
import { Meter, ScoreDial } from './ui/ScoreDial';

const CONFIDENCE_TEXT = {
  high: 'Most requirements could be checked, and the posting states them clearly.',
  medium: 'Some requirements could not be checked or were ambiguous in the posting.',
  low: 'Much of what the posting asks for could not be checked against this resume.',
};

export function ScoreSummary({ result }: { result: AnalysisResult }) {
  return (
    <section aria-labelledby="score-heading" className="grid gap-6 rounded-lg border border-line bg-paper p-5 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
      <ScoreDial score={result.score} />
      <div>
        <h2 id="score-heading" className="type-condensed text-3xl font-semibold">{result.verdict}</h2>
        <p className="mt-2 max-w-prose text-ink">{result.summary}</p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5">
            <dt className="text-ink-soft">Evidence coverage</dt>
            <dd className="tabular font-semibold">{Math.round(result.evidence_coverage * 100)}%</dd>
            <InfoTip label="What evidence coverage means">The weighted share of this job’s requirements that could be checked against your resume. Unchecked requirements are left out of the score.</InfoTip>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-ink-soft">Confidence</dt>
            <dd className="font-semibold capitalize">{result.confidence}</dd>
            <InfoTip label="What confidence means">{CONFIDENCE_TEXT[result.confidence]}</InfoTip>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-ink-soft">Required met</dt>
            <dd className="tabular font-semibold">{result.counts.required_met} of {result.counts.required_total}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-ink-faint">This score reflects how clearly your resume evidences the posting’s stated requirements. It does not predict hiring decisions.</p>
      </div>
    </section>
  );
}

export function ComponentBreakdown({ components }: { components: ComponentResult[] }) {
  return (
    <ul className="divide-y divide-line">
      {components.map((component) => (
        <li key={component.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:grid-cols-[12rem_minmax(0,1fr)_5.5rem] sm:px-5">
          <div>
            <p className={`font-medium ${component.status === 'not_applicable' ? 'text-ink-faint' : ''}`}>{component.label}</p>
            <p className="text-xs text-ink-faint">{component.detail}</p>
          </div>
          <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
            {component.status === 'scored' ? <Meter value={component.score} label={`${component.label} score`} /> : <p className="text-sm text-ink-faint">{component.status === 'unverifiable' ? 'Could not be checked' : 'Not asked for'}</p>}
          </div>
          <p className="tabular row-start-1 text-right text-sm sm:row-start-auto" title="Share of the overall score">
            {component.status === 'scored' ? <><span className="font-semibold">{Math.round((component.score ?? 0) * 100)}</span><span className="text-ink-faint"> · {Math.round(component.effective_weight * 100)}%</span></> : <span className="text-ink-faint">—</span>}
          </p>
        </li>
      ))}
    </ul>
  );
}

const FILTERS: { value: 'all' | RequirementStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'met', label: STATUS_META.met.short },
  { value: 'partial', label: STATUS_META.partial.short },
  { value: 'not_found', label: STATUS_META.not_found.short },
  { value: 'unverifiable', label: STATUS_META.unverifiable.short },
];

const SOURCE_LABEL = { resume_text: 'From your resume', profile: 'From your edited profile', related_skill: 'Related evidence in your resume', computed: 'Calculated from your resume' };

/** Requirement ↔ status ↔ resume evidence, side by side. */
export function EvidenceLedger({ requirements }: { requirements: RequirementResult[] }) {
  const [filter, setFilter] = useState<'all' | RequirementStatus>('all');
  const [requiredOnly, setRequiredOnly] = useState(false);
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: requirements.length };
    requirements.forEach((r) => (result[r.status] = (result[r.status] ?? 0) + 1));
    return result;
  }, [requirements]);
  const rows = requirements.filter((r) => (filter === 'all' || r.status === filter) && (!requiredOnly || r.importance === 'required'));

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div role="radiogroup" aria-label="Filter requirements by status" className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={filter === item.value}
              onClick={() => setFilter(item.value)}
              disabled={item.value !== 'all' && !counts[item.value]}
              className={`rounded border px-2.5 py-1 text-sm transition-colors disabled:opacity-40 ${filter === item.value ? 'border-ink bg-ink text-ink-inverse' : 'border-line bg-paper text-ink-soft hover:border-line-strong hover:text-ink'}`}
            >
              {item.label} <span className="tabular opacity-70">{counts[item.value] ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={requiredOnly} onChange={(event) => setRequiredOnly(event.target.checked)} className="accent-[rgb(var(--accent))]" />
          Required only
        </label>
      </div>
      <div className="hidden grid-cols-[minmax(0,1fr)_9rem_minmax(0,1.15fr)] gap-4 border-b border-line bg-sunk/40 px-5 py-2 text-xs font-medium text-ink-soft lg:grid" aria-hidden="true">
        <span>What the job asks for</span>
        <span>Status</span>
        <span>What your resume shows</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-soft">No requirements match this filter.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((requirement) => (
            <li key={requirement.id} className="grid gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1.15fr)]">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{requirement.text}</span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                  <span>{CATEGORY_LABEL[requirement.category]}</span>
                  <span aria-hidden="true">·</span>
                  <span className={requirement.importance === 'required' ? 'font-medium text-ink-soft' : ''}>{requirement.importance === 'required' ? 'Required' : 'Preferred'}</span>
                  {requirement.uncertain && <Badge tone="unknown" title="The posting is ambiguous about this; it counts half.">Uncertain</Badge>}
                </p>
                {requirement.source_excerpt && requirement.source_excerpt !== requirement.text && (
                  <details className="mt-1 text-sm">
                    <summary className="cursor-pointer text-ink-soft hover:text-ink">In the posting</summary>
                    <p className="mt-1 border-l-2 border-line-strong pl-2.5 text-ink-soft">“{requirement.source_excerpt}”</p>
                  </details>
                )}
              </div>
              <div>
                <RequirementStatusBadge status={requirement.status} />
              </div>
              <div className="min-w-0 text-sm">
                {requirement.evidence.length > 0 && (
                  <blockquote className={`border-l-2 pl-2.5 ${requirement.status === 'met' ? 'border-met/60' : 'border-partial/60'}`}>
                    <p className="text-xs text-ink-faint">{SOURCE_LABEL[requirement.evidence[0].source]}</p>
                    <p className="break-words text-ink">{requirement.evidence[0].excerpt}</p>
                  </blockquote>
                )}
                <p className={`text-ink-soft ${requirement.evidence.length ? 'mt-1.5' : ''}`}>{requirement.note}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const PRIORITY = { high: { label: 'High priority', tone: 'missing' as const }, medium: { label: 'Medium', tone: 'partial' as const }, low: { label: 'Low', tone: 'neutral' as const } };

export function ActionPlan({ items }: { items: ActionItem[] }) {
  if (!items.length) return <p className="px-5 py-5 text-sm text-ink-soft">No gaps found. Every requirement that could be checked is evidenced in your resume.</p>;
  return (
    <ol className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.requirement_id} className="flex gap-3 px-4 py-4 sm:px-5">
          <span className="mt-0.5 shrink-0 text-accent" aria-hidden="true">{item.priority === 'high' ? <CircleAlert size={18} /> : <Lightbulb size={18} />}</span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{item.requirement}</span>
              <Badge tone={PRIORITY[item.priority].tone}>{PRIORITY[item.priority].label}</Badge>
              <span className="text-xs text-ink-faint">{STATUS_META[item.status].label}</span>
            </p>
            <p className="mt-1 text-sm text-ink-soft">{item.why}</p>
            <p className="mt-1.5 text-sm text-ink">{item.suggestion}</p>
            {item.section && (
              <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-ink-faint">
                <ArrowUpRight size={12} aria-hidden="true" /> Review your {item.section} section
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
