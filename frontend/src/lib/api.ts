export type EvaluationItem = {
  id: number;
  job_title: string;
  status: string;
  created_at: string;
  updated_at: string;
  candidate_count: number;
  average_score?: number;
};

export type CandidateSummary = {
  id: number;
  candidate_name: string;
  match_score?: number | null;
  verdict?: string | null;
  processing_status: string;
  email?: string | null;
  error_message?: string | null;
};

export type EvaluationDetail = {
  id: number;
  job_title: string;
  job_description: string;
  structured_job?: Record<string, unknown> | null;
  status: string;
  candidates: CandidateSummary[];
};

export type CreationResponse = {
  id: number;
  job_title: string;
  status: string;
  structured_job?: Record<string, unknown> | null;
};

export type AuthUser = { id: number; email: string };

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** Per-file budget: LLM structured extraction (2 repair attempts × 2 HTTP retries × default 30s) + parsing overhead. */
export const RESUME_UPLOAD_TIMEOUT_PER_FILE_MS = 120_000;

export function resumeUploadTimeoutMs(fileCount: number): number {
  const count = Math.max(1, fileCount);
  return RESUME_UPLOAD_TIMEOUT_PER_FILE_MS * count;
}

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const callerSignal = options.signal;
  const abortFromCaller = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', abortFromCaller, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: options.credentials ?? 'include',
      signal: controller.signal,
      headers: { ...(options.headers || {}) },
    });
  } catch (error) {
    if (timedOut) {
      throw new Error('The request timed out. For large batches, try uploading fewer files at once.');
    }
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('Unable to reach the HireMatch backend. Check that the API is running and try again.');
  } finally {
    window.clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const payload = await response.json();
      message = payload.detail || payload.error || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function healthCheck() {
  return request<{ status: string; app: string; dependencies?: { database?: string; llm?: string; provider?: string; model?: string; provider_connectivity?: string } }>('/api/health');
}

export async function login(email: string, password: string) {
  return request<{ user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function register(email: string, password: string) {
  return request<{ user: AuthUser }>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function currentUser() {
  return request<AuthUser>('/api/auth/me');
}

export async function logout() {
  return request<void>('/api/auth/logout', { method: 'POST' });
}

export async function createEvaluation(jobTitle: string, jobDescription: string) {
  // LLM job extraction can take up to 60 s with retries; use 90 s timeout
  return request<CreationResponse>('/api/evaluations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_title: jobTitle, job_description: jobDescription }),
  }, 90000);
}

export async function listEvaluations() {
  return request<EvaluationItem[]>('/api/evaluations');
}

export async function fetchEvaluationDetail(id: number) {
  return request<EvaluationDetail>(`/api/evaluations/${id}`);
}

export type ResumeUploadResult = {
  id: number;
  status: string;
  name: string;
  score?: number;
  error?: string;
};

export async function uploadResumes(
  id: number,
  files: File[],
  options?: {
    onFileComplete?: (index: number, result: ResumeUploadResult) => void;
    signal?: AbortSignal;
  },
) {
  if (files.length === 0) {
    throw new Error('Select at least one PDF or DOCX file.');
  }

  const allResults: ResumeUploadResult[] = [];

  // One request per file so each gets a full LLM budget and the UI can reflect real progress.
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const formData = new FormData();
    formData.append('files', file);

    let result: ResumeUploadResult;
    try {
      const response = await request<{ evaluation_id: number; results: ResumeUploadResult[] }>(
        `/api/evaluations/${id}/resumes`,
        {
          method: 'POST',
          body: formData,
          signal: options?.signal,
        },
        RESUME_UPLOAD_TIMEOUT_PER_FILE_MS,
      );
      result = response.results[0] ?? {
        id: 0,
        status: 'failed',
        name: file.name,
        error: 'The backend returned no result for this file.',
      };
    } catch (error) {
      if (options?.signal?.aborted) throw error;
      result = {
        id: 0,
        status: 'failed',
        name: file.name,
        error: error instanceof Error ? error.message : 'This file could not be processed.',
      };
    }
    if (result) {
      allResults.push(result);
      options?.onFileComplete?.(index, result);
    }
  }

  return { evaluation_id: id, results: allResults };
}

export async function fetchCandidate(id: number) {
  return request<Record<string, unknown>>(`/api/candidates/${id}`);
}

export async function deleteCandidate(id: number) {
  return request<{ deleted: boolean; candidate_id: number }>(`/api/candidates/${id}`, { method: 'DELETE' });
}

export async function deleteEvaluation(id: number) {
  return request<{ deleted: boolean; evaluation_id: number }>(`/api/evaluations/${id}`, { method: 'DELETE' });
}

export async function exportEvaluation(id: number) {
  return request<{ csv: string }>(`/api/evaluations/${id}/export`);
}
