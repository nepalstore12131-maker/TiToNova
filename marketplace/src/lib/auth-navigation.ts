/** Accept only local non-auth destinations, including after an existing session is detected. */
export function safeAuthDestination(candidate: string | null | undefined): string {
  const fallback = '/dashboard';
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  try {
    const origin = 'https://titonova.invalid';
    const url = new URL(candidate, origin);
    const pathname = decodeURIComponent(url.pathname);
    if (url.origin !== origin || pathname.includes('\\') || /^\/(?:login|employer\/login|admin\/login|signup|forgot-password|reset-password|auth)(?:\/|$)/.test(pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}

/** Production aliases must use one host. Preview deployments and localhost stay independent. */
export function canonicalSiteUrl(requestUrl: string, method = 'GET'): string | null {
  if (!['GET', 'HEAD'].includes(method)) return null;
  const url = new URL(requestUrl);
  if (!['titonova.vercel.app', 'titonova.com'].includes(url.hostname)) return null;
  url.protocol = 'https:';
  url.host = 'www.titonova.com';
  url.port = '';
  return url.toString();
}
