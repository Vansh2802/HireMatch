import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BriefcaseBusiness, CalendarClock, Check, FileText, Gauge, History } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatRelative, STAGES } from '../lib/format';
import type { Dashboard as DashboardData } from '../lib/types';
import { LinkButton } from '../components/ui/Button';
import { Badge, ScorePill } from '../components/ui/Badge';
import { InfoTip, PageHeader, Panel } from '../components/ui/Layout';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States';

export default function Dashboard() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });

  return (
    <>
      <PageHeader
        title="Overview"
        description="Your resumes, saved jobs and analyses at a glance."
        actions={
          <LinkButton to="/analyze" icon={<Gauge size={16} />}>
            Analyze a resume
          </LinkButton>
        }
      />
      {query.isPending && <DashboardSkeleton />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && <DashboardContent data={query.data} />}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading overview">
      <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="bg-paper p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-9 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function Onboarding({ data }: { data: DashboardData }) {
  const queryClient = useQueryClient();
  const dismiss = useMutation({
    mutationFn: api.dismissOnboarding,
    onSuccess: () => queryClient.setQueryData<DashboardData>(['dashboard'], (old) => (old ? { ...old, onboarding: { ...old.onboarding, dismissed: true } } : old)),
  });
  const { has_resume, has_job, has_analysis } = data.onboarding;
  const steps = [
    { done: has_resume, title: 'Upload your resume', body: 'PDF or DOCX. Check what HireMatch extracted and correct anything it misread.', to: '/resumes', cta: 'Upload resume' },
    { done: has_job, title: 'Add a job you’re interested in', body: 'Paste the full job description so its requirements can be extracted.', to: '/jobs', cta: 'Add a job' },
    { done: has_analysis, title: 'Run your first analysis', body: 'See which requirements your resume evidences and what to improve.', to: '/analyze', cta: 'Analyze' },
  ];
  const nextIndex = steps.findIndex((step) => !step.done);
  return (
    <Panel
      title="Get started"
      description="Three steps to your first match analysis."
      actions={
        <button type="button" className="text-sm text-ink-soft hover:text-ink" onClick={() => dismiss.mutate()} disabled={dismiss.isPending}>
          Hide this guide
        </button>
      }
      className="mb-6"
      bodyClassName=""
    >
      <ol className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3 p-4 sm:p-5">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                step.done ? 'bg-met text-white' : index === nextIndex ? 'bg-accent text-white' : 'bg-sunk text-ink-soft'
              }`}
              aria-hidden="true"
            >
              {step.done ? <Check size={15} /> : index + 1}
            </span>
            <div>
              <h3 className={`font-semibold ${step.done ? 'text-ink-soft line-through decoration-ink-faint/50' : ''}`}>
                {step.title}
                <span className="sr-only">{step.done ? ' (done)' : ''}</span>
              </h3>
              <p className="mt-0.5 text-sm text-ink-soft">{step.body}</p>
              {!step.done && index === nextIndex && (
                <LinkButton to={step.to} size="sm" className="mt-3">
                  {step.cta}
                </LinkButton>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function DashboardContent({ data }: { data: DashboardData }) {
  const onboardingDone = data.onboarding.has_resume && data.onboarding.has_job && data.onboarding.has_analysis;
  const activeStages = STAGES.filter((stage) => stage.value !== 'archived');
  const tracked = activeStages.reduce((sum, stage) => sum + data.stages[stage.value], 0);

  return (
    <div className="space-y-6">
      {!onboardingDone && !data.onboarding.dismissed && <Onboarding data={data} />}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        <Metric label="Resumes" value={data.counts.resumes} to="/resumes" />
        <Metric label="Saved jobs" value={data.counts.jobs} to="/jobs" />
        <Metric label="Analyses" value={data.counts.analyses} to="/analyses" />
        <div className="bg-paper p-4 sm:p-5">
          <dt className="flex items-center gap-1 text-sm text-ink-soft">
            Average best match
            <InfoTip label="How the average best match is calculated">{data.average_definition}</InfoTip>
          </dt>
          <dd className="type-condensed tabular mt-1 text-4xl font-semibold">{data.average_best_score ?? '—'}</dd>
          <dd className="text-xs text-ink-faint">
            {data.average_best_score_jobs ? `across ${data.average_best_score_jobs} job${data.average_best_score_jobs === 1 ? '' : 's'}` : 'no scored analyses yet'}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title="Recent analyses"
          actions={
            data.recent_analyses.length > 0 && (
              <Link to="/analyses" className="link text-sm">
                View all
              </Link>
            )
          }
          bodyClassName=""
        >
          {data.recent_analyses.length === 0 ? (
            <div className="p-5">
              <EmptyState
                compact
                icon={<History size={22} />}
                title="No analyses yet"
                description="Pick a resume and a job to see how well they match."
                action={<LinkButton to="/analyze" size="sm">Analyze a resume</LinkButton>}
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.recent_analyses.map((item) => (
                <li key={item.id}>
                  <Link to={`/analyses/${item.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-sunk/50 sm:px-5">
                    <ScorePill score={item.score} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {item.job_title}
                        {item.job_company && <span className="font-normal text-ink-soft"> at {item.job_company}</span>}
                      </p>
                      <p className="truncate text-sm text-ink-soft">
                        {item.resume_title}
                        {item.resume_version_number ? ` (v${item.resume_version_number})` : ''} · {item.verdict}
                      </p>
                    </div>
                    <span className="hidden shrink-0 text-sm text-ink-faint sm:block">{formatRelative(item.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Applications" description={tracked ? `${tracked} active job${tracked === 1 ? '' : 's'}` : undefined} bodyClassName="">
            {data.counts.jobs === 0 ? (
              <div className="p-5">
                <EmptyState compact icon={<BriefcaseBusiness size={22} />} title="No saved jobs" description="Save jobs to track where you are with each one." action={<LinkButton to="/jobs" size="sm" variant="secondary">Add a job</LinkButton>} />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {STAGES.map((stage) => (
                  <li key={stage.value}>
                    <Link to={`/jobs?stage=${stage.value}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-sunk/50 sm:px-5">
                      <span className={data.stages[stage.value] ? 'text-ink' : 'text-ink-faint'}>{stage.label}</span>
                      <span className="tabular font-medium">{data.stages[stage.value]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {data.follow_ups.length > 0 && (
            <Panel title="Upcoming follow-ups" bodyClassName="">
              <ul className="divide-y divide-line">
                {data.follow_ups.map((job) => (
                  <li key={job.id}>
                    <Link to={`/jobs/${job.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-sunk/50 sm:px-5">
                      <CalendarClock size={16} className={job.overdue ? 'text-missing' : 'text-ink-faint'} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {job.title}
                        {job.company && <span className="text-ink-soft"> · {job.company}</span>}
                      </span>
                      {job.overdue ? <Badge tone="missing">Overdue</Badge> : <span className="text-sm text-ink-soft">{formatDate(job.follow_up_on, { day: 'numeric', month: 'short' })}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Quick actions" bodyClassName="p-2">
            <QuickLink to="/resumes" icon={<FileText size={16} />} label="Manage resumes" />
            <QuickLink to="/jobs" icon={<BriefcaseBusiness size={16} />} label="Saved jobs and applications" />
            <QuickLink to="/analyses" icon={<History size={16} />} label="Review previous analyses" />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <div className="bg-paper p-4 sm:p-5">
      <dt className="text-sm text-ink-soft">
        <Link to={to} className="hover:text-ink hover:underline">
          {label}
        </Link>
      </dt>
      <dd className="type-condensed tabular mt-1 text-4xl font-semibold">{value}</dd>
    </div>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded px-3 py-2 text-sm text-ink hover:bg-sunk">
      <span className="text-ink-faint">{icon}</span>
      {label}
    </Link>
  );
}
