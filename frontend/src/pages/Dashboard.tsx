import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Briefcase, CheckCircle2, Database, FileStack, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listEvaluations } from '../lib/api';

export default function Dashboard() {
  const { data: evaluations = [], isLoading, error } = useQuery({
    queryKey: ['evaluations'],
    queryFn: listEvaluations,
  });

  const totalCandidates = evaluations.reduce((sum, item) => sum + (item.candidate_count || 0), 0);
  const averageScore = evaluations.length
    ? Math.round(evaluations.reduce((total, item) => total + (item.average_score ?? 0), 0) / evaluations.length)
    : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-brand-600">Recruitment intelligence</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Your hiring pipeline</h2>
          </div>
          <Link to="/evaluations/new" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-medium text-white shadow-sm transition hover:bg-brand-700">
            Create evaluation
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<Briefcase />} label="Evaluations" value={String(evaluations.length)} />
        <StatCard icon={<FileStack />} label="Candidates processed" value={String(totalCandidates)} />
        <StatCard icon={<CheckCircle2 />} label="Avg. match score" value={`${averageScore}%`} />
        <StatCard icon={<Database />} label="Status" value={evaluations.length ? 'Active' : 'Empty'} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent evaluations</h3>
          <Link to="/evaluations/new" className="text-sm font-medium text-brand-700">New run</Link>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">Loading evaluations…</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error.message}</div>
        ) : evaluations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <Sparkles size={22} />
            </div>
            <h4 className="text-lg font-semibold">No evaluations yet</h4>
            <p className="mt-2 text-slate-500">Create your first role-based evaluation to compare candidates.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {evaluations.slice(0, 5).map((evaluation) => (
              <div key={evaluation.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-semibold text-slate-800">{evaluation.job_title}</p>
                  <p className="text-sm text-slate-500">{new Date(evaluation.created_at).toLocaleDateString()} • {evaluation.candidate_count} candidate(s)</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{evaluation.status}</span>
                  <Link to={`/evaluations/${evaluation.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-brand-700">
                    Open
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 inline-flex rounded-xl bg-brand-50 p-2 text-brand-700">{icon}</div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
