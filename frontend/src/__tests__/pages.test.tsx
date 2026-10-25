import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAnalysis, renderWithProviders } from './helpers';

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  analysis: vi.fn(),
  resumes: vi.fn(),
  jobs: vi.fn(),
  health: vi.fn(),
  uploadResume: vi.fn(),
  createJob: vi.fn(),
  createAnalysis: vi.fn(),
  resume: vi.fn(),
  job: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  session: vi.fn(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, api: { ...actual.api, ...mocks } };
});

import Dashboard from '../pages/Dashboard';
import AnalysisDetail from '../pages/AnalysisDetail';
import Analyze from '../pages/Analyze';
import Login from '../pages/Login';
import Compare from '../pages/Compare';
import { validateResumeFile } from '../components/ui/UploadZone';
import { validateJob } from '../components/JobForm';

const emptyDashboard = {
  counts: { resumes: 0, jobs: 0, analyses: 0 },
  average_best_score: null,
  average_best_score_jobs: 0,
  average_definition: 'Mean of the highest score each saved job received.',
  stages: { interested: 0, preparing: 0, applied: 0, interviewing: 0, completed: 0, archived: 0 },
  recent_analyses: [],
  follow_ups: [],
  onboarding: { has_resume: false, has_job: false, has_analysis: false, dismissed: false },
};

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.health.mockResolvedValue({ status: 'ok', scoring_version: '2.0', dependencies: { database: 'ok', llm: 'mock', provider: 'openrouter', model: null }, limits: { max_upload_size_mb: 10, max_job_description_chars: 20000 } });
});

describe('Dashboard', () => {
  it('guides a new account instead of showing invented activity', async () => {
    mocks.dashboard.mockResolvedValue(emptyDashboard);
    renderWithProviders(<Dashboard />);
    expect(await screen.findByText('Get started')).toBeInTheDocument();
    expect(screen.getByText('Upload your resume')).toBeInTheDocument();
    expect(screen.getByText('No analyses yet')).toBeInTheDocument();
    expect(screen.getByText('no scored analyses yet')).toBeInTheDocument();
  });

  it('renders real metrics and recent analyses', async () => {
    mocks.dashboard.mockResolvedValue({
      ...emptyDashboard,
      counts: { resumes: 2, jobs: 3, analyses: 4 },
      average_best_score: 71,
      average_best_score_jobs: 3,
      onboarding: { has_resume: true, has_job: true, has_analysis: true, dismissed: false },
      recent_analyses: [{ id: 9, job_title: 'Data Engineer', job_company: 'Globex', resume_title: 'CV', resume_version_number: 2, score: 64, verdict: 'Partial alignment', created_at: '2026-10-25T10:00:00' }],
    });
    renderWithProviders(<Dashboard />);
    expect(await screen.findByText('71')).toBeInTheDocument();
    expect(screen.queryByText('Get started')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Data Engineer/ })).toHaveAttribute('href', '/analyses/9');
  });

  it('offers a retry when loading fails', async () => {
    mocks.dashboard.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(emptyDashboard);
    renderWithProviders(<Dashboard />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Get started')).toBeInTheDocument();
  });
});

describe('Analysis results', () => {
  it('shows score, verdict, evidence and the action plan', async () => {
    mocks.analysis.mockResolvedValue(makeAnalysis());
    renderWithProviders(<AnalysisDetail />, { route: '/analyses/7', path: '/analyses/:id' });
    expect(await screen.findByLabelText('Match score 79 out of 100')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Strong alignment' })).toBeInTheDocument();
    expect(screen.getByText('Built APIs in Python')).toBeInTheDocument();
    expect(screen.getAllByText(/does not mean you lack it/).length).toBeGreaterThan(0);
    expect(screen.getByText('High priority')).toBeInTheDocument();
    expect(screen.getByText(/does not predict hiring decisions/)).toBeInTheDocument();
  });

  it('filters requirements by status', async () => {
    mocks.analysis.mockResolvedValue(makeAnalysis());
    renderWithProviders(<AnalysisDetail />, { route: '/analyses/7', path: '/analyses/:id' });
    const filters = await screen.findByRole('radiogroup', { name: 'Filter requirements by status' });
    await userEvent.click(within(filters).getByRole('radio', { name: /Not found/ }));
    const ledger = screen.getByRole('radiogroup', { name: 'Filter requirements by status' }).parentElement!.parentElement!;
    expect(within(ledger).queryByText('Built APIs in Python')).not.toBeInTheDocument();
    expect(within(ledger).getByText('Kubernetes')).toBeInTheDocument();
  });

  it('marks results that are based on an older resume version', async () => {
    mocks.analysis.mockResolvedValue(makeAnalysis({ is_current_resume_version: false }));
    renderWithProviders(<AnalysisDetail />, { route: '/analyses/7', path: '/analyses/:id' });
    expect(await screen.findByText(/You have a newer version of this resume/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze with latest' })).toBeInTheDocument();
  });

  it('shows an explicit no-score state instead of a number', async () => {
    mocks.analysis.mockResolvedValue(makeAnalysis({ score: null, verdict: 'Insufficient evidence', result: { ...makeAnalysis().result, score: null, verdict: 'Insufficient evidence', confidence: 'low', evidence_coverage: 0.2 } as never }));
    renderWithProviders(<AnalysisDetail />, { route: '/analyses/7', path: '/analyses/:id' });
    expect(await screen.findByLabelText('No score: not enough evidence')).toBeInTheDocument();
  });

  it('handles legacy results without requirement evidence', async () => {
    mocks.analysis.mockResolvedValue(makeAnalysis({ is_legacy: true, scoring_version: '1.0', result: { legacy: true, summary: 'Good Match.' } }));
    renderWithProviders(<AnalysisDetail />, { route: '/analyses/7', path: '/analyses/:id' });
    expect(await screen.findByText('Result from an earlier scoring method')).toBeInTheDocument();
  });

  it('shows a not-found state for missing or foreign analyses', async () => {
    const { ApiError } = await import('../lib/api');
    mocks.analysis.mockRejectedValue(new ApiError('Analysis not found.', 404));
    renderWithProviders(<AnalysisDetail />, { route: '/analyses/99', path: '/analyses/:id' });
    expect(await screen.findByText('Not found')).toBeInTheDocument();
  });
});

describe('Analyze workflow', () => {
  it('validates inputs before calling the server', async () => {
    mocks.resumes.mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 });
    mocks.jobs.mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 });
    renderWithProviders(<Analyze />);
    await screen.findByText('Drop your resume here or');
    await userEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    expect(await screen.findByText('Enter the job title.')).toBeInTheDocument();
    expect(screen.getByText('Choose a resume file to upload.')).toBeInTheDocument();
    expect(mocks.uploadResume).not.toHaveBeenCalled();
  });

  it('runs the full flow with saved items and opens the result', async () => {
    const ready = { status: 'ready', version_number: 1, id: 5 };
    mocks.resumes.mockResolvedValue({ items: [{ id: 1, title: 'Backend CV', created_at: '', updated_at: '2026-10-25T10:00:00', current_version: ready, version_count: 1, analysis_count: 0, best_score: null }], total: 1, limit: 100, offset: 0 });
    mocks.jobs.mockResolvedValue({ items: [{ id: 2, title: 'Backend Engineer', company: 'Acme', status: 'ready', requirement_count: 8, created_at: '2026-10-25T10:00:00' }], total: 1, limit: 100, offset: 0 });
    mocks.resume.mockResolvedValue({ id: 1, versions: [ready], current_version: ready });
    mocks.job.mockResolvedValue({ id: 2, status: 'ready' });
    mocks.createAnalysis.mockResolvedValue(makeAnalysis({ id: 11 }));
    renderWithProviders(<Analyze />, { route: '/analyze' });
    await userEvent.click(await screen.findByRole('radio', { name: /Backend CV/ }));
    await userEvent.click(screen.getByRole('radio', { name: /Backend Engineer · Acme/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    expect(await screen.findByText('Analysis page')).toBeInTheDocument();
    expect(mocks.createAnalysis).toHaveBeenCalledWith(1, 2);
  });

  it('keeps the form and shows the reason when extraction fails', async () => {
    const failed = { status: 'failed', version_number: 1, id: 5, error_message: 'The AI extraction service is busy. Please retry in a minute.' };
    mocks.resumes.mockResolvedValue({ items: [{ id: 1, title: 'Backend CV', created_at: '', updated_at: '2026-10-25T10:00:00', current_version: { status: 'processing', version_number: 1, id: 5 }, version_count: 2, analysis_count: 0, best_score: null }], total: 1, limit: 100, offset: 0 });
    mocks.jobs.mockResolvedValue({ items: [{ id: 2, title: 'Backend Engineer', company: null, status: 'ready', requirement_count: 8, created_at: '2026-10-25T10:00:00' }], total: 1, limit: 100, offset: 0 });
    mocks.resume.mockResolvedValue({ id: 1, versions: [failed], current_version: failed });
    renderWithProviders(<Analyze />);
    await userEvent.click(await screen.findByRole('radio', { name: /Backend CV/ }));
    await userEvent.click(screen.getByRole('radio', { name: /Backend Engineer/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    expect(await screen.findByText('The AI extraction service is busy. Please retry in a minute.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /Backend CV/ })).toBeChecked();
  });
});

describe('Sign in', () => {
  it('labels fields and validates before submitting', async () => {
    mocks.session.mockResolvedValue({ user: null });
    renderWithProviders(<Login mode="login" />, { user: null });
    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');
    await userEvent.type(email, 'not-an-email');
    await userEvent.type(password, 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('shows the server error and allows another attempt', async () => {
    mocks.login.mockRejectedValue(new Error('Invalid email or password.'));
    renderWithProviders(<Login mode="login" />, { user: null });
    await userEvent.type(screen.getByLabelText('Email'), 'someone@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'long enough password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled());
  });
});

describe('Compare', () => {
  it('warns when scoring methods differ', async () => {
    mocks.analysis.mockImplementation(async (id: number) => (id === 1 ? makeAnalysis({ id: 1 }) : makeAnalysis({ id: 2, is_legacy: true, scoring_version: '1.0', result: { legacy: true } })));
    renderWithProviders(<Compare />, { route: '/compare?ids=1,2' });
    expect(await screen.findByText(/use different scoring methods/)).toBeInTheDocument();
  });

  it('asks for a selection when fewer than two analyses are given', () => {
    renderWithProviders(<Compare />, { route: '/compare?ids=1' });
    expect(screen.getByText('Choose analyses to compare')).toBeInTheDocument();
  });
});

describe('client-side validation helpers', () => {
  it('rejects unsupported or oversized resume files', () => {
    expect(validateResumeFile(new File(['x'], 'cv.doc'))).toMatch(/PDF or DOCX/);
    expect(validateResumeFile(new File([], 'cv.pdf'))).toMatch(/empty/);
    expect(validateResumeFile(new File(['x'.repeat(2048)], 'cv.pdf'), 0.001)).toMatch(/limit/);
    expect(validateResumeFile(new File(['%PDF'], 'cv.PDF'))).toBeNull();
  });

  it('requires a title and a real job description', () => {
    expect(validateJob({ title: '', company: '', location: '', url: '', description: 'short' })).toMatchObject({ title: expect.any(String), description: expect.any(String) });
    expect(validateJob({ title: 'Dev', company: '', location: '', url: 'ftp://x', description: 'x'.repeat(100) })).toEqual({ url: expect.any(String) });
  });
});
