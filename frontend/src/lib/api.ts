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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });

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
  return request<{ status: string; app: string }>('/api/health');
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
