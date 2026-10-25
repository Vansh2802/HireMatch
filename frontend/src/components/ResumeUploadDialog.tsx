import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, errorMessage } from '../lib/api';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Field, Input } from './ui/Field';
import { InlineError } from './ui/States';
import { useToast } from './ui/Toast';
import { UploadZone } from './ui/UploadZone';

/** Upload a new resume, or (with `resumeId`) a new version of an existing one. */
export function ResumeUploadDialog({ open, onClose, resumeId }: { open: boolean; onClose: () => void; resumeId?: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [duplicateOf, setDuplicateOf] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const notify = useToast();

  const upload = useMutation({
    mutationFn: () => (resumeId ? api.uploadResumeVersion(resumeId, file!) : api.uploadResume(file!, title.trim() || undefined)),
    onSuccess: (resume) => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.setQueryData(['resume', resume.id], resume);
      notify(resumeId ? 'New version uploaded. Reading it now…' : 'Resume uploaded. Reading it now…');
      close();
      if (!resumeId) navigate(`/resumes/${resume.id}`);
    },
    onError: (error) => {
      const data = error instanceof ApiError ? (error.data as { resume_id?: number } | undefined) : undefined;
      setDuplicateOf(error instanceof ApiError && error.status === 409 && data?.resume_id ? data.resume_id : null);
    },
  });

  const close = () => {
    setFile(null);
    setTitle('');
    setDuplicateOf(null);
    upload.reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={upload.isPending ? () => undefined : close}
      title={resumeId ? 'Upload a new version' : 'Upload a resume'}
      description={
        resumeId
          ? 'The new file becomes the current version. Earlier versions and their analyses are kept.'
          : 'HireMatch reads the text and shows you what it found. The file itself isn’t stored.'
      }
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button onClick={() => upload.mutate()} disabled={!file} loading={upload.isPending}>
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <UploadZone
          file={file}
          onFile={(next) => {
            setFile(next);
            upload.reset();
          }}
          disabled={upload.isPending}
        />
        {!resumeId && (
          <Field label="Name" optional hint="For example “Backend roles” or “Product, short version”. Defaults to the file name.">
            <Input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} disabled={upload.isPending} />
          </Field>
        )}
        {upload.isError && <InlineError message={errorMessage(upload.error)} />}
        {duplicateOf && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              close();
              navigate(`/resumes/${duplicateOf}`);
            }}
          >
            Open the existing resume
          </Button>
        )}
      </div>
    </Dialog>
  );
}
