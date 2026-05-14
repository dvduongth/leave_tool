type FetchRetryOptions = {
  maxRetries?: number;
  retryDelay?: number;
  retryOn?: (response: Response, error: Error | null) => boolean;
};

const DEFAULT_OPTIONS: Required<FetchRetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  retryOn: (response, error) => {
    if (error) return true;
    return response.status >= 500 || response.status === 429;
  },
};

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: FetchRetryOptions
): Promise<Response> {
  const { maxRetries, retryDelay, retryOn } = { ...DEFAULT_OPTIONS, ...options };

  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(input, init);

      if (!retryOn(response, null) || attempt === maxRetries) {
        return response;
      }

      lastResponse = response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!retryOn(new Response(null, { status: 0 }), lastError) || attempt === maxRetries) {
        throw lastError;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
  }

  if (lastResponse) return lastResponse;
  throw lastError ?? new Error("Fetch failed after retries");
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: FetchRetryOptions
): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const response = await fetchWithRetry(input, init, options);
    const status = response.status;

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { data: null, error: body.error || `HTTP ${status}`, status };
    }

    const data = await response.json();
    return { data, error: null, status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return { data: null, error: message, status: 0 };
  }
}
