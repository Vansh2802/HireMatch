import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes, createQueryClient } from '../App';
import { ToastProvider } from '../components/ui/Toast';

function renderAt(route: string, user: { id: number; email: string } | null) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/api/auth/session')) return new Response(JSON.stringify({ user }), { status: 200 });
    if (url.includes('/api/dashboard'))
      return new Response(
        JSON.stringify({
          counts: { resumes: 0, jobs: 0, analyses: 0 }, average_best_score: null, average_best_score_jobs: 0, average_definition: '',
          stages: { interested: 0, preparing: 0, applied: 0, interviewing: 0, completed: 0, archived: 0 }, recent_analyses: [], follow_ups: [],
          onboarding: { has_resume: false, has_job: false, has_analysis: false, dismissed: false },
        }),
        { status: 200 },
      );
    return new Response('{}', { status: 200 });
  });
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>
          <AppRoutes />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('routing and authentication', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the public landing page without a session', async () => {
    renderAt('/', null);
    expect(await screen.findByRole('heading', { level: 1, name: /Read your resume the way a job description does/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Analyze my resume' })).toHaveAttribute('href', '/register');
  });

  it('sends signed-out users to sign in, keeping the destination', async () => {
    renderAt('/resumes', null);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows the workspace with navigation for signed-in users', async () => {
    renderAt('/dashboard', { id: 1, email: 'test@example.com' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0];
    for (const label of ['Overview', 'Analyze a resume', 'My resumes', 'Jobs & applications', 'Analysis history', 'Settings & privacy']) {
      expect(nav).toHaveTextContent(label);
    }
  });

  it('renders a not-found page for unknown routes', async () => {
    renderAt('/nope', null);
    expect(await screen.findByText('This page doesn’t exist')).toBeInTheDocument();
  });
});
