/** Only read-only screens may be acknowledged after an error screen is delivered. */
export function isReadOnlyBotAction(action: string) {
  return /^(?:shop(?::\d+)?|wallet|walletlog|rewards|menu|home|categories|category:[a-z_]+|prod:[a-f0-9-]+|storeprofile|profile|myorders(?::\d+)?|order:[a-f0-9-]+)$/.test(action);
}

export function botFailureMessage(message: string) {
  if (/DIGIHUP.*(?:key|unauthorized|forbidden|authentication)/i.test(message)) {
    return 'DIGIHUP rejected its API key. The owner must update the DIGIHUP connection. Other store options remain available.';
  }
  return 'This option is temporarily unavailable. Please try again or contact Support. Other store options remain available.';
}