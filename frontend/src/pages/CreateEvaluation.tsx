import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEvaluation } from '../lib/api';

export default function CreateEvaluation() {
  const navigate = useNavigate();
  const [jobTitle, setJobTitle] = useState('Senior Python Engineer');
  const [jobDescription, setJobDescription] = useState('Build backend services with Python, FastAPI, SQL, and cloud deployment.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await createEvaluation(jobTitle, jobDescription);
      navigate(`/evaluations/${result.id}/upload`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to create evaluation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand-600">Create evaluation</p>
        <h2 className="mt-2 text-2xl font-semibold">Define the role</h2>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="job-title" className="mb-2 block text-sm font-medium text-slate-700">Job title</label>
          <input
            id="job-title"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            required
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
            <label htmlFor="job-description" className="font-medium">Job description</label>
            <span>{jobDescription.length} chars</span>
          </div>
          <textarea
            id="job-description"
            className="min-h-[220px] w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            required
            minLength={20}
          />
        </div>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-3 font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? 'Creating…' : 'Create evaluation'}
        </button>
      </form>
    </div>
  );
}
