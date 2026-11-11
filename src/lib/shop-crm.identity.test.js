import { test, expect } from "bun:test";
// Integration checks exercise the actual identity function installed in the database.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const integration = url && key ? test : test.skip;
async function identity(profile, customer, email, telegram) {
  const response = await fetch(`${url}/rest/v1/rpc/shop_crm_customer_id`, {
    method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ _profile: profile, _customer: customer, _emails: email, _telegram: telegram }),
  });
  expect(response.ok).toBe(true);
  return response.json();
}
const profile = "b1111111-1111-4111-8111-111111111111";
const customer = "c1111111-1111-4111-8111-111111111111";
integration("profile ID takes precedence over email and Telegram", async () => {
  expect(await identity(profile, customer, "buyer@example.com", 123)).toBe(profile);
});
integration("verified website account without profile keeps stable account UUID across email changes", async () => {
  expect(await identity(null, customer, "first@example.com", null)).toBe(customer);
  expect(await identity(null, customer, "second@example.com", null)).toBe(customer);
});
integration("email fallback normalizes case and spaces before Telegram fallback", async () => {
  const expected = "e246ddaf-8fca-e9ec-ce8a-1739d5ee1c86";
  expect(await identity(null, null, " Buyer@Example.com , second@example.com", 123)).toBe(expected);
  expect(await identity(null, null, "buyer@example.com", 456)).toBe(expected);
});
integration("Telegram fallback is deterministic when no email or account exists", async () => {
  expect(await identity(null, null, null, 123)).toBe("efa59dbd-ed14-45b1-bb5d-d0dd9aa2642e");
});