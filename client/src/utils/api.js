const API_BASE = 'http://localhost:3001/api';

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, config);

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));

    // Only treat 401 as "session expired" for authenticated requests,
    // not for the login/signup attempt itself
    const isAuthEndpoint = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/signup');
    if (res.status === 401 && token && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return;
    }

    throw new Error(error.message || 'Request failed');
  }

  return res.json();
}