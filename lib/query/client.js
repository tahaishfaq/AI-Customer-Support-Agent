import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function makeQueryClient() {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => {
        toast.error(error?.message || "Something went wrong. Please try again.");
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: (failureCount, error) => error?.status !== 401 && failureCount < 1,
        refetchOnWindowFocus: true,
      },
    },
  });
}
