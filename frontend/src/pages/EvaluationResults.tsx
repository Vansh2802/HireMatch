import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Download,
  Search,
  Upload,
  Users,
} from 'lucide-react';
import { fetchEvaluationDetail, exportEvaluation, type CandidateSummary } from '../lib/api';

type SortKey = 'score' | 'name' | 'status';
type SortDir = 'asc' | 'desc';

export default function EvaluationResults() {
  const { id } = useParams();
  const evaluationId = Number(id ?? 0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['evaluation-detail', evaluationId],
    queryFn: () => fetchEvaluationDetail(evaluationId),
    enabled: Boolean(id),
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'score' ? 'desc' : 'asc'); }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const { csv } = await exportEvaluation(evaluationId);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hirematch-${evaluationId}-candidates.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Unable to export this evaluation.');
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <EvaluationSkeleton />;

  if (error || !data) {
    return (
      <div className="space-y-4">
        <div className="alert-error" role="alert">
          {error instanceof Error ? error.message : 'Unable to load the evaluation.'}
        </div>
        <button type="button" onClick={() => refetch()} className="btn-secondary">
          Retry
        </button>
      </div>
    );
  }

  // Filter and sort candidates
  let candidates = [...data.candidates];
  if (search) {
    const q = search.toLowerCase();
    candidates = candidates.filter(
      (c) =>
        c.candidate_name.toLowerCase().includes(q) ||
        (c.verdict ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q),
    );
  }
  if (statusFilter !== 'all') {
    candidates = candidates.filter((c) => c.processing_status === statusFilter);
  }
  candidates.sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'score') cmp = (b.match_score ?? -1) - (a.match_score ?? -1);
    if (sortKey === 'name') cmp = a.candidate_name.localeCompare(b.candidate_name);
    if (sortKey === 'status') cmp = a.processing_status.localeCompare(b.processing_status);
    if (cmp === 0) cmp = a.id - b.id;
    return sortDir === 'asc' ? -cmp : cmp;
  });

  const completed = data.candidates.filter((c) => c.processing_status === 'completed');
  const scores = completed
    .map((c) => c.match_score)
    .filter((score): score is number => score !== null && score !== undefined);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const topScore = scores.length ? Math.max(...scores) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <div>
        <Link to="/dashboard" className="btn-ghost inline-flex gap-1.5 p-0 text-xs text-ink-muted">
          <ArrowLeft size={12} />
          Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow mb-1">Evaluation</p>
          <h1 className="page-heading">{data.job_title}</h1>
          <p className="mt-1 text-sm text-ink-secondary capitalize">{data.status} · {data.candidates.length} candidate{data.candidates.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end lg:flex-row lg:items-center">
          <Link
            to={`/evaluations/${evaluationId}/upload`}
            className="btn-secondary"
          >
            <Upload size={14} />
            Add resumes
          </Link>
          {data.candidates.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="btn-secondary"
            >
              <Download size={14} />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          )}
        </div>
      </div>

      {exportError && <div className="alert-error" role="alert">{exportError}</div>}

      {/* Summary metrics */}
      {completed.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MiniStat label="Total candidates" value={String(data.candidates.length)} />
          <MiniStat label="Processed" value={String(completed.length)} />
          <MiniStat label="Avg. score" value={avgScore !== null ? `${avgScore}%` : '—'} accent />
          <MiniStat label="Top score" value={topScore !== null ? `${topScore}%` : '—'} accent />
        </div>
      )}

      {/* Table */}
      <div className="card">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border-light px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              placeholder="Search candidates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-8"
              aria-label="Search candidates"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-xs text-ink-secondary">Status:</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-auto text-xs"
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
            <span className="text-xs text-ink-muted">{candidates.length} result{candidates.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Table */}
        {data.candidates.length === 0 ? (
          <NoCandidates evaluationId={evaluationId} />
        ) : candidates.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-muted">
            No candidates match your filters.{' '}
            <button type="button" className="text-brand-600 hover:text-brand-700" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-6">#</th>
                  <SortHeader label="Candidate" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Score" sortKey="score" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="hidden md:table-cell">Verdict</th>
                  <SortHeader label="Status" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
                  <th className="w-14" />
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate, index) => (
                  <CandidateRow key={candidate.id} candidate={candidate} rank={index + 1} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── SORT HEADER ── */
function SortHeader({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
  className = '',
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === currentKey;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 text-left"
      >
        {label}
        {active ? (
          dir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />
        ) : (
          <ChevronDown size={12} className="opacity-30" />
        )}
      </button>
    </th>
  );
}

/* ── CANDIDATE ROW ── */
function CandidateRow({ candidate, rank }: { candidate: CandidateSummary; rank: number }) {
  const score = candidate.match_score;
  const scoreColorClass =
    score === null || score === undefined
      ? ''
      : score >= 70 ? 'score-high' : score >= 45 ? 'score-mid' : 'score-low';

  return (
    <tr>
      <td className="text-xs text-ink-muted">{rank}</td>
      <td>
        <div>
          <p className="font-medium text-ink-primary">{candidate.candidate_name}</p>
          {candidate.email && <p className="text-xs text-ink-muted">{candidate.email}</p>}
        </div>
      </td>
      <td>
        {score !== null && score !== undefined ? (
          <div className="flex items-center gap-2">
            <div className="score-bar w-16 hidden sm:block">
              <div
                className={`score-bar-fill ${score >= 70 ? 'bg-success' : score >= 45 ? 'bg-warning' : 'bg-error'}`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className={`score-badge ${scoreColorClass}`}>{score}%</span>
          </div>
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </td>
      <td className="hidden md:table-cell">
        <span className="text-sm text-ink-secondary">{candidate.verdict ?? '—'}</span>
      </td>
      <td className="hidden sm:table-cell">
        <span className={`status-chip ${candidate.processing_status === 'completed' ? 'status-completed' : candidate.processing_status === 'failed' ? 'status-failed' : 'status-pending'}`}>
          {candidate.processing_status}
        </span>
      </td>
      <td>
        {candidate.processing_status === 'completed' ? (
          <Link
            to={`/candidates/${candidate.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 transition hover:text-brand-700"
            aria-label={`View ${candidate.candidate_name}`}
          >
            View
            <ArrowRight size={11} />
          </Link>
        ) : (
          candidate.error_message && (
            <span className="text-xs text-error" title={candidate.error_message}>Error</span>
          )
        )}
      </td>
    </tr>
  );
}

/* ── MINI STAT ── */
function MiniStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-ink-secondary">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${accent ? 'text-brand-600' : 'text-ink-primary'}`}>{value}</p>
    </div>
  );
}

/* ── NO CANDIDATES ── */
function NoCandidates({ evaluationId }: { evaluationId: number }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Users size={24} />
      </div>
      <h3 className="section-heading">No candidates yet</h3>
      <p className="mt-2 max-w-sm text-sm text-ink-secondary">
        Upload resume files to start evaluating candidates against this role.
      </p>
      <Link to={`/evaluations/${evaluationId}/upload`} className="btn-primary mt-6">
        <Upload size={16} />
        Upload resumes
      </Link>
    </div>
  );
}

/* ── SKELETON ── */
function EvaluationSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="skeleton h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="card p-4"><div className="skeleton h-8 w-20" /></div>)}
      </div>
      <div className="card p-6 space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-10 w-full" />)}
      </div>
    </div>
  );
}
