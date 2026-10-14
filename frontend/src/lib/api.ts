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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: options.credentials ?? 'include',
      signal: options.signal ?? controller.signal,
      headers: { ...(options.headers || {}) },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The backend request timed out. Check that the API is running and try again.');
    }
    throw new Error('Unable to reach the HireMatch backend. Check that the API is running and try again.');
  } finally {
    window.clearTimeout(timeout);
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
  return request<CreationResponse>('/api/evaluations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_title: jobTitle, job_description: jobDescription }),
  });
}

export async function listEvaluations() {
  return request<EvaluationItem[]>('/api/evaluations');
}

export async function fetchEvaluationDetail(id: number) {
  return request<EvaluationDetail>(`/api/evaluations/${id}`);
}

export async function uploadResumes(id: number, files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return request<{ evaluation_id: number; results: Array<{ id: number; status: string; name: string; score?: number; error?: string }> }>(`/api/evaluations/${id}/resumes`, {
    method: 'POST',
    body: formData,
  });
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
