"use client";

import { useState, useCallback } from "react";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { toast } from "sonner";

type MutationOptions<T> = {
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
  successMessage?: string;
  errorMessage?: string;
};

export function useMutation<T = unknown>() {
  const [loading, setLoading] = useState(false);

  const mutate = useCallback(
    async (
      input: RequestInfo | URL,
      init?: RequestInit,
      options?: MutationOptions<T>
    ): Promise<{ data: T | null; error: string | null }> => {
      setLoading(true);

      try {
        const response = await fetchWithRetry(input, init, {
          maxRetries: 3,
          retryDelay: 1000,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const error = body.error || `HTTP ${response.status}`;

          if (options?.onError) {
            options.onError(error);
          } else {
            toast.error(options?.errorMessage || error);
          }

          return { data: null, error };
        }

        const data = await response.json();

        if (options?.onSuccess) {
          options.onSuccess(data);
        }
        if (options?.successMessage) {
          toast.success(options.successMessage);
        }

        return { data, error: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Network error";

        if (options?.onError) {
          options.onError(message);
        } else {
          toast.error(options?.errorMessage || "Kết nối thất bại, vui lòng thử lại");
        }

        return { data: null, error: message };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { mutate, loading };
}
