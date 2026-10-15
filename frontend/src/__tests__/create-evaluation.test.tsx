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

    // Use htmlFor matching (which ignores the asterisk span inside the label)
    fireEvent.change(screen.getByRole('textbox', { name: /job title/i }), {
      target: { value: 'Senior Python Engineer' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /job description/i }), {
      target: { value: 'You will build Python APIs and maintain data pipelines.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create evaluation/i }));

    expect(await screen.findByRole('button', { name: /create evaluation|extracting/i })).toBeInTheDocument();
    expect(mocks.createEvaluationMock).toHaveBeenCalledWith(
      'Senior Python Engineer',
      'You will build Python APIs and maintain data pipelines.',
    );
  });
});
