const defaultApiBase = 'http://localhost:4000';

function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? defaultApiBase).replace(/\/$/, '');
}

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
