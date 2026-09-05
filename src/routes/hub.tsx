import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { completeTask, getHubState, redeemReward, verifyMembership, type HubState } from "@/lib/hub.functions";

export const Route = createFileRoute("/hub")({
  head: () => ({
    meta: [
      { title: "FoxGEN PRO Rewards Hub — Earn. Refer. Unlock." },
      {
        name: "description",
        content:
          "Invite friends, collect credits and unlock free FoxGEN Pro extension licenses from your rewards dashboard.",
      },
      { property: "og:title", content: "FoxGEN PRO Rewards Hub" },
      { property: "og:description", content: "Earn credits with referrals and unlock free extension licenses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HubPage,
});

const TABS = [
  "Dashboard",
  "Invite",
  "Tasks",
  "Store",
  "My Licenses",
  "Credits",
  "Leaderboard",
  "Download",
] as const;
type Tab = (typeof TABS)[number];

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}

function HubPage() {
  const load = useServerFn(getHubState);
  const done = useServerFn(completeTask);
  const verify = useServerFn(verifyMembership);
  const redeem = useServerFn(redeemReward);

  const [token, setToken] = useState("");
  const [state, setState] = useState<HubState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState<{ license_key: string; duration_days: number; credits_used: number } | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("t");
    const stored = localStorage.getItem("foxgen_hub_token");
    const t = fromUrl || stored || "";
    if (fromUrl) localStorage.setItem("foxgen_hub_token", fromUrl);
    setToken(t);
  }, []);

  const refresh = useCallback(
    async (t: string) => {
      if (!t) return;
      try {
        setState(await load({ data: { token: t } }));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load your account.");
      }
    },
    [load],
  );

  useEffect(() => {
    void refresh(token);
  }, [token, refresh]);

  if (!token || error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="text-2xl font-black">FoxGEN PRO Rewards Hub</h1>
        <p className="text-sm text-muted-foreground">
          {error ?? "Open the Telegram bot, tap “My account” and use the web dashboard link to sign in."}
        </p>
        <input
          placeholder="Paste your access token"
          className="rounded-xl border border-border bg-background px-4 py-3 text-sm"
          onChange={(e) => {
            const t = e.target.value.trim();
            if (t.length > 20) {
              localStorage.setItem("foxgen_hub_token", t);
              setError(null);
              setToken(t);
            }
          }}
        />
      </main>
    );
  }

  if (!state) return <main className="p-10 text-sm text-muted-foreground">Loading…</main>;

  const links = state.links;
  const shareMessage = `🦊 Join FoxGEN PRO Rewards Hub!\n\n🎁 Earn FREE Lovable Unlimited Extension licenses.\n\nComplete tasks, invite friends and earn credits.\n\nJoin using my referral link:\n${state.referralLink}`;
  const encodedMessage = encodeURIComponent(shareMessage);

  async function run(fn: () => Promise<string | void>) {
    setBusy(true);
    try {
      const msg = await fn();
      if (msg) setFlash(msg);
      await refresh(token);
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-lg font-black text-primary">
            {state.profile.initials}
          </div>
          <div>
            <h1 className="text-3xl font-black">🦊 {links["brand_name"] || "FoxGEN PRO Rewards Hub"}</h1>
            <p className="text-sm font-semibold">{state.profile.name}{state.profile.username ? ` · @${state.profile.username}` : ""}</p>
            <p className="text-sm text-muted-foreground">{links["brand_description"] || "Earn. Refer. Unlock."}</p>
          </div>
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-2 text-xs font-bold ${
              tab === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {flash && <p className="mb-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm">{flash}</p>}

      {tab === "Dashboard" && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Available credits" value={state.profile.credits_available} />
          <Card label="Total earned" value={state.profile.credits_earned} />
          <Card label="Total spent" value={state.profile.credits_spent} />
          <Card label="Valid referrals" value={state.verifiedReferrals} />
          <Card label="Bonus credits" value={state.bonusCredits} />
          <Card label="Pending referrals" value={state.pendingReferrals} />
          <Card label="Status" value={state.profile.status} />
          {state.announcements.map((a) => (
            <div key={a.title} className="rounded-2xl border border-border bg-card/60 p-5 sm:col-span-2 lg:col-span-4">
              <p className="font-bold">{a.title}</p>
              <p className="text-sm text-muted-foreground">{a.message}</p>
              {a.button_url && (
                <a className="mt-2 inline-block text-sm font-semibold text-primary" href={a.button_url}>
                  {a.button_text || "Open"}
                </a>
              )}
            </div>
          ))}
        </section>
      )}

      {tab === "Invite" && (
        <section className="rounded-2xl border border-border bg-card/60 p-6">
          <h2 className="text-xl font-black">👥 Invite & Earn</h2>
          <p className="mt-1 text-sm text-muted-foreground">1 verified referral = 1 credit.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Card label="Valid referrals" value={state.verifiedReferrals} />
            <Card label="Available credits" value={state.profile.credits_available} />
            <Card label="Referral code" value={state.profile.referral_code} />
          </div>
          <p className="mt-5 text-xs font-bold uppercase text-muted-foreground">Your referral link</p>
          <p className="mt-2 break-all rounded-xl bg-muted/40 px-4 py-3 font-mono text-sm">{state.referralLink}</p>
          {state.nextReward && (
            <div className="mt-5">
              <div className="flex justify-between text-sm">
                <span>Next reward: <b>{state.nextReward.name}</b></span>
                <span>{state.nextReward.progress} / {state.nextReward.credit_cost} credits</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (state.nextReward.progress / state.nextReward.credit_cost) * 100)}%` }} />
              </div>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={`https://t.me/share/url?url=${encodeURIComponent(state.referralLink)}&text=${encodeURIComponent(shareMessage.replace(state.referralLink, ""))}`} target="_blank" rel="noreferrer" className="rounded-xl border border-border px-4 py-2 text-xs font-bold">Telegram Share</a>
            <a href={`https://wa.me/?text=${encodedMessage}`} target="_blank" rel="noreferrer" className="rounded-xl border border-border px-4 py-2 text-xs font-bold">WhatsApp Share</a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(state.referralLink)}`} target="_blank" rel="noreferrer" className="rounded-xl border border-border px-4 py-2 text-xs font-bold">Facebook Share</a>
            <button onClick={() => navigator.clipboard.writeText(state.referralLink).then(() => setFlash("Referral link copied"))} className="rounded-xl bg-primary px-4 py-2 text-xs font-black text-primary-foreground">Copy Referral Link</button>
          </div>
        </section>
      )}

      {tab === "Tasks" && (
        <section className="space-y-3">
          {state.tasks.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/60 p-4">
              <div className="flex-1">
                <p className="font-bold">
                  {t.completed ? "✅ " : "⬜ "}
                  {t.name}
                </p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
              {t.url && (
                <a
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                >
                  Open
                </a>
              )}
              {t.verification_type === "manual_confirmation" && !t.completed && (
                <button
                  disabled={busy}
                  onClick={() => run(async () => void (await done({ data: { token, taskId: t.id } })))}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  I completed this
                </button>
              )}
            </div>
          ))}
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const res = await verify({ data: { token } });
                return res.allDone ? "Verified — account active!" : `Still missing: ${res.missing.join(", ")}`;
              })
            }
            className="rounded-xl bg-accent px-5 py-3 text-xs font-black uppercase text-primary-foreground"
          >
            Verify membership
          </button>
        </section>
      )}

      {tab === "Store" && (
        <section className="space-y-5">
          {unlocked && (
            <div className="border border-primary bg-primary/10 p-6">
              <h2 className="text-2xl font-black">🎉 Congratulations!</h2>
              <p className="mt-1 text-sm">You successfully unlocked a FREE FoxGEN PRO reward!</p>
              <p className="mt-5 text-xs font-bold uppercase text-muted-foreground">Your Lovable Unlimited License</p>
              <p className="mt-2 break-all font-mono text-xl font-black text-primary">{unlocked.license_key}</p>
              <p className="mt-3 text-sm">📅 {unlocked.duration_days} Days · 💰 {unlocked.credits_used} Credits Used</p>
              <p className="mt-1 text-xs text-muted-foreground">Keep your license key safe.</p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => navigator.clipboard.writeText(unlocked.license_key).then(() => setFlash("License copied"))} className="rounded-lg bg-primary px-4 py-2 text-xs font-black text-primary-foreground">📋 Copy License</button>
                <button onClick={() => setTab("My Licenses")} className="rounded-lg border border-border px-4 py-2 text-xs font-black">🔑 My Licenses</button>
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
          {state.rewards.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card/60 p-6">
              <p className="text-xs font-black uppercase text-primary">{r.duration_days === 15 ? "🟢" : r.duration_days === 30 ? "🔵" : "🟣"} {r.duration_days} Days License</p>
              <p className="mt-3 text-sm text-muted-foreground">Lovable Unlimited Extension License</p>
              <p className="mt-5 text-3xl font-black">💰 {r.credit_cost}</p>
              <p className="text-xs text-muted-foreground">Credits</p>
              <button
                disabled={busy || state.profile.credits_available < r.credit_cost}
                onClick={() =>
                  run(async () => {
                    const row = await redeem({ data: { token, rewardId: r.id } });
                    setUnlocked(row);
                    return "License unlocked successfully.";
                  })
                }
                className="mt-4 w-full rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase text-primary-foreground"
              >
                🎁 Redeem Now
              </button>
            </div>
          ))}
          </div>
        </section>
      )}

      {tab === "My Licenses" && (
        <section className="space-y-2">
          {state.licenses.length === 0 && <p className="text-sm text-muted-foreground">No licenses yet.</p>}
          {state.licenses.map((l) => (
            <div key={l.license_key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/60 p-4">
              <div><p className="font-mono text-sm text-primary">{l.license_key}</p><p className="text-xs text-muted-foreground">{l.duration_days} days · {l.status} · {new Date(l.redeemed_at).toLocaleString()}</p></div>
              <button onClick={() => navigator.clipboard.writeText(l.license_key).then(() => setFlash("License copied"))} className="rounded-lg border border-border px-3 py-2 text-xs font-bold">📋 Copy</button>
            </div>
          ))}
        </section>
      )}

      {tab === "Credits" && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Card label="Available" value={state.profile.credits_available} />
            <Card label="Total earned" value={state.profile.credits_earned} />
            <Card label="Total spent" value={state.profile.credits_spent} />
            <Card label="Bonus credits" value={state.bonusCredits} />
          </div>
          <div className="space-y-2">
          {state.transactions.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-border bg-card/60 p-3 text-sm">
              <div><p>{t.description || t.transaction_type}</p><p className="text-xs text-muted-foreground">{t.transaction_type.replace(/_/g, " ")} · {new Date(t.created_at).toLocaleString()}</p></div>
              <span className={t.amount > 0 ? "font-bold text-primary" : "font-bold text-destructive"}>{t.amount > 0 ? `+${t.amount}` : t.amount}</span>
            </div>
          ))}
          </div>
        </section>
      )}

      {tab === "Leaderboard" && (
        <section className="space-y-2">
          {state.leaderboard.map((row, i) => (
            <div key={i} className="flex justify-between rounded-xl border border-border bg-card/60 p-3 text-sm">
              <span>
                #{i + 1} {row.name}
              </span>
              <span className="font-bold">{row.credits} credits</span>
            </div>
          ))}
        </section>
      )}

      {tab === "Download" && (
        <section className="border border-border bg-card/60 p-7 text-center">
          <h2 className="text-3xl font-black">🦊 {links["extension_name"] || "FoxGEN PRO Extension"}</h2>
          <p className="mt-2 text-sm">Lovable Unlimited Extension Experience</p>
          <p className="mt-1 text-xs font-bold uppercase text-primary">Premium Access • Unlimited Possibilities</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground"><span>Version {links["extension_version"] || "—"}</span>{links["extension_release_date"] && <span>Released {links["extension_release_date"]}</span>}</div>
          {links["extension_description"] && <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">{links["extension_description"]}</p>}
          <a
            href={`/foxgen-extension.zip?v=${encodeURIComponent(links["extension_version"] || "latest")}`}
            download={`FoxGEN-Pro-Extension-${links["extension_version"] || "latest"}.zip`}
            className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 text-xs font-black uppercase text-primary-foreground"
          >
            📥 Download Extension
          </a>
          <p className="mt-7 text-xs font-bold uppercase text-muted-foreground">Need help?</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm text-primary">
            {links["installation_guide_url"] && <a className="rounded-lg border border-border px-4 py-2" href={links["installation_guide_url"]}>📖 Installation Guide</a>}
            {links["tutorial_url"] && <a className="rounded-lg border border-border px-4 py-2" href={links["tutorial_url"]}>▶️ Video Tutorial</a>}
            {links["support_url"] && <a className="rounded-lg border border-border px-4 py-2" href={links["support_url"]}>💬 Contact Support</a>}
          </div>
        </section>
      )}
    </main>
  );
}
