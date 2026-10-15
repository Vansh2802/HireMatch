import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Database, RefreshCw, ServerCog, XCircle, Zap } from 'lucide-react';
import { healthCheck } from '../lib/api';

export default function Settings() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: healthCheck,
    staleTime: 30000,
  });

  const dbOk = data?.dependencies?.database === 'ok';
  const llmOk = data?.dependencies?.llm === 'ok' || data?.dependencies?.llm === 'available';
  const backendOk = data?.status === 'ok';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow mb-1">Configuration</p>
          <h1 className="page-heading">Settings</h1>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-secondary"
          aria-label="Refresh health status"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Health overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HealthCard
          icon={<ServerCog size={18} />}
          title="Backend API"
          loading={isLoading}
          ok={error ? false : backendOk}
          statusLabel={isLoading ? 'Checking…' : error ? 'Unreachable' : backendOk ? 'Online' : 'Degraded'}
          detail={
            error
              ? (error as Error).message
              : data
                ? `API is responding. Version 0.1.0.`
                : 'Waiting for backend health status.'
          }
        />
        <HealthCard
          icon={<Database size={18} />}
          title="Database"
          loading={isLoading}
          ok={error ? false : dbOk}
          statusLabel={isLoading ? 'Checking…' : error ? 'Unknown' : dbOk ? 'Connected' : 'Degraded'}
          detail={
            data
              ? `SQLite / PostgreSQL — status: ${data.dependencies?.database ?? 'unknown'}.`
              : 'Database status will appear after health check.'
          }
        />
        <HealthCard
          icon={<Zap size={18} />}
          title="LLM provider"
          loading={isLoading}
          ok={error ? false : llmOk}
          statusLabel={isLoading ? 'Checking…' : error ? 'Unknown' : data?.dependencies?.llm ?? 'Unknown'}
          detail={
            data
              ? `${data.dependencies?.provider ?? 'Unknown provider'} · ${data.dependencies?.model ?? 'No model'} · Connectivity: ${data.dependencies?.provider_connectivity ?? 'unknown'}.`
              : 'The backend owns the LLM connection. API keys are never exposed to the browser.'
          }
        />
      </div>

      {/* Operational limits */}
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Database size={16} className="text-brand-600" />
          <h2 className="section-heading">Operational limits</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Supported file types', value: 'PDF, DOCX' },
            { label: 'Max file size', value: '10 MB' },
            { label: 'Max files per upload', value: '10 files' },
            { label: 'Max resume text', value: '12,000 characters' },
            { label: 'Max job description', value: '12,000 characters' },
            { label: 'Max document pages', value: '80 pages' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded bg-ivory-100 px-4 py-3">
              <p className="text-xs text-ink-muted">{label}</p>
              <p className="mt-0.5 text-sm font-semibold text-ink-primary">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Security note */}
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-success" />
          <h2 className="section-heading">Security</h2>
        </div>
        <ul className="space-y-2 text-sm text-ink-secondary">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
            Candidate data is private to your account and never shared.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
            LLM API keys are stored server-side and never sent to the browser.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
            Session cookies are HTTP-only and scoped to this origin.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
            Uploaded files are validated for type and size before processing.
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ── HEALTH CARD ── */
function HealthCard({
  icon,
  title,
  loading,
  ok,
  statusLabel,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  loading: boolean;
  ok: boolean | undefined;
  statusLabel: string;
  detail: string;
}) {
  const statusColor =
    loading ? 'text-ink-muted' : ok ? 'text-success' : 'text-error';
  const StatusIcon = loading ? RefreshCw : ok ? CheckCircle2 : XCircle;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-ink-primary">
          <span className="text-brand-600">{icon}</span>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <StatusIcon size={16} className={`${statusColor} ${loading ? 'animate-spin' : ''}`} />
      </div>
      <p className={`text-sm font-semibold ${statusColor}`}>{statusLabel}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{detail}</p>
    </div>
  );
}
