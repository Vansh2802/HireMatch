import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { uploadResumes } from '../lib/api';

type FileStatus = 'pending' | 'processing' | 'done' | 'error';

interface FileEntry {
  file: File;
  status: FileStatus;
  result?: { id: number; status: string; name: string; score?: number; error?: string };
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 10;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function UploadResumes() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incomingFiles: File[]) => {
    setError(null);
    const issues: string[] = [];
    const valid: File[] = [];

    for (const file of incomingFiles) {
      const ext = file.name.toLowerCase().split('.').pop() || '';
      if (!['pdf', 'docx'].includes(ext)) {
        issues.push(`${file.name}: unsupported format (PDF and DOCX only)`);
        continue;
      }
      if (file.size === 0) {
        issues.push(`${file.name}: file is empty`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        issues.push(`${file.name}: exceeds 10 MB limit`);
        continue;
      }
      valid.push(file);
    }

    if (issues.length > 0) {
      setError(issues.join('\n'));
    }

    setEntries((current) => {
      const existingKeys = new Set(current.map((e) => `${e.file.name}:${e.file.size}:${e.file.lastModified}`));
      const newEntries = valid
        .filter((f) => !existingKeys.has(`${f.name}:${f.size}:${f.lastModified}`))
        .map((file) => ({ file, status: 'pending' as FileStatus }));

      const combined = [...current, ...newEntries];
      if (combined.length > MAX_FILES) {
        setError(`Maximum ${MAX_FILES} files per upload. Extra files were ignored.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  };

  const removeEntry = (index: number) => {
    setEntries((current) => current.filter((_, i) => i !== index));
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const handleSubmit = async () => {
    if (!id || entries.length === 0) {
      setError('Select at least one PDF or DOCX file.');
      return;
    }
    setError(null);
    setIsUploading(true);
    setUploadDone(false);

    setEntries((current) =>
      current.map((entry, idx) => ({
        ...entry,
        status: idx === 0 ? 'processing' : entry.status,
      })),
    );

    try {
      const files = entries.map((e) => e.file);
      const response = await uploadResumes(Number(id), files, {
        onFileComplete: (index, result) => {
          setEntries((current) =>
            current.map((entry, idx) => {
              if (idx === index) {
                return {
                  ...entry,
                  status: result.status === 'completed' ? 'done' : 'error',
                  result,
                };
              }
              if (idx === index + 1 && idx < current.length) {
                return { ...entry, status: 'processing' };
              }
              return entry;
            }),
          );
        },
      });

      setEntries((current) =>
        current.map((entry, idx) => {
          const result = response.results[idx];
          if (!result) return { ...entry, status: 'error' };
          return {
            ...entry,
            status: result.status === 'completed' ? 'done' : 'error',
            result,
          };
        }),
      );
      setUploadDone(true);
    } catch (uploadError) {
      const msg = uploadError instanceof Error ? uploadError.message : 'Upload failed.';
      setError(msg);
      setEntries((current) => current.map((e) => ({ ...e, status: 'error' })));
    } finally {
      setIsUploading(false);
    }
  };

  const completedCount = entries.filter((e) => e.status === 'done').length;
  const errorCount = entries.filter((e) => e.status === 'error').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <p className="eyebrow mb-1">Resume upload</p>
        <h1 className="page-heading">Add candidate documents</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Upload up to {MAX_FILES} PDF or DOCX resumes. Each file is processed individually — partial failures are reported without stopping the rest.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upload area */}
        <div className="space-y-4 lg:col-span-2">
          {/* Drop zone */}
          {!uploadDone && (
            <label
              className={`drop-zone ${isDragging ? 'drop-zone-active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload size={32} className="mb-3 text-brand-500" />
              <p className="mb-1 font-semibold text-ink-primary">
                {isDragging ? 'Drop files here' : 'Drag and drop resumes here'}
              </p>
              <p className="text-sm text-ink-secondary">
                or{' '}
                <span className="font-semibold text-brand-600">browse files</span>
              </p>
              <p className="mt-2 text-xs text-ink-muted">PDF and DOCX only · Max 10 MB per file · Up to {MAX_FILES} files</p>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files || []));
                  e.currentTarget.value = '';
                }}
              />
            </label>
          )}

          {/* File list */}
          {entries.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-border-light px-4 py-3">
                <p className="text-sm font-semibold text-ink-primary">
                  {entries.length} file{entries.length !== 1 ? 's' : ''} selected
                </p>
              </div>
              <ul>
                {entries.map((entry, index) => (
                  <li
                    key={`${entry.file.name}-${index}`}
                    className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0"
                  >
                    {/* Icon */}
                    <div className="shrink-0">
                      {entry.status === 'pending' && <FileText size={18} className="text-ink-muted" />}
                      {entry.status === 'processing' && <Loader2 size={18} className="animate-spin text-warning" />}
                      {entry.status === 'done' && <CheckCircle2 size={18} className="text-success" />}
                      {entry.status === 'error' && <XCircle size={18} className="text-error" />}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-primary">{entry.file.name}</p>
                      <div className="flex items-center gap-2 text-xs text-ink-muted">
                        <span>{formatBytes(entry.file.size)}</span>
                        {entry.status === 'processing' && (
                          <span className="text-warning">Analysing…</span>
                        )}
                        {entry.status === 'done' && entry.result && (
                          <span className="text-success">
                            {entry.result.name}
                            {entry.result.score !== undefined ? ` · ${entry.result.score}%` : ''}
                          </span>
                        )}
                        {entry.status === 'error' && entry.result?.error && (
                          <span className="text-error">{entry.result.error}</span>
                        )}
                      </div>
                    </div>

                    {/* Status chip */}
                    <div className="shrink-0">
                      {entry.status === 'pending' && (
                        <span className="status-chip status-pending">
                          <Clock size={10} />
                          Queued
                        </span>
                      )}
                      {entry.status === 'done' && entry.result && (
                        <span className="status-chip status-completed">
                          <CheckCircle2 size={10} />
                          Done
                        </span>
                      )}
                      {entry.status === 'error' && (
                        <span className="status-chip status-failed">
                          <AlertCircle size={10} />
                          Failed
                        </span>
                      )}
                    </div>

                    {/* Remove button */}
                    {!isUploading && entry.status !== 'done' && (
                      <button
                        type="button"
                        aria-label={`Remove ${entry.file.name}`}
                        className="btn-ghost shrink-0 p-1 text-ink-muted"
                        onClick={() => removeEntry(index)}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Error alert */}
          {error && (
            <div className="alert-error whitespace-pre-line" role="alert">
              <span className="flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </span>
            </div>
          )}

          {/* Upload complete summary */}
          {uploadDone && (
            <div className="card p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="shrink-0 text-success" />
                <div>
                  <p className="font-semibold text-ink-primary">Processing complete</p>
                  <p className="mt-0.5 text-sm text-ink-secondary">
                    {completedCount} of {entries.length} file{entries.length !== 1 ? 's' : ''} processed successfully.
                    {errorCount > 0 && ` ${errorCount} failed — see details above.`}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/evaluations/${id}`)}
                  className="btn-primary"
                >
                  View evaluation results
                  <ChevronRight size={15} />
                </button>
                {entries.length < MAX_FILES && (
                  <button
                    type="button"
                    onClick={() => {
                      setEntries([]);
                      setUploadDone(false);
                      setError(null);
                    }}
                    className="btn-secondary"
                  >
                    Upload more resumes
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!uploadDone && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isUploading || entries.length === 0}
                className="btn-primary"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Processing {entries.length} file{entries.length !== 1 ? 's' : ''}…
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    Process {entries.length > 0 ? `${entries.length} ` : ''}resume{entries.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/evaluations/${id}`)}
                className="btn-secondary"
                disabled={isUploading}
              >
                Skip for now
              </button>
            </div>
          )}
        </div>

        {/* Side info */}
        <div className="space-y-4">
          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold text-ink-primary">Processing steps</p>
            <ol className="space-y-3 text-sm text-ink-secondary">
              {[
                { label: 'File validation', detail: 'Format, size, and content checks' },
                { label: 'Text extraction', detail: 'PDF or DOCX parsing' },
                { label: 'Profile extraction', detail: 'Skills, experience, education' },
                { label: 'Match scoring', detail: 'Scored against role requirements' },
                { label: 'Results saved', detail: 'Persisted to your evaluation' },
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-ink-primary">{step.label}</p>
                    <p className="text-xs text-ink-muted">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold text-ink-primary">Supported formats</p>
            <div className="space-y-2 text-sm text-ink-secondary">
              <div className="flex items-center gap-2">
                <span className="status-chip status-completed">PDF</span>
                <span>Selectable text required. Scanned images are not supported.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="status-chip status-completed">DOCX</span>
                <span>Standard Word documents (.docx only, not .doc).</span>
              </div>
              <div className="mt-3 text-xs text-ink-muted">
                Max 10 MB per file. Up to 80 pages per document. Processing may take up to 30 seconds per file when AI extraction is enabled.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
