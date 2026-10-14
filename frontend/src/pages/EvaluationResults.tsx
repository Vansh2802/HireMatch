import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { fetchEvaluationDetail } from '../lib/api';

export default function EvaluationResults() {
  const { id } = useParams();
  const evaluationId = Number(id ?? 0);
  const { data, isLoading, error } = useQuery({
    queryKey: ['evaluation-detail', evaluationId],
    queryFn: () => fetchEvaluationDetail(evaluationId),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-slate-500">Loading evaluation…</div>;
  }

  if (error || !data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error instanceof Error ? error.message : 'Unable to load the evaluation.'}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-brand-600">Evaluation</p>
            <h2 className="mt-2 text-3xl font-semibold">{data.job_title}</h2>
          </div>
          <div className="flex gap-3">
            <Link to={`/evaluations/${evaluationId}/upload`} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50">Upload resumes</Link>
            <Link to="/" className="rounded-xl bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-700">Back to dashboard</Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ranked candidates</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">{data.candidates.length} total</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-3 py-3 font-medium">Candidate</th>
                <th className="px-3 py-3 font-medium">Score</th>
                <th className="px-3 py-3 font-medium">Verdict</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.candidates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-500">No candidates have been added yet.</td>
                </tr>
              ) : (
                [...data.candidates]
                  .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
                  .map((candidate) => (
                    <tr key={candidate.id} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-800">{candidate.candidate_name}</td>
                      <td className="px-3 py-3">{candidate.match_score ?? '—'}%</td>
                      <td className="px-3 py-3">{candidate.verdict ?? 'Pending'}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{candidate.processing_status}</span>
                      </td>
                      <td className="px-3 py-3">
                        <Link to={`/candidates/${candidate.id}`} className="text-brand-700 hover:text-brand-800">View</Link>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
