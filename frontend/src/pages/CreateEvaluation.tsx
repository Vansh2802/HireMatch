import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, FileText, Loader2 } from 'lucide-react';
import { createEvaluation } from '../lib/api';

const MAX_DESC_CHARS = 12000;

export default function CreateEvaluation() {
  const navigate = useNavigate();
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const descLength = jobDescription.length;
  const descWarning = descLength > MAX_DESC_CHARS * 0.9;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!jobTitle.trim()) { setError('Job title is required.'); return; }
    if (jobDescription.trim().length < 20) { setError('Job description must be at least 20 characters.'); return; }
    if (descLength > MAX_DESC_CHARS) { setError(`Job description must not exceed ${MAX_DESC_CHARS.toLocaleString()} characters.`); return; }

    setError(null);
    setIsSubmitting(true);
    try {
      const result = await createEvaluation(jobTitle.trim(), jobDescription.trim());
      navigate(`/evaluations/${result.id}/upload`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to create evaluation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div>
        <p className="eyebrow mb-1">Create evaluation</p>
        <h1 className="page-heading">Define the role</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Enter the job details below. HireMatch will extract structured requirements to score candidates against.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              {/* Job title */}
              <div>
                <label htmlFor="job-title" className="label">
                  Job title <span className="text-error" aria-hidden="true">*</span>
                </label>
                <input
                  id="job-title"
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Senior Python Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="input"
                  disabled={isSubmitting}
                  maxLength={200}
                />
              </div>

              {/* Job description */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="job-description" className="label mb-0">
                    Job description <span className="text-error" aria-hidden="true">*</span>
                  </label>
                  <span className={`text-xs tabular-nums ${descWarning ? 'font-semibold text-warning' : 'text-ink-muted'}`}>
                    {descLength.toLocaleString()} / {MAX_DESC_CHARS.toLocaleString()}
                  </span>
                </div>
                <textarea
                  id="job-description"
                  required
                  minLength={20}
                  maxLength={MAX_DESC_CHARS}
                  placeholder="Paste the full job description here. Include required skills, responsibilities, experience level, and any qualifications."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="textarea min-h-[240px]"
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-ink-muted">
                  Include required and preferred skills, experience requirements, and key responsibilities for best results.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="alert-error" role="alert">{error}</div>
              )}

              {/* Processing notice */}
              {isSubmitting && (
                <div className="alert-info flex items-center gap-2" role="status">
                  <Loader2 size={14} className="animate-spin shrink-0" />
                  <span>Extracting job requirements… this may take up to 60 seconds.</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Extracting requirements…
                    </>
                  ) : (
                    <>
                      Create evaluation
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Tips sidebar */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2 text-brand-600">
              <BriefcaseBusiness size={16} />
              <p className="text-sm font-semibold text-ink-primary">What happens next</p>
            </div>
            <ol className="space-y-3 text-sm text-ink-secondary">
              {[
                'HireMatch extracts structured requirements from your job description.',
                'You upload candidate resumes (PDF or DOCX).',
                'Each resume is scored against the extracted requirements.',
                'Candidates are ranked by match score with supporting evidence.',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2">
              <FileText size={16} className="text-ink-secondary" />
              <p className="text-sm font-semibold text-ink-primary">Tips for better results</p>
            </div>
            <ul className="space-y-2 text-sm text-ink-secondary">
              {[
                'Include both required and nice-to-have skills.',
                'Specify minimum years of experience.',
                'List key responsibilities and technologies.',
                'Mention education or certification requirements if relevant.',
              ].map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
