import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileUp, X } from 'lucide-react';
import { uploadResumes } from '../lib/api';

export default function UploadResumes() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ results: Array<{ id: number; status: string; name: string; score?: number; error?: string }> } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const maxFileSize = 10 * 1024 * 1024;

  const addFiles = (incomingFiles: File[]) => {
    const invalidFile = incomingFiles.find((file) => {
      const extension = file.name.toLowerCase().split('.').pop();
      return !['pdf', 'docx'].includes(extension || '') || file.size > maxFileSize || file.size === 0;
    });
    if (invalidFile) {
      setError(`${invalidFile.name} is not a valid non-empty PDF or DOCX under 10 MB.`);
      return;
    }

    setError(null);
    setUploadResult(null);
    setFiles((current) => {
      const selected = new Map(current.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]));
      incomingFiles.forEach((file) => selected.set(`${file.name}:${file.size}:${file.lastModified}`, file));
      return Array.from(selected.values());
    });
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const handleSubmit = async () => {
    if (!id || !files.length) {
      setError('Select at least one PDF or DOCX resume file.');
      return;
    }

    setError(null);
    setIsUploading(true);
    try {
      const result = await uploadResumes(Number(id), files);
      setUploadResult(result);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand-600">Resume upload</p>
        <h2 className="mt-2 text-2xl font-semibold">Add candidate documents</h2>
      </div>

      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:border-brand-500 hover:bg-brand-50'}`}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <FileUp size={36} className="mb-3 text-brand-700" />
        <span className="text-lg font-medium text-slate-800">Drag and drop or browse resumes</span>
        <span className="mt-2 text-sm text-slate-500">Supports PDF and DOCX files up to 10 MB each</span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          multiple
          className="hidden"
          onChange={(event) => {
            addFiles(Array.from(event.target.files || []));
            event.currentTarget.value = '';
          }}
        />
      </label>

      {files.length > 0 ? (
        <div className="mt-5 space-y-3">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div>
                <p className="font-medium text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200" onClick={() => removeFile(index)}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {uploadResult ? (
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Processing complete</p>
          <ul className="mt-2 space-y-1">
            {uploadResult.results.map((result) => (
              <li key={result.id}>
                {result.name}: {result.status}{result.score !== undefined ? ` (${result.score}%)` : ''}{result.error ? ` - ${result.error}` : ''}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => navigate(`/evaluations/${id}`)} className="mt-3 font-medium text-brand-700 hover:text-brand-800">
            View evaluation results
          </button>
        </div>
      ) : null}

      <div className="mt-6 flex gap-3">
        <button type="button" onClick={handleSubmit} disabled={isUploading || !files.length} className="rounded-xl bg-brand-600 px-4 py-3 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          {isUploading ? 'Uploading…' : 'Process resumes'}
        </button>
        <button type="button" onClick={() => navigate(`/evaluations/${id}`)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50">
          Skip for now
        </button>
      </div>
    </div>
  );
}
