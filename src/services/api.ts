export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (typeof err === 'object' && err !== null && 'name' in err && (err as { name?: string }).name === 'AbortError')
  );
}

export interface RawApiResponseInput {
  path: string;
  status: number;
  ok: boolean;
  contentType: string;
  rawText: string;
}

export function parseApiResponsePayload<T>(input: RawApiResponseInput): T {
  const { path, status, ok, contentType, rawText } = input;
  const normalizedType = (contentType || '').toLowerCase();
  const trimmed = (rawText || '').trim();
  const isApiPath = path === '/api' || path.startsWith('/api/');
  const looksLikeJsonContentType =
    normalizedType.includes('application/json') || normalizedType.includes('+json');
  const looksLikeHtml =
    normalizedType.includes('text/html') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html');

  // If the server returned HTML or non-JSON content for an /api/* endpoint
  if (!looksLikeJsonContentType || looksLikeHtml) {
    // Some reverse proxies return JSON without Content-Type only when status is JSON-shaped
    if (!looksLikeHtml && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
      try {
        const parsedFallback = JSON.parse(trimmed) as {
          ok?: boolean;
          code?: string;
          error?: string;
          message?: string;
          details?: unknown;
        };
        if (!ok || parsedFallback.ok === false) {
          throw new ApiError(
            status,
            parsedFallback.code || 'API_ERROR',
            parsedFallback.error || parsedFallback.message || `Request failed (${status}).`,
            parsedFallback.details,
          );
        }
        return parsedFallback as unknown as T;
      } catch (err) {
        if (err instanceof ApiError) throw err;
      }
    }

    if (!ok) {
      const hint =
        status === 502 || status === 503 || status === 504
          ? 'Backend catalog service is temporarily unreachable or starting up.'
          : looksLikeHtml
            ? `API endpoint returned an HTML error page (HTTP ${status}).`
            : `Request failed with status ${status}.`;
      throw new ApiError(status, 'HTTP_ERROR', hint);
    }

    if (isApiPath) {
      throw new ApiError(
        502,
        'INVALID_API_RESPONSE',
        looksLikeHtml
          ? 'Backend API returned an HTML page instead of JSON. Ensure the Express API server is running and handling /api/* routes.'
          : 'Server returned an unexpected non-JSON response.',
      );
    }

    return rawText as unknown as T;
  }

  if (!trimmed) {
    if (!ok) {
      throw new ApiError(status, 'EMPTY_ERROR_RESPONSE', `Server returned an empty error response (HTTP ${status}).`);
    }
    if (isApiPath) {
      throw new ApiError(502, 'EMPTY_API_RESPONSE', 'Server returned an empty JSON response.');
    }
    return {} as T;
  }

  let data: {
    ok?: boolean;
    code?: string;
    error?: string;
    message?: string;
    details?: unknown;
  };

  try {
    data = JSON.parse(trimmed) as typeof data;
  } catch {
    throw new ApiError(
      status >= 400 ? status : 502,
      'MALFORMED_JSON_RESPONSE',
      'Server returned malformed JSON data.',
    );
  }

  if (!ok || data.ok === false) {
    throw new ApiError(
      status,
      data.code || 'API_ERROR',
      data.error || data.message || `Request failed (${status})`,
      data.details,
    );
  }

  return data as unknown as T;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> | undefined),
  };

  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'include',
      cache: options.cache ?? 'no-store',
      headers,
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw err;
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach NOVARA servers. Please check your network connection.');
  }

  const rawText = await response.text();
  const contentType = response.headers.get('content-type') || '';

  return parseApiResponsePayload<T>({
    path,
    status: response.status,
    ok: response.ok,
    contentType,
    rawText,
  });
}
