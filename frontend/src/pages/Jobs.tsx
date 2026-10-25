import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, CalendarClock, Plus } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { formatDate, formatRelative, STAGES, stageLabel } from '../lib/format';
import { pollWhileProcessing } from '../lib/polling';
import type { ApplicationStage } from '../lib/types';
import { JobFields, toJobPayload, useJobForm } from '../components/JobForm';
import { Button } from '../components/ui/Button';
import { ProcessingBadge, ScorePill } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';
import { Select } from '../components/ui/Field';
import { PageHeader, Pagination, SearchInput, useDebounced } from '../components/ui/Layout';
import { EmptyState, ErrorState, InlineError, LoadingRows } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';

const LIMIT = 20;

export function AddJobDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const form = useJobForm();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const notify = useToast();
  const create = useMutation({
    mutationFn: () => api.createJob(toJobPayload(form.values)),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.setQueryData(['job', job.id], job);
      notify('Job saved. Extracting its requirements…');
      form.setValues({ title: '', company: '', location: '', url: '', description: '' });
      onClose();
      navigate(`/jobs/${job.id}`);
    },
  });
  return (
    <Dialog
      open={open}
      onClose={create.isPending ? () => undefined : onClose}
      title="Add a job"
      description="Paste the posting. HireMatch extracts its requirements so you can analyze any resume against it."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button onClick={() => form.check() && create.mutate()} loading={create.isPending}>Save job</Button>
        </>
      }
    >
      <form onSubmit={(event) => form.check(event) && create.mutate()} className="space-y-4">
        <JobFields values={form.values} onChange={form.setValues} errors={form.errors} disabled={create.isPending} />
        {create.isError && <InlineError message={errorMessage(create.error)} />}
      </form>
    </Dialog>
  );
}

export default function Jobs() {
  const [params, setParams] = useSearchParams();
  const stage = params.get('stage') ?? '';
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('updated');
  const [offset, setOffset] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const q = useDebounced(search.trim());
  const queryClient = useQueryClient();
  const notify = useToast();

  const query = useQuery({
    queryKey: ['jobs', { q, stage, sort, offset }],
    queryFn: () => api.jobs({ q, stage: stage || undefined, sort, limit: LIMIT, offset }),
    placeholderData: (previous) => previous,
    refetchInterval: (current) => (current.state.data?.items.some((job) => job.status === 'processing') ? pollWhileProcessing('processing') : false),
  });
  const updateStage = useMutation({
    mutationFn: ({ id, value }: { id: number; value: ApplicationStage }) => api.updateJob(id, { stage: value }),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.setQueryData(['job', job.id], job);
      notify(`Moved “${job.title}” to ${stageLabel(job.stage)}.`);
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const setStage = (value: string) => {
    setOffset(0);
    setParams(value ? { stage: value } : {}, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Jobs & applications"
        description="Save the jobs you’re considering, analyze resumes against them, and keep track of where each application stands."
        actions={<Button icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>Add job</Button>}
      />
      <div role="tablist" aria-label="Filter by stage" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {[{ value: '', label: 'All' }, ...STAGES].map((item) => (
          <button
            key={item.value || 'all'}
            role="tab"
            type="button"
            aria-selected={stage === item.value}
            onClick={() => setStage(item.value)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${stage === item.value ? 'border-accent text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput label="Search jobs" placeholder="Search title, company or location" value={search} onChange={(value) => { setSearch(value); setOffset(0); }} />
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Sort by
          <Select value={sort} onChange={(event) => setSort(event.target.value)} className="w-auto py-1.5">
            <option value="updated">Recently updated</option>
            <option value="created">Recently added</option>
            <option value="follow_up">Next follow-up</option>
            <option value="title">Title</option>
          </Select>
        </label>
      </div>

      {query.isPending ? (
        <LoadingRows rows={4} label="Loading jobs" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.total === 0 ? (
        q || stage ? (
          <EmptyState title="No jobs match these filters" action={<Button variant="secondary" size="sm" onClick={() => { setSearch(''); setStage(''); }}>Clear filters</Button>} />
        ) : (
          <EmptyState
            icon={<BriefcaseBusiness size={26} />}
            title="Save your first job"
            description="Paste a job description you’re interested in. HireMatch never invents job listings — every job here is one you added."
            action={<Button icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>Add job</Button>}
          />
        )
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper">
            {query.data.items.map((job) => (
              <li key={job.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <ScorePill score={job.best_score} />
                  <div className="min-w-0">
                    <Link to={`/jobs/${job.id}`} className="block truncate font-medium hover:underline">
                      {job.title}
                    </Link>
                    <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
                      {[job.company, job.location].filter(Boolean).join(' · ') || 'No company'}
                      {job.status !== 'ready' && <ProcessingBadge status={job.status} />}
                      {job.follow_up_on && (
                        <span className="inline-flex items-center gap-1"><CalendarClock size={13} aria-hidden="true" /> {formatDate(job.follow_up_on, { day: 'numeric', month: 'short' })}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-[3.75rem] sm:pl-0">
                  <span className="hidden text-sm text-ink-faint md:inline">{formatRelative(job.updated_at)}</span>
                  <Select
                    aria-label={`Stage for ${job.title}`}
                    value={job.stage}
                    onChange={(event) => updateStage.mutate({ id: job.id, value: event.target.value as ApplicationStage })}
                    disabled={updateStage.isPending && updateStage.variables?.id === job.id}
                    className="w-40 py-1.5 text-sm"
                  >
                    {STAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </Select>
                </div>
              </li>
            ))}
          </ul>
          <Pagination total={query.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </>
      )}
      <AddJobDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
