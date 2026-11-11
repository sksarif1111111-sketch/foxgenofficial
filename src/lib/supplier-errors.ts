/** Never relay a supplier response body: it may contain credentials. */
export function supplierFailure(status: number, provider: string, body: Record<string, unknown> | null) {
  const reason = [body?.['error'], body?.['message'], body?.['detail']].filter(v => typeof v === 'string').join(' ');
  if (status === 401 || status === 403 || /invalid.*(?:api.?key|token)|unauthori[sz]ed|(?:api.?key|token).*(?:invalid|expired|revoked)/i.test(reason)) {
    return `${provider} rejected the API key. Update the provider credential; other suppliers and bot menus remain available.`;
  }
  if (status === 429) return `${provider} rate limit reached. Try again later.`;
  if (status >= 500) return `${provider} is temporarily unavailable (${status}).`;
  return `${provider} returned an unexpected response (${status}).`;
}