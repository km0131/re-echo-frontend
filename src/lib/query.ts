import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

/** TanStack Query の設定。4xx はやり直しても同じなので再試行しない。 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: (count, err) => {
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false
        return count < 2
      },
    },
    mutations: { retry: false },
  },
})
