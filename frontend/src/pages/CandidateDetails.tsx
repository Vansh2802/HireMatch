import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchCandidate } from '../lib/api';

export default function CandidateDetails() {
  const { id } = useParams();
  const candidateId = Number(id ?? 0);
  const { data, isLoading, error } = useQuery({
    queryKey: ['candidate', candidateId],
    queryFn: () => fetchCandidate(candidateId),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-slate-500">Loading candidate details…</div>;
  }

  if (error || !data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error instanceof Error ? error.message : 'Unable to load candidate.'}</div>;
  }

  const structuredResume = (data.structured_resume as Record<string, unknown> | undefined) ?? {};
  const evaluationDetails = (data.evaluation_details as Record<string, unknown> | undefined) ?? {};

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-brand-600">Candidate analysis</p>
            <h2 className="mt-2 text-3xl font-semibold">{String(data.candidate_name ?? 'Candidate')}</h2>
          </div>
          <div className="rounded-2xl bg-brand-50 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-brand-700">Score</p>
            <p className="text-2xl font-semibold text-brand-900">{Number((data as Record<string, unknown>).match_score ?? 0)}%</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Summary</h3>
          <ul className="space-y-3 text-sm text-slate-600">
            <li><strong className="text-slate-800">Verdict:</strong> {String(data.verdict ?? 'Pending')}</li>
            <li><strong className="text-slate-800">Email:</strong> {String(data.email ?? 'Not available')}</li>
            <li><strong className="text-slate-800">Phone:</strong> {String(data.phone ?? 'Not available')}</li>
            <li><strong className="text-slate-800">Status:</strong> {String(data.processing_status ?? 'Pending')}</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Match explanation</h3>
          <p className="text-sm text-slate-600">{String((evaluationDetails.overall_explanation as string | undefined) ?? 'This profile was evaluated against the role requirements using the structured match engine.')}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">Structured profile</h3>
        <pre className="overflow-x-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700">{JSON.stringify(structuredResume, null, 2)}</pre>
      </div>
    </div>
  );
}
