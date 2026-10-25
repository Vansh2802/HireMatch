import { useId, useRef, useState, type DragEvent } from 'react';
import { FileUp, FileText, X } from 'lucide-react';
import { formatBytes } from '../../lib/format';

const ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function validateResumeFile(file: File, maxMb = 10): string | null {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.pdf') && !name.endsWith('.docx')) return 'Choose a PDF or DOCX file. Older .doc files must be saved as .docx first.';
  if (file.size === 0) return 'This file is empty.';
  if (file.size > maxMb * 1024 * 1024) return `This file is ${formatBytes(file.size)}; the limit is ${maxMb} MB.`;
  return null;
}

type Props = {
  file: File | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
  error?: string | null;
  maxMb?: number;
};

/** Drag-and-drop or click-to-browse picker for a single resume. Validation is repeated on the server. */
export function UploadZone({ file, onFile, disabled, error, maxMb = 10 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const hintId = useId();

  const choose = (candidate: File | undefined) => {
    if (!candidate) return;
    const problem = validateResumeFile(candidate, maxMb);
    setLocalError(problem);
    onFile(problem ? null : candidate);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) choose(event.dataTransfer.files?.[0]);
  };

  const message = localError || error;
  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-line-strong bg-paper px-4 py-3">
        <FileText size={20} className="shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{file.name}</p>
          <p className="text-sm text-ink-faint">{formatBytes(file.size)}</p>
        </div>
        {!disabled && (
          <button type="button" onClick={() => onFile(null)} className="rounded p-1 text-ink-faint hover:bg-sunk hover:text-ink" aria-label={`Remove ${file.name}`}>
            <X size={16} />
          </button>
        )}
      </div>
    );
  }
  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragging ? 'border-accent bg-accent-wash/50' : message ? 'border-missing/50 bg-paper' : 'border-line-strong bg-paper hover:border-ink-faint'
        }`}
      >
        <FileUp size={24} className="text-ink-faint" aria-hidden="true" />
        <p className="font-medium">
          Drop your resume here or{' '}
          <button type="button" className="link" onClick={() => inputRef.current?.click()} disabled={disabled} aria-describedby={hintId}>
            choose a file
          </button>
        </p>
        <p id={hintId} className="text-sm text-ink-faint">
          PDF or DOCX, up to {maxMb} MB. Text-based files only; scanned images can’t be read.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label="Resume file"
          disabled={disabled}
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      {message && (
        <p className="mt-2 text-sm font-medium text-missing" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
