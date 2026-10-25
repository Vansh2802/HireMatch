import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { CATEGORY_LABEL, formatDate, STATUS_META } from '../lib/format';
import { Brand } from '../components/Brand';
import { Button, LinkButton } from '../components/ui/Button';
import { ErrorState, LoadingRows } from '../components/ui/States';
import { isCurrentResult } from './AnalysisDetail';

/** A print-optimised report. Uses the browser's print dialog ("Save as PDF") so nothing leaves the device. */
export default function AnalysisReport() {
  const id = Number(useParams().id);
  const query = useQuery({ queryKey: ['analysis', id], queryFn: () => api.analysis(id), enabled: Number.isFinite(id) });
  useEffect(() => {
    if (query.data) document.title = `HireMatch report – ${query.data.job_title}`;
  }, [query.data]);

  if (query.isPending) return <div className="mx-auto max-w-3xl p-6"><LoadingRows rows={6} /></div>;
  if (query.isError) return <div className="mx-auto max-w-3xl p-6"><ErrorState error={query.error} onRetry={() => query.refetch()} /></div>;
  const analysis = query.data;
  if (!isCurrentResult(analysis))
    return <div className="mx-auto max-w-3xl p-6"><ErrorState error={new Error('Reports are available for analyses made with the current scoring method.')} title="Report unavailable" /></div>;
  const result = analysis.result;

  return (
    <div className="min-h-screen bg-canvas py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4">
        <LinkButton to={`/analyses/${analysis.id}`} variant="ghost" icon={<ChevronLeft size={16} />}>Back to analysis</LinkButton>
        <Button icon={<Printer size={16} />} onClick={() => window.print()}>Print or save as PDF</Button>
      </div>
      <article className="report mx-auto max-w-3xl rounded-lg border border-line bg-white px-6 py-8 text-[0.875rem] leading-relaxed sm:px-10">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-5">
          <div>
            <p className="text-xs text-ink-faint">Resume match report</p>
            <h1 className="type-condensed mt-1 text-3xl font-semibold">{analysis.job_title}</h1>
            <p className="text-ink-soft">{[analysis.job_company, analysis.job_snapshot.location].filter(Boolean).join(' · ')}</p>
          </div>
          <Brand />
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-1 border-b border-line py-4 text-sm sm:grid-cols-4">
          <Meta label="Resume" value={`${analysis.resume_title} (v${analysis.resume_version_number})`} />
          <Meta label="Analysed" value={formatDate(analysis.created_at)} />
          <Meta label="Scoring method" value={`v${result.scoring_version}`} />
          <Meta label="Evidence coverage" value={`${Math.round(result.evidence_coverage * 100)}% · ${result.confidence} confidence`} />
        </section>

        <section className="flex items-center gap-6 border-b border-line py-5">
          <p className="type-condensed tabular text-6xl font-semibold leading-none">{result.score ?? '—'}</p>
          <div>
            <p className="text-lg font-semibold">{result.verdict}</p>
            <p className="text-ink-soft">{result.summary}</p>
          </div>
        </section>

        <section className="py-5">
          <h2 className="text-base font-semibold">Score breakdown</h2>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-ink-soft"><tr><th className="py-1 font-medium">Component</th><th className="py-1 font-medium">Result</th><th className="py-1 text-right font-medium">Score</th><th className="py-1 text-right font-medium">Weight</th></tr></thead>
            <tbody>
              {result.components.map((c) => (
                <tr key={c.key} className="border-t border-line">
                  <td className="py-1.5">{c.label}</td>
                  <td className="py-1.5 text-ink-soft">{c.status === 'scored' ? c.detail : c.status === 'unverifiable' ? 'Could not be checked' : 'Not asked for'}</td>
                  <td className="tabular py-1.5 text-right">{c.score === null ? '—' : Math.round(c.score * 100)}</td>
                  <td className="tabular py-1.5 text-right">{c.status === 'scored' ? `${Math.round(c.effective_weight * 100)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="py-5">
          <h2 className="text-base font-semibold">Requirements and evidence</h2>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-ink-soft"><tr><th className="w-[34%] py-1 font-medium">Requirement</th><th className="w-[18%] py-1 font-medium">Status</th><th className="py-1 font-medium">Evidence in resume</th></tr></thead>
            <tbody>
              {result.requirements.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="py-2 pr-3">
                    <p className="font-medium">{r.text}</p>
                    <p className="text-xs text-ink-faint">{CATEGORY_LABEL[r.category]} · {r.importance}{r.uncertain ? ' · uncertain' : ''}</p>
                  </td>
                  <td className="py-2 pr-3">{STATUS_META[r.status].label}</td>
                  <td className="py-2">
                    {r.evidence[0] && <p>“{r.evidence[0].excerpt}”</p>}
                    <p className="text-ink-soft">{r.note}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="py-5">
          <h2 className="text-base font-semibold">Action plan</h2>
          {result.action_plan.length ? (
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {result.action_plan.map((a) => (
                <li key={a.requirement_id}>
                  <p className="font-medium">{a.requirement} <span className="font-normal text-ink-faint">({a.priority} priority)</span></p>
                  <p className="text-ink-soft">{a.suggestion}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-ink-soft">No gaps found among the requirements that could be checked.</p>
          )}
        </section>

        <footer className="border-t border-line pt-4 text-xs text-ink-faint">
          <p>
            How this score works: each requirement from the job description is checked against the resume text and weighted (required skills 45%, experience 20%,
            responsibilities 15%, education & certifications 10%, preferred skills 10%; components the job does not ask for are excluded). Requirements that cannot be
            checked are excluded rather than counted as met or missing. “Not found” means the resume does not show it, not that the candidate lacks it.
          </p>
          <p className="mt-2">This report describes how clearly a resume evidences a job description. It is not a prediction of interviews, offers or hiring decisions.</p>
        </footer>
      </article>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-1">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
