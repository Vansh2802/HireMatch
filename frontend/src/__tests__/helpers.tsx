import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';
import type { Analysis, AnalysisResult } from '../lib/types';

export function renderWithProviders(ui: ReactElement, { route = '/', path = '*', user = { id: 1, email: 'test@example.com' } as { id: number; email: string } | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['me'], user);
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={ui} />
              <Route path="/login" element={<p>Sign-in page</p>} />
              <Route path="/analyses/:id" element={<p>Analysis page</p>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    ),
  };
}

export const RESULT: AnalysisResult = {
  scoring_version: '2.0',
  score: 79,
  verdict: 'Strong alignment',
  confidence: 'high',
  evidence_coverage: 1,
  summary: 'Your resume shows clear evidence for 1 of 2 required skills.',
  components: [
    { key: 'required_skills', label: 'Required skills', base_weight: 0.45, effective_weight: 1, score: 0.5, status: 'scored', requirement_count: 2, detail: '1 of 2 met' },
    { key: 'experience', label: 'Experience', base_weight: 0.2, effective_weight: 0, score: null, status: 'not_applicable', requirement_count: 0, detail: 'none' },
  ],
  requirements: [
    { id: 'r1', category: 'skill', importance: 'required', text: 'Python', source_excerpt: 'Strong Python skills', uncertain: false, status: 'met', credit: 1, evidence: [{ excerpt: 'Built APIs in Python', source: 'resume_text', line: 3 }], note: 'Python appears in your resume.' },
    { id: 'r2', category: 'skill', importance: 'required', text: 'Kubernetes', source_excerpt: 'Kubernetes experience', uncertain: false, status: 'not_found', credit: 0, evidence: [], note: 'Kubernetes was not found in your resume. This does not mean you lack it.' },
  ],
  strengths: ['Clear evidence of required skills: Python'],
  action_plan: [{ requirement_id: 'r2', requirement: 'Kubernetes', importance: 'required', status: 'not_found', priority: 'high', why: 'Listed as a required skill.', suggestion: 'If you have used Kubernetes, add it.', section: 'Skills and Experience' }],
  next_steps: ['Work through the 1 high-priority gap below.'],
  counts: { total: 2, met: 1, partial: 0, not_found: 1, unverifiable: 0, required_total: 2, required_met: 1 },
};

export function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: 7,
    resume_id: 1,
    resume_version_id: 1,
    resume_title: 'Backend CV',
    resume_version_number: 1,
    job_id: 2,
    job_title: 'Backend Engineer',
    job_company: 'Acme',
    score: 79,
    verdict: 'Strong alignment',
    confidence: 'high',
    scoring_version: '2.0',
    created_at: '2026-10-25T10:00:00',
    job_revision: 1,
    job_snapshot: { title: 'Backend Engineer', company: 'Acme', location: null, url: null, description: 'desc', profile: { seniority: null, requirements: [], method: 'heuristic', warnings: [] } },
    result: RESULT,
    is_legacy: false,
    is_current_resume_version: true,
    is_current_job_revision: true,
    ...overrides,
  };
}
