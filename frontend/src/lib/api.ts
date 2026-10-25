import type {
  Analysis,
  AnalysisListItem,
  ApplicationStage,
  AuthUser,
  Dashboard,
  Health,
  Importance,
  Job,
  JobListItem,
  Page,
  ResumeDetail,
  ResumeProfile,
  ResumeSummary,
  ResumeVersion,
} from './types';

// Same-origin by default (Vite proxies /api in development, nginx in Docker).
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const DEFAULT_TIMEOUT_MS = 20_000;
/** Uploads only parse the document synchronously; extraction continues in the background. */
export const UPLOAD_TIMEOUT_MS = 90_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetwork() {
    return this.status === 0;
  }
}

/** Fired when the server says the session is gone, so the app can send the user to sign in. */
export const SESSION_EXPIRED_EVENT = 'hirematch:session-expired';

type RequestOptions = Omit<RequestInit, 'body'> & { json?: unknown; body?: BodyInit; timeoutMs?: number; quiet401?: boolean };

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, timeoutMs = DEFAULT_TIMEOUT_MS, quiet401, headers, signal, ...rest } = options;
  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const relay = () => controller.abort();
  signal?.addEventListener('abort', relay, { once: true });

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...rest,
      credentials: 'include',
      signal: controller.signal,
      headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(headers || {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.method && rest.method !== 'GET' ? options.body : undefined,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut) throw new ApiError('The server took too long to respond. Check your connection and try again.', 0);
    throw new ApiError('Cannot reach HireMatch. Check your connection and try again.', 0);
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', relay);
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const detail = (payload as { detail?: unknown } | null)?.detail;
    let message: string;
    if (typeof detail === 'string') message = detail;
    else if (detail && typeof detail === 'object' && 'message' in detail) message = String((detail as { message: unknown }).message);
    else if (response.status >= 500) message = 'The server ran into a problem. Please try again.';
    else message = `Request failed (${response.status}).`;
    if (response.status === 401 && !quiet401) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new ApiError(message, response.status, detail);
  }
  return payload as T;
}

const qs = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : '';
};

export const api = {
  health: () => request<Health>('/api/health'),

  // Auth
  session: () => request<{ user: AuthUser | null }>('/api/auth/session'),
  login: (email: string, password: string) => request<{ user: AuthUser }>('/api/auth/login', { method: 'POST', json: { email, password }, quiet401: true }),
  register: (email: string, password: string) => request<{ user: AuthUser }>('/api/auth/register', { method: 'POST', json: { email, password } }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST', quiet401: true }),
  logoutAll: () => request<void>('/api/auth/logout-all', { method: 'POST' }),
  changePassword: (current_password: string, new_password: string) =>
    request<void>('/api/auth/change-password', { method: 'POST', json: { current_password, new_password } }),
  deleteAccount: (password: string) => request<void>('/api/auth/account', { method: 'DELETE', json: { password, confirm: 'DELETE' } }),

  dashboard: () => request<Dashboard>('/api/dashboard'),
  dismissOnboarding: () => request<void>('/api/dashboard/onboarding/dismiss', { method: 'POST' }),

  // Resumes
  resumes: (params: { q?: string; sort?: string; limit?: number; offset?: number } = {}) => request<Page<ResumeSummary>>(`/api/resumes${qs(params)}`),
  resume: (id: number) => request<ResumeDetail>(`/api/resumes/${id}`),
  uploadResume: (file: File, title?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    return request<ResumeDetail>('/api/resumes', { method: 'POST', body: form, timeoutMs: UPLOAD_TIMEOUT_MS });
  },
  uploadResumeVersion: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<ResumeDetail>(`/api/resumes/${id}/versions`, { method: 'POST', body: form, timeoutMs: UPLOAD_TIMEOUT_MS });
  },
  renameResume: (id: number, title: string) => request<ResumeDetail>(`/api/resumes/${id}`, { method: 'PATCH', json: { title } }),
  deleteResume: (id: number) => request<void>(`/api/resumes/${id}`, { method: 'DELETE' }),
  saveProfile: (id: number, profile: ResumeProfile, baseVersionId: number) =>
    request<ResumeDetail>(`/api/resumes/${id}/profile`, { method: 'PUT', json: { profile, base_version_id: baseVersionId } }),
  resumeVersion: (id: number, versionId: number) => request<ResumeVersion & { raw_text: string }>(`/api/resumes/${id}/versions/${versionId}`),
  retryResumeVersion: (id: number, versionId: number) => request<ResumeDetail>(`/api/resumes/${id}/versions/${versionId}/retry`, { method: 'POST' }),

  // Jobs
  jobs: (params: { q?: string; stage?: string; sort?: string; limit?: number; offset?: number } = {}) => request<Page<JobListItem>>(`/api/jobs${qs(params)}`),
  job: (id: number) => request<Job>(`/api/jobs/${id}`),
  createJob: (payload: { title: string; company?: string | null; location?: string | null; url?: string | null; description: string }) =>
    request<Job>('/api/jobs', { method: 'POST', json: payload }),
  updateJob: (
    id: number,
    payload: Partial<{ title: string; company: string | null; location: string | null; url: string | null; description: string; stage: ApplicationStage; notes: string | null; applied_on: string | null; follow_up_on: string | null }>,
  ) => request<Job>(`/api/jobs/${id}`, { method: 'PATCH', json: payload }),
  updateRequirements: (id: number, keep: { id: string; importance: Importance }[], baseRevision: number) =>
    request<Job>(`/api/jobs/${id}/requirements`, { method: 'PUT', json: { keep, base_revision: baseRevision } }),
  retryJob: (id: number) => request<Job>(`/api/jobs/${id}/retry`, { method: 'POST' }),
  deleteJob: (id: number) => request<void>(`/api/jobs/${id}`, { method: 'DELETE' }),

  // Analyses
  analyses: (params: { resume_id?: number; job_id?: number; q?: string; verdict?: string; sort?: string; limit?: number; offset?: number } = {}) =>
    request<Page<AnalysisListItem>>(`/api/analyses${qs(params)}`),
  analysis: (id: number) => request<Analysis>(`/api/analyses/${id}`),
  createAnalysis: (resume_id: number, job_id: number, resume_version_id?: number) =>
    request<Analysis>('/api/analyses', { method: 'POST', json: { resume_id, job_id, resume_version_id } }),
  deleteAnalysis: (id: number) => request<void>(`/api/analyses/${id}`, { method: 'DELETE' }),
};

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError || error instanceof Error) return error.message || fallback;
  return fallback;
}
