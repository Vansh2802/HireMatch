import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { api, ApiError, errorMessage } from '../lib/api';
import { formatRelative } from '../lib/format';
import { waitUntilReady } from '../lib/polling';
import { JobFields, toJobPayload, useJobForm } from '../components/JobForm';
import { Button } from '../components/ui/Button';
import { ProcessingBadge } from '../components/ui/Badge';
import { PageHeader, Panel } from '../components/ui/Layout';
import { InlineError, LoadingRows } from '../components/ui/States';
import { UploadZone } from '../components/ui/UploadZone';

type StepState = 'idle' | 'running' | 'done' | 'failed';
type Steps = { resume: StepState; job: StepState; score: StepState };

function Tabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (value: T) => void; options: { value: T; label: string; disabled?: boolean }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded border border-line bg-sunk/60 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${value === option.value ? 'bg-paper text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ChoiceList({ name, items, selected, onSelect, empty }: { name: string; items: { id: number; title: string; meta: ReactNode; disabled?: boolean }[]; selected: number | null; onSelect: (id: number) => void; empty: ReactNode }) {
  if (items.length === 0) return <div className="text-sm text-ink-soft">{empty}</div>;
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{name}</legend>
      <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded border border-line">
        {items.map((item) => (
          <li key={item.id}>
            <label className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 ${item.disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-sunk/50'} ${selected === item.id ? 'bg-accent-wash/40' : ''}`}>
              <input type="radio" name={name} className="mt-1 accent-[rgb(var(--accent))]" checked={selected === item.id} disabled={item.disabled} onChange={() => onSelect(item.id)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.title}</span>
                <span className="block text-sm text-ink-soft">{item.meta}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function StepRow({ state, label, detail }: { state: StepState; label: string; detail?: string }) {
  const icon = {
    idle: <Circle size={16} className="text-ink-faint" />,
    running: <Loader2 size={16} className="animate-spin text-accent" />,
    done: <CheckCircle2 size={16} className="text-met" />,
    failed: <XCircle size={16} className="text-missing" />,
  }[state];
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5" aria-hidden="true">{icon}</span>
      <span>
        <span className={state === 'idle' ? 'text-ink-faint' : 'text-ink'}>{label}</span>
        {detail && <span className="block text-sm text-ink-soft">{detail}</span>}
        <span className="sr-only"> — {state}</span>
      </span>
    </li>
  );
}

export default function Analyze() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const resumes = useQuery({ queryKey: ['resumes', 'picker'], queryFn: () => api.resumes({ limit: 100 }) });
  const jobs = useQuery({ queryKey: ['jobs', 'picker'], queryFn: () => api.jobs({ limit: 100 }) });
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, staleTime: 5 * 60_000 });

  const presetResume = Number(params.get('resume')) || null;
  const presetJob = Number(params.get('job')) || null;
  const [resumeMode, setResumeMode] = useState<'saved' | 'upload'>('saved');
  const [jobMode, setJobMode] = useState<'saved' | 'new'>('saved');
  const [resumeId, setResumeId] = useState<number | null>(presetResume);
  const [jobId, setJobId] = useState<number | null>(presetJob);
  const [file, setFile] = useState<File | null>(null);
  const jobForm = useJobForm();
  const [steps, setSteps] = useState<Steps>({ resume: 'idle', job: 'idle', score: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);

  // Default to the "new" tabs when the library is empty.
  useEffect(() => {
    if (resumes.data && resumes.data.total === 0) setResumeMode('upload');
  }, [resumes.data]);
  useEffect(() => {
    if (jobs.data && jobs.data.total === 0) setJobMode('new');
  }, [jobs.data]);
  useEffect(() => () => abort.current?.abort(), []);

  const resumeItems = (resumes.data?.items ?? []).map((resume) => ({
    id: resume.id,
    title: resume.title,
    disabled: resume.current_version?.status === 'failed' && resume.version_count === 1,
    meta: (
      <span className="inline-flex flex-wrap items-center gap-2">
        {resume.current_version && <span>Version {resume.current_version.version_number}</span>}
        {resume.current_version && resume.current_version.status !== 'ready' && <ProcessingBadge status={resume.current_version.status} />}
        <span>updated {formatRelative(resume.updated_at)}</span>
      </span>
    ),
  }));
  const jobItems = (jobs.data?.items ?? []).map((job) => ({
    id: job.id,
    title: job.company ? `${job.title} · ${job.company}` : job.title,
    disabled: job.status === 'failed',
    meta: (
      <span className="inline-flex flex-wrap items-center gap-2">
        {job.status !== 'ready' ? <ProcessingBadge status={job.status} /> : <span>{job.requirement_count} requirements</span>}
        <span>saved {formatRelative(job.created_at)}</span>
      </span>
    ),
  }));

  const maxMb = health.data?.limits.max_upload_size_mb ?? 10;
  const resumeReady = resumeMode === 'saved' ? resumeId !== null : file !== null;

  const run = async () => {
    if (running) return;
    setError(null);
    let jobValid = true;
    if (jobMode === 'new') jobValid = jobForm.check();
    if (!resumeReady) {
      setError(resumeMode === 'saved' ? 'Choose a resume to analyze.' : 'Choose a resume file to upload.');
      return;
    }
    if (jobMode === 'saved' && jobId === null) {
      setError('Choose a saved job, or paste a new job description.');
      return;
    }
    if (!jobValid) return;

    setRunning(true);
    abort.current = new AbortController();
    const signal = abort.current.signal;
    setSteps({ resume: 'running', job: 'idle', score: 'idle' });
    let stage: keyof Steps = 'resume';
    try {
      let rid = resumeId;
      if (resumeMode === 'upload' && file) {
        try {
          const created = await api.uploadResume(file);
          rid = created.id;
        } catch (uploadError) {
          const existing = uploadError instanceof ApiError && uploadError.status === 409 ? (uploadError.data as { resume_id?: number } | undefined)?.resume_id : undefined;
          if (!existing) throw uploadError;
          rid = existing; // identical file already in the library: reuse it
        }
        // Keep the created resume selected so a retry never uploads it twice.
        setResumeId(rid);
        setResumeMode('saved');
        setFile(null);
        queryClient.invalidateQueries({ queryKey: ['resumes'] });
      }
      await waitUntilReady(
        () => api.resume(rid!),
        (resume) => (resume.versions.some((v) => v.status === 'ready') ? 'ready' : resume.current_version?.status),
        (resume) => resume.current_version?.error_message,
        { signal },
      );
      setSteps((s) => ({ ...s, resume: 'done', job: 'running' }));

      stage = 'job';
      let jid = jobId;
      if (jobMode === 'new') {
        const created = await api.createJob(toJobPayload(jobForm.values));
        jid = created.id;
        setJobId(jid);
        setJobMode('saved');
        jobForm.setValues({ title: '', company: '', location: '', url: '', description: '' });
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
      }
      await waitUntilReady(() => api.job(jid!), (job) => job.status, (job) => job.error_message, { signal });
      setSteps((s) => ({ ...s, job: 'done', score: 'running' }));

      stage = 'score';
      const analysis = await api.createAnalysis(rid!, jid!);
      setSteps((s) => ({ ...s, score: 'done' }));
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.setQueryData(['analysis', analysis.id], analysis);
      navigate(`/analyses/${analysis.id}`);
    } catch (runError) {
      if (signal.aborted) return;
      setSteps((s) => ({ ...s, [stage]: 'failed' }));
      setError(errorMessage(runError));
      setRunning(false);
    }
  };

  const llmMode = health.data?.dependencies.llm;
  return (
    <>
      <PageHeader title="Analyze a resume" description="Choose a resume and a job. HireMatch checks each of the job’s requirements against your resume and explains the result." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="1. Resume"
          actions={
            <Tabs
              label="Resume source"
              value={resumeMode}
              onChange={setResumeMode}
              options={[
                { value: 'saved', label: 'My resumes', disabled: running || resumes.data?.total === 0 },
                { value: 'upload', label: 'Upload new', disabled: running },
              ]}
            />
          }
        >
          {resumeMode === 'saved' ? (
            resumes.isPending ? (
              <LoadingRows rows={3} label="Loading resumes" />
            ) : resumes.isError ? (
              <InlineError message={errorMessage(resumes.error)} />
            ) : (
              <ChoiceList name="Resume" items={resumeItems} selected={resumeId} onSelect={setResumeId} empty="You have no saved resumes yet. Upload one instead." />
            )
          ) : (
            <UploadZone file={file} onFile={setFile} disabled={running} maxMb={maxMb} />
          )}
        </Panel>

        <Panel
          title="2. Job"
          actions={
            <Tabs
              label="Job source"
              value={jobMode}
              onChange={setJobMode}
              options={[
                { value: 'saved', label: 'Saved jobs', disabled: running || jobs.data?.total === 0 },
                { value: 'new', label: 'Paste new', disabled: running },
              ]}
            />
          }
        >
          {jobMode === 'saved' ? (
            jobs.isPending ? (
              <LoadingRows rows={3} label="Loading jobs" />
            ) : jobs.isError ? (
              <InlineError message={errorMessage(jobs.error)} />
            ) : (
              <ChoiceList name="Job" items={jobItems} selected={jobId} onSelect={setJobId} empty="You have no saved jobs yet. Paste a job description instead." />
            )
          ) : (
            <JobFields values={jobForm.values} onChange={jobForm.setValues} errors={jobForm.errors} disabled={running} compact />
          )}
        </Panel>
      </div>

      <section aria-label="Run analysis" className="mt-6 flex flex-col gap-5 rounded-lg border border-line bg-paper p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="space-y-3">
          {running || steps.resume !== 'idle' ? (
            <ol className="space-y-2" aria-live="polite">
              <StepRow state={steps.resume} label="Read the resume" detail={steps.resume === 'running' ? 'Extracting skills, roles and dates…' : undefined} />
              <StepRow state={steps.job} label="Extract the job’s requirements" detail={steps.job === 'running' ? 'Separating required and preferred items…' : undefined} />
              <StepRow state={steps.score} label="Check each requirement against the resume" />
            </ol>
          ) : (
            <p className="max-w-prose text-sm text-ink-soft">
              Reading a new resume or job usually takes a few seconds{llmMode === 'configured' ? ' (up to a minute when the AI reader is busy)' : ''}. Results are saved to your
              history.
            </p>
          )}
          <InlineError message={error} />
        </div>
        <div className="flex shrink-0 gap-2">
          {running && (
            <Button
              variant="secondary"
              onClick={() => {
                abort.current?.abort();
                setRunning(false);
                setSteps({ resume: 'idle', job: 'idle', score: 'idle' });
              }}
            >
              Stop waiting
            </Button>
          )}
          <Button onClick={run} loading={running} disabled={running}>
            {running ? 'Analyzing…' : error ? 'Try again' : 'Run analysis'}
          </Button>
        </div>
      </section>
    </>
  );
}
