import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, Gauge, Pencil, RefreshCw, Trash2, Undo2, X } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { CATEGORY_LABEL, formatDate, formatRelative, STAGES, stageLabel } from '../lib/format';
import { pollWhileProcessing } from '../lib/polling';
import type { ApplicationStage, Importance, Job, Requirement, RequirementCategory } from '../lib/types';
import { JobFields, toJobPayload, useJobForm } from '../components/JobForm';
import { Button, LinkButton } from '../components/ui/Button';
import { Badge, ScorePill } from '../components/ui/Badge';
import { ConfirmDialog, Dialog } from '../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { InfoTip, PageHeader, Panel } from '../components/ui/Layout';
import { EmptyState, ErrorState, InlineError, LoadingRows, Spinner } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';

const CATEGORY_ORDER: RequirementCategory[] = ['skill', 'experience', 'education', 'certification', 'qualification', 'responsibility'];

export default function JobDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const query = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.job(id),
    enabled: Number.isFinite(id),
    refetchInterval: (current) => pollWhileProcessing(current.state.data?.status),
  });
  const setJob = (job: Job) => {
    queryClient.setQueryData(['job', id], job);
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const retry = useMutation({ mutationFn: () => api.retryJob(id), onSuccess: setJob, onError: (error) => notify(errorMessage(error), 'error') });
  const remove = useMutation({
    mutationFn: () => api.deleteJob(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['job', id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notify('Job deleted. Its analyses are kept in your history.');
      navigate('/jobs', { replace: true });
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  if (query.isPending) return <LoadingRows rows={5} label="Loading job" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const job = query.data;
  const isLegacy = job.profile?.method === 'legacy';

  return (
    <>
      <PageHeader
        back={{ to: '/jobs', label: 'Jobs & applications' }}
        title={job.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            {[job.company, job.location].filter(Boolean).join(' · ') || 'No company recorded'}
            {job.url && (
              <a href={job.url} target="_blank" rel="noopener noreferrer nofollow" className="link inline-flex items-center gap-1 text-sm">
                Original posting <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
          </span>
        }
        actions={
          <>
            <LinkButton to={`/analyze?job=${job.id}`} icon={<Gauge size={16} />}>Analyze a resume</LinkButton>
            <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => setDeleteOpen(true)} className="hover:text-missing">Delete</Button>
          </>
        }
      />

      {job.status === 'processing' && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-unknown/30 bg-unknown-wash/60 px-4 py-3">
          <Spinner />
          <p className="text-sm">Extracting requirements from the description. This page updates automatically.</p>
        </div>
      )}
      {(job.status === 'failed' || isLegacy) && (
        <div role="alert" className="mb-5 flex flex-col gap-3 rounded-lg border border-partial/30 bg-partial-wash/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-partial" />
            {job.status === 'failed' ? `Requirements could not be extracted: ${job.error_message}` : 'These requirements were imported from an earlier version of HireMatch and have no source lines.'}
          </p>
          <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} loading={retry.isPending} onClick={() => retry.mutate()}>
            {job.status === 'failed' ? 'Retry' : 'Re-extract requirements'}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {job.status === 'ready' && job.profile && <Requirements job={job} onSaved={setJob} />}
          <JobAnalyses jobId={job.id} />
          <Panel title="Job description" description={`Revision ${job.revision} · saved ${formatDate(job.updated_at)}`}>
            <p className="max-h-[28rem] overflow-auto whitespace-pre-line text-sm leading-relaxed">{job.description}</p>
          </Panel>
        </div>
        <Tracker job={job} onSaved={setJob} />
      </div>

      <EditJobDialog open={editOpen} onClose={() => setEditOpen(false)} job={job} onSaved={setJob} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete “${job.title}”?`}
        description={`The job, its requirements and your application notes are deleted.${job.analysis_count ? ` Its ${job.analysis_count} analys${job.analysis_count === 1 ? 'is stays' : 'es stay'} in your history with a copy of the job details.` : ''}`}
        confirmLabel="Delete job"
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}

function Requirements({ job, onSaved }: { job: Job; onSaved: (job: Job) => void }) {
  const profile = job.profile!;
  const [editing, setEditing] = useState(false);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [importance, setImportance] = useState<Record<string, Importance>>({});
  const notify = useToast();
  const save = useMutation({
    mutationFn: () =>
      api.updateRequirements(
        job.id,
        profile.requirements.filter((r) => !removed.has(r.id)).map((r) => ({ id: r.id, importance: importance[r.id] ?? r.importance })),
        job.revision,
      ),
    onSuccess: (updated) => {
      onSaved(updated);
      setEditing(false);
      notify('Requirements updated. New analyses will use them.');
    },
  });
  useEffect(() => {
    if (!editing) {
      setRemoved(new Set());
      setImportance({});
    }
  }, [editing]);

  const groups = CATEGORY_ORDER.map((category) => ({ category, items: profile.requirements.filter((r) => r.category === category) })).filter((g) => g.items.length);
  const required = profile.requirements.filter((r) => r.importance === 'required').length;

  return (
    <Panel
      title="Extracted requirements"
      description={`${profile.requirements.length} found · ${required} required · read by ${profile.method === 'llm' ? 'AI model' : profile.method === 'legacy' ? 'an earlier version' : 'built-in rules'}`}
      actions={
        editing ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={save.isPending}>Cancel</Button>
            <Button size="sm" onClick={() => save.mutate()} loading={save.isPending}>Save changes</Button>
          </>
        ) : (
          profile.requirements.length > 0 && <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => setEditing(true)}>Review</Button>
        )
      }
      bodyClassName=""
    >
      {profile.warnings.length > 0 && (
        <ul className="space-y-1 border-b border-line bg-partial-wash/40 px-4 py-3 text-sm sm:px-5">
          {profile.warnings.map((warning) => <li key={warning} className="flex gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-partial" />{warning}</li>)}
        </ul>
      )}
      {editing && (
        <p className="border-b border-line px-4 py-2.5 text-sm text-ink-soft sm:px-5">
          Remove anything that was misread, or switch between required and preferred. Saving creates a new revision; earlier analyses are unchanged.
        </p>
      )}
      {save.isError && <div className="px-4 pt-3 sm:px-5"><InlineError message={errorMessage(save.error)} /></div>}
      {groups.length === 0 ? (
        <div className="p-5"><EmptyState compact title="No requirements found" description="Edit the description to include the requirements section of the posting." /></div>
      ) : (
        groups.map((group) => (
          <section key={group.category} className="border-b border-line last:border-0">
            <h3 className="px-4 pb-1 pt-3 text-sm font-semibold text-ink-soft sm:px-5">{CATEGORY_LABEL[group.category]}{group.items.length > 1 ? 's' : ''}</h3>
            <ul>
              {group.items.map((requirement) => (
                <RequirementRow
                  key={requirement.id}
                  requirement={requirement}
                  editing={editing}
                  removed={removed.has(requirement.id)}
                  importance={importance[requirement.id] ?? requirement.importance}
                  onToggleRemove={() => setRemoved((current) => { const next = new Set(current); if (next.has(requirement.id)) next.delete(requirement.id); else next.add(requirement.id); return next; })}
                  onImportance={(value) => setImportance((current) => ({ ...current, [requirement.id]: value }))}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </Panel>
  );
}

function RequirementRow({ requirement, editing, removed, importance, onToggleRemove, onImportance }: { requirement: Requirement; editing: boolean; removed: boolean; importance: Importance; onToggleRemove: () => void; onImportance: (value: Importance) => void }) {
  return (
    <li className={`flex items-start gap-3 px-4 py-2 sm:px-5 ${removed ? 'opacity-45' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className={`flex flex-wrap items-center gap-1.5 ${removed ? 'line-through' : ''}`}>
          <span className="font-medium">{requirement.text}</span>
          {!editing && <Badge tone={importance === 'required' ? 'dark' : 'neutral'}>{importance === 'required' ? 'Required' : 'Preferred'}</Badge>}
          {requirement.uncertain && <Badge tone="unknown" title="The posting is ambiguous about this; it counts half.">Uncertain</Badge>}
        </p>
        {requirement.source_excerpt && requirement.source_excerpt !== requirement.text && (
          <p className="mt-0.5 text-sm text-ink-soft">“{requirement.source_excerpt}”</p>
        )}
      </div>
      {editing && (
        <div className="flex shrink-0 items-center gap-1">
          <Select aria-label={`Importance of ${requirement.text}`} value={importance} onChange={(event) => onImportance(event.target.value as Importance)} disabled={removed} className="w-32 py-1 text-sm">
            <option value="required">Required</option>
            <option value="preferred">Preferred</option>
          </Select>
          <button type="button" onClick={onToggleRemove} className="rounded p-1.5 text-ink-soft hover:bg-sunk hover:text-ink" aria-label={removed ? `Restore ${requirement.text}` : `Remove ${requirement.text}`}>
            {removed ? <Undo2 size={15} /> : <X size={15} />}
          </button>
        </div>
      )}
    </li>
  );
}

function Tracker({ job, onSaved }: { job: Job; onSaved: (job: Job) => void }) {
  const [stage, setStage] = useState<ApplicationStage>(job.stage);
  const [appliedOn, setAppliedOn] = useState(job.applied_on ?? '');
  const [followUp, setFollowUp] = useState(job.follow_up_on ?? '');
  const [notes, setNotes] = useState(job.notes ?? '');
  const notify = useToast();
  useEffect(() => {
    setStage(job.stage);
    setAppliedOn(job.applied_on ?? '');
    setFollowUp(job.follow_up_on ?? '');
    setNotes(job.notes ?? '');
  }, [job.id, job.stage, job.applied_on, job.follow_up_on, job.notes]);
  const dirty = stage !== job.stage || appliedOn !== (job.applied_on ?? '') || followUp !== (job.follow_up_on ?? '') || notes !== (job.notes ?? '');
  const save = useMutation({
    mutationFn: () => api.updateJob(job.id, { stage, applied_on: appliedOn || null, follow_up_on: followUp || null, notes: notes.trim() ? notes : null }),
    onSuccess: (updated) => {
      onSaved(updated);
      notify(`Application saved · ${stageLabel(updated.stage)}.`);
    },
  });
  return (
    <Panel title="Your application" description="Only you see this. HireMatch never applies on your behalf." className="self-start">
      <form onSubmit={(event) => { event.preventDefault(); if (dirty) save.mutate(); }} className="space-y-4">
        <Field label="Stage">
          <Select
            value={stage}
            onChange={(event) => {
              const value = event.target.value as ApplicationStage;
              setStage(value);
              if (value === 'applied' && !appliedOn) setAppliedOn(new Date().toLocaleDateString('en-CA'));
            }}
          >
            {STAGES.map((item) => <option key={item.value} value={item.value}>{item.label} — {item.hint}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Applied on" optional><Input type="date" value={appliedOn} onChange={(event) => setAppliedOn(event.target.value)} /></Field>
          <Field label="Follow up on" optional><Input type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></Field>
        </div>
        <Field label="Notes" optional hint="Contacts, interview dates, what to emphasise…">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} maxLength={10000} />
        </Field>
        {save.isError && <InlineError message={errorMessage(save.error)} />}
        <Button type="submit" disabled={!dirty} loading={save.isPending} className="w-full">Save application</Button>
      </form>
    </Panel>
  );
}

function JobAnalyses({ jobId }: { jobId: number }) {
  const query = useQuery({ queryKey: ['analyses', { job_id: jobId }], queryFn: () => api.analyses({ job_id: jobId, limit: 50 }) });
  return (
    <Panel
      title="Analyses for this job"
      actions={
        <span className="inline-flex items-center gap-1 text-sm text-ink-soft">
          Newest first
          <InfoTip label="About scores over time">Re-run an analysis after improving your resume to see how the evidence changes. Each row shows which resume version was used.</InfoTip>
        </span>
      }
      bodyClassName=""
    >
      {query.isPending ? (
        <div className="p-5"><LoadingRows rows={2} /></div>
      ) : query.isError ? (
        <div className="p-5"><ErrorState error={query.error} onRetry={() => query.refetch()} /></div>
      ) : query.data.items.length === 0 ? (
        <div className="p-5"><EmptyState compact title="No analyses yet" description="Analyze one of your resumes against this job." action={<LinkButton to={`/analyze?job=${jobId}`} size="sm">Analyze a resume</LinkButton>} /></div>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {query.data.items.map((analysis) => (
              <li key={analysis.id}>
                <Link to={`/analyses/${analysis.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-sunk/50 sm:px-5">
                  <ScorePill score={analysis.score} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{analysis.resume_title} <span className="font-normal text-ink-soft">v{analysis.resume_version_number}</span></p>
                    <p className="text-sm text-ink-soft">{analysis.verdict}</p>
                  </div>
                  <span className="text-sm text-ink-faint">{formatRelative(analysis.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {query.data.items.length > 1 && (
            <div className="border-t border-line px-4 py-3 sm:px-5">
              <LinkButton size="sm" variant="secondary" to={`/compare?ids=${query.data.items.slice(0, 4).reverse().map((a) => a.id).join(',')}`}>
                Compare these analyses
              </LinkButton>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function EditJobDialog({ open, onClose, job, onSaved }: { open: boolean; onClose: () => void; job: Job; onSaved: (job: Job) => void }) {
  const form = useJobForm({ title: job.title, company: job.company ?? '', location: job.location ?? '', url: job.url ?? '', description: job.description });
  const notify = useToast();
  useEffect(() => {
    if (open) form.setValues({ title: job.title, company: job.company ?? '', location: job.location ?? '', url: job.url ?? '', description: job.description });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = useMutation({
    mutationFn: () => api.updateJob(job.id, toJobPayload(form.values)),
    onSuccess: (updated) => {
      onSaved(updated);
      notify(updated.revision !== job.revision ? 'Saved. Requirements are being re-extracted from the new description.' : 'Job details saved.');
      onClose();
    },
  });
  return (
    <Dialog
      open={open}
      onClose={save.isPending ? () => undefined : onClose}
      title="Edit job"
      description="Changing the description re-extracts requirements as a new revision. Existing analyses keep the version they used."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => form.check() && save.mutate()} loading={save.isPending}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        <JobFields values={form.values} onChange={form.setValues} errors={form.errors} disabled={save.isPending} />
        {save.isError && <InlineError message={errorMessage(save.error)} />}
      </div>
    </Dialog>
  );
}
