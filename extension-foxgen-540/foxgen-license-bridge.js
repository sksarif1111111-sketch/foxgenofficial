/* FoxGEN Pro 5.40 licence adapter. Original feature bundles stay unchanged. */
(() => {
  'use strict';
  const storeOrigin = 'https://foxgenofficial.lovable.app';
  const verifyUrl = storeOrigin + '/api/public/license/verify';
  // Credit balance and spending are kept by the FoxGEN licence panel, never by the old provider.
  const creditRoutes = {
    '/api/credits/balance': storeOrigin + '/api/public/license/credits-balance',
    '/api/credits/deduct': storeOrigin + '/api/public/license/credits-deduct',
  };
  const verifyPaths = new Set(['/api/validate-license', '/api/public/ext/compat/functions/v1/validate-license']);
  const originalFetch = globalThis.fetch.bind(globalThis);
  const providerHosts = new Set(['ai.127hub.com', 'bundlee.store']);

  globalThis.fetch = async (input, init) => {
    let url;
    try { url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url); }
    catch (_) { return originalFetch(input, init); }
    if (providerHosts.has(url.hostname) && creditRoutes[url.pathname]) {
      try {
        const request = new Request(input, init);
        const body = await request.text();
        const headers = { 'Content-Type': 'application/json' };
        const auth = request.headers.get('Authorization');
        if (auth) headers.Authorization = auth;
        const upstream = await originalFetch(creditRoutes[url.pathname], {
          method: 'POST', headers, body, cache: 'no-store', credentials: 'omit',
          signal: AbortSignal.timeout(15000),
        });
        return new Response(await upstream.text(), {
          status: upstream.status,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      } catch (_) {
        return new Response(JSON.stringify({
          ok: false, success: false, error: 'network_error',
          message: 'Cannot reach FoxGEN. Please try again.',
        }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      }
    }
    if (!providerHosts.has(url.hostname) || !verifyPaths.has(url.pathname)) {
      return originalFetch(input, init);
    }

    try {
      const request = new Request(input, init);
      const body = await request.json();
      const key = String(body.license_key || body.licenseKey || body.key || '').trim();
      const device = String(body.device_id || body.deviceId || '').slice(0, 200);
      const response = await originalFetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key, deviceId: device }),
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      // Preserve the panel's real verdict, expiry and session. Never create an activation locally.
      const valid = response.ok && result.ok === true && result.valid === true;
      return new Response(JSON.stringify({
        ...result,
        ok: valid,
        valid,
        success: valid,
        username: result.user_name || '',
        error: valid ? undefined : (result.message || 'FoxGEN licence verification failed.'),
      }), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    } catch (_) {
      // A network failure must not fall back to the previous licence provider or unlock the tools.
      return new Response(JSON.stringify({
        ok: false, valid: false, success: false, status: 'error',
        error: 'Cannot reach FoxGEN. Please try again.',
        message: 'Cannot reach FoxGEN. Please try again.',
      }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
  };
})();