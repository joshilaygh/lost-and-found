const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export default API_BASE;
