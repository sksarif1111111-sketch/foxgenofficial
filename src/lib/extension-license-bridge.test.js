import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../extension-foxgen-540/foxgen-license-bridge.js', import.meta.url), 'utf8');
function adapter(result, status = 200, fail = false) {
  const calls = [];
  const context = vm.createContext({ URL, Request, Response, AbortSignal, fetch: async (url, init) => {
    calls.push({ url: String(url), init });
    if (fail) throw new Error('offline');
    return Response.json(result, { status });
  } });
  vm.runInContext(source, context);
  return { fetch: context.fetch, calls };
}
const activate = (bridge) => bridge.fetch('https://ai.127hub.com/api/validate-license', {
  method: 'POST', body: JSON.stringify({ license_key: 'FG-TEST-540', device_id: 'test-device' }),
});

test('5.40 uses the existing FoxGEN panel and its real licence session', async () => {
  const b = adapter({ ok: true, valid: true, session_id: 'panel-session', expires_at: '2026-12-01T00:00:00Z' });
  const result = await (await activate(b)).json();
  expect(b.calls[0]?.url).toBe('https://foxgenofficial.lovable.app/api/public/license/verify');
  expect(JSON.parse(b.calls[0]?.init.body ?? '{}')).toEqual({ licenseKey: 'FG-TEST-540', deviceId: 'test-device' });
  expect(result.session_id).toBe('panel-session');
  expect(result.expires_at).toBe('2026-12-01T00:00:00Z');
  expect(result.valid).toBe(true);
});
for (const state of ['invalid', 'expired', 'blocked']) {
  test(`5.40 denies ${state} keys with the panel's message`, async () => {
    const b = adapter({ ok: false, valid: false, status: state, message: `Licence ${state}` }, 401);
    const response = await activate(b);
    expect(response.status).toBe(401);
    const result = await response.json();
    expect(result.valid).toBe(false);
    expect(result.error).toBe(`Licence ${state}`);
    expect(b.calls.length).toBe(1);
  });
}
test('network failure cannot activate or fall back to the old licence provider', async () => {
  const b = adapter({}, 200, true);
  const response = await activate(b);
  expect(response.status).toBe(503);
  expect((await response.json()).valid).toBe(false);
  expect(b.calls.length).toBe(1);
});
test('credit balance and spending go to the FoxGEN panel, not the old provider', async () => {
  const b = adapter({ ok: true, credits: 300 });
  const response = await b.fetch('https://bundlee.store/api/credits/balance', {
    method: 'POST', headers: { Authorization: 'Bearer FG-KEY-1', 'Content-Type': 'application/json' },
    body: JSON.stringify({ license_key: 'FG-KEY-1' }),
  });
  expect(b.calls[0]?.url).toBe('https://foxgenofficial.lovable.app/api/public/license/credits-balance');
  expect(b.calls[0]?.init.headers.Authorization).toBe('Bearer FG-KEY-1');
  expect(JSON.parse(b.calls[0]?.init.body ?? '{}')).toEqual({ license_key: 'FG-KEY-1' });
  expect((await response.json()).credits).toBe(300);
});
test('a refused credit spend keeps its status and message', async () => {
  const b = adapter({ ok: false, error: 'insufficient_credits', credits: 0 }, 402);
  const response = await b.fetch('https://ai.127hub.com/api/credits/deduct', {
    method: 'POST', body: JSON.stringify({ license_key: 'FG-KEY-1', amount: 1, reason: 'prompt' }),
  });
  expect(b.calls[0]?.url).toBe('https://foxgenofficial.lovable.app/api/public/license/credits-deduct');
  expect(response.status).toBe(402);
  expect((await response.json()).error).toBe('insufficient_credits');
});
test('credit calls cannot fall back to the old provider when FoxGEN is unreachable', async () => {
  const b = adapter({}, 200, true);
  const response = await b.fetch('https://bundlee.store/api/credits/deduct', { method: 'POST', body: '{}' });
  expect(response.status).toBe(503);
  expect(b.calls.length).toBe(1);
  expect(b.calls[0]?.url).toBe('https://foxgenofficial.lovable.app/api/public/license/credits-deduct');
});
test('the background licence heartbeat is checked by the FoxGEN panel', async () => {
  const b = adapter({ ok: true, valid: true });
  await b.fetch('https://bundlee.store/api/public/ext/compat/functions/v1/validate-license', {
    method: 'POST', body: JSON.stringify({ license_key: 'FG-KEY-1', heartbeat: true, device_id: 'd1' }),
  });
  expect(b.calls[0]?.url).toBe('https://foxgenofficial.lovable.app/api/public/license/verify');
  expect(JSON.parse(b.calls[0]?.init.body ?? '{}')).toEqual({ licenseKey: 'FG-KEY-1', deviceId: 'd1' });
});
test('other requests and unrelated URLs remain unchanged', async () => {
  const b = adapter({});
  const url = 'https://bundlee.store/api/extension_versions';
  await b.fetch(url);
  expect(b.calls[0]?.url).toBe(url);
  await b.fetch('https://example.com/api/validate-license');
  expect(b.calls[1]?.url).toBe('https://example.com/api/validate-license');
  await b.fetch('https://example.com/api/credits/balance');
  expect(b.calls[2]?.url).toBe('https://example.com/api/credits/balance');
});
