import { describe, expect, it } from 'vitest';
import { RESUME_UPLOAD_TIMEOUT_PER_FILE_MS, resumeUploadTimeoutMs } from '../lib/api';

describe('resume upload timeouts', () => {
  it('allocates a full LLM budget per file when batching sequentially', () => {
    expect(RESUME_UPLOAD_TIMEOUT_PER_FILE_MS).toBe(120_000);
    expect(resumeUploadTimeoutMs(1)).toBe(120_000);
    expect(resumeUploadTimeoutMs(3)).toBe(360_000);
  });
});
