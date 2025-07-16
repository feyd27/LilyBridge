// public/js/authFetch.js

// 1) Keep the native fetch around for other uses
export const origFetch = window.fetch.bind(window);

/**
 * A drop-in replacement for fetch() that:
 *  • logs request + response (collapsed groups)
 *  • attaches the access token
 *  • on 401 tries /api/auth/refresh
 *  • retries the original request once
 */
export async function fetchWithAuth(input, init = {}) {
  console.groupCollapsed('[🚨 fetch]', input);
  console.log('→ options:', init);

  // ensure we have a headers object
  init.headers = init.headers || {};

  // if there's a body and no content-type, assume JSON
  if (init.body && !init.headers['Content-Type']) {
    init.headers['Content-Type'] = 'application/json';
  }

  // attach (possibly stale) access token
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    init.headers.Authorization = `Bearer ${accessToken}`;
  }

  console.log(`  ↳ outgoing headers:`, init.headers);
  console.groupEnd();

  // ─── first attempt ────────────────────────────────────────────────────────
  let res = await origFetch(input, init);
  console.groupCollapsed('[🚨 fetch]', input, '(response)');
  console.log('← status:', res.status);
  console.groupEnd();

  // ─── on 401 → try a single refresh ─────────────────────────────────────────
  if (res.status === 401) {
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
      // refresh failed—force logout
      window.location.href = '/login';
    }
  }

  return res;
}


