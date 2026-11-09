import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Bot, Coins, Gift, LogOut, Receipt, Wallet } from "lucide-react";
import { getHubState } from "@/lib/hub.functions";
import { shopWallet } from "@/lib/shop.functions";
import { publicSiteInfo } from "@/lib/site.functions";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account — Foxgen AI Store" },
      { name: "description", content: "Sign in with Telegram to see your orders, wallet balance, credits and licences." },
      { property: "og:title", content: "My Account — Foxgen AI Store" },
      { property: "og:description", content: "Your orders, wallet, credits and licences in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

const TOKEN_KEY = "foxgen_hub_token";

function AccountPage() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const fromUrl = new URL(window.location.href).searchParams.get("t");
    if (fromUrl) localStorage.setItem(TOKEN_KEY, fromUrl);
    setToken(fromUrl ?? localStorage.getItem(TOKEN_KEY) ?? "");
  }, []);
  const loadHub = useServerFn(getHubState);
  const loadWallet = useServerFn(shopWallet);
  const loadSite = useServerFn(publicSiteInfo);
  const hub = useQuery({ queryKey: ["account-hub", token], queryFn: () => loadHub({ data: { token: token! } }), enabled: !!token, retry: false });
  const wallet = useQuery({ queryKey: ["account-wallet", token], queryFn: () => loadWallet({ data: { token: token! } }), enabled: !!token && hub.isSuccess, retry: false });
  const site = useQuery({ queryKey: ["site-info"], queryFn: () => loadSite() });
  const botUser = site.data?.links.bot_username?.replace(/^@/, "");

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
  };

  const signedIn = !!token && hub.isSuccess;
  const p = hub.data?.profile;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="container-page py-10 sm:py-14">
        {token === null || (token && hub.isLoading) ? (
          <div className="h-64 animate-pulse rounded-3xl border border-border bg-card" />
        ) : !signedIn ? (
          <section className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-lift">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Bot className="size-6" /></span>
            <h1 className="mt-5 text-2xl font-bold">Sign in with Telegram</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your Foxgen account lives in our Telegram bot. Open the bot, tap <b>My account</b> and use the secure link it sends — you'll be signed in here automatically.
            </p>
            {token && hub.isError && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Your sign-in link has expired. Open the bot again to get a new one.</p>}
            {botUser ? (
              <a href={`https://t.me/${botUser}`} target="_blank" rel="noreferrer" className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                <Bot className="size-4" /> Open @{botUser}
              </a>
            ) : (
              <Link to="/support" className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">Contact support</Link>
            )}
          </section>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-ink font-display text-lg font-bold text-ink-foreground">{p?.initials}</span>
                <div>
                  <h1 className="text-2xl font-bold">{p?.name}</h1>
                  <p className="text-sm text-muted-foreground">{p?.username ? `@${p.username} · ` : ""}{p?.status === "active" ? "Verified member" : "Verification pending"}</p>
                </div>
              </div>
              <button type="button" onClick={signOut} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted">
                <LogOut className="size-4" /> Sign out
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link to="/shop" search={{ view: "orders" }} className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:border-primary/40">
                <Receipt className="size-5 text-primary" />
                <p className="mt-3 font-semibold">My orders</p>
                <p className="text-sm text-muted-foreground">Track payment and delivery</p>
              </Link>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <Wallet className="size-5 text-primary" />
                <p className="mt-3 font-semibold">Wallet</p>
                <p className="font-display text-2xl font-bold tabular-nums">{wallet.data ? `$${wallet.data.balance.toFixed(2)}` : "—"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <Coins className="size-5 text-primary" />
                <p className="mt-3 font-semibold">Credits</p>
                <p className="font-display text-2xl font-bold tabular-nums">{p?.credits_available ?? 0}</p>
                <p className="text-xs text-muted-foreground">{hub.data?.verifiedReferrals ?? 0} verified referrals</p>
              </div>
              <Link to="/hub" className="rounded-2xl bg-ink p-5 text-ink-foreground shadow-soft">
                <Gift className="size-5" />
                <p className="mt-3 font-semibold">Free rewards</p>
                <p className="text-sm opacity-80">Tasks, invites and licences →</p>
              </Link>
            </div>
            {hub.data && hub.data.licenses.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <h2 className="text-lg font-semibold">My licences</h2>
                <ul className="mt-4 divide-y divide-border">
                  {hub.data.licenses.map((l) => (
                    <li key={l.license_key} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                      <span className="font-mono">{l.license_key}</span>
                      <span className="text-muted-foreground">{l.reward_name} · {l.duration_days} days · {l.status}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
