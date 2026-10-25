import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Gauge, Pencil, RefreshCw, Trash2, Upload } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { formatBytes, formatDate, formatRelative } from '../lib/format';
import { pollWhileProcessing } from '../lib/polling';
import type { ResumeDetail as ResumeDetailData, ResumeProfile, ResumeVersion } from '../lib/types';
import { ProfileEditor } from '../components/ProfileEditor';
import { ResumeUploadDialog } from '../components/ResumeUploadDialog';
import { Button, LinkButton } from '../components/ui/Button';
import { Badge, ProcessingBadge, ScorePill } from '../components/ui/Badge';
import { ConfirmDialog, Dialog } from '../components/ui/Dialog';
import { Field, Input } from '../components/ui/Field';
import { PageHeader, Panel } from '../components/ui/Layout';
import { EmptyState, ErrorState, InlineError, LoadingRows, Spinner } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';

type Tab = 'details' | 'text' | 'versions' | 'analyses';

export default function ResumeDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useToast();
  const [tab, setTab] = useState<Tab>('details');
  const [editing, setEditing] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);

  const query = useQuery({
    queryKey: ['resume', id],
    queryFn: () => api.resume(id),
    enabled: Number.isFinite(id),
    refetchInterval: (current) => pollWhileProcessing(current.state.data?.versions.some((v) => v.status === 'processing') ? 'processing' : undefined),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['resumes'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const retry = useMutation({
    mutationFn: (versionId: number) => api.retryResumeVersion(id, versionId),
    onSuccess: (data) => queryClient.setQueryData(['resume', id], data),
    onError: (error) => notify(errorMessage(error), 'error'),
  });
  const saveProfile = useMutation({
    mutationFn: ({ profile, base }: { profile: ResumeProfile; base: number }) => api.saveProfile(id, profile, base),
    onSuccess: (data) => {
      queryClient.setQueryData(['resume', id], data);
      invalidate();
      setEditing(false);
      notify(`Saved as version ${data.current_version?.version_number}.`);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteResume(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['resume', id] });
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      invalidate();
      notify('Resume and its analyses deleted.');
      navigate('/resumes', { replace: true });
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  if (query.isPending) return <LoadingRows rows={5} label="Loading resume" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const resume = query.data;
  const current = resume.current_version;
  const latest = resume.versions[0];

  return (
    <>
      <PageHeader
        back={{ to: '/resumes', label: 'My resumes' }}
        title={resume.title}
        description={
          <span>
            {resume.version_count} version{resume.version_count === 1 ? '' : 's'} · added {formatDate(resume.created_at)}
          </span>
        }
        actions={
          <>
            <LinkButton to={`/analyze?resume=${resume.id}`} icon={<Gauge size={16} />} variant="primary">
              Analyze against a job
            </LinkButton>
            <Button variant="secondary" icon={<Upload size={16} />} onClick={() => setVersionOpen(true)}>
              New version
            </Button>
            <Button variant="ghost" icon={<Pencil size={15} />} onClick={() => setRenameOpen(true)}>
              Rename
            </Button>
            <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => setDeleteOpen(true)} className="hover:text-missing">
              Delete
            </Button>
          </>
        }
      />

      {latest && latest.status === 'processing' && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-unknown/30 bg-unknown-wash/60 px-4 py-3">
          <Spinner />
          <p className="text-sm">Reading version {latest.version_number}. This page updates automatically.</p>
        </div>
      )}
      {latest && latest.status === 'failed' && (
        <div role="alert" className="mb-5 flex flex-col gap-3 rounded-lg border border-missing/30 bg-missing-wash/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-missing" />
            <span>
              Version {latest.version_number} could not be processed: {latest.error_message}
              {current && current.id !== latest.id && ` Analyses keep using version ${current.version_number}.`}
            </span>
          </p>
          <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} loading={retry.isPending} onClick={() => retry.mutate(latest.id)}>
            Retry
          </Button>
        </div>
      )}

      <div role="tablist" aria-label="Resume sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {(
          [
            ['details', 'Extracted details'],
            ['text', 'Document text'],
            ['versions', `Versions (${resume.version_count})`],
            ['analyses', `Analyses (${resume.analysis_count})`],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => {
              setTab(value);
              setEditing(false);
            }}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === value ? 'border-accent text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'details' &&
          (!current || current.status !== 'ready' || !current.profile ? (
            <EmptyState title="Nothing extracted yet" description={current?.status === 'processing' ? 'Details appear here once the resume has been read.' : 'Upload a new version or retry processing.'} />
          ) : editing ? (
            <Panel title={`Correct version ${current.version_number}`}>
              <ProfileEditor
                profile={current.profile}
                saving={saveProfile.isPending}
                error={saveProfile.isError ? errorMessage(saveProfile.error) : null}
                onCancel={() => setEditing(false)}
                onSave={(profile) => saveProfile.mutate({ profile, base: current.id })}
              />
            </Panel>
          ) : (
            <ProfileView version={current} onEdit={() => setEditing(true)} />
          ))}
        {tab === 'text' && <DocumentText resume={resume} />}
        {tab === 'versions' && <Versions versions={resume.versions} currentId={current?.id} onRetry={(versionId) => retry.mutate(versionId)} retrying={retry.isPending} />}
        {tab === 'analyses' && <ResumeAnalyses resumeId={resume.id} />}
      </div>

      <RenameDialog open={renameOpen} onClose={() => setRenameOpen(false)} resume={resume} />
      <ResumeUploadDialog open={versionOpen} onClose={() => setVersionOpen(false)} resumeId={resume.id} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete “${resume.title}”?`}
        description={
          <>
            This permanently deletes all {resume.version_count} version{resume.version_count === 1 ? '' : 's'}
            {resume.analysis_count ? ` and the ${resume.analysis_count} analys${resume.analysis_count === 1 ? 'is' : 'es'} made from it` : ''}. Saved jobs are not affected.
          </>
        }
        confirmLabel="Delete resume"
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}

function RenameDialog({ open, onClose, resume }: { open: boolean; onClose: () => void; resume: ResumeDetailData }) {
  const [title, setTitle] = useState(resume.title);
  const queryClient = useQueryClient();
  const rename = useMutation({
    mutationFn: () => api.renameResume(resume.id, title.trim()),
    onSuccess: (data) => {
      queryClient.setQueryData(['resume', resume.id], data);
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      onClose();
    },
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Rename resume"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => rename.mutate()} loading={rename.isPending} disabled={!title.trim()}>Save name</Button>
        </>
      }
    >
      <form onSubmit={(event) => { event.preventDefault(); if (title.trim()) rename.mutate(); }} className="space-y-3">
        <Field label="Name"><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} autoFocus /></Field>
        {rename.isError && <InlineError message={errorMessage(rename.error)} />}
      </form>
    </Dialog>
  );
}

function Definition({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-ink-soft">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function ProfileView({ version, onEdit }: { version: ResumeVersion & { raw_text?: string }; onEdit: () => void }) {
  const profile = version.profile!;
  const yearsSource = { date_ranges: 'calculated from dated roles', stated: 'as stated in the resume', user: 'entered by you' }[profile.experience_years_source ?? 'stated'];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <Panel
        title={`Version ${version.version_number}`}
        description={`${version.source === 'edit' ? 'Your corrections' : version.source === 'legacy' ? 'Imported' : 'Uploaded'} ${formatRelative(version.created_at)} · read by ${version.extraction_method === 'llm' ? 'AI model' : version.extraction_method === 'user' ? 'you' : 'built-in rules'}`}
        actions={<Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={onEdit}>Correct details</Button>}
      >
        <dl className="divide-y divide-line">
          <Definition term="Name">{profile.name || <span className="text-ink-faint">Not found</span>}</Definition>
          <Definition term="Contact">{[profile.email, profile.phone].filter(Boolean).join(' · ') || <span className="text-ink-faint">Not found</span>}</Definition>
          <Definition term="Experience">
            {profile.total_experience_years !== null ? `About ${profile.total_experience_years} years (${yearsSource})` : <span className="text-ink-faint">Could not be calculated</span>}
          </Definition>
          <Definition term={`Skills (${profile.skills.length})`}>
            {profile.skills.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill) => (
                  <li key={skill}><Badge>{skill}</Badge></li>
                ))}
              </ul>
            ) : (
              <span className="text-ink-faint">None recognised</span>
            )}
          </Definition>
          {profile.summary && <Definition term="Summary"><p className="whitespace-pre-line text-sm">{profile.summary}</p></Definition>}
          <Definition term="Roles">
            {profile.experiences.length ? (
              <ul className="space-y-3">
                {profile.experiences.map((role, index) => (
                  <li key={index}>
                    <p className="font-medium">{[role.title, role.company].filter(Boolean).join(' · ') || 'Untitled role'}</p>
                    <p className="text-sm text-ink-soft">{[role.start, role.end].filter(Boolean).join(' – ')}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-ink-faint">None recognised</span>
            )}
          </Definition>
          <Definition term="Education">
            {profile.education.length ? (
              <ul className="space-y-2">
                {profile.education.map((entry, index) => (
                  <li key={index}>
                    <p className="font-medium">{entry.degree}</p>
                    <p className="text-sm text-ink-soft">{[entry.institution, entry.end && !entry.institution?.includes(entry.end) ? entry.end : null].filter(Boolean).join(' · ')}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-ink-faint">None recognised</span>
            )}
          </Definition>
          {profile.certifications.length > 0 && (
            <Definition term="Certifications">
              <ul className="list-disc space-y-0.5 pl-4 text-sm">{profile.certifications.map((cert) => <li key={cert}>{cert}</li>)}</ul>
            </Definition>
          )}
        </dl>
      </Panel>
      <Panel title="Reading notes" description="Things worth checking or fixing in your resume.">
        {version.warnings.length ? (
          <ul className="space-y-3 text-sm">
            {version.warnings.map((warning) => (
              <li key={warning} className="flex gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-partial" aria-hidden="true" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">No problems found while reading this version.</p>
        )}
        <dl className="mt-5 space-y-1 border-t border-line pt-4 text-sm text-ink-soft">
          <div className="flex justify-between gap-3"><dt>File</dt><dd className="truncate text-ink">{version.file_name ?? '—'}</dd></div>
          <div className="flex justify-between gap-3"><dt>Size</dt><dd className="text-ink">{formatBytes(version.file_size)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Text extracted</dt><dd className="tabular text-ink">{version.text_length.toLocaleString()} characters</dd></div>
        </dl>
      </Panel>
    </div>
  );
}

function DocumentText({ resume }: { resume: ResumeDetailData }) {
  const text = resume.current_version?.raw_text ?? '';
  return (
    <Panel title="Text read from the document" description="This is exactly what HireMatch analyses. If something is missing here, it is likely missing for applicant tracking systems too.">
      {text ? (
        <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap break-words rounded bg-sunk/50 p-4 font-sans text-sm leading-relaxed">{text}</pre>
      ) : (
        <p className="text-sm text-ink-soft">No document text is available for this version.</p>
      )}
    </Panel>
  );
}

function Versions({ versions, currentId, onRetry, retrying }: { versions: ResumeVersion[]; currentId?: number; onRetry: (id: number) => void; retrying: boolean }) {
  return (
    <Panel bodyClassName="">
      <ul className="divide-y divide-line">
        {versions.map((version) => (
          <li key={version.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
            <span className="type-condensed tabular w-10 text-2xl font-semibold text-ink-soft">v{version.version_number}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {version.source === 'edit' ? 'Corrections saved' : version.source === 'legacy' ? 'Imported from an earlier version' : version.file_name}
                {version.id === currentId && <Badge tone="accent" className="ml-2">Used for new analyses</Badge>}
              </p>
              <p className="text-sm text-ink-soft">{formatDate(version.created_at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              {version.status === 'failed' && <p className="text-sm text-missing">{version.error_message}</p>}
            </div>
            <ProcessingBadge status={version.status} />
            {version.status === 'failed' && (
              <Button size="sm" variant="secondary" onClick={() => onRetry(version.id)} loading={retrying}>Retry</Button>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ResumeAnalyses({ resumeId }: { resumeId: number }) {
  const query = useQuery({ queryKey: ['analyses', { resume_id: resumeId, sort: 'score' }], queryFn: () => api.analyses({ resume_id: resumeId, sort: 'score', limit: 50 }) });
  if (query.isPending) return <LoadingRows rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data.items.length)
    return <EmptyState title="Not analysed yet" description="Analyze this resume against a job to see how it matches." action={<LinkButton to={`/analyze?resume=${resumeId}`} size="sm">Analyze against a job</LinkButton>} />;
  const ids = query.data.items.slice(0, 4).map((a) => a.id).join(',');
  return (
    <Panel
      title="This resume across jobs"
      description="Sorted by score. Scores show how clearly this resume evidences each job’s own requirements, so a lower score points to the jobs where tailoring matters most."
      actions={query.data.items.length > 1 && <LinkButton to={`/compare?ids=${ids}`} size="sm" variant="secondary">Compare top {Math.min(4, query.data.items.length)}</LinkButton>}
      bodyClassName=""
    >
      <ul className="divide-y divide-line">
        {query.data.items.map((analysis) => (
          <li key={analysis.id}>
            <Link to={`/analyses/${analysis.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-sunk/50 sm:px-5">
              <ScorePill score={analysis.score} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{analysis.job_title}{analysis.job_company && <span className="font-normal text-ink-soft"> at {analysis.job_company}</span>}</p>
                <p className="text-sm text-ink-soft">{analysis.verdict} · resume v{analysis.resume_version_number}</p>
              </div>
              <span className="hidden text-sm text-ink-faint sm:block">{formatRelative(analysis.created_at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
