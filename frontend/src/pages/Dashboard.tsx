import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Briefcase, FileStack, Plus, Sparkles, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listEvaluations, type EvaluationItem } from '../lib/api';

export default function Dashboard() {
  const { data: evaluations = [], isLoading, error } = useQuery({
    queryKey: ['evaluations'],
    queryFn: listEvaluations,
  });

  // Accurate metric calculations
  const totalCandidates = evaluations.reduce((sum, item) => sum + (item.candidate_count || 0), 0);
  const completedEvaluations = evaluations.filter((e) => e.status === 'completed');
  const scoresWithValues = evaluations.filter((e) => typeof e.average_score === 'number' && e.average_score !== null);
  const averageScore =
    scoresWithValues.length > 0
      ? Math.round(scoresWithValues.reduce((sum, e) => sum + (e.average_score ?? 0), 0) / scoresWithValues.length)
      : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow mb-1">Recruitment intelligence</p>
          <h1 className="page-heading">Your hiring pipeline</h1>
        </div>
        <Link to="/evaluations/new" className="btn-primary self-start sm:self-auto">
          <Plus size={16} />
          New evaluation
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Briefcase size={18} />}
          label="Evaluations"
          value={isLoading ? null : String(evaluations.length)}
          subtext={completedEvaluations.length > 0 ? `${completedEvaluations.length} completed` : undefined}
        />
        <StatCard
          icon={<FileStack size={18} />}
          label="Candidates"
          value={isLoading ? null : String(totalCandidates)}
          subtext="total processed"
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Avg. match score"
          value={isLoading ? null : averageScore !== null ? `${averageScore}%` : '—'}
          subtext={scoresWithValues.length > 0 ? `across ${scoresWithValues.length} evaluation${scoresWithValues.length !== 1 ? 's' : ''}` : 'no data yet'}
          accent={averageScore !== null}
        />
        <StatCard
          icon={<Sparkles size={18} />}
          label="Status"
          value={isLoading ? null : evaluations.length > 0 ? 'Active' : 'Empty'}
          subtext={evaluations.length > 0 ? 'pipeline running' : 'create an evaluation'}
        />
      </div>

      {/* Recent evaluations */}
      <div className="card">
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <h2 className="section-heading">Recent evaluations</h2>
          <Link to="/evaluations/new" className="text-xs font-semibold text-brand-600 transition hover:text-brand-700">
            + New run
          </Link>
        </div>

        {isLoading ? (
          <EvaluationSkeleton />
        ) : error ? (
          <div className="p-5">
            <div className="alert-error">{(error as Error).message}</div>
          </div>
        ) : evaluations.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job title</th>
                  <th className="hidden sm:table-cell">Created</th>
                  <th>Candidates</th>
                  <th className="hidden md:table-cell">Avg. score</th>
                  <th>Status</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {evaluations.map((evaluation) => (
                  <EvaluationRow key={evaluation.id} evaluation={evaluation} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── STAT CARD ── */
function StatCard({
  icon,
  label,
  value,
  subtext,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  subtext?: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded bg-brand-50 text-brand-600">
        {icon}
      </div>
      <p className="text-xs font-medium text-ink-secondary">{label}</p>
      {value === null ? (
        <div className="mt-1.5 skeleton h-7 w-16" />
      ) : (
        <p className={`mt-1 text-2xl font-bold tabular-nums ${accent ? 'text-brand-600' : 'text-ink-primary'}`}>
          {value}
        </p>
      )}
      {subtext && <p className="mt-0.5 text-xs text-ink-muted">{subtext}</p>}
    </div>
  );
}

/* ── EVALUATION ROW ── */
function EvaluationRow({ evaluation }: { evaluation: EvaluationItem }) {
  const scoreColor =
    evaluation.average_score === undefined || evaluation.average_score === null
      ? ''
      : evaluation.average_score >= 70
        ? 'score-high'
        : evaluation.average_score >= 45
          ? 'score-mid'
          : 'score-low';

  return (
    <tr>
      <td>
        <span className="font-medium text-ink-primary">{evaluation.job_title}</span>
      </td>
      <td className="hidden text-ink-secondary sm:table-cell">
        {new Date(evaluation.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </td>
      <td className="tabular-nums text-ink-secondary">{evaluation.candidate_count}</td>
      <td className="hidden md:table-cell">
        {evaluation.average_score !== undefined && evaluation.average_score !== null ? (
          <span className={`score-badge ${scoreColor}`}>{Math.round(evaluation.average_score)}%</span>
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </td>
      <td>
        <span className={`status-chip ${evaluation.status === 'completed' ? 'status-completed' : evaluation.status === 'pending' ? 'status-pending' : 'status-processing'}`}>
          {evaluation.status}
        </span>
      </td>
      <td>
        <Link
          to={`/evaluations/${evaluation.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 transition hover:text-brand-700"
          aria-label={`Open ${evaluation.job_title}`}
        >
          Open
          <ArrowRight size={12} />
        </Link>
      </td>
    </tr>
  );
}

/* ── SKELETON ── */
function EvaluationSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="skeleton h-4 w-48" />
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-4 w-8" />
          <div className="skeleton ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/* ── EMPTY STATE ── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Sparkles size={24} />
      </div>
      <h3 className="section-heading">No evaluations yet</h3>
      <p className="mt-2 max-w-sm text-sm text-ink-secondary">
        Create your first role-based evaluation to start comparing candidates with structured AI scoring.
      </p>
      <Link to="/evaluations/new" className="btn-primary mt-6">
        <Plus size={16} />
        Create evaluation
      </Link>
    </div>
  );
}
