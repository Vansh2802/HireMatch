import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, request, SESSION_EXPIRED_EVENT } from '../lib/api';

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
}

describe('API client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends credentials and JSON to the same-origin API', async () => {
    const spy = mockFetch(200, { user: null });
    await api.session();
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/api/auth/session');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('surfaces the server detail message', async () => {
    mockFetch(422, { detail: 'The uploaded file is empty.' });
    await expect(request('/api/resumes', { method: 'POST' })).rejects.toThrow('The uploaded file is empty.');
  });

  it('reads structured conflict details and keeps the payload', async () => {
    mockFetch(409, { detail: { message: 'You already uploaded this exact file.', resume_id: 4 } });
    const error = await request<never>('/api/resumes', { method: 'POST' }).catch((e: unknown) => e as ApiError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('You already uploaded this exact file.');
    expect(error.data).toEqual({ message: 'You already uploaded this exact file.', resume_id: 4 });
  });

  it('hides raw server errors behind a generic message', async () => {
    mockFetch(500, null);
    await expect(request('/api/dashboard')).rejects.toThrow('The server ran into a problem');
  });

  it('announces an expired session on 401', async () => {
    mockFetch(401, { detail: 'Your session has expired.' });
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    await expect(request('/api/dashboard')).rejects.toThrow();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports network failures clearly', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await request<never>('/api/dashboard').catch((e: unknown) => e as ApiError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.isNetwork).toBe(true);
    expect(error.message).toMatch(/Cannot reach HireMatch/);
  });
});
