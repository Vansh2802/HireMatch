import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import type { Analysis, AnalysisResult, RequirementStatus } from '../lib/types';
import { LinkButton } from '../components/ui/Button';
import { RequirementStatusBadge, ScorePill } from '../components/ui/Badge';
import { PageHeader, Panel } from '../components/ui/Layout';
import { EmptyState, ErrorState, LoadingRows } from '../components/ui/States';

type Current = Analysis & { result: AnalysisResult };
const isCurrent = (a: Analysis): a is Current => !a.is_legacy && 'requirements' in a.result;
const RANK: Record<RequirementStatus, number> = { met: 3, partial: 2, not_found: 1, unverifiable: 0 };

export default function Compare() {
  const [params] = useSearchParams();
  const ids = Array.from(new Set((params.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))).slice(0, 4);
  const queries = useQueries({ queries: ids.map((id) => ({ queryKey: ['analysis', id], queryFn: () => api.analysis(id), staleTime: 60_000 })) });

  if (ids.length < 2)
    return (
      <>
        <PageHeader title="Compare analyses" />
        <EmptyState
          title="Choose analyses to compare"
          description="Select two to four analyses in your history — for example the same job before and after you updated your resume, or one resume against several jobs."
          action={<LinkButton to="/analyses">Open analysis history</LinkButton>}
        />
      </>
    );
  if (queries.some((q) => q.isPending)) return <LoadingRows rows={5} label="Loading analyses" />;
  const failed = queries.find((q) => q.isError);
  if (failed) return <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => q.refetch())} />;

  const analyses = queries.map((q) => q.data!).filter(Boolean);
  const current = analyses.filter(isCurrent);
  const versions = new Set(analyses.map((a) => a.scoring_version));
  const sameJob = analyses.every((a) => a.job_id !== null && a.job_id === analyses[0].job_id);
  const base = current[0];

  return (
    <>
      <PageHeader
        back={{ to: '/analyses', label: 'Analysis history' }}
        title="Compare analyses"
        description={sameJob ? 'The same job analysed with different resume versions or resumes.' : 'Different jobs. Scores show how well each job’s own requirements are evidenced, so compare coverage and gaps — not just the numbers.'}
      />
      {versions.size > 1 && (
        <p role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-partial/30 bg-partial-wash/60 px-4 py-3 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-partial" />
          These analyses use different scoring methods ({Array.from(versions).map((v) => `v${v}`).join(', ')}). Their scores are not directly comparable.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-paper">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">Comparison of selected analyses</caption>
          <thead>
            <tr className="border-b border-line align-top">
              <th scope="col" className="w-48 px-4 py-3 font-medium text-ink-soft">Analysis</th>
              {analyses.map((a) => (
                <th key={a.id} scope="col" className="px-4 py-3 font-normal">
                  <Link to={`/analyses/${a.id}`} className="font-semibold hover:underline">{a.job_title}</Link>
                  <p className="text-ink-soft">{a.resume_title} v{a.resume_version_number}</p>
                  <p className="text-xs text-ink-faint">{formatDate(a.created_at)}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Score">{analyses.map((a, index) => <td key={a.id} className="px-4 py-3"><span className="inline-flex items-center gap-2"><ScorePill score={a.score} />{index > 0 && sameJob && <Delta from={analyses[0].score} to={a.score} />}</span></td>)}</Row>
            <Row label="Verdict">{analyses.map((a) => <td key={a.id} className="px-4 py-3">{a.verdict}</td>)}</Row>
            <Row label="Evidence coverage">{analyses.map((a) => <td key={a.id} className="tabular px-4 py-3">{isCurrent(a) ? `${Math.round(a.result.evidence_coverage * 100)}%` : '—'}</td>)}</Row>
            <Row label="Required evidenced">{analyses.map((a) => <td key={a.id} className="tabular px-4 py-3">{isCurrent(a) ? `${a.result.counts.required_met} of ${a.result.counts.required_total}` : '—'}</td>)}</Row>
            <Row label="Not found">{analyses.map((a) => <td key={a.id} className="tabular px-4 py-3">{isCurrent(a) ? a.result.counts.not_found : '—'}</td>)}</Row>
            <Row label="Method">{analyses.map((a) => <td key={a.id} className="px-4 py-3 text-ink-soft">v{a.scoring_version}</td>)}</Row>
          </tbody>
        </table>
      </div>

      {sameJob && base && current.length === analyses.length ? (
        <Panel title="Requirement changes" description="Requirements whose status differs between analyses are listed first." className="mt-6" bodyClassName="overflow-x-auto">
          <RequirementMatrix analyses={current} />
        </Panel>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {current.map((a) => (
            <Panel key={a.id} title={a.job_title} description="Top gaps">
              {a.result.action_plan.length ? (
                <ul className="space-y-1.5 text-sm">
                  {a.result.action_plan.slice(0, 5).map((item) => <li key={item.requirement_id} className="flex justify-between gap-2"><span className="truncate">{item.requirement}</span><RequirementStatusBadge status={item.status} short /></li>)}
                </ul>
              ) : (
                <p className="text-sm text-ink-soft">No gaps found.</p>
              )}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="border-b border-line last:border-0">
      <th scope="row" className="px-4 py-3 font-medium text-ink-soft">{label}</th>
      {children}
    </tr>
  );
}

function Delta({ from, to }: { from: number | null; to: number | null }) {
  if (from === null || to === null || from === to) return null;
  const up = to > from;
  return (
    <span className={`inline-flex items-center text-xs font-medium ${up ? 'text-met' : 'text-missing'}`}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {Math.abs(to - from)}
    </span>
  );
}

function RequirementMatrix({ analyses }: { analyses: Current[] }) {
  const keys = new Map<string, string>();
  analyses.forEach((a) => a.result.requirements.forEach((r) => keys.set(`${r.category}:${r.text.toLowerCase()}`, r.text)));
  const rows = Array.from(keys.entries()).map(([key, text]) => {
    const statuses = analyses.map((a) => a.result.requirements.find((r) => `${r.category}:${r.text.toLowerCase()}` === key)?.status ?? null);
    const changed = new Set(statuses.map(String)).size > 1;
    return { key, text, statuses, changed };
  });
  rows.sort((a, b) => Number(b.changed) - Number(a.changed));
  return (
    <table className="w-full min-w-[36rem] text-left text-sm">
      <thead className="border-b border-line text-ink-soft">
        <tr>
          <th scope="col" className="px-4 py-2 font-medium">Requirement</th>
          {analyses.map((a) => <th key={a.id} scope="col" className="px-4 py-2 font-medium">v{a.resume_version_number} · {formatDate(a.created_at, { day: 'numeric', month: 'short' })}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((row) => {
          const first = row.statuses[0];
          const last = row.statuses[row.statuses.length - 1];
          const improved = first && last && RANK[last] > RANK[first];
          return (
            <tr key={row.key} className={row.changed ? (improved ? 'bg-met-wash/30' : 'bg-partial-wash/30') : ''}>
              <th scope="row" className="px-4 py-2 font-medium">{row.text}</th>
              {row.statuses.map((status, index) => <td key={index} className="px-4 py-2">{status ? <RequirementStatusBadge status={status} short /> : <span className="text-ink-faint">Not in this revision</span>}</td>)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
