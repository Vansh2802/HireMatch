import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Columns2, Info, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import type { Analysis, AnalysisResult } from '../lib/types';
import { ActionPlan, ComponentBreakdown, EvidenceLedger, ScoreSummary } from '../components/AnalysisParts';
import { Button, LinkButton } from '../components/ui/Button';
import { ScorePill } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/Dialog';
import { PageHeader, Panel } from '../components/ui/Layout';
import { ErrorState, LoadingRows } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';

export function isCurrentResult(analysis: Analysis): analysis is Analysis & { result: AnalysisResult } {
  return !analysis.is_legacy && 'requirements' in analysis.result;
}

export default function AnalysisDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const query = useQuery({ queryKey: ['analysis', id], queryFn: () => api.analysis(id), enabled: Number.isFinite(id), staleTime: 60_000 });

  const rerun = useMutation({
    mutationFn: (analysis: Analysis) => api.createAnalysis(analysis.resume_id!, analysis.job_id!),
    onSuccess: (fresh) => {
      queryClient.setQueryData(['analysis', fresh.id], fresh);
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate(`/analyses/${fresh.id}`);
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteAnalysis(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['analysis', id] });
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notify('Analysis deleted.');
      navigate('/analyses', { replace: true });
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  if (query.isPending) return <LoadingRows rows={6} label="Loading analysis" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const analysis = query.data;
  const outdated = analysis.is_current_resume_version === false || analysis.is_current_job_revision === false;
  const canRerun = analysis.resume_id !== null && analysis.job_id !== null;

  return (
    <>
      <PageHeader
        back={{ to: '/analyses', label: 'Analysis history' }}
        title={analysis.job_title}
        description={
          <span>
            {analysis.job_company && <>{analysis.job_company} · </>}
            {analysis.resume_id ? <Link to={`/resumes/${analysis.resume_id}`} className="link">{analysis.resume_title}</Link> : analysis.resume_title}
            {analysis.resume_version_number && <> v{analysis.resume_version_number}</>} · {formatDate(analysis.created_at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        }
        actions={
          <>
            {isCurrentResult(analysis) && <LinkButton to={`/analyses/${analysis.id}/report`} variant="secondary" icon={<Printer size={15} />}>Report</LinkButton>}
            {analysis.job_id && <LinkButton to={`/jobs/${analysis.job_id}`} variant="secondary">View job</LinkButton>}
            <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => setDeleteOpen(true)} className="hover:text-missing">Delete</Button>
          </>
        }
      />

      {outdated && (
        <div className="mb-5 flex flex-col gap-3 rounded-lg border border-line bg-paper px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm">
            <Info size={16} className="mt-0.5 shrink-0 text-unknown" />
            <span>
              {analysis.is_current_resume_version === false && 'You have a newer version of this resume. '}
              {analysis.is_current_job_revision === false && 'The job’s requirements have changed since this analysis. '}
              This result is kept exactly as it was.
            </span>
          </p>
          {canRerun && <Button size="sm" icon={<RefreshCw size={14} />} loading={rerun.isPending} onClick={() => rerun.mutate(analysis)}>Analyze with latest</Button>}
        </div>
      )}

      {isCurrentResult(analysis) ? <CurrentResult analysis={analysis} /> : <LegacyResult analysis={analysis} canRerun={canRerun} onRerun={() => rerun.mutate(analysis)} rerunning={rerun.isPending} />}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this analysis?"
        description="The resume and job are not affected. You can run the analysis again at any time."
        confirmLabel="Delete analysis"
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}

function CurrentResult({ analysis }: { analysis: Analysis & { result: AnalysisResult } }) {
  const result = analysis.result;
  return (
    <div className="space-y-6">
      <ScoreSummary result={result} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel title="How the score is made up" description="Each part’s score and its share of the total." bodyClassName="">
          <ComponentBreakdown components={result.components} />
          <p className="border-t border-line px-4 py-2.5 text-xs text-ink-faint sm:px-5">
            Scoring method v{result.scoring_version}. <Link to="/how-it-works" className="link">How scoring works</Link>
          </p>
        </Panel>
        <Panel title="Strengths for this role">
          {result.strengths.length ? (
            <ul className="space-y-2.5">
              {result.strengths.map((strength) => (
                <li key={strength} className="flex gap-2 text-sm">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-met" aria-hidden="true" />
                  {strength}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">No clear strengths were evidenced for this role yet. The action plan below shows where to start.</p>
          )}
          <h3 className="mt-5 border-t border-line pt-4 text-sm font-semibold">Next steps</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
            {result.next_steps.map((step) => <li key={step}>{step}</li>)}
          </ul>
        </Panel>
      </div>

      <Panel title="Requirement by requirement" description="Each requirement from the posting next to the evidence found in your resume." bodyClassName="">
        <EvidenceLedger requirements={result.requirements} />
      </Panel>

      <Panel title="Action plan" description="Gaps in priority order. Only add what is true — these are prompts to check, not text to copy." bodyClassName="">
        <ActionPlan items={result.action_plan} />
      </Panel>

      <div className="flex flex-wrap gap-2">
        <LinkButton to={`/compare?ids=${analysis.id}`} variant="secondary" icon={<Columns2 size={15} />}>Compare with other analyses</LinkButton>
      </div>
    </div>
  );
}

function LegacyResult({ analysis, canRerun, onRerun, rerunning }: { analysis: Analysis; canRerun: boolean; onRerun: () => void; rerunning: boolean }) {
  const summary = 'summary' in analysis.result ? analysis.result.summary : null;
  return (
    <Panel title="Result from an earlier scoring method" description={`Scoring method v${analysis.scoring_version}`}>
      <div className="flex items-center gap-4">
        <ScorePill score={analysis.score} className="h-10 text-2xl" />
        <div>
          <p className="font-semibold">{analysis.verdict}</p>
          {summary && <p className="text-sm text-ink-soft">{summary}</p>}
        </div>
      </div>
      <p className="mt-4 max-w-prose text-sm text-ink-soft">
        This analysis was created before evidence-based scoring. It has no requirement-level evidence, and its score is not comparable with current scores.
        {canRerun ? ' Re-extract the job’s requirements and upload the resume again for a full analysis.' : ''}
      </p>
      {canRerun && <Button className="mt-4" variant="secondary" onClick={onRerun} loading={rerunning}>Run a current analysis</Button>}
    </Panel>
  );
}
