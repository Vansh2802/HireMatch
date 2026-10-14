import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listEvaluationsMock: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/api', () => ({
  listEvaluations: mocks.listEvaluationsMock,
}));

import Dashboard from '../pages/Dashboard';

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Dashboard', () => {
  it('shows the empty state when there are no evaluations', async () => {
    renderDashboard();

    expect(await screen.findByText('No evaluations yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first role-based evaluation to compare candidates.')).toBeInTheDocument();
  });
});
