// Fetch wrapper used by every page and by AuthContext.
// Exports: api (get/post/put/patch/delete), getToken/setToken/clearToken,
// setOnUnauthorized, ApiError.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'brandlens_token';

// A review can take ~20 s with AI, and a free Render server needs up to a minute to
// wake up after being idle. Longer than this, the request is given up with a clear message.
const TIMEOUT_MS = 60000;

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage blocked: the session just will not survive a reload */
  }
}
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// AuthContext registers its logout here, so an expired token (401) logs the user out.
let onUnauthorized = null;
export function setOnUnauthorized(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError') {
      throw new ApiError(
        'The server took too long to answer. Free servers sleep when idle, so wait a minute and try again.',
        0
      );
    }
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  let data = null;
  try {
    data = await res.json(); // 204 (delete) has no body
  } catch {
    /* empty or non-JSON body */
  }

  if (!res.ok) {
    // A 401 while holding a token means it expired or is invalid: log out.
    // A 401 with no token (wrong password on the login form) just shows its message.
    if (res.status === 401 && token) {
      clearToken();
      if (onUnauthorized) onUnauthorized();
    }
    // 502/503/504 come from the hosting proxy (an HTML page, not our JSON) while the
    // server is starting up or restarting.
    const proxyDown = [502, 503, 504].includes(res.status) && !data?.message;
    throw new ApiError(
      data?.message ||
        (proxyDown
          ? 'The server is starting up or unavailable. Wait a minute and try again.'
          : `Request failed (${res.status})`),
      res.status
    );
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
