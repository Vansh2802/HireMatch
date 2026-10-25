import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { useSession } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { ConfirmDialog, Dialog } from '../components/ui/Dialog';
import { Field, Input } from '../components/ui/Field';
import { PageHeader, Panel } from '../components/ui/Layout';
import { InlineError, Skeleton } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';

export default function Settings() {
  const { data: user } = useSession();
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, staleTime: 5 * 60_000 });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const notify = useToast();
  const [signOutAllOpen, setSignOutAllOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const signOutAll = useMutation({
    mutationFn: api.logoutAll,
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(['me'], null);
      notify('Signed out on all devices.', 'info');
      navigate('/login', { replace: true });
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const reader = health.data?.dependencies.llm === 'configured' ? `AI model (${health.data.dependencies.model})` : health.data?.dependencies.llm === 'mock' ? 'Built-in rules (no AI provider)' : 'Unavailable';

  return (
    <>
      <PageHeader title="Settings & privacy" description="Manage your account and the data HireMatch keeps for you." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Account">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-ink-soft">Email</dt><dd className="font-medium">{user?.email}</dd></div>
            <div><dt className="text-ink-soft">Member since</dt><dd className="font-medium">{formatDate(user?.created_at)}</dd></div>
          </dl>
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="font-semibold">Sessions</h3>
            <p className="mt-1 text-sm text-ink-soft">Signs you out on every browser and device, including this one.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setSignOutAllOpen(true)}>Sign out everywhere</Button>
          </div>
        </Panel>

        <ChangePassword />

        <Panel title="Your data">
          {dashboard.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : dashboard.data ? (
            <ul className="grid grid-cols-3 gap-px overflow-hidden rounded border border-line bg-line text-center">
              {[['Resumes', dashboard.data.counts.resumes], ['Jobs', dashboard.data.counts.jobs], ['Analyses', dashboard.data.counts.analyses]].map(([label, value]) => (
                <li key={label} className="bg-paper py-3"><p className="type-condensed tabular text-2xl font-semibold">{value}</p><p className="text-xs text-ink-soft">{label}</p></li>
              ))}
            </ul>
          ) : (
            <InlineError message={errorMessage(dashboard.error)} />
          )}
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
            <li>Original resume files are not stored — only the text extracted from them.</li>
            <li>Delete a resume from its page to remove all its versions and the analyses made from it.</li>
            <li>Delete a job from its page; its analyses stay in your history with a copy of the job details.</li>
            <li>Document reading on this server: <span className="font-medium text-ink">{health.isPending ? '…' : reader}</span>. Contact details are removed before text is sent to an AI provider.</li>
          </ul>
        </Panel>

        <Panel title="Delete account" className="border-missing/40">
          <p className="text-sm text-ink-soft">Permanently deletes your account, every resume and version, every saved job and note, and every analysis. This cannot be undone.</p>
          <Button variant="danger" size="sm" className="mt-4" onClick={() => setDeleteOpen(true)}>Delete my account</Button>
        </Panel>
      </div>

      <ConfirmDialog
        open={signOutAllOpen}
        onClose={() => setSignOutAllOpen(false)}
        title="Sign out everywhere?"
        description="You will need to sign in again on every device."
        confirmLabel="Sign out everywhere"
        danger={false}
        pending={signOutAll.isPending}
        onConfirm={() => signOutAll.mutate()}
      />
      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const notify = useToast();
  const change = useMutation({
    mutationFn: () => api.changePassword(current, next),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      notify('Password changed. Other devices have been signed out.');
    },
    onError: (err) => setError(errorMessage(err)),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (next.length < 8) return setError('Use at least 8 characters for the new password.');
    if (next !== confirm) return setError('The new passwords do not match.');
    change.mutate();
  };
  return (
    <Panel title="Change password">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Current password"><Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
        <Field label="New password" hint="At least 8 characters."><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <InlineError message={error} />
        <Button type="submit" loading={change.isPending} disabled={!current || !next || !confirm}>Change password</Button>
      </form>
    </Panel>
  );
}

function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const remove = useMutation({
    mutationFn: () => api.deleteAccount(password),
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(['me'], null);
      navigate('/', { replace: true });
    },
  });
  const close = () => {
    setPassword('');
    setTyped('');
    remove.reset();
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={remove.isPending ? () => undefined : close}
      title="Delete your account?"
      description="All of your resumes, jobs, notes and analyses will be permanently deleted."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={remove.isPending}>Cancel</Button>
          <Button variant="danger" onClick={() => remove.mutate()} loading={remove.isPending} disabled={!password || typed !== 'DELETE'}>Delete account permanently</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Your password"><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Type DELETE to confirm"><Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></Field>
        {remove.isError && <InlineError message={errorMessage(remove.error)} />}
      </div>
    </Dialog>
  );
}

