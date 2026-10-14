import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Database, ServerCog } from 'lucide-react';
import { healthCheck } from '../lib/api';

export default function Settings() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: healthCheck,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm uppercase tracking-[0.18em] text-brand-600">Settings</p>
        <h2 className="mt-2 text-2xl font-semibold">Application configuration</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard
          title="Backend connection"
          icon={<ServerCog className="text-brand-700" />}
          status={isLoading ? 'Checking…' : data?.status === 'ok' ? 'Connected' : 'Degraded'}
          description={error ? (error as Error).message : data ? `API responding. Database: ${data.dependencies?.database ?? 'unknown'}.` : 'Waiting for backend health status.'}
        />
        <InfoCard
          title="LLM provider"
          icon={<CheckCircle2 className="text-brand-700" />}
          status={isLoading ? 'Checking…' : data?.dependencies?.llm ?? 'Unknown'}
          description={data ? `${data.dependencies?.provider ?? 'Unknown'} / ${data.dependencies?.model ?? 'No model configured'}; connectivity: ${data.dependencies?.provider_connectivity ?? 'unknown'}.` : 'The backend owns the LLM connection and never exposes provider secrets to the browser.'}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Database className="text-brand-700" />
          <h3 className="text-lg font-semibold">Operational limits</h3>
        </div>
        <ul className="space-y-3 text-sm text-slate-600">
          <li>Supported file types: PDF and DOCX</li>
          <li>Max upload size: 10 MB</li>
          <li>Local development mode: PostgreSQL or SQLite fallback depending on configuration</li>
        </ul>
      </div>
    </div>
  );
}

function InfoCard({ title, status, description, icon }: { title: string; status: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-slate-800">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-sm font-medium text-brand-700">{status}</p>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}
