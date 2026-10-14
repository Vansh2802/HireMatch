import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  uploadResumesMock: vi.fn().mockResolvedValue({ evaluation_id: 1, results: [] }),
}));

vi.mock('../lib/api', () => ({
  uploadResumes: mocks.uploadResumesMock,
}));

import UploadResumes from '../pages/UploadResumes';

describe('UploadResumes', () => {
  it('shows the selected file names before uploading', async () => {
    render(
      <MemoryRouter initialEntries={['/evaluations/1/upload']}>
        <Routes>
          <Route path="/evaluations/:id/upload" element={<UploadResumes />} />
        </Routes>
      </MemoryRouter>,
    );

    const file = new File(['resume'], 'candidate.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('candidate.pdf')).toBeInTheDocument();
  });
});
