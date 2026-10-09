const API_BASE = '/api';

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('dk_auth_token');
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('dk_auth_token');
    localStorage.removeItem('dk_auth_user');
    window.dispatchEvent(new Event('auth_state_change'));
    throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
  }

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Bir hata oluştu');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  get: (endpoint, params = {}) => {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, v);
      }
    }
    const qs = query.toString();
    return request(qs ? `${endpoint}?${qs}` : endpoint, { method: 'GET' });
  },

  post: (endpoint, body) => {
    return request(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  put: (endpoint, body) => {
    return request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  delete: (endpoint, body = {}) => {
    return request(endpoint, {
      method: 'DELETE',
      body: JSON.stringify(body),
    });
  },

  patch: (endpoint, body) => {
    return request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  upload: (endpoint, formData) => {
    return request(endpoint, {
      method: 'POST',
      body: formData,
    });
  },
};
