/**
 * Browser-side HTTP client for the Mantra API.
 *
 * IMPORTANT — same-origin by design:
 *   All requests go to the Next.js origin (e.g. /api/clients), which
 *   `next.config.mjs#rewrites` reverse-proxies to the Go Fiber backend.
 *   This keeps the session cookie scope trivial: one origin, one
 *   HttpOnly cookie, no CORS dance. Never prepend an absolute URL here
 *   or you'll bleed the cookie and break auth.
 *
 * Error handling:
 *   - 401 → thrown as ApiError, caller should trigger a logout/redirect
 *   - 428 (PASSWORD_CHANGE_REQUIRED) → thrown; React layer redirects
 *     the user to /change-password (middleware does the same on nav).
 */

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(`API Error: ${status} ${statusText}`)
    this.name = 'ApiError'
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    // Global pit-stop for force-password-change: anywhere in the app
    // that calls the API will land here on 428 and get bounced to the
    // rotation page. This is belt-and-suspenders on top of the edge
    // middleware, which may not have seen the flag yet if the JWT was
    // issued mid-session.
    if (
      response.status === 428 &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/change-password'
    ) {
      window.location.href = '/change-password'
    }
    throw new ApiError(response.status, response.statusText, data)
  }
  // 204 No Content -> return {} as T
  if (response.status === 204) return {} as T
  return response.json()
}

// Always call same-origin; the rewrite in next.config.mjs forwards
// `/api/*` to the backend.
const base = ''

export const apiClient = {
  get: async <T>(endpoint: string): Promise<T> => {
    const response = await fetch(`${base}${endpoint}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    })
    return handleResponse<T>(response)
  },

  post: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    const response = await fetch(`${base}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: data ? JSON.stringify(data) : undefined,
    })
    return handleResponse<T>(response)
  },

  put: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    const response = await fetch(`${base}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: data ? JSON.stringify(data) : undefined,
    })
    return handleResponse<T>(response)
  },

  patch: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    const response = await fetch(`${base}${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: data ? JSON.stringify(data) : undefined,
    })
    return handleResponse<T>(response)
  },

  delete: async <T>(endpoint: string): Promise<T> => {
    const response = await fetch(`${base}${endpoint}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    })
    return handleResponse<T>(response)
  },
}

export { ApiError }
