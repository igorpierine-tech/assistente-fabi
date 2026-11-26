const API_BASE = process.env.NEXT_PUBLIC_LMS_API_URL || "http://localhost:3002";

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

let _refreshFn: (() => Promise<string | null>) | null = null;
let _refreshPromise: Promise<string | null> | null = null;

export function setTokenRefresh(fn: (() => Promise<string | null>) | null) {
  _refreshFn = fn;
}

async function doFetch<T>(path: string, opts: ApiOptions): Promise<{ data: T; ok: boolean; status: number }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  return { data, ok: res.ok, status: res.status };
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { data, ok, status } = await doFetch<T>(path, opts);

  if (!ok) {
    if (status === 401 && opts.token && _refreshFn) {
      if (!_refreshPromise) {
        _refreshPromise = _refreshFn().finally(() => { _refreshPromise = null; });
      }
      const newToken = await _refreshPromise;
      if (newToken) {
        const retry = await doFetch<T>(path, { ...opts, token: newToken });
        if (retry.ok) return retry.data;
        throw new ApiError((retry.data as Record<string, string>)?.error || "Erro desconhecido", retry.status, retry.data);
      }
    }
    throw new ApiError((data as Record<string, string>)?.error || "Erro desconhecido", status, data);
  }

  return data;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}
