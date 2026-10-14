import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createEvaluationMock: vi.fn().mockResolvedValue({ id: 42, job_title: 'Senior Python Engineer' }),
}));

vi.mock('../lib/api', () => ({
  createEvaluation: mocks.createEvaluationMock,
}));

import CreateEvaluation from '../pages/CreateEvaluation';

describe('CreateEvaluation', () => {
  it('submits the job title and description to the backend', async () => {
    render(
      <MemoryRouter>
        <CreateEvaluation />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Senior Python Engineer' } });
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: 'You will build Python APIs and maintain data pipelines.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create evaluation' }));

    expect(await screen.findByRole('button', { name: 'Create evaluation' })).toBeInTheDocument();
    expect(mocks.createEvaluationMock).toHaveBeenCalledWith('Senior Python Engineer', 'You will build Python APIs and maintain data pipelines.');
  });
});
