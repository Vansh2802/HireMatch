import type { ProcessingStatus } from './types';

/** Poll interval for TanStack Query: fast while the server is still processing, off otherwise. */
export function pollWhileProcessing(status: ProcessingStatus | undefined | null, intervalMs = 1500): number | false {
  return status === 'processing' ? intervalMs : false;
}

export class ProcessingFailedError extends Error {}

/**
 * Wait until a resource leaves the "processing" state. Bounded by `timeoutMs` so the UI
 * never spins forever; the server keeps working and the user can come back to it.
 */
export async function waitUntilReady<T>(
  load: () => Promise<T>,
  status: (value: T) => ProcessingStatus | undefined,
  failure: (value: T) => string | null | undefined,
  { intervalMs = 1500, timeoutMs = 180_000, signal }: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const started = Date.now();
  for (;;) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const value = await load();
    const current = status(value);
    if (current === 'ready') return value;
    if (current === 'failed') throw new ProcessingFailedError(failure(value) || 'Processing failed.');
    if (Date.now() - started > timeoutMs) {
      throw new ProcessingFailedError('This is taking longer than expected. It will keep processing; check back on its page in a minute.');
    }
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
}
