// Talks to the server. Keeps the login token in localStorage.

const KEY = 'tradesim_token';

export const session = {
  get token() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
  set(t) { try { localStorage.setItem(KEY, t); } catch (e) { /* private mode */ } },
  clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } },
};

export async function api(path, { method = 'GET', body } = {}) {
  const token = session.token;
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  let data = {};
  try { data = await res.json(); } catch (e) { /* empty body */ }

  if (!res.ok) {
    // Expired / invalid token on a protected call -> send the user back to login.
    if (res.status === 401 && token && !path.startsWith('/auth')) {
      window.dispatchEvent(new CustomEvent('tradesim:expired', { detail: data.error }));
    }
    const err = new Error(data.error || 'Something went wrong. Please try again.');
    err.status = res.status;
    throw err;
  }
  return data;
}
