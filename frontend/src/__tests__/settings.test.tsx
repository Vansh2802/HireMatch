import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  healthCheckMock: vi.fn().mockRejectedValue(new Error('Backend unreachable')),
}));

vi.mock('../lib/api', () => ({
  healthCheck: mocks.healthCheckMock,
}));

import Settings from '../pages/Settings';

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Settings', () => {
  it('shows the backend error when health is unavailable', async () => {
    renderSettings();

    expect(await screen.findByText('Backend unreachable')).toBeInTheDocument();
  });
});
