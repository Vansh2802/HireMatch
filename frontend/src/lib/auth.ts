import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from './api';

export const ME_KEY = ['me'] as const;

/** Current user, or null when signed out. Network errors surface as `error`, not as "signed out". */
export function useSession() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => (await api.session()).user,
    staleTime: 5 * 60_000,
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });
}
