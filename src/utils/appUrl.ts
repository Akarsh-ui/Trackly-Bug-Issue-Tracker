export function getFrontendBaseUrl(): string {
  const configured =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL
      ? String(import.meta.env.VITE_APP_URL).trim().replace(/\/+$/, '')
      : '';

  if (configured && /^https?:\/\//i.test(configured)) {
    return configured;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }

  return '';
}

export function buildInvitationUrl(invitePathOrToken: string): string {
  const cleaned = String(invitePathOrToken || '').trim();
  if (!cleaned) return '';

  const path = cleaned.startsWith('/invite/')
    ? cleaned
    : cleaned.startsWith('/')
      ? cleaned
      : `/invite/${encodeURIComponent(cleaned)}`;

  const base = getFrontendBaseUrl();
  return base ? `${base}${path}` : path;
}
