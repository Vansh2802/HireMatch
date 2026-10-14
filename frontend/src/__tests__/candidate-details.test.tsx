import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchCandidateMock: vi.fn().mockResolvedValue({
    candidate_name: 'Alicia Jordan',
    match_score: 92,
    verdict: 'Strong Match',
    email: 'alicia@example.com',
    phone: '555-9999',
    processing_status: 'completed',
    structured_resume: { skills: ['Python', 'FastAPI'] },
    evaluation_details: { overall_explanation: 'Strong fit for backend engineering.' },
  }),
}));

vi.mock('../lib/api', () => ({
  fetchCandidate: mocks.fetchCandidateMock,
}));

import CandidateDetails from '../pages/CandidateDetails';

function renderCandidateDetails() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/candidates/1']}>
        <Routes>
          <Route path="/candidates/:id" element={<CandidateDetails />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CandidateDetails', () => {
  it('renders the candidate score and explanation', async () => {
    renderCandidateDetails();

    expect(await screen.findByText('Alicia Jordan')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText(/Strong fit for backend engineering/i)).toBeInTheDocument();
  });
});
