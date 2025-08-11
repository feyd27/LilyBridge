// public/js/authFetch.js

// 1) Keep the native fetch around for other uses
export const origFetch = window.fetch.bind(window);

// Public pages & endpoints where a 401 MUST NOT trigger a redirect
const PUBLIC_PAGES = ['/login', '/register', '/verify-email', '/forgot-password'];
const PUBLIC_API_PATHS = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/verify-email',
  '/api/auth/request-reset',
  '/api/auth/reset',
  '/api/public/refresh'
];

// helper: is this call/page public?
function isPublicContext(input) {
  const onPublicPage = PUBLIC_PAGES.includes(location.pathname);
  let path = '';

  if (typeof input === 'string') {
    try {
      const u = new URL(input, location.origin);
      path = u.pathname;
    } catch {
      path = input; // relative path
    }
  } else if (input && typeof input.url === 'string') {
    // Request object
    try {
      const u = new URL(input.url, location.origin);
      path = u.pathname;
    } catch {
      path = input.url;
    }
  }

  const isPublicApi = PUBLIC_API_PATHS.some(p => path.startsWith(p));
  return onPublicPage || isPublicApi;
}

/**
 * A drop-in replacement for fetch() that:
 *  • logs request + response (collapsed groups)
 *  • attaches the access token (if present)
 *  • on 401 tries /api/public/refresh and retries once
 *  • DOES NOT redirect on 401 for public pages/endpoints
 *
 * You can also opt-out per-call with { anonymousOk: true } in init.
 */
export async function fetchWithAuth(input, init = {}) {
  console.groupCollapsed('[🚨 fetch]', input);
  console.log('→ options:', init);

  // custom flag to force public behavior per-call
  const anonymousOk = init.anonymousOk === true;
  if ('anonymousOk' in init) delete init.anonymousOk;

  const publicCtx = anonymousOk || isPublicContext(input);

  // ensure we have a headers object
  init.headers = init.headers || {};
  if (init.body && !init.headers['Content-Type']) {
    init.headers['Content-Type'] = 'application/json';
  }

  // attach (possibly stale) access token if present
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    init.headers.Authorization = `Bearer ${accessToken}`;
  }

  console.log('  ↳ outgoing headers:', init.headers);
  console.groupEnd();

  // ─── first attempt ────────────────────────────────────────────────────────
  let res = await origFetch(input, init);
  console.groupCollapsed('[🚨 fetch]', input, '(response)');
  console.log('← status:', res.status);
  console.groupEnd();

  // ─── on 401 → optionally try refresh ──────────────────────────────────────
  if (res.status === 401) {
    // On public pages/endpoints, do NOT redirect. Just return the 401.
    if (publicCtx) {
      console.warn('[fetchWithAuth] 401 in public context, not redirecting');
      return res;
    }

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      console.warn('[fetchWithAuth] no refreshToken, redirecting to login');
      window.location.href = '/login';
      return res;
    }

    // build refresh call
    const refreshInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Refresh-Token': refreshToken
      },
      body: JSON.stringify({ refreshToken })
    };

    console.groupCollapsed('[🚨 fetch]', '/api/public/refresh');
    console.log('→ options:', refreshInit);
    const refreshRes = await origFetch('/api/public/refresh', refreshInit);
    console.log('← status:', refreshRes.status);
    console.groupEnd();

    if (refreshRes.ok) {
      const payload = await refreshRes.json();
      if (payload.accessToken)  localStorage.setItem('accessToken', payload.accessToken);
      if (payload.refreshToken) localStorage.setItem('refreshToken', payload.refreshToken);

      // retry original with the brand-new access token
      init.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;

      console.groupCollapsed('[🚨 fetch]', input, '(retry)');
      console.log('→ options:', init);
      res = await origFetch(input, init);
      console.log('← status:', res.status);
      console.groupEnd();
    } else {
      console.warn('[fetchWithAuth] refresh failed');
      window.location.href = '/login';
      return res;
    }
  }

  return res;
}
